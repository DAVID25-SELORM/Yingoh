import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Plus, Search } from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { DIAGNOSTIC_NOTE, ERROR_TYPES, ReportBody, diagnosticRpc } from './DiagnosticShared';
import './diagnostic.css';

const PARTS = { A: 'A · Core knowledge (100)', B: 'B · Clinical judgment (30)', C: 'C · Medication calculations (10)', D: 'D · Prioritization / delegation (10)' };
const CJ_STEPS = ['Recognize Cues', 'Analyze Cues', 'Prioritize Hypotheses', 'Generate Solutions', 'Take Action', 'Evaluate Outcomes'];
const SUBCATEGORIES = ['Management of Care', 'Safety and Infection Prevention and Control', 'Health Promotion and Maintenance', 'Psychosocial Integrity',
  'Basic Care and Comfort', 'Pharmacological and Parenteral Therapies', 'Reduction of Risk Potential', 'Physiological Adaptation'];
const STATUS_TONE = { draft: 'neutral', published: 'good', retired: 'warn' };

function ConfirmPublish({ busy, onCancel, onConfirm }) {
  const ref = useDialog(true, onCancel);
  return <div className="dx-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
    <div className="dx-modal" role="dialog" aria-modal="true" aria-labelledby="dx-pub-title" aria-describedby="dx-pub-body" ref={ref}>
      <h3 id="dx-pub-title">Publish this diagnostic?</h3>
      <p id="dx-pub-body">Published forms cannot be edited, so every student sees exactly the same 150 questions. Students still need to be assigned before they can start.</p>
      <div className="dx-actions"><button type="button" className="ghost-btn" data-autofocus onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>{busy ? 'Publishing…' : 'Publish form'}</button></div>
    </div>
  </div>;
}

function Validation({ check }) {
  if (!check) return null;
  const parts = check.parts ?? {};
  const targets = { A: 100, B: 30, C: 10, D: 10 };
  return <section className="dx-panel" aria-label="Form checklist">
    <h3>Form checklist</h3>
    <p className={check.valid ? 'dx-good' : 'dx-muted'} role="status">{check.items}/150 items · {check.valid ? 'Ready to publish' : 'Not ready to publish'}</p>
    <ul className="dx-chips" aria-label="Section counts">{Object.entries(targets).map(([part, target]) => <li key={part} className={`dx-chip ${(parts[part] ?? 0) === target ? 'dx-chip-ok' : ''}`}>Part {part}: {parts[part] ?? 0}/{target}</li>)}</ul>
    <table className="dx-table"><thead><tr><th scope="col">Client needs area</th><th scope="col">Have</th><th scope="col">Target</th></tr></thead>
      <tbody>{(check.subcategories ?? []).map(s => <tr key={s.subcategory} className={s.have === s.target ? '' : 'dx-row-gap'}>
        <td data-label="Area">{s.subcategory}</td><td data-label="Have">{s.have}</td><td data-label="Target">{s.target}{s.have === s.target ? ' ✓' : ''}</td></tr>)}</tbody></table>
    {check.problems?.length > 0 && <ul className="dx-problems" aria-label="Problems to fix">{check.problems.map(p => <li key={p}>{p}</li>)}</ul>}
  </section>;
}

function ItemAdder({ formId, items, onChanged, onError }) {
  const [query, setQuery] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [results, setResults] = useState(null);
  const [part, setPart] = useState('B');
  const [busy, setBusy] = useState(false);
  const used = new Set(items.map(i => i.position));
  const nextFree = Array.from({ length: 150 }, (_, i) => i + 1).find(n => !used.has(n)) ?? null;
  const [position, setPosition] = useState(nextFree ?? 1);
  useEffect(() => { if (nextFree) setPosition(nextFree); }, [nextFree]);

  async function search(e) {
    e?.preventDefault(); onError('');
    try { setResults(await diagnosticRpc('admin_diagnostic_search_questions', { p_query: query, p_subcategory: subcategory || null, p_limit: 20 })); }
    catch (err) { onError(err.message); }
  }
  async function add(question) {
    setBusy(true); onError('');
    try {
      await diagnosticRpc('admin_diagnostic_set_item', { p_form: formId, p_position: Number(position), p_question: question.id, p_part: part,
        p_subcategory: question.client_need, p_subtopic: question.topic, p_cj_step: question.cj_step || null, p_difficulty: null });
      setResults(prev => prev?.filter(r => r.id !== question.id) ?? null); await onChanged();
    } catch (err) { onError(err.message); } finally { setBusy(false); }
  }
  if (!nextFree) return <p className="dx-muted">All 150 positions are filled. Remove an item to swap it.</p>;
  return <section className="dx-panel" aria-label="Add a question">
    <h3>Add a question</h3>
    <form className="dx-form" onSubmit={search}>
      <label>Search questions<input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} placeholder="Words in the question or topic" /></label>
      <label>Client needs area<select value={subcategory} onChange={e => setSubcategory(e.target.value)}><option value="">Any</option>{SUBCATEGORIES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Section<select value={part} onChange={e => setPart(e.target.value)}>{Object.entries(PARTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Position<input type="number" min="1" max="150" value={position} onChange={e => setPosition(e.target.value)} /></label>
      <button className="ghost-btn"><Search size={16} aria-hidden="true" /> Search</button>
    </form>
    {results && results.length === 0 && <p className="dx-muted">No eligible unused questions match. Only reviewed single-answer and select-all questions can be used.</p>}
    {results?.length > 0 && <ul className="dx-results">{results.map(r => <li key={r.id}>
      <div><p className="dx-prompt">{r.prompt}</p><p className="dx-muted">{r.client_need} · {r.topic}{r.cj_step ? ` · ${r.cj_step}` : ''} · {r.question_type === 'sata' ? 'Select all' : 'Single answer'}</p></div>
      <button type="button" className="primary-btn" disabled={busy} aria-label={`Add to position ${position}`} onClick={() => add(r)}><Plus size={16} aria-hidden="true" /> Add</button>
    </li>)}</ul>}
  </section>;
}

function FormScreen({ formId, onBack }) {
  const [form, setForm] = useState(null);
  const [check, setCheck] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState(null);
  const [tab, setTab] = useState('items');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [found, setFound] = useState(null);
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [viewAttempt, setViewAttempt] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await diagnosticRpc('admin_diagnostic_get_form', { p_form: formId });
      setForm(data);
      setCheck(await diagnosticRpc('admin_diagnostic_validate_form', { p_form: formId }));
      if (data.status === 'published') {
        setAssignments(await diagnosticRpc('admin_diagnostic_assignments', { p_form: formId }));
        setAttempts(await diagnosticRpc('admin_diagnostic_list_attempts', { p_form: formId, p_page: 0 }));
      }
    } catch (e) { setError(e.message); }
  }, [formId]);
  useEffect(() => { load(); }, [load]);

  async function run(fn, done) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); if (done) setMessage(done); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const propose = () => run(async () => {
    const res = await diagnosticRpc('admin_diagnostic_propose_items', { p_form: formId, p_seed: seed, p_part_a: 100 });
    setMessage(`Added ${res.added} Part A questions.${res.shortfalls?.length ? ` Not enough eligible questions for: ${res.shortfalls.map(s => s.subcategory).join(', ')}.` : ''}`);
  });
  const remove = position => run(() => diagnosticRpc('admin_diagnostic_remove_item', { p_form: formId, p_position: position }));
  const publish = () => run(async () => { await diagnosticRpc('admin_diagnostic_publish_form', { p_form: formId }); setPublishing(false); }, 'Form published.');
  async function findUsers(e) {
    e.preventDefault(); setError('');
    try { setFound(await diagnosticRpc('admin_diagnostic_find_users', { p_query: userQuery })); } catch (err) { setError(err.message); }
  }
  const assign = user => run(() => diagnosticRpc('admin_diagnostic_assign', { p_form: formId, p_users: [user.id], p_attempts: Number(attemptsAllowed) }), `Assigned to ${user.full_name || user.email}.`);

  if (viewAttempt) return <AttemptScreen attemptId={viewAttempt} onBack={() => setViewAttempt(null)} />;
  if (!form) return error ? <p role="alert" className="dx-alert">{error}</p> : <p className="dx-muted" role="status">Loading…</p>;
  const draft = form.status === 'draft';
  const tabs = draft ? [['items', 'Questions']] : [['items', 'Questions'], ['assign', 'Assign students'], ['results', 'Results']];

  return <div>
    <div className="dx-toolbar"><button type="button" className="ghost-btn" onClick={onBack}><ChevronLeft size={16} aria-hidden="true" /> All forms</button></div>
    <header className="dx-header"><div><h2>{form.name} <span className="dx-muted">v{form.version}</span></h2>
      <span className={`dx-badge dx-badge-${STATUS_TONE[form.status]}`}>{form.status}</span></div>
      {draft && <div className="dx-actions">
        <label className="dx-inline">Seed (optional)<input value={seed} maxLength={40} onChange={e => setSeed(e.target.value)} /></label>
        <button type="button" className="ghost-btn" disabled={busy || form.items.length > 0} onClick={propose}>Propose Part A (100)</button>
        <button type="button" className="primary-btn" disabled={busy || !check?.valid} onClick={() => setPublishing(true)}>Publish</button></div>}
    </header>
    <p className="dx-note" role="note">{DIAGNOSTIC_NOTE}</p>
    {error && <p role="alert" className="dx-alert">{error}</p>}{message && <p role="status" className="dx-good">{message}</p>}
    <div className="dx-tabs" role="tablist" aria-label="Form sections">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'dx-tab-on' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>

    {tab === 'items' && <div className="dx-stack">
      <Validation check={check} />
      {draft && <ItemAdder formId={formId} items={form.items} onChanged={load} onError={setError} />}
      <section className="dx-panel" aria-label="Form questions"><h3>Questions ({form.items.length})</h3>
        {form.items.length === 0 ? <p className="dx-muted">No questions yet. Propose Part A to fill the core section, then add Parts B–D.</p> :
          <div className="dx-table-wrap"><table className="dx-table"><thead><tr><th scope="col">#</th><th scope="col">Part</th><th scope="col">Area</th><th scope="col">Topic</th><th scope="col">CJ step</th><th scope="col">Question</th>{draft && <th scope="col"><span className="dx-sr">Actions</span></th>}</tr></thead>
            <tbody>{form.items.map(i => <tr key={i.position}><td data-label="#">{i.position}</td><td data-label="Part">{i.part}</td><td data-label="Area">{i.subcategory}</td><td data-label="Topic">{i.subtopic || '—'}</td>
              <td data-label="CJ step">{i.cj_step || '—'}</td><td data-label="Question" className="dx-cell-prompt">{i.prompt}</td>
              {draft && <td data-label="Actions"><button type="button" className="ghost-btn" disabled={busy} aria-label={`Remove question ${i.position}`} onClick={() => remove(i.position)}>Remove</button></td>}</tr>)}</tbody></table></div>}
      </section></div>}

    {tab === 'assign' && <div className="dx-stack">
      <section className="dx-panel" aria-label="Assign students"><h3>Assign students</h3>
        <form className="dx-form" onSubmit={findUsers}>
          <label>Find student (name or email)<input value={userQuery} maxLength={100} onChange={e => setUserQuery(e.target.value)} /></label>
          <label>Attempts allowed<select value={attemptsAllowed} onChange={e => setAttemptsAllowed(e.target.value)}>{[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <button className="ghost-btn"><Search size={16} aria-hidden="true" /> Find</button>
        </form>
        {found && found.length === 0 && <p className="dx-muted">No students found. Type at least 2 characters.</p>}
        {found?.length > 0 && <ul className="dx-results">{found.map(u => <li key={u.id}><div><strong>{u.full_name || '—'}</strong><p className="dx-muted">{u.email}</p></div>
          <button type="button" className="primary-btn" disabled={busy} aria-label={`Assign ${u.full_name || u.email}`} onClick={() => assign(u)}>Assign</button></li>)}</ul>}
      </section>
      <section className="dx-panel" aria-label="Assigned students"><h3>Assigned ({assignments.length})</h3>
        {assignments.length === 0 ? <p className="dx-muted">No students assigned yet.</p> : <table className="dx-table"><thead><tr><th scope="col">Student</th><th scope="col">Email</th><th scope="col">Attempts</th></tr></thead>
          <tbody>{assignments.map(a => <tr key={a.user_id}><td data-label="Student">{a.full_name || '—'}</td><td data-label="Email">{a.email}</td><td data-label="Attempts">{a.attempts_used} of {a.attempts_allowed}</td></tr>)}</tbody></table>}
      </section></div>}

    {tab === 'results' && <section className="dx-panel" aria-label="Submitted attempts"><h3>Submitted attempts ({attempts?.total ?? 0})</h3>
      {!attempts?.rows?.length ? <p className="dx-muted">No submitted attempts yet.</p> : <table className="dx-table"><thead><tr><th scope="col">Student</th><th scope="col">Attempt</th><th scope="col">Submitted</th><th scope="col">Overall</th><th scope="col"><span className="dx-sr">Open</span></th></tr></thead>
        <tbody>{attempts.rows.map(r => <tr key={r.attempt_id}><td data-label="Student">{r.full_name || '—'}</td><td data-label="Attempt">#{r.attempt_no}</td>
          <td data-label="Submitted">{new Date(r.submitted_at).toLocaleDateString()}</td><td data-label="Overall">{r.pct == null ? '—' : `${Math.round(r.pct)}%`}</td>
          <td data-label="Open"><button type="button" className="ghost-btn" aria-label={`Open attempt ${r.attempt_no} for ${r.full_name || 'student'}`} onClick={() => setViewAttempt(r.attempt_id)}>Open</button></td></tr>)}</tbody></table>}
    </section>}
    {publishing && <ConfirmPublish busy={busy} onCancel={() => setPublishing(false)} onConfirm={publish} />}
  </div>;
}

function AttemptScreen({ attemptId, onBack }) {
  const [data, setData] = useState(null);
  const [review, setReview] = useState([]);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      const [report, rows] = await Promise.all([diagnosticRpc('admin_get_diagnostic_report', { p_attempt: attemptId }), diagnosticRpc('admin_get_diagnostic_review', { p_attempt: attemptId })]);
      setData(report); setReview(rows ?? []);
    } catch (e) { setError(e.message); }
  }, [attemptId]);
  useEffect(() => { load(); }, [load]);

  async function tag(row) {
    const draft = drafts[row.question_id] ?? {};
    const type = draft.type ?? row.error_type;
    if (!type) { setError('Choose an error type first.'); return; }
    setError('');
    try {
      await diagnosticRpc('admin_diagnostic_tag_error', { p_attempt: attemptId, p_question: row.question_id, p_type: type, p_note: draft.note ?? row.error_note ?? null });
      setSaved(`Saved tag for question ${row.position}.`); await load();
    } catch (e) { setError(e.message); }
  }

  const missed = review.filter(r => !r.is_correct);
  const tagged = missed.filter(r => r.error_type).length;
  const counts = Object.entries(ERROR_TYPES).map(([code, label]) => [code, label, missed.filter(r => r.error_type === code).length]).filter(x => x[2] > 0);
  if (!data) return error ? <p role="alert" className="dx-alert">{error}</p> : <p className="dx-muted" role="status">Loading…</p>;
  return <div>
    <div className="dx-toolbar"><button type="button" className="ghost-btn" onClick={onBack}><ChevronLeft size={16} aria-hidden="true" /> Back to form</button></div>
    <h2>Attempt #{data.attempt_no}</h2>
    <ReportBody report={data.report} />
    <section className="dx-panel" aria-label="Error analysis">
      <h3>Why questions were missed</h3>
      <p className="dx-muted">{tagged} of {missed.length} missed questions tagged. Tagging separates knowledge gaps from reasoning and test-taking problems.</p>
      {counts.length > 0 && <ul className="dx-chips" aria-label="Error type totals">{counts.map(([code, label, n]) => <li key={code} className="dx-chip">{code} · {label}: {n}</li>)}</ul>}
      {error && <p role="alert" className="dx-alert">{error}</p>}{saved && <p role="status" className="dx-good">{saved}</p>}
      {missed.length === 0 ? <p className="dx-good">No missed questions.</p> : <ol className="dx-review">{missed.map(r => {
        const draft = drafts[r.question_id] ?? {};
        return <li key={r.question_id}>
          <p className="dx-prompt">Q{r.position} · {r.subcategory}{r.subtopic ? ` · ${r.subtopic}` : ''}</p><p>{r.prompt}</p>
          <p className="dx-muted">{r.answered ? `Answered ${(r.selected ?? []).join(', ').toUpperCase()}` : 'Not answered'} · correct {(r.correct_answer ?? []).join(', ').toUpperCase()}{r.seconds != null ? ` · ${r.seconds}s` : ''}</p>
          <div className="dx-form">
            <label>Error type<select value={draft.type ?? r.error_type ?? ''} onChange={e => setDrafts(p => ({ ...p, [r.question_id]: { ...draft, type: e.target.value } }))}>
              <option value="">Choose…</option>{Object.entries(ERROR_TYPES).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></label>
            <label>Note<input maxLength={1000} value={draft.note ?? r.error_note ?? ''} onChange={e => setDrafts(p => ({ ...p, [r.question_id]: { ...draft, note: e.target.value } }))} /></label>
            <button type="button" className="ghost-btn" aria-label={`Save tag for question ${r.position}`} onClick={() => tag(r)}>Save tag</button>
          </div></li>;
      })}</ol>}
    </section>
  </div>;
}

export default function DiagnosticAdmin() {
  const [forms, setForms] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setForms(await diagnosticRpc('admin_diagnostic_list_forms')); setError(''); }
    catch (e) { setError(e.message); setForms([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault(); if (!name.trim()) return;
    setBusy(true); setError('');
    try { const id = await diagnosticRpc('admin_diagnostic_create_form', { p_name: name.trim() }); setName(''); setOpenId(id); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (openId) return <section className="dx-page"><FormScreen formId={openId} onBack={() => { setOpenId(null); load(); }} /></section>;
  return <section className="dx-page" aria-labelledby="dx-admin-title">
    <header className="dx-header"><div><p className="dx-eyebrow">SMART NCLEX Roadmap™</p><h2 id="dx-admin-title">Diagnostic administration</h2>
      <p className="dx-muted">Build the 150-question diagnostic, publish it, assign students and review their results.</p></div></header>
    {error && <p role="alert" className="dx-alert">{error}</p>}
    <form className="dx-form dx-panel" onSubmit={create} aria-label="Create form">
      <label>New diagnostic form name<input required maxLength={150} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NurseFaculty SMART Diagnostic" /></label>
      <button className="primary-btn" disabled={busy}><Plus size={16} aria-hidden="true" /> Create draft</button>
    </form>
    {forms === null && <p className="dx-muted" role="status">Loading…</p>}
    {forms?.length === 0 && !error && <div className="dx-empty"><h3>No diagnostic forms yet</h3><p>Create a draft above to start building your first diagnostic.</p></div>}
    {forms?.length > 0 && <section className="dx-panel" aria-label="Diagnostic forms"><table className="dx-table"><thead><tr><th scope="col">Form</th><th scope="col">Status</th><th scope="col">Questions</th><th scope="col">Assigned</th><th scope="col">Submitted</th><th scope="col"><span className="dx-sr">Open</span></th></tr></thead>
      <tbody>{forms.map(f => <tr key={f.id}><td data-label="Form">{f.name} <span className="dx-muted">v{f.version}</span></td>
        <td data-label="Status"><span className={`dx-badge dx-badge-${STATUS_TONE[f.status]}`}>{f.status}</span></td><td data-label="Questions">{f.items}/150</td><td data-label="Assigned">{f.assigned}</td><td data-label="Submitted">{f.submitted}</td>
        <td data-label="Open"><button type="button" className="ghost-btn" aria-label={`Open ${f.name}`} onClick={() => setOpenId(f.id)}>Open</button></td></tr>)}</tbody></table></section>}
  </section>;
}
