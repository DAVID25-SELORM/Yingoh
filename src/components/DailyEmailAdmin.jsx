import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export default function DailyEmailAdmin() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(''); const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(''); const [page, setPage] = useState(0);
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function load() {
    setError(''); setBusy(true);
    try {
      const result = await supabase.rpc('admin_daily_emails', { p_date: date, p_status: status || null, p_search: filter, p_page: page });
      if (result.error) throw result.error;
      setData(result.data);
    } catch { setError('Daily email reporting could not be loaded. Administrator access is required.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [date, status, filter, page]);
  async function toggle() {
    setBusy(true);
    const result = await supabase.from('daily_email_config').update({ enabled: !data.enabled }).eq('id', true).select('enabled').single();
    if (result.error) { setError('Could not update the global email setting.'); setBusy(false); } else await load();
  }
  const m = data?.metrics;
  const rate = (n, d) => d ? `${Math.round(n / d * 100)}%` : '—';
  return <section className="content-band"><h2>Daily email monitoring</h2><p>Dates reflect each recipient’s local delivery date. Sent means SMTP accepted; inbox delivery, opens and clicks are not tracked.</p>
    {error && <p role="alert">{error}</p>}
    {data?.rows.some(r => r.last_error === 'delivery_outcome_unknown') && <p role="status">Manual review required: an SMTP outcome is unknown. Automatic retries are blocked to prevent duplicate emails. Check provider logs before taking action.</p>}
    {data && <button className="primary-btn" disabled={busy} onClick={toggle}>{data.enabled ? 'Pause daily emails' : 'Enable daily emails'}</button>}
    <form onSubmit={e => { e.preventDefault(); setPage(0); setFilter(search); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '20px 0' }}>
      <label>Local delivery date<input type="date" required value={date} onChange={e => { setDate(e.target.value); setPage(0); }} /></label>
      <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">All</option>{['scheduled','reserved','sending','sent','failed','answered'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>User or email<input value={search} maxLength={100} onChange={e => setSearch(e.target.value)} /></label><button disabled={busy}>Search</button><button type="button" disabled={busy} onClick={load}>Refresh</button>
    </form>
    {m && <><div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>{['scheduled','sent','pending','failed','answered','correct','incorrect'].map(k => <p key={k}>{k}: <strong>{m[k]}</strong></p>)}</div><p>Send acceptance: {rate(m.sent,m.total)} · Answer rate: {rate(m.answered,m.total)} · Correct answers: {rate(m.correct,m.answered)}</p></>}
    <div style={{ overflowX: 'auto' }}><table><thead><tr>{['User','Email','Question','Local date / zone','Scheduled (UTC)','Status','Sent','Answered','Correct?','Attempts','Diagnostic'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data?.rows.map(r => <tr key={r.id}><td>{r.full_name}</td><td>{r.email}</td><td>{r.question_id}</td><td>{r.scheduled_date} {r.timezone}</td><td>{r.scheduled_for}</td><td>{r.status}</td><td>{r.sent_at || '—'}</td><td>{r.answered_at || '—'}</td><td>{r.is_correct == null ? '—' : r.is_correct ? 'Yes' : 'No'}</td><td>{r.retry_count}</td><td>{r.last_error || '—'}</td></tr>)}</tbody></table></div>
    {data?.rows.length === 0 && <p>No deliveries match these filters.</p>}
    <p><button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous</button> Page {page + 1} <button disabled={busy || data?.rows.length !== 50} onClick={() => setPage(page + 1)}>Next</button></p>
  </section>;
}
