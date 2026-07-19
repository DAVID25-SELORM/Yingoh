import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Edit3, Eye, EyeOff, FilePlus, Filter,
  PlusCircle, Save, Trash2, Upload, X, XCircle,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { TOPICS } from '../data/topics';
import { DEMO_QUESTIONS } from '../data/demoQuestions';


const EMPTY_QUESTION = {
  topic: 'Pharmacology',
  minimum_plan: 'pro',
  question_type: 'mcq',
  prompt: '',
  choices: [
    { id: 'a', text: '' },
    { id: 'b', text: '' },
    { id: 'c', text: '' },
    { id: 'd', text: '' },
  ],
  correct_answer: { ids: [] },
  rationale: '',
  strategy: '',
  status: 'draft',
};

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const PAGE_SIZE = 100;
const LIST_COLUMNS = 'id,topic,question_type,prompt,status,minimum_plan,created_at';
const QUESTION_CACHE_PREFIX = 'nursefaculty.questionManager.page.v2';

function questionCacheKey(status, topic, pageNumber) {
  return `${QUESTION_CACHE_PREFIX}:${status}:${topic}:${pageNumber}`;
}

function clearQuestionCache() {
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(QUESTION_CACHE_PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Cache is only a speed boost; ignore private-mode/storage failures.
  }
}

export default function QuestionManager() {
  const [questions, setQuestions] = useState([]);
  const [counts, setCounts] = useState({ total: 0, published: 0, draft: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null | question obj
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    loadCounts();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [statusFilter, topicFilter, page]);

  async function loadCounts() {
    if (!supabase) {
      setCounts({
        total: DEMO_QUESTIONS.length,
        published: DEMO_QUESTIONS.filter((q) => q.status === 'published').length,
        draft: DEMO_QUESTIONS.filter((q) => q.status === 'draft').length,
      });
      return;
    }
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_question_manager_counts');
    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!rpcError && rpcRow) {
      setCounts({
        total: Number(rpcRow.total ?? 0),
        published: Number(rpcRow.published ?? 0),
        draft: Number(rpcRow.draft ?? 0),
      });
      return;
    }

    const [totalResult, publishedResult, draftResult] = await Promise.all([
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ]);
    setCounts({
      total: totalResult.count ?? 0,
      published: publishedResult.count ?? 0,
      draft: draftResult.count ?? 0,
    });
  }

  async function loadQuestions() {
    const cacheKey = questionCacheKey(statusFilter, topicFilter, page);
    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) setQuestions(JSON.parse(cached));
    } catch {
      // If storage is unavailable, continue with the network request.
    }

    setLoading(true);
    if (!supabase) {
      let rows = DEMO_QUESTIONS;
      if (statusFilter !== 'all') rows = rows.filter((q) => q.status === statusFilter);
      if (topicFilter !== 'All Topics') rows = rows.filter((q) => q.topic === topicFilter);
      setQuestions(rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
      setLoading(false);
      return;
    }
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from('questions')
      .select(LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (topicFilter !== 'All Topics') query = query.eq('topic', topicFilter);
    const { data, error } = await query;
    if (!error) {
      const rows = data ?? [];
      setQuestions(rows);
      try {
        window.sessionStorage.setItem(cacheKey, JSON.stringify(rows));
      } catch {
        // Non-critical cache failure.
      }
    }
    setLoading(false);
  }

  async function fetchQuestionDetails(q) {
    if (!supabase || Object.prototype.hasOwnProperty.call(q, 'choices')) return q;
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', q.id)
      .single();
    if (error || !data) return q;
    setQuestions((prev) => prev.map((item) => (item.id === data.id ? { ...item, ...data } : item)));
    return data;
  }

  function openNew() {
    setEditing(JSON.parse(JSON.stringify(EMPTY_QUESTION)));
    setIsNew(true);
  }

  async function openEdit(q) {
    const fullQuestion = await fetchQuestionDetails(q);
    setEditing(JSON.parse(JSON.stringify(fullQuestion)));
    setIsNew(false);
  }

  async function togglePreview(q) {
    if (preview?.id === q.id) {
      setPreview(null);
      return;
    }
    const fullQuestion = await fetchQuestionDetails(q);
    setPreview(fullQuestion);
  }

  function closeEditor() { setEditing(null); setIsNew(false); }

  function updateEditing(field, value) {
    setEditing((prev) => ({ ...prev, [field]: value }));
  }

  function updateChoice(idx, text) {
    setEditing((prev) => {
      const choices = [...prev.choices];
      choices[idx] = { ...choices[idx], text };
      return { ...prev, choices };
    });
  }

  function addChoice() {
    setEditing((prev) => {
      if (prev.choices.length >= 6) return prev;
      const nextId = CHOICE_IDS[prev.choices.length];
      return { ...prev, choices: [...prev.choices, { id: nextId, text: '' }] };
    });
  }

  function removeChoice(idx) {
    setEditing((prev) => {
      if (prev.choices.length <= 2) return prev;
      const choices = prev.choices.filter((_, i) => i !== idx).map((c, i) => ({ ...c, id: CHOICE_IDS[i] }));
      const correctIds = prev.correct_answer.ids.filter((id) => choices.some((c) => c.id === id));
      return { ...prev, choices, correct_answer: { ids: correctIds } };
    });
  }

  function toggleCorrect(id) {
    setEditing((prev) => {
      const ids = prev.correct_answer.ids ?? [];
      if (prev.question_type === 'mcq') {
        return { ...prev, correct_answer: { ids: [id] } };
      }
      return { ...prev, correct_answer: { ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] } };
    });
  }

  async function handleSave(publish = false) {
    if (!editing.prompt.trim() || !editing.choices.some((c) => c.text.trim())) return;
    setSaving(true);
    const payload = {
      ...editing,
      status: publish ? 'published' : editing.status,
      choices: editing.choices.filter((c) => c.text.trim()),
    };
    delete payload.id;

    if (supabase) {
      if (isNew) {
        const { data } = await supabase.from('questions').insert(payload).select().single();
        if (data) setQuestions((prev) => [data, ...prev]);
      } else {
        const { data } = await supabase.from('questions').update(payload).eq('id', editing.id).select().single();
        if (data) setQuestions((prev) => prev.map((q) => q.id === data.id ? data : q));
      }
      clearQuestionCache();
      await loadCounts();
      await loadQuestions();
    } else {
      const updated = { ...payload, id: editing.id ?? `demo-${Date.now()}` };
      setQuestions((prev) =>
        isNew ? [updated, ...prev] : prev.map((q) => q.id === updated.id ? updated : q)
      );
    }
    setSaving(false);
    closeEditor();
  }

  async function handleTogglePublish(q) {
    const newStatus = q.status === 'published' ? 'draft' : 'published';
    if (supabase) {
      await supabase.from('questions').update({ status: newStatus }).eq('id', q.id);
      clearQuestionCache();
      await loadCounts();
      await loadQuestions();
      return;
    }
    setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, status: newStatus } : x));
  }

  async function handleDelete(q) {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    if (supabase) {
      await supabase.from('questions').delete().eq('id', q.id);
      clearQuestionCache();
      await loadCounts();
      await loadQuestions();
      return;
    }
    setQuestions((prev) => prev.filter((x) => x.id !== q.id));
  }

  // ── CSV Import ─────────────────────────────────────────────────────────────
  const csvRef = useRef();
  const [csvModal, setCsvModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]); // parsed rows
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDone, setCsvDone] = useState(null); // { added, skipped }

  // Expected CSV columns:
  // topic, question_type, prompt, choice_a..choice_f, correct_ids, correct_order,
  // ngn_data, rationale, status
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { rows: [], errors: ['File is empty'] };
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const required = ['topic', 'question_type', 'prompt', 'rationale'];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length) return { rows: [], errors: [`Missing required columns: ${missing.join(', ')}`] };

    const rows = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      // Handle quoted fields with commas inside
      const cells = [];
      let cur = '';
      let inQuote = false;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"' && inQuote && line[c + 1] === '"') {
          cur += '"';
          c++;
          continue;
        }
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { cells.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      cells.push(cur.trim());

      const get = (col) => {
        const idx = header.indexOf(col);
        return idx >= 0 ? (cells[idx] ?? '').replace(/^"|"$/g, '').trim() : '';
      };

      if (!get('prompt')) { errors.push(`Row ${i + 1}: Missing prompt`); continue; }

      const choiceCols = ['choice_a', 'choice_b', 'choice_c', 'choice_d', 'choice_e', 'choice_f'];
      const choiceIds = ['a', 'b', 'c', 'd', 'e', 'f'];
      const choices = choiceCols
        .map((col, idx) => ({ id: choiceIds[idx], text: get(col) }))
        .filter((c) => c.text);

      const correctIds = get('correct_ids').split(/[|,]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const correctOrder = get('correct_order').split(/[|,]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const qType = (get('question_type') || 'mcq').toLowerCase();
      const status = get('status') || 'draft';
      const complexNgnTypes = ['bow_tie', 'matrix', 'highlight'];
      const isOrdered = qType === 'ordered_response';
      const isChoiceBased = ['mcq', 'sata'].includes(qType);
      const isComplexNgn = complexNgnTypes.includes(qType);
      let ngnData = null;

      if (![...complexNgnTypes, 'ordered_response', 'mcq', 'sata'].includes(qType)) {
        errors.push(`Row ${i + 1}: Unsupported question_type "${qType}"`);
        continue;
      }

      if ((isChoiceBased || isOrdered) && choices.length < 2) {
        errors.push(`Row ${i + 1}: Need at least 2 choices`);
        continue;
      }

      if (isChoiceBased && !correctIds.length) {
        errors.push(`Row ${i + 1}: Missing correct_ids`);
        continue;
      }

      if (isOrdered && !correctOrder.length) {
        errors.push(`Row ${i + 1}: Missing correct_order`);
        continue;
      }

      if (isComplexNgn) {
        if (!get('ngn_data')) {
          errors.push(`Row ${i + 1}: Missing ngn_data JSON for ${qType}`);
          continue;
        }
        try {
          ngnData = JSON.parse(get('ngn_data'));
        } catch {
          errors.push(`Row ${i + 1}: Invalid ngn_data JSON`);
          continue;
        }
      }

      const correctAnswer = isOrdered ? { ids: [], order: correctOrder } : { ids: correctIds };

      rows.push({
        topic: get('topic') || 'Pharmacology',
        question_type: qType,
        prompt: get('prompt'),
        choices,
        correct_answer: correctAnswer,
        rationale: get('rationale'),
        status,
        ngn_data: ngnData,
        _rowNum: i + 1,
      });
    }
    return { rows, errors };
  }

  function handleCSVFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, errors } = parseCSV(ev.target.result);
      setCsvPreview(rows);
      setCsvErrors(errors);
      setCsvDone(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function importCSV() {
    if (!csvPreview.length) return;
    setCsvImporting(true);
    let added = 0;
    let skipped = 0;
    for (const row of csvPreview) {
      const { _rowNum, ...payload } = row;
      if (supabase) {
        const { error } = await supabase.from('questions').insert(payload);
        if (error) { skipped++; } else { added++; }
      } else {
        const q = { ...payload, id: `csv-${Date.now()}-${Math.random().toString(36).slice(2)}` };
        setQuestions((prev) => [q, ...prev]);
        added++;
      }
    }
    if (supabase && added > 0) {
      clearQuestionCache();
      await loadCounts();
      await loadQuestions();
    }
    setCsvDone({ added, skipped });
    setCsvImporting(false);
    setCsvPreview([]);
  }

  function closeCSVModal() {
    setCsvModal(false);
    setCsvPreview([]);
    setCsvErrors([]);
    setCsvDone(null);
  }

  function downloadCSVTemplate() {
    const escapeCell = (value = '') => `"${String(value).replaceAll('"', '""')}"`;
    const columns = [
      'topic', 'question_type', 'prompt', 'choice_a', 'choice_b', 'choice_c', 'choice_d', 'choice_e', 'choice_f',
      'correct_ids', 'correct_order', 'ngn_data', 'rationale', 'status',
    ];
    const rows = [
      [
        'Pharmacology', 'mcq', 'A nurse is administering metoprolol. What is the priority assessment?',
        'Apical pulse', 'Blood pressure', 'Respiratory rate', 'Temperature', '', '',
        'a', '', '', 'Hold metoprolol if apical pulse is below the ordered parameter.', 'published',
      ],
      [
        'Medical-Surgical', 'sata', 'Which findings indicate dehydration? Select all that apply.',
        'Dry mucous membranes', 'Decreased skin turgor', 'Bounding pulse', 'Orthostatic hypotension', 'Dark concentrated urine', '',
        'a|b|d|e', '', '', 'Dehydration causes dry mucosa, poor turgor, orthostatic changes, and concentrated urine.', 'draft',
      ],
      [
        'NGN Case Studies', 'ordered_response', 'Place the actions in priority order for a deteriorating postoperative client.',
        'Assess airway breathing circulation', 'Obtain vital signs', 'Notify the provider', 'Prepare for transfer', 'Document care', '',
        '', 'a|b|c|d|e', '', 'Priority follows ABCs, assessment, escalation, preparation, and documentation.', 'published',
      ],
      [
        'NGN Case Studies', 'bow_tie', 'A client presents with sepsis. Select priority actions and monitoring parameters.',
        '', '', '', '', '', '', '', '',
        JSON.stringify({
          condition: 'Sepsis',
          left_label: 'Priority Actions',
          right_label: 'Parameters to Monitor',
          left_choices: [
            { id: 'l1', text: 'Administer oxygen' },
            { id: 'l2', text: 'Start antibiotics' },
            { id: 'l3', text: 'Restrict fluids' },
          ],
          right_choices: [
            { id: 'r1', text: 'MAP' },
            { id: 'r2', text: 'Urine output' },
            { id: 'r3', text: 'LDL cholesterol' },
          ],
          correct_left: ['l1', 'l2'],
          correct_right: ['r1', 'r2'],
        }),
        'Bow tie items store their selectable choices and correct selections in ngn_data JSON.', 'draft',
      ],
      [
        'NGN Case Studies', 'matrix', 'Classify each intervention for acute heart failure.',
        '', '', '', '', '', '', '', '',
        JSON.stringify({
          columns: [
            { id: 'c1', text: 'Indicated' },
            { id: 'c2', text: 'Contraindicated' },
          ],
          rows: [
            { id: 'r1', text: 'Administer ordered diuretic' },
            { id: 'r2', text: 'Encourage excess oral fluids' },
          ],
          correct: { r1: 'c1', r2: 'c2' },
        }),
        'Matrix items store columns, rows, and correct row-column mappings in ngn_data JSON.', 'draft',
      ],
      [
        'NGN Case Studies', 'highlight', 'Highlight the findings that require immediate follow-up.',
        '', '', '', '', '', '', '', '',
        JSON.stringify({
          passage: 'Client is restless. SpO2 is 88% on room air. Urine output is 15 mL/hr. Dressing has scant drainage.',
          highlights: [
            { id: 'h1', text: 'restless', correct: false },
            { id: 'h2', text: 'SpO2 is 88% on room air', correct: true },
            { id: 'h3', text: 'Urine output is 15 mL/hr', correct: true },
          ],
        }),
        'Highlight items store the passage and selectable highlights in ngn_data JSON.', 'draft',
      ],
    ];
    const csv = [columns.join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nursefaculty_questions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const showingStart = questions.length ? page * PAGE_SIZE + 1 : 0;
  const showingEnd = page * PAGE_SIZE + questions.length;

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Question Manager</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost-btn" onClick={() => setCsvModal(true)}>
            <Upload size={15} /> Import CSV
          </button>
          <button className="primary-btn" onClick={openNew}>
            <FilePlus size={16} /> New Question
          </button>
        </div>
      </div>

      {/* CSV Import Modal */}
      {csvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div className="qm-editor-header" style={{ padding: '18px 24px', borderBottom: '1px solid #e9f1ef' }}>
              <strong style={{ fontSize: '1.05rem' }}>Bulk Import Questions via CSV</strong>
              <button className="icon-btn" onClick={closeCSVModal}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>

              {/* Template download */}
              <div style={{ background: '#e9f6f4', borderRadius: 10, padding: '14px 18px', marginBottom: 18 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#135f55', fontSize: '0.9rem' }}>Required CSV columns (in order):</p>
                <code style={{ fontSize: '0.78rem', color: '#2b8a7d', wordBreak: 'break-all' }}>
                  topic, question_type, prompt, choice_a, choice_b, choice_c, choice_d, choice_e, choice_f, correct_ids, correct_order, ngn_data, rationale, status
                </code>
                <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#607478' }}>
                  <strong>question_type:</strong> mcq | sata | ordered_response | bow_tie | matrix | highlight &nbsp;|&nbsp;
                  <strong>correct_ids:</strong> comma- or pipe-separated letters e.g. <code>a</code>, <code>a,c,d</code>, or <code>a|c|d</code> &nbsp;|&nbsp;
                  <strong>correct_order:</strong> for ordered response &nbsp;|&nbsp;
                  <strong>ngn_data:</strong> JSON for Bow Tie, Matrix, Highlight &nbsp;|&nbsp;
                  <strong>status:</strong> published | draft
                </p>
                <button
                  className="ghost-btn"
                  style={{ marginTop: 10, fontSize: '0.8rem' }}
                  onClick={downloadCSVTemplate}
                >
                  Download Template CSV
                </button>
              </div>

              {/* File picker */}
              {!csvDone && (
                <div style={{ marginBottom: 16 }}>
                  <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCSVFile} />
                  <button className="primary-btn" onClick={() => csvRef.current?.click()}>
                    <Upload size={15} /> Choose CSV File
                  </button>
                  {csvPreview.length > 0 && (
                    <span style={{ marginLeft: 12, color: '#29b7a3', fontWeight: 700, fontSize: '0.9rem' }}>
                      ✓ {csvPreview.length} rows ready to import
                    </span>
                  )}
                </div>
              )}

              {/* Errors */}
              {csvErrors.length > 0 && (
                <div style={{ background: '#fff3f3', border: '1px solid #f5c6c6', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#8a2c21', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <AlertCircle size={15} /> {csvErrors.length} error{csvErrors.length > 1 ? 's' : ''} found
                  </p>
                  {csvErrors.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: '0.82rem', color: '#8a2c21' }}>{e}</p>)}
                </div>
              )}

              {/* Preview table */}
              {csvPreview.length > 0 && !csvDone && (
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table className="admin-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr><th>#</th><th>Topic</th><th>Type</th><th>Prompt (truncated)</th><th>Choices</th><th>Correct</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i}>
                          <td style={{ color: '#8a999c' }}>{row._rowNum}</td>
                          <td>{row.topic}</td>
                          <td><span className="type-badge">{row.question_type}</span></td>
                          <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.prompt}>{row.prompt}</td>
                          <td>{row.choices.length || (row.ngn_data ? 'NGN' : 0)}</td>
                          <td>
                            <code style={{ fontSize: '0.78rem' }}>
                              {row.correct_answer.order?.length
                                ? row.correct_answer.order.join(', ')
                                : row.correct_answer.ids.join(', ') || (row.ngn_data ? 'ngn_data' : '')}
                            </code>
                          </td>
                          <td><span className={`status-badge status-${row.status === 'published' ? 'paid' : 'pending'}`}>{row.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Success state */}
              {csvDone && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle2 size={48} color="#29b7a3" style={{ marginBottom: 12 }} />
                  <h3 style={{ margin: '0 0 6px', color: '#135f55' }}>Import Complete</h3>
                  <p style={{ color: '#607478', margin: 0 }}>
                    <strong style={{ color: '#29b7a3' }}>{csvDone.added} questions</strong> imported successfully
                    {csvDone.skipped > 0 && <>, <strong style={{ color: '#e3a72f' }}>{csvDone.skipped} skipped</strong> (errors)</>}
                  </p>
                </div>
              )}

              <div className="editor-footer" style={{ borderTop: '1px solid #e9f1ef', paddingTop: 14, marginTop: 4 }}>
                <button className="ghost-btn" onClick={closeCSVModal}>Close</button>
                {csvPreview.length > 0 && !csvDone && (
                  <button className="primary-btn" onClick={importCSV} disabled={csvImporting}>
                    {csvImporting ? `Importing… (${csvPreview.length} rows)` : `Import ${csvPreview.length} Questions`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="qm-stat"><strong>{counts.total.toLocaleString()}</strong><span>Total</span></div>
        <div className="qm-stat" style={{ borderColor: '#29b7a3' }}><strong style={{ color: '#135f55' }}>{counts.published.toLocaleString()}</strong><span>Published</span></div>
        <div className="qm-stat" style={{ borderColor: '#e3a72f' }}><strong style={{ color: '#875f08' }}>{counts.draft.toLocaleString()}</strong><span>Drafts</span></div>
      </div>

      {/* Filters */}
      <div className="qb-filters" style={{ marginBottom: 14 }}>
        <Filter size={15} color="#607478" />
        <div className="segmented-control" style={{ width: 'auto', display: 'flex', gap: 4, padding: 3, background: '#e9f1ef', borderRadius: 8 }}>
          {['all', 'published', 'draft'].map((s) => (
            <button key={s} style={{ minHeight: 30, padding: '0 12px', fontSize: '0.82rem', fontWeight: 700, borderRadius: 6, background: statusFilter === s ? '#fff' : 'transparent', color: statusFilter === s ? '#17313a' : '#51676c', border: 0, cursor: 'pointer' }} onClick={() => { setPage(0); setStatusFilter(s); }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select value={topicFilter} onChange={(e) => { setPage(0); setTopicFilter(e.target.value); }} style={{ height: 36, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px', background: '#fff' }}>
          <option>All Topics</option>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: '#607478', fontSize: '0.88rem' }}>
          {loading
            ? (questions.length ? 'Refreshing questions…' : 'Loading questions…')
            : `Showing ${showingStart.toLocaleString()}–${showingEnd.toLocaleString()} of ${counts.total.toLocaleString()}`}
        </span>
      </div>

      {/* Question editor */}
      {editing && (
        <div className="qm-editor">
          <div className="qm-editor-header">
            <strong>{isNew ? 'New Question' : 'Edit Question'}</strong>
            <button className="icon-btn" onClick={closeEditor}><X size={18} /></button>
          </div>

          <div className="qm-form-grid">
            <div className="qm-form-row">
              <label>Topic</label>
              <select value={editing.topic} onChange={(e) => updateEditing('topic', e.target.value)}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          <div className="qm-form-row">
            <label>Question Type</label>
              <div className="segmented-control" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <button type="button" className={editing.question_type === 'mcq' ? 'segment-active' : ''} onClick={() => updateEditing('question_type', 'mcq')}>Multiple Choice</button>
                <button type="button" className={editing.question_type === 'sata' ? 'segment-active' : ''} onClick={() => updateEditing('question_type', 'sata')}>Select All That Apply</button>
              </div>
            </div>
          </div>
          <div className="qm-form-row">
            <label>Available From</label>
            <select value={editing.minimum_plan ?? 'pro'} onChange={(e) => updateEditing('minimum_plan', e.target.value)}>
              <option value="free">Free — included in the 25-question sampler</option>
              <option value="starter">30-Day Pass — included in the 2,000-question package</option>
              <option value="pro">Pro — complete bank only</option>
            </select>
          </div>

          <div className="qm-form-row">
            <label>Question Prompt</label>
            <textarea
              className="editor-textarea"
              rows={4}
              placeholder="Write the clinical scenario and question here…"
              value={editing.prompt}
              onChange={(e) => updateEditing('prompt', e.target.value)}
            />
          </div>

          <div className="qm-form-row">
            <label>
              Answer Choices
              <span style={{ fontWeight: 400, color: '#607478', marginLeft: 8, fontSize: '0.82rem' }}>
                {editing.question_type === 'mcq' ? 'Click the letter to mark correct (1 answer)' : 'Click letters to mark all correct answers'}
              </span>
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              {editing.choices.map((choice, idx) => {
                const isCorrect = editing.correct_answer.ids?.includes(choice.id);
                return (
                  <div key={choice.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleCorrect(choice.id)}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, fontWeight: 800, fontSize: '0.82rem',
                        background: isCorrect ? '#29b7a3' : '#edf2f1', color: isCorrect ? '#fff' : '#42585e',
                        border: '2px solid ' + (isCorrect ? '#29b7a3' : '#dde8e6'), cursor: 'pointer',
                      }}
                    >
                      {choice.id.toUpperCase()}
                    </button>
                    <input
                      value={choice.text}
                      onChange={(e) => updateChoice(idx, e.target.value)}
                      placeholder={`Choice ${choice.id.toUpperCase()}…`}
                      style={{ flex: 1, height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', background: isCorrect ? '#e9f6f4' : '#fff', borderColor: isCorrect ? '#29b7a3' : '#dbe6e4' }}
                    />
                    {editing.choices.length > 2 && (
                      <button type="button" className="icon-btn" style={{ flexShrink: 0 }} onClick={() => removeChoice(idx)}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {editing.choices.length < 6 && (
                <button type="button" className="ghost-btn" onClick={addChoice} style={{ justifyContent: 'center' }}>
                  <PlusCircle size={14} /> Add choice
                </button>
              )}
            </div>
          </div>

          {!editing.correct_answer.ids?.length && (
            <div style={{ padding: '10px 14px', background: '#fff5df', borderRadius: 8, color: '#875f08', fontSize: '0.86rem' }}>
              ⚠️ No correct answer selected. Click a letter to mark the correct answer(s).
            </div>
          )}

          <div className="qm-form-row">
            <label>Rationale</label>
            <textarea
              className="editor-textarea"
              rows={4}
              placeholder="Explain why each choice is correct or incorrect. Include nursing priorities, safety considerations, and clinical reasoning…"
              value={editing.rationale}
              onChange={(e) => updateEditing('rationale', e.target.value)}
            />
          </div>

          <div className="qm-form-row">
            <label>
              Test-Taking Strategy
              <span style={{ fontWeight: 400, color: '#607478', marginLeft: 8, fontSize: '0.82rem' }}>
                The thinking shortcut — how to arrive at the answer, not just why it's right
              </span>
            </label>
            <textarea
              className="editor-textarea"
              rows={3}
              placeholder='e.g. "Note the strategic words need for further teaching — this signals a negative event query. Select the option that contradicts safe practice."'
              value={editing.strategy ?? ''}
              onChange={(e) => updateEditing('strategy', e.target.value)}
            />
          </div>

          <div className="editor-footer">
            <button className="ghost-btn" onClick={closeEditor}>Cancel</button>
            <button className="ghost-btn" onClick={() => handleSave(false)} disabled={saving || !editing.prompt.trim()}>
              <Save size={15} /> Save as Draft
            </button>
            <button className="primary-btn" onClick={() => handleSave(true)} disabled={saving || !editing.prompt.trim() || !editing.correct_answer.ids?.length}>
              <CheckCircle2 size={15} /> {saving ? 'Saving…' : 'Save & Publish'}
            </button>
          </div>
        </div>
      )}

      {/* Question list */}
      <div style={{ display: 'grid', gap: 10 }}>
        {questions.map((q) => (
          <div key={q.id} className="qm-question-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span className={`qm-status qm-status-${q.status}`}>{q.status}</span>
                <span style={{ fontSize: '0.78rem', color: '#2b8a7d', fontWeight: 700, textTransform: 'uppercase' }}>{q.topic}</span>
                <span style={{ fontSize: '0.76rem', color: '#8a999c' }}>{q.question_type?.replaceAll('_', ' ').toUpperCase()}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.45, color: '#17212f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {q.prompt}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="icon-btn" title="Preview" onClick={() => togglePreview(q)}>
                {preview?.id === q.id ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button className="icon-btn" title="Edit" onClick={() => openEdit(q)}>
                <Edit3 size={15} />
              </button>
              <button
                className="icon-btn"
                title={q.status === 'published' ? 'Unpublish' : 'Publish'}
                style={{ color: q.status === 'published' ? '#135f55' : '#875f08' }}
                onClick={() => handleTogglePublish(q)}
              >
                {q.status === 'published' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              </button>
              <button className="icon-btn" title="Delete" style={{ color: '#8a2c21' }} onClick={() => handleDelete(q)}>
                <Trash2 size={15} />
              </button>
            </div>

            {/* Inline preview */}
            {preview?.id === q.id && (
              <div style={{ gridColumn: '1 / -1', marginTop: 12, padding: 14, background: '#f7faf9', borderRadius: 8, border: '1px solid #e1ebe9' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 500 }}>{preview.prompt}</p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(preview.choices ?? []).map((c) => {
                    const correct = preview.correct_answer?.ids?.includes(c.id);
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: correct ? '#e9f6f4' : '#fff', border: `1px solid ${correct ? '#b9e3dc' : '#e1ebe9'}` }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: correct ? '#29b7a3' : '#edf2f1', color: correct ? '#fff' : '#42585e', display: 'grid', placeItems: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
                          {c.id.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.88rem' }}>{c.text}</span>
                        {correct && <CheckCircle2 size={14} color="#29b7a3" style={{ marginLeft: 'auto' }} />}
                      </div>
                    );
                  })}
                </div>
                {preview.rationale && (
                  <div style={{ marginTop: 10, padding: 10, background: '#fff6ef', borderRadius: 6, border: '1px solid #f2d6bd', fontSize: '0.84rem', color: '#4a3020' }}>
                    <strong>Rationale:</strong> {preview.rationale}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && !questions.length && (
          <div style={{ textAlign: 'center', padding: 36, color: '#607478' }}>
            Loading question page…
          </div>
        )}
        {!loading && !questions.length && (
          <div style={{ textAlign: 'center', padding: 48, color: '#607478' }}>
            <p>No questions match your filters.</p>
            <button className="primary-btn" onClick={openNew}><FilePlus size={16} /> Add your first question</button>
          </div>
        )}
      </div>
      <div className="qb-nav" style={{ marginTop: 14 }}>
        <button className="ghost-btn" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
        <span style={{ color: '#607478', fontSize: '0.86rem' }}>Page {page + 1}</span>
        <button className="ghost-btn" disabled={loading || questions.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </section>
  );
}

