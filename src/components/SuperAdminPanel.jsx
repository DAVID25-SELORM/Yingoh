import React, { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, RefreshCw,
  Search, Shield, Trash2, UserCheck, UserX, Users,
} from 'lucide-react';
import { supabase, checkTableAvailability, nurseFacultyTables } from '../services/supabase';
import {
  getEffectivePermissions,
  getPermissionGroupsForRoles,
  RBAC_ROLES,
  RBAC_ROLE_NAMES,
  ROLE_LOOKUP,
} from '../data/rbac';

const DEMO_STATS = {
  total_users: 142,
  published_questions: 20,
  draft_questions: 4,
  total_attempts: 1847,
  total_sessions: 89,
  active_subscriptions: 38,
  paid_invoices: 52,
  total_revenue: 1842.48,
  upcoming_classes: 3,
  total_notes: 217,
  total_bookmarks: 89,
};

const DEMO_USERS = [
  { id: 'u1', full_name: 'Ama Owusu', email: 'ama@example.com', roles: ['student'], created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'u2', full_name: 'Kofi Mensah', email: 'kofi@example.com', roles: ['student', 'instructor'], created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'u3', full_name: 'Abena Asante', email: 'abena@example.com', roles: ['student'], created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'u4', full_name: 'Kwame Boateng', email: 'kwame@example.com', roles: ['content_reviewer'], created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: 'u5', full_name: 'Efua Darko', email: 'efua@example.com', roles: ['student'], created_at: new Date(Date.now() - 86400000 * 14).toISOString() },
  { id: 'u6', full_name: 'Yaw Appiah', email: 'yaw@example.com', roles: ['instructor'], created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: 'u7', full_name: 'Akosua Frimpong', email: 'akosua@example.com', roles: ['student'], created_at: new Date(Date.now() - 86400000 * 22).toISOString() },
  { id: 'u8', full_name: 'Nana Osei', email: 'nana@example.com', roles: ['finance'], created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
];

const DEMO_AUDIT = [
  { id: 'a1', action: 'question.publish', target_table: 'questions', details: { title: 'Digoxin toxicity MCQ' }, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'a2', action: 'user.role_assign', target_table: 'user_roles', details: { role: 'instructor', email: 'kofi@example.com' }, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'a3', action: 'announcement.create', target_table: 'announcements', details: { title: 'New NGN Case Studies Added' }, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'a4', action: 'plan.create', target_table: 'payment_plans', details: { name: 'Premium', price: '$59.99' }, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const ROLE_COLORS = Object.fromEntries(
  RBAC_ROLES.map((role) => [role.name, { bg: `${role.color}1f`, color: role.color }])
);

const ALL_ROLES = RBAC_ROLE_NAMES;

function StatCard({ label, value, sub, color = '#29b7a3' }) {
  return (
    <div className="admin-stat-card" style={{ borderTopColor: color }}>
      <span>{label}</span>
      <strong>{typeof value === 'number' && value > 999 ? value.toLocaleString() : value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function RoleBadge({ role }) {
  const style = ROLE_COLORS[role] ?? { bg: '#edf2f1', color: '#42585e' };
  return (
    <span style={{ ...style, borderRadius: 999, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', marginRight: 4 }}>
      {ROLE_LOOKUP[role]?.label ?? role}
    </span>
  );
}

function EffectivePermissionPanel({ roles }) {
  const effective = getEffectivePermissions(roles);
  const groups = getPermissionGroupsForRoles(roles);
  return (
    <div style={{ padding: 14, borderRadius: 12, border: '1px solid #dde8e6', background: '#f8fbfa', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <strong>Preview Effective Permissions</strong>
        <span style={{ color: '#607478', fontSize: '0.8rem', fontWeight: 800 }}>{effective.length} granted</span>
      </div>
      <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
        {groups.map((group) => (
          <div key={group.key}>
            <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2b8a7d', fontWeight: 800, marginBottom: 4 }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {group.granted.map(([key, label]) => (
                <span key={key} style={{ padding: '3px 8px', border: '1px solid #dbe6e4', background: '#fff', borderRadius: 999, fontSize: '0.72rem', color: '#42585e' }}>{label}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperAdminPanel({ session }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(supabase ? {
    total_users: 0,
    published_questions: 0,
    draft_questions: 0,
    total_attempts: 0,
    total_sessions: 0,
    active_subscriptions: 0,
    paid_invoices: 0,
    total_revenue: 0,
    upcoming_classes: 0,
    total_notes: 0,
    total_bookmarks: 0,
  } : DEMO_STATS);
  const [users, setUsers] = useState(supabase ? [] : DEMO_USERS);
  const [auditLog, setAuditLog] = useState(supabase ? [] : DEMO_AUDIT);
  const [search, setSearch] = useState('');
  const [tableHealth, setTableHealth] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleModal, setRoleModal] = useState(null); // { user }
  const [assigningRole, setAssigningRole] = useState('');
  const [roleError, setRoleError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) return;
    // Stats
    try {
      const { data } = await supabase.rpc('admin_get_stats');
      if (data) setStats(data);
    } catch (_) {}

    // Table health
    const health = await checkTableAvailability(Object.values(nurseFacultyTables));
    setTableHealth(health);

    // Audit logs
    const { data: logs } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (logs?.length) setAuditLog(logs);
  }

  async function loadUsers() {
    if (!supabase) return;
    setLoadingUsers(true);
    setRoleError('');
    try {
      const { data, error } = await supabase.rpc('admin_get_all_users');
      if (error) throw error;
      setUsers((data ?? []).map((user) => ({ ...user, roles: user.roles ?? [] })));
    } catch (err) {
      setRoleError(err.message ?? 'Could not load users.');
    }
    setLoadingUsers(false);
  }

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'system') {
      checkTableAvailability(Object.values(nurseFacultyTables)).then(setTableHealth);
    }
  }, [tab]);

  async function handleAssignRole(userId, role) {
    if (!supabase) return;
    setAssigningRole(`${userId}:${role}`);
    setRoleError('');
    try {
      const { error } = await supabase.rpc('admin_assign_role', { target_user_id: userId, role_name: role });
      if (error) throw error;
      await supabase.from('admin_audit_logs').insert({ action: 'user.role_assign', target_table: 'user_roles', details: { role, user_id: userId } });
      setUsers((prev) => prev.map((u) => {
        const roles = u.roles ?? [];
        return u.id === userId && !roles.includes(role) ? { ...u, roles: [...roles, role] } : u;
      }));
      setRoleModal((prev) => {
        if (!prev || prev.id !== userId) return prev;
        const roles = prev.roles ?? [];
        return roles.includes(role) ? prev : { ...prev, roles: [...roles, role] };
      });
    } catch (err) {
      setRoleError(err.message ?? 'Could not assign role.');
    }
    setAssigningRole('');
  }

  async function handleRemoveRole(userId, role) {
    if (!supabase) return;
    setAssigningRole(`${userId}:${role}`);
    setRoleError('');
    try {
      const { error } = await supabase.rpc('admin_remove_role', { target_user_id: userId, role_name: role });
      if (error) throw error;
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, roles: (u.roles ?? []).filter((r) => r !== role) } : u));
      setRoleModal((prev) => (
        prev?.id === userId ? { ...prev, roles: (prev.roles ?? []).filter((r) => r !== role) } : prev
      ));
    } catch (err) {
      setRoleError(err.message ?? 'Could not remove role.');
    }
    setAssigningRole('');
  }

  const filteredUsers = users.filter((u) =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'system', label: 'System', icon: Activity },
  ];

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Super Admin Panel</h2>
        <Shield size={22} />
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={tab === key ? 'admin-tab-active' : 'admin-tab'} onClick={() => setTab(key)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="admin-stats-grid">
            <StatCard label="Total Users" value={stats.total_users} sub="registered accounts" />
            <StatCard label="Published Questions" value={stats.published_questions} sub={`${stats.draft_questions} drafts pending`} color="#e3a72f" />
            <StatCard label="Total Attempts" value={stats.total_attempts} sub="across all students" color="#6750a4" />
            <StatCard label="Exam Sessions" value={stats.total_sessions} sub="completed sessions" color="#e85d4f" />
            <StatCard label="Active Subscriptions" value={stats.active_subscriptions} color="#29b7a3" />
            <StatCard label="Revenue" value={`$${Number(stats.total_revenue ?? 0).toFixed(2)}`} sub={`${stats.paid_invoices} paid invoices`} color="#29b7a3" />
            <StatCard label="Upcoming Classes" value={stats.upcoming_classes} sub="scheduled sessions" color="#e3a72f" />
            <StatCard label="Notes Created" value={stats.total_notes} sub={`${stats.total_bookmarks} bookmarks`} color="#6750a4" />
          </div>

          {/* Recent audit log */}
          <div className="surface">
            <div className="section-title"><h3>Recent Activity</h3><Activity size={18} /></div>
            <div style={{ display: 'grid', gap: 8 }}>
              {auditLog.map((log) => (
                <div key={log.id} className="audit-row">
                  <span className="audit-action">{log.action}</span>
                  <span style={{ color: '#607478', fontSize: '0.84rem', flex: 1 }}>
                    {log.details ? JSON.stringify(log.details).replace(/[{}"]/g, '').replace(/,/g, ' · ') : ''}
                  </span>
                  <span style={{ color: '#9fb3b7', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
              {!auditLog.length && <p style={{ color: '#607478', margin: 0 }}>No audit log entries yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="search-box" style={{ flex: 1 }}>
              <Search size={15} />
              <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="ghost-btn" onClick={loadUsers} disabled={loadingUsers}>
              <RefreshCw size={15} /> {loadingUsers ? 'Loading…' : 'Refresh'}
            </button>
            <span style={{ color: '#607478', fontSize: '0.88rem' }}>{filteredUsers.length} users</span>
          </div>

          {roleError && (
            <div className="setup-alert" style={{ color: '#8a2c21', background: '#fff0ee', borderColor: '#f2b7ae' }}>
              {roleError}
            </div>
          )}

          <div className="surface" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.full_name || '—'}</strong></td>
                    <td style={{ color: '#607478', fontSize: '0.88rem' }}>{user.email}</td>
                    <td>
                      {(user.roles ?? []).map((r) => <RoleBadge key={r} role={r} />)}
                      {(!user.roles?.length) && <span style={{ color: '#9fb3b7', fontSize: '0.82rem' }}>No roles</span>}
                    </td>
                    <td style={{ color: '#9fb3b7', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="ghost-btn"
                          style={{ minHeight: 30, padding: '0 8px', fontSize: '0.8rem' }}
                          onClick={() => setRoleModal(user)}
                        >
                          <UserCheck size={13} /> Roles
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredUsers.length && (
              <div style={{ padding: 32, textAlign: 'center', color: '#607478' }}>No users found.</div>
            )}
          </div>

          {/* Role assignment modal */}
          {roleModal && (
            <div className="modal-overlay" onClick={() => setRoleModal(null)}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <h3>Manage Roles — {roleModal.full_name}</h3>
                <p style={{ color: '#607478', margin: '0 0 16px' }}>{roleModal.email}</p>
                <EffectivePermissionPanel roles={roleModal.roles ?? []} />
                <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                  {ALL_ROLES.map((role) => {
                    const hasRole = roleModal.roles?.includes(role);
                    const isWorking = assigningRole === `${roleModal.id}:${role}`;
                    const meta = ROLE_LOOKUP[role];
                    return (
                      <div key={role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fbfa', borderRadius: 8, border: '1px solid #dde8e6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {hasRole ? <CheckCircle2 size={16} color="#29b7a3" /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #dde8e6' }} />}
                          <div>
                            <RoleBadge role={role} />
                            <div style={{ fontSize: '0.76rem', color: '#607478', marginTop: 4 }}>
                              <strong>{meta?.responsibility}</strong> · {meta?.permissions?.length ?? 0} permissions
                            </div>
                          </div>
                        </div>
                        {hasRole ? (
                          <button className="ghost-btn" style={{ minHeight: 28, padding: '0 10px', fontSize: '0.8rem', color: '#8a2c21' }} onClick={() => handleRemoveRole(roleModal.id, role)} disabled={isWorking}>
                            <UserX size={13} /> {isWorking ? 'Removing...' : 'Remove'}
                          </button>
                        ) : (
                          <button className="primary-btn" style={{ minHeight: 28, padding: '0 10px', fontSize: '0.8rem' }} onClick={() => handleAssignRole(roleModal.id, role)} disabled={isWorking}>
                            <UserCheck size={13} /> {isWorking ? 'Assigning...' : 'Assign'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button className="ghost-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setRoleModal(null)}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── System ── */}
      {tab === 'system' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="surface">
            <div className="section-title"><h3>Database Table Health</h3><Activity size={18} /></div>
            <div className="table-list" style={{ gap: 8 }}>
              {(tableHealth.length
                ? tableHealth
                : Object.values(nurseFacultyTables).map((name) => ({ name, status: 'checking', detail: 'Checking…' }))
              ).map((t) => (
                <span key={t.name} className={`table-${t.status}`} title={t.detail}>{t.name}</span>
              ))}
            </div>
            <button className="ghost-btn" style={{ marginTop: 14 }} onClick={() => checkTableAvailability(Object.values(nurseFacultyTables)).then(setTableHealth)}>
              <RefreshCw size={15} /> Re-check tables
            </button>
          </div>

          <div className="surface">
            <div className="section-title"><h3>Platform Configuration</h3><Shield size={18} /></div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'Supabase URL', value: import.meta.env.VITE_SUPABASE_URL || 'https://mcbfqgyosdklnzbagobp.supabase.co', ok: true },
                { label: 'Supabase Anon Key', value: import.meta.env.VITE_SUPABASE_ANON_KEY ? '••••••••••••••••' : 'Not set', ok: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) },
                { label: 'Admin Authorization', value: 'Supabase RBAC', ok: true },
                { label: 'Current Session', value: session?.user?.email || 'No session', ok: Boolean(session) },
              ].map(({ label, value, ok }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fbfa', borderRadius: 8, border: '1px solid #dde8e6' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#42585e' }}>{label}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', color: '#607478', fontFamily: 'monospace' }}>{value}</span>
                    {ok ? <CheckCircle2 size={16} color="#29b7a3" /> : <AlertTriangle size={16} color="#e3a72f" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface">
            <div className="section-title"><h3>Available Roles & Permission Groups</h3></div>
            <div style={{ display: 'grid', gap: 10 }}>
              {RBAC_ROLES.map((role) => (
                <div key={role.name} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: '#f8fbfa', borderRadius: 8, border: '1px solid #dde8e6', alignItems: 'flex-start' }}>
                  <RoleBadge role={role.name} />
                  <span style={{ fontSize: '0.86rem', color: '#5b6d72', lineHeight: 1.45 }}>
                    <strong>{role.responsibility}:</strong> {role.desc} <em>({role.permissions.length} permissions)</em>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
