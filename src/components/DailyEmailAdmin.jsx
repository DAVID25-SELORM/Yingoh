import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, Inbox, Info,
  Mail, MessageSquareReply, Users, Pause, Play, RefreshCw, RotateCcw, Search, Send, Target, X, XCircle,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import './email-ops.css';

const PAGE_SIZE = 50;
const STATUSES = ['scheduled', 'reserved', 'sending', 'sent', 'failed', 'answered'];
const TABS = [['overview', 'Overview'], ['deliveries', 'Deliveries'], ['failures', 'Failures']];
const today = () => new Date().toISOString().slice(0, 10);

// last_error only ever holds short worker outcome codes; unknown values are never echoed verbatim.
const ERROR_LABELS = {
  delivery_outcome_unknown: 'SMTP outcome unknown — manual review required',
  temporary_rejection: 'Temporarily rejected by the mail provider',
  permanent_rejection: 'Permanently rejected by the mail provider',
  invalid_recipient: 'Recipient address is invalid',
};
const errorLabel = code => (code ? ERROR_LABELS[code] || 'Delivery failed — see provider logs' : null);

const STATUS_META = {
  scheduled: { label: 'Scheduled', Icon: CalendarCheck, tone: 'neutral' },
  reserved: { label: 'Scheduled', Icon: CalendarCheck, tone: 'neutral' },
  sending: { label: 'Sending', Icon: Clock, tone: 'warn' },
  sent: { label: 'Sent', Icon: Send, tone: 'info' },
  answered: { label: 'Answered', Icon: MessageSquareReply, tone: 'good' },
  failed: { label: 'Failed', Icon: XCircle, tone: 'bad' },
};

const num = n => (n == null ? '—' : Number(n).toLocaleString('en-US'));
const rate = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : `${d.toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC`;
}

function StatusBadge({ status, retryable }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', Icon: Info, tone: 'neutral' };
  return <span className={`eo-badge eo-badge-${meta.tone}`}><meta.Icon size={13} aria-hidden="true" />{meta.label}{status === 'failed' && retryable ? ' · retry pending' : ''}</span>;
}
function CorrectBadge({ value }) {
  if (value == null) return <span className="eo-muted">—</span>;
  return <span className={`eo-badge ${value ? 'eo-badge-good' : 'eo-badge-bad'}`}>{value ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}{value ? 'Correct' : 'Incorrect'}</span>;
}

function Kpi({ label, value, helper, Icon }) {
  return <div className="eo-kpi"><div className="eo-kpi-label"><span>{label}</span><Icon size={16} aria-hidden="true" /></div><strong>{value}</strong><small>{helper || ' '}</small></div>;
}

function useDialog(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    node?.querySelector('[data-autofocus]')?.focus();
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll('button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open, onClose]);
  return ref;
}

function ConfirmDialog({ enabled, busy, onCancel, onConfirm }) {
  const ref = useDialog(true, onCancel);
  const pausing = enabled;
  return <div className="eo-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
    <div className="eo-modal" role="dialog" aria-modal="true" aria-labelledby="eo-confirm-title" aria-describedby="eo-confirm-body" ref={ref}>
      <h3 id="eo-confirm-title">{pausing ? 'Pause Daily Emails?' : 'Resume Daily Emails?'}</h3>
      <p id="eo-confirm-body">{pausing ? 'Scheduled daily emails will stop being sent until sending is resumed. Existing delivery history will not be deleted.' : 'Scheduled daily email processing will resume.'}</p>
      <div className="eo-modal-actions">
        <button type="button" className="ghost-btn" data-autofocus onClick={onCancel}>Cancel</button>
        <button type="button" className={pausing ? 'eo-danger-btn' : 'primary-btn'} disabled={busy} onClick={onConfirm}>{pausing ? 'Pause Daily Emails' : 'Resume Daily Emails'}</button>
      </div>
    </div>
  </div>;
}

const AUDIENCES = {
  paid: { label: 'Paid subscribers only', note: 'Only users with an active paid plan receive daily emails.' },
  all: { label: 'All users', note: 'Every opted-in user with a verified email receives daily emails, including free accounts.' },
};

function AudienceDialog({ target, preview, busy, onCancel, onConfirm }) {
  const ref = useDialog(true, onCancel);
  const count = preview && Number.isFinite(preview[target === 'all' ? 'all_eligible' : 'paid_eligible']) ? preview[target === 'all' ? 'all_eligible' : 'paid_eligible'] : null;
  return <div className="eo-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
    <div className="eo-modal" role="dialog" aria-modal="true" aria-labelledby="eo-aud-title" aria-describedby="eo-aud-body" ref={ref}>
      <h3 id="eo-aud-title">{target === 'all' ? 'Send to all users?' : 'Send to paid subscribers only?'}</h3>
      <p id="eo-aud-body">{AUDIENCES[target].note}{count != null && <> About <strong>{num(count)}</strong> of {num(preview.opted_in)} opted-in users would be eligible.</>} This applies from the next processing run, does not change existing deliveries, and does not turn sending on or off.</p>
      <div className="eo-modal-actions">
        <button type="button" className="ghost-btn" data-autofocus onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>{target === 'all' ? 'Send to all users' : 'Paid subscribers only'}</button>
      </div>
    </div>
  </div>;
}

function Field({ label, children }) {
  return <div className="eo-field"><dt>{label}</dt><dd>{children}</dd></div>;
}

function DetailDrawer({ row, onClose }) {
  const ref = useDialog(true, onClose);
  const diagnostic = errorLabel(row.last_error);
  return <div className="eo-overlay eo-overlay-drawer" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="eo-drawer" role="dialog" aria-modal="true" aria-labelledby="eo-drawer-title" ref={ref}>
      <header><div><p className="eyebrow">Delivery details</p><h3 id="eo-drawer-title">{row.full_name || row.email || 'Recipient'}</h3></div>
        <button type="button" className="icon-btn" aria-label="Close delivery details" data-autofocus onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
      <section aria-labelledby="eo-d-recipient"><h4 id="eo-d-recipient">Recipient</h4><dl>
        <Field label="Name">{row.full_name || '—'}</Field><Field label="Email">{row.email || '—'}</Field>
        <Field label="Timezone">{row.timezone || '—'}</Field><Field label="Local delivery date">{row.scheduled_date || '—'}</Field></dl></section>
      <section aria-labelledby="eo-d-delivery"><h4 id="eo-d-delivery">Delivery</h4><dl>
        <Field label="Status"><StatusBadge status={row.status} retryable={row.retryable} /></Field>
        <Field label="Scheduled at">{stamp(row.scheduled_for)}</Field><Field label="Sent at">{stamp(row.sent_at)}</Field><Field label="Answered at">{stamp(row.answered_at)}</Field></dl></section>
      <section aria-labelledby="eo-d-question"><h4 id="eo-d-question">Question</h4><dl><Field label="Question ID"><code>{row.question_id || '—'}</code></Field></dl></section>
      <section aria-labelledby="eo-d-engagement"><h4 id="eo-d-engagement">Engagement</h4><dl>
        <Field label="Answered">{row.answered_at ? 'Yes' : 'No'}</Field><Field label="Result"><CorrectBadge value={row.is_correct} /></Field></dl></section>
      <section aria-labelledby="eo-d-diag"><h4 id="eo-d-diag">Delivery diagnostics</h4><dl>
        <Field label="Accepted by SMTP provider">{row.sent_at ? 'Yes' : 'No'}</Field>
        <Field label="Retry count">{row.retry_count ?? '—'}</Field>
        {row.status === 'failed' && <Field label="Automatic retry">{row.retryable ? 'Pending' : 'Not scheduled'}</Field>}
        <Field label="Last error">{diagnostic || 'None'}</Field></dl>
        <p className="eo-muted eo-small">Inbox placement, opens and clicks are not tracked.</p></section>
    </aside>
  </div>;
}

export default function DailyEmailAdmin() {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState(''); const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(''); const [page, setPage] = useState(0);
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [audienceTarget, setAudienceTarget] = useState(null); const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false); const [selected, setSelected] = useState(null);
  const effectiveStatus = tab === 'failures' ? 'failed' : status;

  async function load() {
    setError(''); setBusy(true);
    try {
      const result = await supabase.rpc('admin_daily_emails', { p_date: date, p_status: effectiveStatus || null, p_search: filter, p_page: page });
      if (result.error) throw result.error;
      setData(result.data);
    } catch { setError('Daily email reporting could not be loaded. Administrator access is required.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [date, effectiveStatus, filter, page]);
  async function toggle() {
    setBusy(true);
    const result = await supabase.from('daily_email_config').update({ enabled: !data.enabled }).eq('id', true).select('enabled').single();
    setConfirming(false);
    if (result.error) { setError('Could not update the global email setting.'); setBusy(false); } else await load();
  }
  async function chooseAudience(next) {
    if (!data || next === data.audience) return;
    setPreview(null); setAudienceTarget(next);
    try { const r = await supabase.rpc('admin_daily_email_audience_preview'); if (!r.error) setPreview(r.data); } catch { /* preview is optional */ }
  }
  async function saveAudience() {
    setBusy(true);
    const result = await supabase.from('daily_email_config').update({ audience: audienceTarget }).eq('id', true).select('audience').single();
    setAudienceTarget(null);
    if (result.error) { setError('Could not update the recipient audience.'); setBusy(false); } else await load();
  }
  function resetFilters() { setDate(today()); setStatus(''); setSearch(''); setFilter(''); setPage(0); }
  const selectTab = key => { setTab(key); setPage(0); };

  const m = data?.metrics; const health = data?.health;
  const rows = data?.rows || [];
  const total = data?.filtered_total;
  const pages = total == null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasNext = total == null ? rows.length === PAGE_SIZE : (page + 1) * PAGE_SIZE < total;
  const filtered = Boolean(effectiveStatus || filter);
  const anyManual = rows.some(r => r.last_error === 'delivery_outcome_unknown') || (health?.unknown_outcome ?? 0) > 0;
  const issueCount = m ? m.failed : 0;

  const toolbar = <form className="eo-toolbar" onSubmit={e => { e.preventDefault(); setPage(0); setFilter(search); }}>
    <label>Local delivery date<input type="date" required value={date} onChange={e => { setDate(e.target.value); setPage(0); }} /></label>
    {tab !== 'failures' && <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">All</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>}
    <label className="eo-grow">User or email<input value={search} maxLength={100} placeholder="Name or email" onChange={e => setSearch(e.target.value)} /></label>
    <div className="eo-toolbar-actions">
      <button className="primary-btn" disabled={busy}><Search size={16} aria-hidden="true" />Search</button>
      <button type="button" className="ghost-btn" disabled={busy} onClick={resetFilters}><RotateCcw size={16} aria-hidden="true" />Reset filters</button>
      <button type="button" className="ghost-btn" disabled={busy} onClick={load}><RefreshCw size={16} aria-hidden="true" />Refresh</button>
    </div>
  </form>;

  const table = <>
    {rows.length > 0 && <div className="eo-table-wrap"><table className="eo-table">
      <caption className="eo-sr">Daily email deliveries for {date}</caption>
      <thead><tr>{['Recipient', 'Email', 'Local date', 'Timezone', 'Status', 'Sent', 'Answered', 'Correct', 'Attempts', 'Actions'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r.id} className={r.status === 'failed' ? 'eo-row-failed' : ''} onClick={() => setSelected(r)}>
        <td data-label="Recipient"><strong>{r.full_name || '—'}</strong>{r.status === 'failed' && <span className="eo-reason">{errorLabel(r.last_error) || 'Delivery failed'}</span>}</td>
        <td data-label="Email" className="eo-email">{r.email || '—'}</td>
        <td data-label="Local date">{r.scheduled_date || '—'}</td>
        <td data-label="Timezone">{r.timezone || '—'}</td>
        <td data-label="Status"><StatusBadge status={r.status} retryable={r.retryable} /></td>
        <td data-label="Sent">{stamp(r.sent_at)}</td>
        <td data-label="Answered">{stamp(r.answered_at)}</td>
        <td data-label="Correct"><CorrectBadge value={r.is_correct} /></td>
        <td data-label="Attempts">{r.retry_count ?? 0}</td>
        <td data-label="Actions"><button type="button" className="ghost-btn eo-small-btn" aria-label={`View details for ${r.full_name || r.email || 'recipient'}`} onClick={e => { e.stopPropagation(); setSelected(r); }}>{r.status === 'failed' ? 'View diagnostic' : 'View details'}</button></td>
      </tr>)}</tbody></table></div>}
    {data && rows.length === 0 && <div className="eo-empty">
      <Inbox size={28} aria-hidden="true" />
      <h3>{filtered || (m && m.total > 0) ? 'No deliveries found' : 'Nothing scheduled'}</h3>
      <p>{filtered || (m && m.total > 0) ? 'No email deliveries match the selected date and filters.' : 'No daily emails are scheduled for this date.'}</p>
      {filtered && <button type="button" className="ghost-btn" onClick={resetFilters}>Clear filters</button>}
    </div>}
    {data && rows.length > 0 && <nav className="eo-pager" aria-label="Delivery pagination">
      <span role="status">{total == null ? `Page ${page + 1}` : `Showing ${num(page * PAGE_SIZE + 1)}–${num(page * PAGE_SIZE + rows.length)} of ${num(total)}`}</span>
      <div><button className="ghost-btn" disabled={busy || page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} aria-hidden="true" />Previous</button>
        <span className="eo-page">{pages == null ? `Page ${page + 1}` : `Page ${page + 1} of ${num(pages)}`}</span>
        <button className="ghost-btn" disabled={busy || !hasNext} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} aria-hidden="true" /></button></div>
    </nav>}
  </>;

  const attention = m && <section className="eo-panel" aria-labelledby="eo-attention">
    <h3 id="eo-attention"><AlertTriangle size={17} aria-hidden="true" />Needs attention</h3>
    {issueCount === 0 && !anyManual ? <p className="eo-good"><CheckCircle2 size={16} aria-hidden="true" /> No email delivery issues require attention.</p> : <>
      <dl className="eo-list">
        <div><dt>Failed deliveries</dt><dd>{num(m.failed)}</dd></div>
        {health && <><div><dt>Retries pending</dt><dd>{num(health.retry_pending)}</dd></div>
          <div><dt>Permanent failures</dt><dd>{num(health.permanent_failures)}</dd></div>
          <div><dt>Invalid recipients</dt><dd>{num(health.invalid_recipients)}</dd></div>
          <div><dt>Unknown SMTP outcome</dt><dd>{num(health.unknown_outcome)}</dd></div></>}
      </dl>
      <button type="button" className="ghost-btn" onClick={() => selectTab('failures')}>View failures</button></>}
  </section>;

  const healthPanel = data && <section className="eo-panel" aria-labelledby="eo-health">
    <h3 id="eo-health"><Activity size={17} aria-hidden="true" />Sending health</h3>
    <dl className="eo-list">
      <div><dt>Daily emails</dt><dd>{data.enabled ? 'Enabled' : 'Paused'}</dd></div>
      {data.audience && <div><dt>Recipient audience</dt><dd>{AUDIENCES[data.audience]?.label || '—'}</dd></div>}
      <div><dt>Queue ({date})</dt><dd>{issueCount === 0 && !anyManual ? 'Healthy' : 'Has issues'}</dd></div>
      <div><dt>Failed jobs ({date})</dt><dd>{num(m?.failed)}</dd></div>
      {health && <><div><dt>Last accepted send</dt><dd>{stamp(health.last_sent_at)}</dd></div>
        <div><dt>Opted-in recipients</dt><dd>{num(health.opted_in_recipients)}</dd></div></>}
    </dl>
  </section>;

  const audiencePanel = data?.audience && <section className="eo-panel" aria-labelledby="eo-audience">
    <h3 id="eo-audience"><Users size={17} aria-hidden="true" />Recipient audience</h3>
    <div className="eo-audience" role="radiogroup" aria-labelledby="eo-audience">
      {Object.entries(AUDIENCES).map(([key, a]) => <label key={key} className={data.audience === key ? 'eo-aud-on' : ''}><input type="radio" name="eo-audience" value={key} checked={data.audience === key} disabled={busy} onChange={() => chooseAudience(key)} /><span><strong>{a.label}</strong><small>{a.note}</small></span></label>)}
    </div>
  </section>;

  const recent = data?.recent && <section className="eo-panel" aria-labelledby="eo-recent">
    <h3 id="eo-recent"><Clock size={17} aria-hidden="true" />Recent delivery activity</h3>
    {data.recent.length === 0 ? <p className="eo-muted">No delivery activity for this date yet.</p> : <ul className="eo-activity">{data.recent.map(a => <li key={a.id}>
      <span className="eo-activity-name">{a.full_name || 'Recipient'}</span>
      <span className="eo-activity-what"><StatusBadge status={a.status} />{a.status === 'answered' && a.is_correct != null && <CorrectBadge value={a.is_correct} />}</span>
      <time dateTime={a.activity_at}>{stamp(a.activity_at)}</time></li>)}</ul>}
  </section>;

  return <section className="eo-page-root" aria-labelledby="eo-title">
    <header className="eo-header">
      <div><h2 id="eo-title">Daily Emails</h2><p>Monitor scheduled NCLEX emails, delivery health, learner engagement and operational issues.</p></div>
      <div className="eo-header-actions">
        {data && <span className={`eo-state ${data.enabled ? 'eo-state-on' : 'eo-state-off'}`} role="status">
          <span className="eo-dot" aria-hidden="true" />{data.enabled ? 'Sending Enabled' : 'Sending Paused'}</span>}
        <button type="button" className="ghost-btn" disabled={busy} onClick={load}><RefreshCw size={16} aria-hidden="true" />Refresh</button>
        {data && <button type="button" className={data.enabled ? 'eo-danger-outline' : 'primary-btn'} disabled={busy} onClick={() => setConfirming(true)}>
          {data.enabled ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{data.enabled ? 'Pause Daily Emails' : 'Resume Daily Emails'}</button>}
      </div>
    </header>
    {error && <p role="alert" className="eo-alert">{error}</p>}
    {anyManual && <p role="status" className="eo-alert eo-alert-warn">Manual review required: an SMTP outcome is unknown. Automatic retries are blocked to prevent duplicate emails. Check provider logs before taking action.</p>}
    <div className="eo-info"><Info size={16} aria-hidden="true" /><div><strong>About delivery metrics</strong><p>Sent means the SMTP provider accepted the message. Inbox placement, opens and clicks are not currently tracked. Dates use each recipient’s local delivery date.</p></div></div>

    {m && <>
      <div className="eo-kpis" role="group" aria-label={`Delivery metrics for ${date}`}>
        <Kpi label={date === today() ? 'Scheduled Today' : 'Scheduled'} value={num(m.total)} helper={`For ${date}`} Icon={CalendarCheck} />
        <Kpi label="Sent" value={num(m.sent)} helper="Accepted by SMTP" Icon={Send} />
        <Kpi label="Pending" value={num(m.pending)} helper={`${num(m.scheduled)} awaiting first send`} Icon={Clock} />
        <Kpi label="Failed" value={num(m.failed)} helper={m.failed ? 'Needs review' : 'No failures'} Icon={XCircle} />
        <Kpi label="Answered" value={num(m.answered)} helper={`${num(m.incorrect)} incorrect`} Icon={MessageSquareReply} />
        <Kpi label="Correct rate" value={rate(m.correct, m.answered)} helper={`${num(m.correct)} of ${num(m.answered)} answered`} Icon={Target} />
      </div>
      <p className="eo-secondary" aria-label="Rates"><span className="eo-chip">Send acceptance <strong>{rate(m.sent, m.total)}</strong></span><span className="eo-chip">Answer rate <strong>{rate(m.answered, m.total)}</strong></span><span className="eo-chip">Correct answer rate <strong>{rate(m.correct, m.answered)}</strong></span></p>
    </>}

    <div className="eo-tabs" role="tablist" aria-label="Email operations sections">
      {TABS.map(([key, label]) => <button key={key} type="button" role="tab" id={`eo-tab-${key}`} aria-selected={tab === key} aria-controls="eo-tabpanel" tabIndex={tab === key ? 0 : -1} className={tab === key ? 'eo-tab-active' : ''} onClick={() => selectTab(key)}
        onKeyDown={e => { const i = TABS.findIndex(t => t[0] === key); const n = e.key === 'ArrowRight' ? TABS[(i + 1) % 3] : e.key === 'ArrowLeft' ? TABS[(i + 2) % 3] : null; if (n) { e.preventDefault(); selectTab(n[0]); document.getElementById(`eo-tab-${n[0]}`)?.focus(); } }}>{label}{key === 'failures' && m?.failed > 0 && <span className="eo-tab-count" aria-label={`${m.failed} failed`}>{num(m.failed)}</span>}</button>)}
    </div>
    <div id="eo-tabpanel" role="tabpanel" aria-labelledby={`eo-tab-${tab}`} className="eo-tabpanel">
      {tab === 'overview' && <><div className="eo-grid">{healthPanel}{attention}{recent}</div>{audiencePanel}</>}
      {tab !== 'overview' && <>{tab === 'failures' && <div className="eo-fail-summary"><p className="eo-muted">Showing failed deliveries with diagnostics. Automatic retries run on the existing schedule; retry from this page is not available.</p>{health && <ul aria-label="Failure breakdown"><li className="eo-chip">Retries pending <strong>{num(health.retry_pending)}</strong></li><li className="eo-chip">Permanent <strong>{num(health.permanent_failures)}</strong></li><li className="eo-chip">Invalid recipients <strong>{num(health.invalid_recipients)}</strong></li><li className="eo-chip">Unknown outcome <strong>{num(health.unknown_outcome)}</strong></li></ul>}</div>}{toolbar}{table}</>}
    </div>
    {audienceTarget && <AudienceDialog target={audienceTarget} preview={preview} busy={busy} onCancel={() => setAudienceTarget(null)} onConfirm={saveAudience} />}
    {confirming && data && <ConfirmDialog enabled={data.enabled} busy={busy} onCancel={() => setConfirming(false)} onConfirm={toggle} />}
    {selected && <DetailDrawer row={selected} onClose={() => setSelected(null)} />}
  </section>;
}
