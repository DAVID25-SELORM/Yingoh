import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, Edit3, Eye, EyeOff, FilePlus, Filter,
  PlusCircle, Save, Trash2, X, XCircle,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { DEMO_QUESTIONS } from '../data/demoQuestions';

const TOPICS = [
  'Pharmacology', 'Safety and Infection Control', 'Medical-Surgical',
  'NGN Case Studies', 'Maternal and Newborn', 'Mental Health',
  'Pediatrics', 'Leadership and Management',
];

const EMPTY_QUESTION = {
  topic: 'Pharmacology',
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
  status: 'draft',
};

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

export default function QuestionManager() {
  const [questions, setQuestions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [editing, setEditing] = useState(null); // null | question obj
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    let qs = questions;
    if (statusFilter !== 'all') qs = qs.filter((q) => q.status === statusFilter);
    if (topicFilter !== 'All Topics') qs = qs.filter((q) => q.topic === topicFilter);
    setFiltered(qs);
  }, [questions, statusFilter, topicFilter]);

  async function loadQuestions() {
    if (!supabase) { setQuestions(DEMO_QUESTIONS); return; }
    const { data } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    setQuestions(data?.length ? data : DEMO_QUESTIONS);
  }

  function openNew() {
    setEditing(JSON.parse(JSON.stringify(EMPTY_QUESTION)));
    setIsNew(true);
  }

  function openEdit(q) {
    setEditing(JSON.parse(JSON.stringify(q)));
    setIsNew(false);
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
    }
    setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, status: newStatus } : x));
  }

  async function handleDelete(q) {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    if (supabase) await supabase.from('questions').delete().eq('id', q.id);
    setQuestions((prev) => prev.filter((x) => x.id !== q.id));
  }

  const publishedCount = questions.filter((q) => q.status === 'published').length;
  const draftCount = questions.filter((q) => q.status === 'draft').length;

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Question Manager</h2>
        <button className="primary-btn" onClick={openNew}>
          <FilePlus size={16} /> New Question
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="qm-stat"><strong>{questions.length}</strong><span>Total</span></div>
        <div className="qm-stat" style={{ borderColor: '#29b7a3' }}><strong style={{ color: '#135f55' }}>{publishedCount}</strong><span>Published</span></div>
        <div className="qm-stat" style={{ borderColor: '#e3a72f' }}><strong style={{ color: '#875f08' }}>{draftCount}</strong><span>Drafts</span></div>
      </div>

      {/* Filters */}
      <div className="qb-filters" style={{ marginBottom: 14 }}>
        <Filter size={15} color="#607478" />
        <div className="segmented-control" style={{ width: 'auto', display: 'flex', gap: 4, padding: 3, background: '#e9f1ef', borderRadius: 8 }}>
          {['all', 'published', 'draft'].map((s) => (
            <button key={s} style={{ minHeight: 30, padding: '0 12px', fontSize: '0.82rem', fontWeight: 700, borderRadius: 6, background: statusFilter === s ? '#fff' : 'transparent', color: statusFilter === s ? '#17313a' : '#51676c', border: 0, cursor: 'pointer' }} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} style={{ height: 36, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px', background: '#fff' }}>
          <option>All Topics</option>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: '#607478', fontSize: '0.88rem' }}>{filtered.length} questions</span>
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
              rows={5}
              placeholder="Explain why each choice is correct or incorrect. Include nursing priorities, safety considerations, and clinical reasoning…"
              value={editing.rationale}
              onChange={(e) => updateEditing('rationale', e.target.value)}
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
        {filtered.map((q) => (
          <div key={q.id} className="qm-question-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span className={`qm-status qm-status-${q.status}`}>{q.status}</span>
                <span style={{ fontSize: '0.78rem', color: '#2b8a7d', fontWeight: 700, textTransform: 'uppercase' }}>{q.topic}</span>
                <span style={{ fontSize: '0.76rem', color: '#8a999c' }}>{q.question_type === 'sata' ? 'SATA' : 'MCQ'}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.45, color: '#17212f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {q.prompt}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="icon-btn" title="Preview" onClick={() => setPreview(preview?.id === q.id ? null : q)}>
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
                <p style={{ margin: '0 0 10px', fontWeight: 500 }}>{q.prompt}</p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(q.choices ?? []).map((c) => {
                    const correct = q.correct_answer?.ids?.includes(c.id);
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
                {q.rationale && (
                  <div style={{ marginTop: 10, padding: 10, background: '#fff6ef', borderRadius: 6, border: '1px solid #f2d6bd', fontSize: '0.84rem', color: '#4a3020' }}>
                    <strong>Rationale:</strong> {q.rationale}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!filtered.length && (
          <div style={{ textAlign: 'center', padding: 48, color: '#607478' }}>
            <p>No questions match your filters.</p>
            <button className="primary-btn" onClick={openNew}><FilePlus size={16} /> Add your first question</button>
          </div>
        )}
      </div>
    </section>
  );
}
