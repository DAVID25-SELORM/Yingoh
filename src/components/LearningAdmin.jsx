import React, { useEffect, useState } from 'react';
import { learningRequest as request } from '../services/lifelong';
import './lifelong.css';

const empty = { title: '', kind: 'cpd', audience: 'clinical', program_id: '', country_id: '', specialty_id: '', exam_id: '', course_id: '', legacy_question_id: '', legacy_lesson_id: '', summary: '', body: '', media_url: '', references_text: '', next_review_on: '', hours: 0, points: 0, credit_authority: '', validity_days: '', pass_score: 80 };
const blankQuestion = () => ({ prompt: '', stage: '', choices: ['', ''], correct: 0, rationale: '' });
export default function LearningAdmin({ session }) {
  const [items, setItems] = useState([]); const [taxonomy, setTaxonomy] = useState([]); const [courses, setCourses] = useState([]);
  const [draft, setDraft] = useState(empty); const [questions, setQuestions] = useState([]); const [versions, setVersions] = useState([]);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState({ kind: 'country', code: '', label: '' });
  async function load() {
    const [i,t,c] = await Promise.all([request(db => db.from('learning_items').select('*').order('updated_at', { ascending: false })), request(db => db.from('learning_taxonomy').select('*').order('label')), request(db => db.from('courses').select('id,title').order('title'))]);
    setItems(i); setTaxonomy(t); setCourses(c);
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function act(fn) { setBusy(true); setError(''); setNotice(''); try { await fn(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function edit(item) {
    await act(async () => {
      const [a,v] = await Promise.all([request(db => db.from('learning_assessments').select('questions').eq('item_id', item.id).maybeSingle()), request(db => db.from('learning_item_versions').select('*').eq('item_id',item.id).order('version',{ascending:false}))]);
      setDraft(item); setQuestions(a?.questions || []); setVersions(v);
    });
  }
  async function save() {
    const payload = Object.fromEntries(Object.keys(empty).map(k => [k, draft[k] ?? empty[k]]));
    for (const key of ['program_id','country_id','specialty_id','exam_id','course_id','legacy_question_id','legacy_lesson_id','media_url','next_review_on','validity_days']) payload[key] ||= null;
    for (const key of ['hours','points','pass_score']) payload[key] = Number(payload[key]);
    const item = await request(db => draft.id ? db.from('learning_items').update({ ...payload, status: 'draft' }).eq('id', draft.id).select().single() : db.from('learning_items').insert({ ...payload, author_id: session.user.id }).select().single());
    setDraft(item);
    await request(db => db.from('learning_assessments').upsert({ item_id: item.id, questions }));
    await load(); setNotice('Draft and assessment saved. Submit for independent review when ready.');
  }
  const changeQuestion = (i, key, value) => setQuestions(questions.map((q,j) => j===i ? { ...q, [key]: value } : q));
  const input = (key,label,type='text') => <label key={key}>{label}<input type={type} required={key==='title'} value={draft[key] ?? ''} min={type==='number'?0:undefined} step={type==='number'?'any':undefined} onChange={e=>setDraft({...draft,[key]:e.target.value})} /></label>;
  return <section className="content-band lifelong"><div className="section-title"><h2>Learning Content Management</h2><button className="ghost-btn" onClick={()=>{setDraft(empty);setQuestions([]);setVersions([]);}}>New content</button></div>
    {error && <p role="alert" className="lf-error">{error}</p>}{notice && <p role="status" className="lf-notice">{notice}</p>}
    <div className="lf-toolbar"><label>Existing content<select value={draft.id || ''} onChange={e=>{const i=items.find(x=>x.id===e.target.value);if(i) edit(i);}}><option value="">Select content</option>{items.map(i=><option key={i.id} value={i.id}>{i.title} · {i.status}{i.next_review_on && i.next_review_on <= new Date().toISOString().slice(0,10) ? ' · Review overdue' : ''}</option>)}</select></label></div>
    <form className="lf-form lf-panel" onSubmit={e=>{e.preventDefault();act(save);}}>
      <h3>{draft.id ? `Version ${draft.version} · ${draft.status}` : 'New learning item'}</h3>
      {input('title','Title')}
      <label>Format<select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}>{['lesson','video','case','cpd','regulatory','competency','question'].map(k=><option key={k}>{k}</option>)}</select></label>
      <label>Learning context<select value={draft.audience} onChange={e=>setDraft({...draft,audience:e.target.value})}>{['nclex','school','clinical','specialty'].map(k=><option key={k}>{k}</option>)}</select></label>
      {['program','country','specialty','exam'].map(kind=><label key={kind}>{kind}<select value={draft[`${kind}_id`] || ''} onChange={e=>setDraft({...draft,[`${kind}_id`]:e.target.value})}><option value="">Not specified</option>{taxonomy.filter(t=>t.kind===kind).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>)}
      <label>Existing LMS course<select value={draft.course_id || ''} onChange={e=>setDraft({...draft,course_id:e.target.value})}><option value="">Standalone learning</option>{courses.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
      {input('legacy_question_id','Existing question ID (optional)')}{input('legacy_lesson_id','Existing lesson ID (optional)')}
      {input('summary','Summary')}{input('media_url','Video or resource HTTPS URL','url')}
      <label className="lf-wide">Lesson / case content<textarea value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} /></label>
      <label className="lf-wide">References (source titles and URLs)<textarea value={draft.references_text} onChange={e=>setDraft({...draft,references_text:e.target.value})} /></label>
      {input('next_review_on','Next review date','date')}{input('hours','Learning hours','number')}{input('points','Approved points','number')}{input('credit_authority','Credit authority / approval reference')}{input('validity_days','Certificate validity days (optional)','number')}{input('pass_score','Passing score (%)','number')}
      <div className="lf-wide"><h3>Assessment / case stages</h3><p>Answers and rationales are only shown to learners after server-side grading.</p>
      {questions.map((q,i)=><fieldset key={i}><legend>Question {i+1}</legend><label>Clinical judgment stage<select value={q.stage || ''} onChange={e=>changeQuestion(i,'stage',e.target.value)}><option value="">General assessment</option>{['Recognize cues','Analyze cues','Prioritize hypotheses','Generate solutions','Take action','Evaluate outcomes'].map(s=><option key={s}>{s}</option>)}</select></label><label>Prompt<textarea required value={q.prompt} onChange={e=>changeQuestion(i,'prompt',e.target.value)} /></label>
        {q.choices.map((c,j)=><label key={j}>Choice {j+1}<input required value={c} onChange={e=>changeQuestion(i,'choices',q.choices.map((v,k)=>k===j?e.target.value:v))} /></label>)}
        <button type="button" className="ghost-btn" onClick={()=>changeQuestion(i,'choices',[...q.choices,''])}>Add choice</button>
        <label>Correct choice<select value={q.correct} onChange={e=>changeQuestion(i,'correct',Number(e.target.value))}>{q.choices.map((_,j)=><option key={j} value={j}>{j+1}</option>)}</select></label><label>Rationale<textarea required value={q.rationale} onChange={e=>changeQuestion(i,'rationale',e.target.value)} /></label><button type="button" className="ghost-btn" onClick={()=>setQuestions(questions.filter((_,j)=>j!==i))}>Remove question</button>
      </fieldset>)}<button type="button" className="ghost-btn" onClick={()=>setQuestions([...questions,blankQuestion()])}>Add question / stage</button></div>
      <button className="primary-btn" disabled={busy}>Save as draft</button>
      {draft.id && <div className="lf-toolbar">{['in_review','published','archived'].map(status=><button key={status} type="button" className="ghost-btn" disabled={busy} onClick={()=>act(async()=>{const i=await request(db=>db.from('learning_items').update({status}).eq('id',draft.id).select().single());setDraft(i);await load();setNotice(`Content status: ${status}`);})}>{({in_review:'Submit saved draft for review',published:'Approve and publish saved version',archived:'Archive'})[status]}</button>)}</div>}
    </form>
    {!!versions.length && <details className="lf-panel"><summary>Revision history ({versions.length})</summary>{versions.map(v=><details key={v.version}><summary>Version {v.version} · {v.recorded_at}</summary><pre className="lf-prose">{JSON.stringify(v.snapshot,null,2)}</pre></details>)}</details>}
    <form className="lf-panel lf-form" onSubmit={e=>{e.preventDefault();act(async()=>{await request(db=>db.from('learning_taxonomy').insert(term));await load();setTerm({...term,code:'',label:''});setNotice('Catalog entry added.');});}}><h3>Add a country, exam, specialty or program</h3><label>Type<select value={term.kind} onChange={e=>setTerm({...term,kind:e.target.value})}>{['country','exam','specialty','program','competency'].map(k=><option key={k}>{k}</option>)}</select></label><label>Code<input required value={term.code} onChange={e=>setTerm({...term,code:e.target.value})} /></label><label>Name<input required value={term.label} onChange={e=>setTerm({...term,label:e.target.value})} /></label><button disabled={busy} className="primary-btn">Add catalog entry</button></form>
  </section>;
}
