import React, { useEffect, useState } from 'react';
import { learningRequest as request, cpdTotals, exportLearningCsv, safeLearningUrl } from '../services/lifelong';
import './lifelong.css';

const STAGES = { student: 'Nursing student', nclex: 'Preparing for NCLEX', practicing: 'Practicing nurse', educator: 'Nurse educator', leader: 'Nurse leader' };
const PROGRAMS = { 'CPD Centre': 'cpd', 'Educator Academy': 'educator', 'Leadership Academy': 'leadership', 'Clinical Cases': 'clinical', 'Career Hub': 'career' };
const year = new Date().getFullYear();
const today = () => new Date().toISOString().slice(0, 10);
const blankProfile = { career_stage: 'nclex', goals: '', daily_email: true, country_id: '', specialty_id: '', cycle_start: `${year}-01-01`, cycle_end: `${year}-12-31`, target_hours: 0, target_points: 0 };

export default function LifelongLearning({ session, view = 'Learning Hub', onNavigate }) {
  const [profile, setProfile] = useState(blankProfile);
  const [taxonomy, setTaxonomy] = useState([]);
  const [items, setItems] = useState([]);
  const [records, setRecords] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null); const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); const [result, setResult] = useState(null); const [step, setStep] = useState(0);
  const [search, setSearch] = useState(''); const [audience, setAudience] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [external, setExternal] = useState({ title: '', provider: '', hours: '', points: '', completed_on: today(), expires_on: '', evidence_url: '', reflection: '' });
  const [period, setPeriod] = useState('cycle');
  async function refresh() {
    const [p, t, i, r, c] = await Promise.all([
      request(db => db.from('learning_profiles').select('*').eq('user_id', session.user.id).maybeSingle()),
      request(db => db.from('learning_taxonomy').select('*').eq('active', true).order('label')),
      request(db => db.from('learning_items').select('*').eq('status', 'published').order('title')),
      request(db => db.from('cpd_records').select('*').eq('user_id', session.user.id).order('completed_on', { ascending: false })),
      request(db => db.from('learning_completions').select('*').eq('user_id', session.user.id)),
    ]);
    setProfile({ ...blankProfile, ...p }); setTaxonomy(t); setItems(i); setRecords(r); setCompletions(c);
  }
  useEffect(() => { let active = true; setLoading(true); refresh().catch(e => active && setError(e.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [session.user.id]);
  useEffect(() => { setSelected(null); setResult(null); setError(''); }, [view]);
  async function act(fn, message) {
    setError(''); setNotice(''); setBusy(true);
    try { await fn(); if (message) setNotice(message); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const start = period === 'year' ? `${year}-01-01` : profile.cycle_start || `${year}-01-01`;
  const end = period === 'year' ? `${year}-12-31` : profile.cycle_end || `${year}-12-31`;
  const totals = cpdTotals(records, start, end);
  const due = records.filter(r => r.expires_on && r.expires_on <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const program = taxonomy.find(t => t.kind === 'program' && t.code === PROGRAMS[view]);
  const shown = items.filter(i => i.kind !== 'competency' && (view !== 'Nursing Question Bank' || i.kind === 'question') && (!PROGRAMS[view] || i.program_id === program?.id) && (!programFilter || i.program_id === programFilter) && (!audience || i.audience === audience) && `${i.title} ${i.summary}`.toLowerCase().includes(search.toLowerCase()));
  const field = (key, label, type = 'text') => <label>{label}<input type={type} value={profile[key] ?? ''} min={type === 'number' ? 0 : undefined} onChange={e => setProfile({ ...profile, [key]: e.target.value })} /></label>;
  async function openItem(item) {
    await act(async () => { const qs = await request(db => db.rpc('learning_questions', { p_item: item.id })); setQuestions(qs); setSelected(item); setAnswers({}); setResult(null); setStep(0); });
  }
  function transcript() {
    exportLearningCsv('NurseFaculty-CPD-transcript.csv', [['Activity', 'Provider / authority', 'Date', 'Hours', 'Points', 'Source', 'Expiry'], ...records.filter(r => r.completed_on >= start && r.completed_on <= end).map(r => [r.title, r.provider, r.completed_on, r.hours, r.points, r.source === 'platform' ? 'Platform assessed' : 'Self-reported external', r.expires_on])]);
  }
  if (loading) return <section className="content-band"><p role="status">Loading your learning records…</p></section>;
  return <section className="content-band lifelong">
    <div className="section-title"><div><span className="eyebrow">NurseFaculty • Lifelong learning</span><h2>{view}</h2><p>Build your knowledge and keep your professional learning together.</p></div></div>
    {error && <p role="alert" className="lf-error">{error}</p>}{notice && <p role="status" className="lf-notice">{notice}</p>}
    <div className="lf-stats"><article><span>Completed learning</span><strong>{completions.length}</strong></article><article><span>Hours · {start} to {end}</span><strong>{totals.hours}</strong></article><article><span>Recorded points</span><strong>{totals.points}</strong></article><article><span>Expired / due within 30 days</span><strong>{due.length}</strong></article></div>
    {view === 'Professional Passport' && <div className="lf-panel"><h3>Your professional learning record</h3><p>{STAGES[profile.career_stage]} · {taxonomy.find(t=>t.id===profile.specialty_id)?.label || 'Specialty not selected'}</p><p>{profile.goals}</p><div className="lf-toolbar"><button className="ghost-btn" onClick={()=>onNavigate('Professional CV')}>Build my CV</button><button className="ghost-btn" onClick={()=>onNavigate('Competencies')}>View assessed competencies</button></div></div>}
    {view === 'Learning Hub' && <>
      <div className="lf-grid">{Object.keys(PROGRAMS).map(name => <button className="lf-card" key={name} onClick={() => onNavigate(name)}><h3>{name}</h3><p>{({ 'CPD Centre': 'Courses, learning hours and renewal records', 'Educator Academy': 'Teaching, assessment, OSCE, simulation and mentorship', 'Leadership Academy': 'Delegation, supervision, conflict management and quality improvement', 'Clinical Cases': 'Practice clinical judgment through unfolding cases' })[name]}</p></button>)}</div>
      <form className="lf-panel lf-form" onSubmit={e => { e.preventDefault(); const { daily_email, ...learningProfile } = profile; act(() => request(db => db.from('learning_profiles').upsert({ ...learningProfile, user_id: session.user.id, country_id: profile.country_id || null, specialty_id: profile.specialty_id || null, cycle_start: profile.cycle_start || null, cycle_end: profile.cycle_end || null, target_hours: Number(profile.target_hours), target_points: Number(profile.target_points) })), 'Learning preferences saved.'); }}>
        <h3>Your learning goals</h3><label>Career stage<select value={profile.career_stage} onChange={e => setProfile({ ...profile, career_stage: e.target.value })}>{Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {['country', 'specialty'].map(kind => <label key={kind}>{kind === 'country' ? 'Country' : 'Specialty'}<select value={profile[`${kind}_id`] || ''} onChange={e => setProfile({ ...profile, [`${kind}_id`]: e.target.value })}><option value="">Choose when available</option>{taxonomy.filter(t => t.kind === kind).map(t => <option value={t.id} key={t.id}>{t.label}</option>)}</select></label>)}
        {field('goals', 'Goals')}{field('cycle_start', 'Renewal cycle starts', 'date')}{field('cycle_end', 'Renewal cycle ends', 'date')}{field('target_hours', 'Your hours target', 'number')}{field('target_points', 'Your points target', 'number')}
        <button type="button" className="ghost-btn" onClick={() => onNavigate('Account')}>Daily email time and notification preferences</button><button disabled={busy} className="primary-btn">Save preferences</button>
      </form>
      <button className="ghost-btn" onClick={() => onNavigate('Questions')}>Continue NCLEX preparation</button>
      <button className="ghost-btn" onClick={() => onNavigate('Learning Catalog')}>Browse all programs</button>
    </>}
    {(PROGRAMS[view] || ['Learning Catalog','Nursing Question Bank'].includes(view)) && <>
      {['Learning Catalog','Nursing Question Bank'].includes(view) && <label>Program<select value={programFilter} onChange={e=>setProgramFilter(e.target.value)}><option value="">All programs</option>{taxonomy.filter(t=>t.kind==='program').map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>}
      <div className="lf-toolbar"><input aria-label="Search learning" placeholder="Search learning…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Learning audience" value={audience} onChange={e => setAudience(e.target.value)}><option value="">All learning contexts</option>{['nclex', 'school', 'clinical', 'specialty'].map(a => <option key={a} value={a}>{a}</option>)}</select></div>
      {!selected ? <div className="lf-grid">{shown.map(item => <article className="lf-card" key={item.id}><span className="eyebrow">{item.kind} · {item.hours} hours</span><h3>{item.title}</h3><p>{item.summary}</p><small>Version {item.version} · Reviewed {item.reviewed_on}</small><button className="primary-btn" disabled={busy || item.next_review_on <= today()} onClick={() => openItem(item)}>{item.next_review_on <= today() ? 'Awaiting content review' : 'Open learning'}</button></article>)}{!shown.length && <p className="lf-panel">No published courses match this view yet. Reviewed learning will appear here when released.</p>}</div> : <article className="lf-panel">
        <button className="ghost-btn" onClick={() => setSelected(null)}>Back to courses</button><h3>{selected.title}</h3><div className="lf-prose">{selected.body}</div>
        {safeLearningUrl(selected.media_url) && <a target="_blank" rel="noreferrer" href={safeLearningUrl(selected.media_url)}>Open supporting video / resource</a>}
        <details><summary>Sources and review details</summary><p className="lf-prose">{selected.references_text}</p><p>Author ID: {selected.author_id}<br />Reviewer ID: {selected.reviewer_id}<br />Version {selected.version} · Reviewed {selected.reviewed_on} · Next review {selected.next_review_on}</p></details>
        <form onSubmit={e => { e.preventDefault(); act(async () => { const r = await request(db => db.rpc('submit_learning_assessment', { p_item: selected.id, p_version: selected.version, p_answers: questions.map((_, i) => answers[i] ?? null) })); setResult(r); await refresh(); }); }}>
          {(selected.kind === 'case' && !result ? questions.map((q, i) => ({ q, i })).filter(x => x.i === step) : questions.map((q, i) => ({ q, i }))).map(({ q, i }) => <fieldset key={i}><legend>{q.stage ? `${q.stage} — ` : ''}{q.prompt}</legend>{q.choices.map((choice, j) => <label className="lf-check" key={j}><input disabled={!!result} type="radio" name={`q-${i}`} checked={answers[i] === j} onChange={() => setAnswers({ ...answers, [i]: j })} required />{choice}</label>)}{result && <p className="lf-notice">Correct answer: {q.choices[result.feedback[i].correct]}<br />{result.feedback[i].rationale}</p>}</fieldset>)}
          {selected.kind === 'case' && !result && <div className="lf-toolbar"><span>Stage {step + 1} of {questions.length}</span><button type="button" className="ghost-btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button>{step < questions.length - 1 && <button type="button" className="primary-btn" disabled={answers[step] === undefined} onClick={() => setStep(step + 1)}>Next stage</button>}</div>}
          {!result && <button className="primary-btn" disabled={busy || Object.keys(answers).length !== questions.length || !questions.length}>Submit assessment</button>}
          {result && <div role="status"><h3>{result.score}% · {result.passed ? 'Completed' : 'Keep practicing'}</h3><p>{result.passed ? 'Your completion, transcript and certificate have been recorded.' : 'Review the explanations and try again.'}</p><button type="button" className="ghost-btn" onClick={() => { setResult(null); setAnswers({}); setStep(0); }}>Try again</button></div>}
        </form>
      </article>}
    </>}
    {(view === 'CPD Centre' || view === 'Learning Analytics' || view === 'Professional Passport') && <div className="lf-panel">
      <div className="lf-toolbar"><h3>CPD transcript</h3><select aria-label="Transcript period" value={period} onChange={e => setPeriod(e.target.value)}><option value="cycle">Renewal cycle</option><option value="year">Calendar year {year}</option></select><button className="ghost-btn" onClick={transcript}>Export CSV</button><button className="ghost-btn" onClick={() => onNavigate('Certificates')}>Certificates</button></div>
      <p>{totals.verifiedHours} platform-assessed hours. External activities are self-reported. Hours and points are tracked separately against your chosen targets ({profile.target_hours} hours / {profile.target_points} points).</p>
      {due.map(r => <p className="lf-notice" key={r.id}>{r.title} — {r.expires_on < today() ? 'expired' : 'renew by'} {r.expires_on}</p>)}
      <div className="lf-table"><table><thead><tr><th>Activity</th><th>Date</th><th>Hours</th><th>Points</th><th>Source</th></tr></thead><tbody>{records.filter(r => r.completed_on >= start && r.completed_on <= end).map(r => <tr key={r.id}><td>{r.title}</td><td>{r.completed_on}</td><td>{r.hours}</td><td>{r.points}</td><td>{r.source === 'platform' ? 'Platform assessed' : 'Self-reported'}</td></tr>)}</tbody></table></div>
    </div>}
    {view === 'Learning Analytics' && <div className="lf-panel"><h3>Course completion results</h3><div className="lf-table"><table><thead><tr><th>Learning item</th><th>Version</th><th>Score</th><th>Completed</th></tr></thead><tbody>{completions.map(c=><tr key={`${c.item_id}-${c.version}`}><td>{items.find(i=>i.id===c.item_id)?.title||records.find(r=>r.item_id===c.item_id)?.title||'Completed learning'}</td><td>{c.version}</td><td>{c.score}%</td><td>{c.completed_at?.slice(0,10)}</td></tr>)}</tbody></table></div><div className="lf-toolbar"><button className="ghost-btn" onClick={()=>onNavigate('Analytics')}>NCLEX readiness analytics</button><button className="ghost-btn" onClick={()=>onNavigate('Competencies')}>Workplace competency analytics</button></div></div>}
    {view === 'CPD Centre' && <form className="lf-panel lf-form" onSubmit={e => { e.preventDefault(); act(async () => { if (external.evidence_url && !safeLearningUrl(external.evidence_url)) throw new Error('Use an HTTPS evidence link.'); await request(db => db.from('cpd_records').insert({ ...external, user_id: session.user.id, hours: Number(external.hours), points: Number(external.points), expires_on: external.expires_on || null, evidence_url: external.evidence_url || null })); setExternal({ title: '', provider: '', hours: '', points: '', completed_on: today(), expires_on: '', evidence_url: '', reflection: '' }); await refresh(); }, 'External activity recorded as self-reported.'); }}>
      <h3>Record external learning</h3>{Object.entries({ title: 'Activity title', provider: 'Provider / credit authority', hours: 'Hours', points: 'Points', completed_on: 'Completion date', expires_on: 'Expiry date (optional)', evidence_url: 'Evidence link (optional)', reflection: 'Reflection' }).map(([k, label]) => <label key={k}>{label}<input required={['title', 'completed_on'].includes(k)} type={k.endsWith('_on') ? 'date' : ['hours', 'points'].includes(k) ? 'number' : k === 'evidence_url' ? 'url' : 'text'} min={['hours', 'points'].includes(k) ? 0 : undefined} step="0.25" max={k === 'completed_on' ? today() : undefined} value={external[k]} onChange={e => setExternal({ ...external, [k]: e.target.value })} /></label>)}<button disabled={busy} className="primary-btn">Save activity</button>
    </form>}
  </section>;
}
