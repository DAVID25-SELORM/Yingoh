import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { useSubscription } from '../hooks/useSubscription';
import { accessRpc, grantDates, localDateTime, parseBulkEntries } from '../services/accessPromotions';
import './access-promotions.css';
import PromotionManager from './PromotionManager';
import AccessPaymentMonitor from './AccessPaymentMonitor';

const date = value => value ? new Date(value).toLocaleString() : '—';
function StudentSearch({ onSelect, label = 'Find student' }) {
  const [query, setQuery] = useState(''), [rows, setRows] = useState([]), [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) { setRows([]); return; }
      accessRpc('admin_access_users', { p_query: query }).then(data => { if (current) { setRows(data); setError(''); } })
        .catch(e => { if (current) setError(e.message); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);
  return <div><label>{label}<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or email, 2+ characters" /></label>
    {error && <p role="alert">{error}</p>}<ul className="ap-search-results">{rows.map(u => <li key={u.id}><button type="button" className="ghost-btn" onClick={() => { onSelect(u); setQuery(''); setRows([]); }}>{u.full_name || u.email} · {u.email}</button></li>)}</ul></div>;
}
function GrantForm({ mode, record, plans, initialUser, onClose, onSaved }) {
  const [student, setStudent] = useState(initialUser ?? (record ? { id: record.user_id, full_name: record.student_name } : null));
  const [entries, setEntries] = useState(''), [plan, setPlan] = useState(record?.plan_id ?? plans[0]?.id ?? '');
  const [start, setStart] = useState(localDateTime(new Date(Math.max(Date.now()+60000, mode === 'extend' ? Date.parse(record.expires_at) : 0))));
  const [days, setDays] = useState(30), [reason, setReason] = useState(''), [note, setNote] = useState('');
  const [notify, setNotify] = useState(false), [review, setReview] = useState(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const running = useRef(false);
  let datesPreview; try { datesPreview = grantDates(start, days); } catch { /* Render field validation. */ }
  async function preview(e) {
    e.preventDefault(); if (running.current) return; running.current = true; setBusy(true); setError('');
    try {
      if (!reason.trim() || !plan || (mode !== 'bulk' && !student)) throw new Error('Select a student, plan and reason.');
      const dates = grantDates(start, days);
      const payload = { p_plan_id:plan, p_starts_at:dates.start, p_expires_at:dates.end, p_reason:reason.trim(),
        p_internal_note:note || null, p_notify:notify, p_request_key:crypto.randomUUID() };
      if (mode === 'bulk') {
        payload.p_entries = parseBulkEntries(entries);
        const result = await accessRpc('admin_preview_bulk_access', { p_entries:payload.p_entries });
        payload.p_preview_hash = result.preview_hash; setReview({ payload, result });
      } else {
        payload.p_user_id = student.id; payload.p_parent_grant_id = mode === 'extend' ? record.id : null;
        setReview({ payload });
      }
    } catch (err) { setError(err.message); } finally { running.current = false; setBusy(false); }
  }
  async function confirm() {
    if (running.current) return; running.current = true; setBusy(true); setError('');
    try { await accessRpc(mode === 'bulk' ? 'admin_execute_bulk_access' : 'admin_issue_access', review.payload); onSaved(); }
    catch (err) { setError(err.message); } finally { running.current = false; setBusy(false); }
  }
  async function upload(file) {
    try {
      if (!file) return;
      if (file.size > 100000) throw new Error('Upload a file smaller than 100 KB.');
      setEntries(parseBulkEntries(await file.text(), true).join('\n')); setError('');
    } catch (err) { setError(err.message); }
  }
  return <section className="ap-panel" aria-label="Access grant form"><header className="ap-header"><h3>{mode === 'bulk' ? 'Bulk grant access' : mode === 'extend' ? 'Extend access' : 'Grant complimentary access'}</h3><button className="ghost-btn" disabled={busy} onClick={onClose}>Cancel</button></header>
    {error && <p role="alert" className="ap-error">{error}</p>}
    {review ? <section aria-label="Review grant"><h4>Review and confirm</h4><p>{plans.find(p => p.id === plan)?.name} · {days} days · Charge: GHS 0</p>
      <p>{date(review.payload.p_starts_at)} → {date(review.payload.p_expires_at)}</p><p>{reason}</p>
      {review.result ? <><dl className="ap-stats">{Object.entries(review.result.summary).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
        <ul>{review.result.rows.map((row,i) => <li key={i}>{row.entry}: {row.status}</li>)}</ul><p>Existing paid and complimentary recipients are skipped.</p></> : <p>{student.full_name || student.email}</p>}
      <p>{notify ? 'Send an in-app notification.' : 'No notification requested.'} Paid subscriptions remain unchanged.</p>
      <div className="ap-actions"><button className="ghost-btn" disabled={busy} onClick={() => setReview(null)}>Back to edit</button><button className="primary-btn" disabled={busy || (review.result && !review.result.summary.eligible)} onClick={confirm}>{busy ? 'Saving…' : 'Confirm access grant'}</button></div>
    </section> : <form onSubmit={preview}><fieldset disabled={busy}>
      {mode !== 'extend' && <StudentSearch onSelect={u => mode === 'bulk' ? setEntries(v => v + (v ? '\n' : '') + u.id) : setStudent(u)} label={mode === 'bulk' ? 'Add selected student' : 'Find student'} />}
      {mode === 'bulk' ? <><label>Email addresses or selected IDs<textarea rows={5} required value={entries} onChange={e => setEntries(e.target.value)} /></label><label>CSV with email column (maximum 100 entries)<input type="file" accept=".csv,text/csv" onChange={e => upload(e.target.files[0])} /></label></> : <p>Student: {student?.full_name || student?.email || 'Select a student above'}</p>}
      <div className="ap-grid"><label>Plan<select required disabled={mode === 'extend'} value={plan} onChange={e => setPlan(e.target.value)}>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Start date and time<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Duration preset<select value={[7,14,30,60,90].includes(Number(days)) ? days : 'custom'} onChange={e => setDays(e.target.value === 'custom' ? 1 : Number(e.target.value))}>{[7,14,30,60,90].map(d => <option key={d} value={d}>{d} days</option>)}<option value="custom">Custom</option></select></label>
        <label>Duration in days<input required type="number" min="1" max="3650" value={days} onChange={e => setDays(e.target.value)} /></label></div>
      <p>Expiry: {datesPreview ? date(datesPreview.end) : 'Choose a valid start and duration'}. Each day is 24 hours.</p>
      <label>Reason<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><label>Internal note<textarea maxLength={4000} value={note} onChange={e => setNote(e.target.value)} /></label>
      <label className="ap-checkbox"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> Send in-app notification</label><p>Ordinary administrators have a cumulative 30-day limit per student.</p>
      <button className="primary-btn">Review before granting</button></fieldset></form>}
  </section>;
}
function RevokeForm({ record, onClose, onSaved }) {
  const [reason,setReason]=useState(''), [notify,setNotify]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const running=useRef(false);
  async function submit(e) {
    e.preventDefault(); if (running.current) return; running.current=true; setBusy(true);
    try { await accessRpc('admin_revoke_access_with_notice',{ p_grant_id:record.id,p_reason:reason,p_notify:notify }); onSaved(); }
    catch(err){ setError(err.message); } finally { running.current=false;setBusy(false); }
  }
  return <section className="ap-panel"><h3>Confirm revocation</h3><p>Revoke this grant for {record.student_name || record.student_email}? Paid subscriptions and separately issued extensions remain unchanged.</p>
    {error && <p role="alert">{error}</p>}<form onSubmit={submit}><fieldset disabled={busy}><label>Required reason<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} /></label><label className="ap-checkbox"><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} /> Notify student in-app</label>
      <div className="ap-actions"><button type="button" className="ghost-btn" onClick={onClose}>Cancel</button><button className="primary-btn" disabled={!reason.trim()}>Confirm revocation</button></div></fieldset></form></section>;
}
export default function AccessPromotions({ session, readOnly=false, initialUser=null }) {
  const access=useSubscription(session); const allowed=access.hasAdminAccess && access.can('access_grant.view');
  const [tab,setTab]=useState('Overview'),[plans,setPlans]=useState([]),[overview,setOverview]=useState(null);
  const [list,setList]=useState({rows:[],total:0}),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [revision,setRevision]=useState(0),[page,setPage]=useState(0),[status,setStatus]=useState(''),[plan,setPlan]=useState('');
  const [student,setStudent]=useState(null),[from,setFrom]=useState(''),[to,setTo]=useState(''),[action,setAction]=useState('');
  const [historyGrant,setHistoryGrant]=useState(null),[form,setForm]=useState(null),[message,setMessage]=useState('');
  const [actor,setActor]=useState(null),[promoFilter,setPromoFilter]=useState('');
  const prefilled=useRef(null);
  useEffect(()=>{ if(initialUser && allowed && !readOnly && plans.length && overview?.enabled && prefilled.current!==initialUser.id) {
    prefilled.current=initialUser.id;setForm({mode:'create',initialUser});
  } },[initialUser,allowed,readOnly,plans.length,overview?.enabled]);
  useEffect(()=>{setPage(0);},[tab,status,plan,student,from,to,action,historyGrant,actor,promoFilter]);
  useEffect(()=>{
    if(!allowed)return; let current=true;setLoading(true);setError('');
    const dates={p_from:from?new Date(from+'T00:00:00').toISOString():null,p_to:to?new Date(new Date(to+'T00:00:00').getTime()+86400000).toISOString():null};
    Promise.all([accessRpc('admin_access_dashboard'),supabase.from('payment_plans').select('id,name').eq('is_active',true).gt('price_usd',0).order('sort_order'),
      tab==='History'?(historyGrant?accessRpc('admin_access_history',{...dates,p_page:page,p_user:student?.id??null,p_action:action||null,p_grant:historyGrant,p_actor:actor?.id??null}):
      accessRpc('admin_access_activity',{...dates,p_page:page,p_user:student?.id??null,p_actor:actor?.id??null,p_action:action||null,p_promo:/^[a-f0-9-]{36}$/i.test(promoFilter)?promoFilter:null})):
      accessRpc('admin_access_grants',{...dates,p_page:page,p_user:student?.id??null,p_status:status||null,p_plan:plan||null})])
      .then(([stats,products,rows])=>{if(!current)return;if(products.error)throw new Error('Plans could not be loaded.');setOverview(stats);setPlans(products.data??[]);setList(rows);})
      .catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[allowed,tab,page,status,plan,student,from,to,action,historyGrant,revision,actor,promoFilter]);
  if(access.loading)return <p role="status">Loading access permissions…</p>;
  if(!allowed)return <p role="alert">Access management permission is required.</p>;
  const saved=()=>{setForm(null);setRevision(v=>v+1);setMessage('Saved. Access history has been updated.');};
  return <section className="ap-page" aria-label="Access and Promotions">
    <header className="ap-header"><div><h2>Access &amp; Promotions</h2><p>Complimentary access and auditable student support.</p></div><div className="ap-actions">
      <button className="ghost-btn" disabled={readOnly||!overview?.enabled||!access.can('access_grant.bulk_create')} onClick={()=>setForm({mode:'bulk'})}>Bulk grant</button>
      <button className="primary-btn" disabled={readOnly||!overview?.enabled||!access.can('access_grant.create')} onClick={()=>setForm({mode:'create'})}>Grant access</button></div></header>
    {overview&&!overview.enabled&&<p className="ap-banner" role="status">Complimentary access is paused server-side. Paid subscriptions remain unchanged.</p>}
    {readOnly&&<p className="ap-banner">Read-only preview</p>}{error&&<p className="ap-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {form&&!readOnly&&(form.mode==='revoke'?<RevokeForm {...form} onClose={()=>setForm(null)} onSaved={saved}/>:<GrantForm {...form} plans={plans} onClose={()=>setForm(null)} onSaved={saved}/>)}
    <nav className="ap-actions" aria-label="Access sections">{['Overview','Free Access',...(access.can('promo.view')?['Promo Codes']:[]),...(access.can('payments.view')?['Payment Monitoring']:[]),'History'].map(name=><button key={name} className="ghost-btn" aria-current={tab===name?'page':undefined} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    {tab==='Promo Codes'&&<PromotionManager access={access} plans={plans} readOnly={readOnly}/>}
    {tab==='Payment Monitoring'&&access.can('payments.view')&&<AccessPaymentMonitor/>}
    {tab==='Overview'&&<><div className="ap-stats">{[['Active complimentary grants',overview?.active],['Expiring in 7 days',overview?.expiring],['Scheduled grants',overview?.scheduled],['Active promo codes',overview?.active_promos],['Redemptions this month',overview?.monthly_redemptions],['Discount value given',overview?.discount_minor==null?'—':'GHS '+(overview.discount_minor/100).toFixed(2)]].map(([label,value])=><article key={label}><h3>{label}</h3><strong>{value??'—'}</strong></article>)}</div><div className="ap-actions"><button className="ghost-btn" onClick={()=>{setTab('Free Access');setStatus('active');}}>View active access</button>{access.can('promo.view')&&<button className="ghost-btn" onClick={()=>setTab('Promo Codes')}>Manage promotions</button>}<button className="ghost-btn" onClick={()=>setTab('History')}>Recent activity</button></div></>}
    {!['Promo Codes','Payment Monitoring'].includes(tab)&&<div className="ap-panel"><div className="ap-grid"><StudentSearch label="Filter by student" onSelect={setStudent}/>{student&&<button className="ghost-btn" onClick={()=>setStudent(null)}>Clear {student.full_name||student.email}</button>}
      {tab!=='History'?<><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['active','scheduled','expired','revoked','expiring'].map(s=><option key={s}>{s}</option>)}</select></label><label>Plan<select value={plan} onChange={e=>setPlan(e.target.value)}><option value="">All plans</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></>:<label>Action<select value={action} onChange={e=>setAction(e.target.value)}><option value="">All actions</option>{['ACCESS_GRANTED','ACCESS_EXTENDED','ACCESS_REVOKED','BULK_ACCESS_GRANTED','PROMO_CREATED','PROMO_UPDATED','PROMO_PAUSED','PROMO_RESUMED','PROMO_ENDED','PROMO_REDEEMED','CHECKOUT_CREATED','PAYMENT_CONFIRMED','PAYMENT_FAILED'].map(a=><option key={a}>{a}</option>)}</select></label>}
      <label>Created from<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Through<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      {tab==='History'&&<><StudentSearch label="Filter by actor" onSelect={setActor}/>{actor&&<button className="ghost-btn" onClick={()=>setActor(null)}>Clear actor {actor.full_name||actor.email}</button>}<label>Promo ID<input value={promoFilter} onChange={e=>setPromoFilter(e.target.value)} placeholder="Optional promotion UUID"/></label></>}
      {historyGrant&&tab==='History'&&<button className="ghost-btn" onClick={()=>setHistoryGrant(null)}>Show all grant history</button>}</div>
      <p aria-live="polite">{loading?'Loading…':list.total+' records · Page '+(page+1)}</p>{!loading&&!list.rows.length&&<p>No matching records.</p>}
      <ul className="ap-rows">{list.rows.map(row=><li key={row.id}><div><strong>{row.student_name||row.student_email||row.target_user_id}</strong>
        {tab==='History'?<><p>{row.action} · {row.actor_name}</p><p>{date(row.created_at)} · {row.reason}</p><details><summary>Event details</summary><pre>{JSON.stringify(row.details??{before:row.old_values,after:row.new_values},null,2)}</pre></details></>:
          <><p><span className="ap-badge">{row.effective_status}</span> {row.plan_name} · {row.grant_type}</p><p>{date(row.starts_at)} → {date(row.expires_at)}</p><details><summary>Grant details</summary><p>{row.reason}</p><p>Internal note: {row.internal_note||'None'}</p><p>Created by: {row.created_by}</p>{row.revoked_at&&<p>Revoked {date(row.revoked_at)}: {row.revocation_reason}</p>}</details></>}
        </div>{tab!=='History'&&<div className="ap-actions"><button className="ghost-btn" onClick={()=>{setHistoryGrant(row.id);setTab('History');}}>History</button><button className="ghost-btn" disabled={readOnly||!overview?.enabled||row.effective_status==='revoked'||!access.can('access_grant.extend')} onClick={()=>setForm({mode:'extend',record:row})}>Extend</button><button className="ghost-btn" disabled={readOnly||row.effective_status==='revoked'||!access.can('access_grant.revoke')} onClick={()=>setForm({mode:'revoke',record:row})}>Revoke</button></div>}</li>)}</ul>
      <footer className="ap-actions"><button className="ghost-btn" disabled={loading||page===0} onClick={()=>setPage(v=>v-1)}>Previous</button><button className="ghost-btn" disabled={loading||(page+1)*25>=list.total} onClick={()=>setPage(v=>v+1)}>Next</button></footer>
    </div>}
  </section>;
}
