import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, RefreshCw, AlertTriangle, Activity } from 'lucide-react';
import { supabase } from '../services/supabase';

const DEMO_LOGS = [
  { id: 'l1', user_email: 'student@test.com', action: 'login', entity_type: 'auth', entity_id: null, metadata: { provider: 'email' }, created_at: new Date(Date.now() - 120000).toISOString() },
  { id: 'l2', user_email: 'student@test.com', action: 'question_answer', entity_type: 'question', entity_id: 'q-42', metadata: { correct: true, topic: 'Pharmacology' }, created_at: new Date(Date.now() - 300000).toISOString() },
  { id: 'l3', user_email: 'nurse@example.com', action: 'plan_subscribed', entity_type: 'subscription', entity_id: 'pro', metadata: { amount_usd: 39.99, method: 'stripe' }, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'l4', user_email: 'admin2@test.com', action: 'user_role_change', entity_type: 'user', entity_id: 'u-9', metadata: { from: 'student', to: 'instructor' }, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'l5', user_email: 'unknown@malicious.com', action: 'failed_login', entity_type: 'auth', entity_id: null, metadata: { attempts: 5, ip: '198.51.100.42' }, created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 'l6', user_email: 'rn2025@health.com', action: 'password_reset', entity_type: 'auth', entity_id: null, metadata: {}, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'l7', user_email: 'student@test.com', action: 'mobile_money_initiated', entity_type: 'subscription', entity_id: 'basic', metadata: { channel: 'mtn', phone: '024****56', amount_ghs: 300 }, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'l8', user_email: 'instructor@nursefaculty.org', action: 'video_uploaded', entity_type: 'video', entity_id: 'v-15', metadata: { title: 'Pediatric Dosage Calculations', topic: 'Pharmacology' }, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
];

const ACTION_COLORS = {
  login: '#29b7a3',
  failed_login: '#e94868',
  password_reset: '#e3a72f',
  plan_subscribed: '#2b8a7d',
  mobile_money_initiated: '#8b5cf6',
  user_role_change: '#c17f44',
  question_answer: '#607478',
  video_uploaded: '#29b7a3',
};

const SUSPICIOUS_ACTIONS = ['failed_login', 'user_role_change'];

export default function AuditLogView({ session }) {
  const [logs, setLogs] = useState(supabase ? [] : DEMO_LOGS);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [loading, setLoading] = useState(false);

  async function fetchLogs() {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (data?.length) setLogs(data);
    setLoading(false);
  }

  useEffect(() => { fetchLogs(); }, []);

  const allActions = [...new Set(logs.map((l) => l.action))].sort();

  const filtered = logs.filter((l) => {
    const matchesSearch = !search || l.user_email?.toLowerCase().includes(search.toLowerCase()) || l.action.includes(search.toLowerCase());
    const matchesAction = filterAction === 'all' || l.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const suspiciousCount = logs.filter((l) => SUSPICIOUS_ACTIONS.includes(l.action)).length;
  const todayCount = logs.filter((l) => new Date(l.created_at) > new Date(Date.now() - 86400000)).length;

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Audit Logs &amp; Security</h2>
        <button className="ghost-btn" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Events', value: logs.length, color: '#29b7a3', icon: Activity },
          { label: 'Last 24h', value: todayCount, color: '#2b8a7d', icon: Activity },
          { label: 'Suspicious', value: suspiciousCount, color: suspiciousCount > 0 ? '#e94868' : '#8a999c', icon: AlertTriangle },
          { label: 'Unique Users', value: new Set(logs.map((l) => l.user_email)).size, color: '#8b5cf6', icon: ShieldCheck },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="stat-card" style={{ borderTop: `3px solid ${color}`, textAlign: 'center', minWidth: 120 }}>
            <Icon size={18} color={color} style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: '#607478' }}>{label}</div>
          </div>
        ))}
      </div>

      {suspiciousCount > 0 && (
        <div style={{ padding: '10px 16px', background: '#ffe4e4', border: '1.5px solid #e94868', borderRadius: 10, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.87rem', color: '#8a2c21' }}>
          <AlertTriangle size={16} />
          {suspiciousCount} suspicious event{suspiciousCount !== 1 ? 's' : ''} detected (failed logins, role changes). Review below.
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#8a999c' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by email or action…" style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px 0 32px', boxSizing: 'border-box', fontSize: '0.88rem' }} />
        </div>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={{ height: 36, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px', fontSize: '0.88rem' }}>
          <option value="all">All actions</option>
          {allActions.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Log table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const isSuspicious = SUSPICIOUS_ACTIONS.includes(log.action);
              const color = ACTION_COLORS[log.action] ?? '#607478';
              return (
                <tr key={log.id} style={{ background: isSuspicious ? '#fff5f5' : 'transparent' }}>
                  <td style={{ fontSize: '0.8rem', color: '#8a999c', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ fontSize: '0.83rem' }}>
                    {isSuspicious && <AlertTriangle size={12} color="#e94868" style={{ display: 'inline', marginRight: 4 }} />}
                    {log.user_email ?? log.user_id?.slice(0, 8) ?? 'anonymous'}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, background: `${color}18`, color, padding: '2px 8px', borderRadius: 12 }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: '#607478' }}>
                    {log.entity_type}{log.entity_id ? `:${log.entity_id}` : ''}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#8a999c', maxWidth: 200 }}>
                    {log.metadata && Object.keys(log.metadata).length > 0
                      ? Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')
                      : '—'}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8a999c', padding: 24 }}>No events match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!supabase && (
        <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: '#8a999c', textAlign: 'center' }}>
          Demo data shown. Connect Supabase and run the migration to see live audit events.
        </p>
      )}
    </section>
  );
}
