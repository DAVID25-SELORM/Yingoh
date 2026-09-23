import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardCheck, Printer } from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { DIAGNOSTIC_NOTE, ReportBody, diagnosticRpc } from './DiagnosticShared';
import './diagnostic.css';

function SubmitDialog({ unanswered, busy, onCancel, onConfirm }) {
  const ref = useDialog(true, onCancel);
  return <div className="dx-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
    <div className="dx-modal" role="dialog" aria-modal="true" aria-labelledby="dx-submit-title" aria-describedby="dx-submit-body" ref={ref}>
      <h3 id="dx-submit-title">Submit your diagnostic?</h3>
      <p id="dx-submit-body">{unanswered > 0
        ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Unanswered questions count as incorrect.`
        : 'You have answered every question.'} You cannot change your answers after submitting.</p>
      <div className="dx-actions">
        <button type="button" className="ghost-btn" data-autofocus onClick={onCancel}>Keep working</button>
        <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>{busy ? 'Submitting…' : 'Submit diagnostic'}</button>
      </div>
    </div>
  </div>;
}

function TestScreen({ attemptId, onExit, onSubmitted }) {
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState('idle');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    let active = true;
    diagnosticRpc('get_diagnostic_attempt', { p_attempt: attemptId }).then(data => {
      if (!active) return;
      if (data.status !== 'in_progress') { onSubmitted(attemptId); return; }
      setAttempt(data);
      setAnswers(Object.fromEntries(data.items.map(item => [item.question_id, item.selected ?? []])));
      const firstOpen = data.items.findIndex(item => !(item.selected?.length));
      setIndex(firstOpen < 0 ? 0 : firstOpen);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attemptId, onSubmitted]);

  useEffect(() => { shownAt.current = Date.now(); }, [index]);

  const items = attempt?.items ?? [];
  const item = items[index];
  const answered = useMemo(() => items.filter(i => answers[i.question_id]?.length).length, [items, answers]);

  const save = useCallback(async (questionId, ids) => {
    setSaveState('saving'); setError('');
    try {
      await diagnosticRpc('save_diagnostic_answer', {
        p_attempt: attemptId, p_question: questionId, p_ids: ids,
        p_seconds: Math.min(3600, Math.max(0, Math.round((Date.now() - shownAt.current) / 1000))),
      });
      setSaveState('saved');
    } catch (e) { setSaveState('error'); setError(e.message); }
  }, [attemptId]);

  function choose(choiceId) {
    if (!item) return;
    const current = answers[item.question_id] ?? [];
    let next;
    if (item.question_type === 'sata') {
      next = current.includes(choiceId) ? current.filter(id => id !== choiceId) : [...current, choiceId];
      if (next.length === 0) return; // an answer can be changed but not cleared
    } else next = [choiceId];
    setAnswers(prev => ({ ...prev, [item.question_id]: next }));
    save(item.question_id, next);
  }

  async function submit() {
    setBusy(true); setError('');
    try { await diagnosticRpc('submit_diagnostic', { p_attempt: attemptId }); setConfirming(false); onSubmitted(attemptId); }
    catch (e) { setError(e.message); setConfirming(false); }
    finally { setBusy(false); }
  }

  if (error && !attempt) return <p role="alert" className="dx-alert">{error}</p>;
  if (!attempt) return <p className="dx-muted" role="status">Loading your diagnostic…</p>;
  const selected = answers[item.question_id] ?? [];
  const inputType = item.question_type === 'sata' ? 'checkbox' : 'radio';
  const firstOpen = items.findIndex(i => !answers[i.question_id]?.length);

  return <div className="dx-test">
    <header className="dx-test-head">
      <div><p className="dx-eyebrow">Diagnostic · Section {item.part}</p><h2>Question {index + 1} of {items.length}</h2></div>
      <div className="dx-head-actions">
        <span className="dx-count" role="status" aria-live="polite">{answered}/{items.length} answered · {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved' : 'Autosave on'}</span>
        <button type="button" className="ghost-btn" onClick={onExit}>Save and exit</button>
      </div>
    </header>
    <div className="dx-progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={answered} aria-label="Questions answered"><span style={{ width: `${(answered / items.length) * 100}%` }} /></div>
    {error && <p role="alert" className="dx-alert">{error} {saveState === 'error' && <button type="button" className="ghost-btn" onClick={() => save(item.question_id, selected)}>Retry save</button>}</p>}
    <section className="dx-question" aria-label={`Question ${index + 1}`}>
      <p className="dx-prompt">{item.prompt}</p>
      <fieldset>
        <legend className="dx-muted">{item.question_type === 'sata' ? 'Select all that apply' : 'Select one answer'}</legend>
        {item.choices.map(choice => <label key={choice.id} className={`dx-choice ${selected.includes(choice.id) ? 'dx-choice-on' : ''}`}>
          <input type={inputType} name={`q-${item.question_id}`} checked={selected.includes(choice.id)} onChange={() => choose(choice.id)} />
          <span>{choice.text}</span>
        </label>)}
      </fieldset>
      {item.question_type === 'sata' && <p className="dx-muted">You can change your selections, but at least one must stay selected.</p>}
    </section>
    <nav className="dx-nav" aria-label="Question navigation">
      <button type="button" className="ghost-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={16} aria-hidden="true" /> Previous</button>
      <button type="button" className="ghost-btn" disabled={firstOpen < 0} onClick={() => setIndex(firstOpen)}>Go to first unanswered</button>
      {index < items.length - 1
        ? <button type="button" className="primary-btn" onClick={() => setIndex(index + 1)}>Next <ChevronRight size={16} aria-hidden="true" /></button>
        : <button type="button" className="primary-btn" onClick={() => setConfirming(true)}>Review and submit</button>}
    </nav>
    <details className="dx-palette-wrap">
      <summary>Question list ({answered} answered)</summary>
      <div className="dx-palette" role="group" aria-label="Jump to question">
        {items.map((it, i) => <button key={it.question_id} type="button"
          className={`dx-dot ${answers[it.question_id]?.length ? 'dx-dot-done' : ''} ${i === index ? 'dx-dot-current' : ''}`}
          aria-label={`Question ${i + 1}, ${answers[it.question_id]?.length ? 'answered' : 'unanswered'}${i === index ? ', current' : ''}`}
          aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}>{i + 1}</button>)}
      </div>
    </details>
    <div className="dx-submit-row"><button type="button" className="primary-btn" onClick={() => setConfirming(true)}>Submit diagnostic</button></div>
    {confirming && <SubmitDialog unanswered={items.length - answered} busy={busy} onCancel={() => setConfirming(false)} onConfirm={submit} />}
  </div>;
}

function ReportScreen({ attemptId, onBack }) {
  const [report, setReport] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    diagnosticRpc('get_my_diagnostic_report', { p_attempt: attemptId }).then(data => {
      if (!active) return;
      if (!data) setError('This report is not available.'); else setReport(data);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attemptId]);

  async function loadReview() {
    try { setReview(await diagnosticRpc('get_my_diagnostic_review', { p_attempt: attemptId })); }
    catch (e) { setError(e.message); }
  }

  if (error) return <div><p role="alert" className="dx-alert">{error}</p><button type="button" className="ghost-btn" onClick={onBack}>Back</button></div>;
  if (!report) return <p className="dx-muted" role="status">Loading your report…</p>;
  const missed = (review ?? []).filter(r => !r.is_correct);
  return <div className="dx-report-page">
    <div className="dx-toolbar">
      <button type="button" className="ghost-btn" onClick={onBack}><ChevronLeft size={16} aria-hidden="true" /> All diagnostics</button>
      <button type="button" className="ghost-btn" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print report</button>
    </div>
    <ReportBody report={report} />
    <section className="dx-panel" aria-label="Review missed questions">
      <h3>Review missed questions</h3>
      {!review && <button type="button" className="ghost-btn" onClick={loadReview}>Show missed questions and rationales</button>}
      {review && missed.length === 0 && <p className="dx-good">You answered every question correctly.</p>}
      {review && missed.length > 0 && <ol className="dx-review">{missed.map(r => <li key={r.question_id}>
        <p className="dx-prompt">Q{r.position}. {r.prompt}</p>
        <p><strong>Your answer:</strong> {r.selected?.length ? r.selected.join(', ').toUpperCase() : 'Not answered'} · <strong>Correct:</strong> {(r.correct_answer ?? []).join(', ').toUpperCase()}</p>
        <p className="dx-muted">{r.rationale}</p>
      </li>)}</ol>}
    </section>
  </div>;
}

export default function DiagnosticView({ session }) {
  const [screen, setScreen] = useState({ name: 'list' });
  const [assignments, setAssignments] = useState(null);
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, history] = await Promise.all([diagnosticRpc('my_diagnostic_assignments'), diagnosticRpc('my_diagnostic_progress')]);
      setAssignments(mine ?? []); setProgress(history ?? []); setError('');
    } catch (e) { setError(e.message); setAssignments([]); }
  }, []);
  useEffect(() => { if (session?.user?.id) load(); }, [session?.user?.id, load]);
  const submitted = useCallback(id => setScreen({ name: 'report', attemptId: id }), []);

  async function start(formId) {
    setBusy(true); setError('');
    try { const id = await diagnosticRpc('start_diagnostic', { p_form: formId }); setScreen({ name: 'test', attemptId: id }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!session?.user?.id) return null;
  if (screen.name === 'test') return <section className="dx-page"><TestScreen attemptId={screen.attemptId} onSubmitted={submitted} onExit={() => { setScreen({ name: 'list' }); load(); }} /></section>;
  if (screen.name === 'report') return <section className="dx-page"><ReportScreen attemptId={screen.attemptId} onBack={() => { setScreen({ name: 'list' }); load(); }} /></section>;

  return <section className="dx-page" aria-labelledby="dx-title">
    <header className="dx-header"><div><p className="dx-eyebrow">SMART NCLEX Roadmap™</p><h2 id="dx-title">Diagnostic</h2>
      <p className="dx-muted">Find your exact learning gaps, then follow a personalised roadmap. Your tutor assigns each diagnostic.</p></div></header>
    <p className="dx-note" role="note">{DIAGNOSTIC_NOTE}</p>
    {error && <p role="alert" className="dx-alert">{error}</p>}
    {assignments === null && <p className="dx-muted" role="status">Loading…</p>}
    {assignments?.length === 0 && <div className="dx-empty"><ClipboardCheck size={28} aria-hidden="true" /><h3>No diagnostic assigned yet</h3>
      <p>When your tutor assigns a diagnostic it will appear here.</p></div>}
    <div className="dx-cards">{assignments?.map(a => {
      const left = a.attempts_allowed - a.attempts_used;
      return <article key={a.form_id} className="dx-panel" aria-label={a.name}>
        <h3>{a.name}</h3>
        <p className="dx-muted">Attempts used: {a.attempts_used} of {a.attempts_allowed}</p>
        <div className="dx-actions">
          {a.open_attempt_id && <button type="button" className="primary-btn" disabled={busy} onClick={() => start(a.form_id)}>Resume diagnostic</button>}
          {!a.open_attempt_id && left > 0 && <button type="button" className="primary-btn" disabled={busy} onClick={() => start(a.form_id)}>{a.attempts_used === 0 ? 'Start diagnostic' : 'Start retest'}</button>}
          {a.last_attempt_id && <button type="button" className="ghost-btn" onClick={() => setScreen({ name: 'report', attemptId: a.last_attempt_id })}>View latest report</button>}
          {!a.open_attempt_id && left <= 0 && !a.last_attempt_id && <span className="dx-muted">No attempts remaining</span>}
        </div>
      </article>;
    })}</div>
    {progress.length > 0 && <section className="dx-panel" aria-label="Your progress">
      <h3>Your progress</h3>
      <table className="dx-table"><thead><tr><th scope="col">Attempt</th><th scope="col">Date</th><th scope="col">Overall</th><th scope="col">Change</th><th scope="col"><span className="dx-sr">Report</span></th></tr></thead>
        <tbody>{progress.map((p, i) => {
          const delta = i > 0 && p.pct != null && progress[i - 1].pct != null ? p.pct - progress[i - 1].pct : null;
          return <tr key={p.attempt_id}>
            <td data-label="Attempt">#{p.attempt_no}</td><td data-label="Date">{p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}</td>
            <td data-label="Overall">{p.pct == null ? '—' : `${Math.round(p.pct)}%`}</td>
            <td data-label="Change">{delta == null ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta)} pts`}</td>
            <td data-label="Report"><button type="button" className="ghost-btn" aria-label={`View report for attempt ${p.attempt_no}`} onClick={() => setScreen({ name: 'report', attemptId: p.attempt_id })}>View</button></td>
          </tr>;
        })}</tbody></table>
    </section>}
  </section>;
}
