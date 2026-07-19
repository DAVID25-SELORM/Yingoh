import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, Eye, Mail, PlusCircle, RefreshCw, Search,
  Shield, Trash2, User, UserCheck, X,
} from 'lucide-react';
import {
  clearUserPermissionOverride,
  getUserPermissionOverrides,
  sendPasswordResetEmail,
  setUserPermissionOverride,
  signUpWithEmail,
  startImpersonationSession,
  supabase,
} from '../services/supabase';
import {
  getEffectivePermissions,
  PERMISSION_GROUPS,
  RBAC_ROLES as ALL_ROLES,
  ROLE_COLORS,
  ROLE_LOOKUP,
} from '../data/rbac';

const DEMO_USERS = [
  { id: 'u1', full_name: 'Selorm Gabiond', email: 'cryxtalcfc@gmail.com', country: 'Ghana', created_at: new Date(Date.now() - 86400000 * 30).toISOString(), roles: ['student', 'admin'] },
  { id: 'u2', full_name: 'Abena Mensah', email: 'abena@nursefaculty.org', country: 'Ghana', created_at: new Date(Date.now() - 86400000 * 14).toISOString(), roles: ['instructor'] },
  { id: 'u3', full_name: 'Kwame Asante', email: 'kwame@nurse.com', country: 'Ghana', created_at: new Date(Date.now() - 86400000 * 7).toISOString(), roles: ['student'] },
  { id: 'u4', full_name: 'Ama Boateng', email: 'ama.boateng@email.com', country: 'USA', created_at: new Date(Date.now() - 86400000 * 3).toISOString(), roles: ['student', 'content_reviewer'] },
  { id: 'u5', full_name: 'Kofi Acheampong', email: 'finance@nursefaculty.org', country: 'Ghana', created_at: new Date(Date.now() - 86400000 * 20).toISOString(), roles: ['finance'] },
];

const DEMO_INVITES = [
  { id: 'i1', email: 'new.instructor@email.com', full_name: 'Dr. Akosua Frimpong', role_name: 'instructor', expires_at: new Date(Date.now() + 86400000 * 5).toISOString(), accepted_at: null, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'i2', email: 'reviewer@content.com', full_name: 'Nana Yaw', role_name: 'content_reviewer', expires_at: new Date(Date.now() + 86400000 * 2).toISOString(), accepted_at: null, created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
];

function RolePill({ role }) {
  const meta = ROLE_LOOKUP[role];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: (ROLE_COLORS[role] ?? '#607478') + '22', color: ROLE_COLORS[role] ?? '#607478' }}>
      {meta?.label ?? role.replace('_', ' ')}
    </span>
  );
}

function PermissionPreview({ roles, overrides = {} }) {
  const rolePermissions = new Set(getEffectivePermissions(roles));
  Object.entries(overrides).forEach(([permission, effect]) => {
    if (effect === 'allow') rolePermissions.add(permission);
    if (effect === 'deny') rolePermissions.delete(permission);
  });
  const effective = [...rolePermissions].sort();
  const groups = PERMISSION_GROUPS
    .map((group) => ({
      ...group,
      granted: group.permissions.filter(([key]) => rolePermissions.has(key)),
    }))
    .filter((group) => group.granted.length > 0);
  return (
    <div style={{ marginTop: 12, padding: 14, background: '#f8fbfa', border: '1px solid #dde8e6', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: '0.9rem' }}>Effective Permissions</strong>
        <span style={{ fontSize: '0.78rem', color: '#607478', fontWeight: 700 }}>{effective.length} permissions granted</span>
      </div>
      <div style={{ display: 'grid', gap: 10, maxHeight: 260, overflow: 'auto' }}>
        {groups.map((group) => (
          <div key={group.key}>
            <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2b8a7d', fontWeight: 800, marginBottom: 4 }}>{group.label}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {group.granted.map(([key, label]) => (
                <span key={key} style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: 999, background: overrides[key] === 'allow' ? '#e2f5f2' : '#fff', border: `1px solid ${overrides[key] === 'allow' ? '#9dd8cf' : '#dbe6e4'}`, color: '#42585e' }}>{label}</span>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <span style={{ color: '#8a999c', fontSize: '0.84rem' }}>No permissions granted yet.</span>}
      </div>
    </div>
  );
}

export default function UserManagement({ session, onStartViewAs, canManageSuperAdmins = false }) {
  const [users, setUsers] = useState(supabase ? [] : DEMO_USERS);
  const [invites, setInvites] = useState(supabase ? [] : DEMO_INVITES);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('users'); // users | invites | add
  const [roleModal, setRoleModal] = useState(null); // user obj
  const [viewAsModal, setViewAsModal] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [permissionOverrides, setPermissionOverrides] = useState({});
  const [overrideSaving, setOverrideSaving] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Add user form
  const EMPTY_FORM = {
    email: '',
    full_name: '',
    password: '',
    role: 'student',
    invite_only: true,
    department: '',
    institution: '',
    professional_title: '',
    nursing_specialty: '',
    staff_id: '',
    account_status: 'invitation_pending',
    send_onboarding_email: true,
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const manageableRoles = canManageSuperAdmins
    ? ALL_ROLES
    : ALL_ROLES.filter((role) => role.name !== 'super_admin');
  const selectedRoleMeta = ALL_ROLES.find((role) => role.name === form.role);

  useEffect(() => {
    loadUsers();
    loadInvites();
  }, []);

  async function loadUsers() {
    if (!supabase) return;
    setError('');
    const { data, error: loadError } = await supabase.rpc('admin_get_all_users');
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setUsers((data ?? []).map((user) => ({ ...user, roles: user.roles ?? [] })));
  }

  async function loadInvites() {
    if (!supabase) return;
    const { data, error: inviteError } = await supabase.from('pending_invites').select('*').order('created_at', { ascending: false });
    if (inviteError) {
      setError(inviteError.message);
      return;
    }
    setInvites(data ?? []);
  }

  async function handleAddUser(e) {
    e.preventDefault();
    if (form.role === 'super_admin' && !canManageSuperAdmins) {
      setError('Only a Super Admin can create or invite another Super Admin.');
      return;
    }
    setSaving(true);
    setMsg('');
    setError('');

    try {
      if (form.invite_only) {
        // Create pending invite + send password reset
        if (supabase) {
          const { error: inviteError } = await supabase.rpc('admin_invite_user', {
            p_email: form.email,
            p_full_name: form.full_name,
            p_role_name: form.role,
          });
          if (inviteError) throw inviteError;
          if (form.role === 'instructor') {
            const { error: profileError } = await supabase
              .from('pending_invites')
              .update({
                invite_type: 'platform_role',
                department: form.department || null,
                institution: form.institution || null,
                professional_title: form.professional_title || null,
                staff_id: form.staff_id || null,
                status: 'pending',
              })
              .eq('email', form.email);
            if (profileError) throw profileError;
          }
          const { error: resetError } = await sendPasswordResetEmail(form.email);
          if (resetError) throw resetError;
          setInvites((prev) => [{
            id: `i${Date.now()}`, email: form.email, full_name: form.full_name,
            role_name: form.role, accepted_at: null, department: form.department, institution: form.institution,
            expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
            created_at: new Date().toISOString(),
          }, ...prev]);
          setMsg(`Invite sent to ${form.email}. They will receive a sign-in link.`);
        } else {
          setInvites((prev) => [{
            id: `i${Date.now()}`, email: form.email, full_name: form.full_name,
            role_name: form.role, accepted_at: null,
            expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
            created_at: new Date().toISOString(),
          }, ...prev]);
          setMsg(`[Demo] Invite recorded for ${form.email} as ${form.role}.`);
        }
      } else {
        // Direct create with password
        if (!form.password || form.password.length < 6) {
          setMsg('Password must be at least 6 characters.');
          return;
        }
        const { error } = await signUpWithEmail({ email: form.email, password: form.password, fullName: form.full_name });
        if (error) throw error;
        // Assign role after short delay for trigger to fire
        if (supabase) {
          setTimeout(async () => {
            const { data: profile } = await supabase.from('profiles').select('id').eq('email', form.email).single();
            if (profile) {
              await supabase.rpc('admin_assign_role', { target_user_id: profile.id, role_name: form.role });
              if (form.role === 'instructor') {
                await supabase.from('instructor_profiles').upsert({
                  user_id: profile.id,
                  department: form.department || null,
                  nursing_specialty: form.nursing_specialty || null,
                  professional_title: form.professional_title || null,
                  institution: form.institution || null,
                  staff_id: form.staff_id || null,
                  account_status: 'active',
                  onboarding_email_sent: Boolean(form.send_onboarding_email),
                  updated_at: new Date().toISOString(),
                });
              }
            }
          }, 1500);
        }
        setMsg(`Account created for ${form.email}. They may need to verify their email.`);
        await loadUsers();
      }
      setForm(EMPTY_FORM);
      setTab('users');
    } catch (err) {
      setError(err.message ?? 'Could not add user.');
    } finally {
      setSaving(false);
    }
  }

  async function assignRole(userId, roleName) {
    setError('');
    if (roleName === 'super_admin' && !canManageSuperAdmins) {
      setError('Only a Super Admin can assign the Super Admin role.');
      return;
    }
    if (supabase) {
      const { error: assignError } = await supabase.rpc('admin_assign_role', { target_user_id: userId, role_name: roleName });
      if (assignError) {
        setError(assignError.message);
        return;
      }
    }
    setUsers((prev) => prev.map((u) => {
      const roles = u.roles ?? [];
      return u.id === userId && !roles.includes(roleName) ? { ...u, roles: [...roles, roleName] } : u;
    }));
    setRoleModal((prev) => {
      if (!prev || prev.id !== userId) return prev;
      const roles = prev.roles ?? [];
      return roles.includes(roleName) ? prev : { ...prev, roles: [...roles, roleName] };
    });
  }

  async function removeRole(userId, roleName) {
    setError('');
    if (roleName === 'super_admin' && !canManageSuperAdmins) {
      setError('Only a Super Admin can remove the Super Admin role.');
      return;
    }
    if (supabase) {
      const { error: removeError } = await supabase.rpc('admin_remove_role', { target_user_id: userId, role_name: roleName });
      if (removeError) {
        setError(removeError.message);
        return;
      }
    }
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, roles: (u.roles ?? []).filter((r) => r !== roleName) } : u));
    setRoleModal((prev) => (
      prev?.id === userId ? { ...prev, roles: (prev.roles ?? []).filter((r) => r !== roleName) } : prev
    ));
  }

  async function openRoleModal(user) {
    setRoleModal(user);
    setPermissionOverrides({});
    if (!supabase) return;
    const { data } = await getUserPermissionOverrides(user.id);
    setPermissionOverrides(Object.fromEntries((data ?? []).map((row) => [row.permission_id, row.effect])));
  }

  async function setOverride(permission, effect) {
    if (!roleModal) return;
    setOverrideSaving(permission);
    setError('');
    try {
      if (supabase) {
        const result = effect
          ? await setUserPermissionOverride(roleModal.id, permission, effect)
          : await clearUserPermissionOverride(roleModal.id, permission);
        if (result.error) throw result.error;
      }
      setPermissionOverrides((prev) => {
        const next = { ...prev };
        if (effect) next[permission] = effect;
        else delete next[permission];
        return next;
      });
    } catch (err) {
      setError(err.message ?? 'Could not update permission override.');
    }
    setOverrideSaving('');
  }

  async function revokeInvite(id) {
    if (!window.confirm('Revoke this invite?')) return;
    if (supabase) await supabase.from('pending_invites').delete().eq('id', id);
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  function primaryRole(user) {
    const roles = user.roles ?? [];
    return roles.includes('instructor') ? 'instructor'
      : roles.includes('finance') ? 'finance'
      : roles.includes('content_reviewer') ? 'content_reviewer'
      : roles.includes('admin') ? 'admin'
      : 'student';
  }

  function availableViewRoles(user) {
    const roles = new Set(user.roles?.length ? user.roles : ['student']);
    roles.add(primaryRole(user));
    return [...roles].filter((role) => role !== 'super_admin');
  }

  async function confirmViewAs() {
    if (!viewAsModal || !onStartViewAs) return;
    const { user, role, reason } = viewAsModal;
    let auditId = null;
    if (supabase) {
      const { data, error: auditError } = await startImpersonationSession(user.id, role, reason || 'Support troubleshooting');
      if (auditError) {
        setError(auditError.message);
        return;
      }
      auditId = data;
    }
    onStartViewAs({
      auditId,
      userId: user.id,
      userName: user.full_name || user.email,
      email: user.email,
      role,
      reason: reason || 'Support troubleshooting',
      startedBy: session?.user?.email,
    });
    setViewAsModal(null);
  }

  const filteredUsers = users.filter((u) =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>User Management</h2>
        <button className="primary-btn" onClick={() => setTab('add')}>
          <PlusCircle size={15} /> Add User
        </button>
      </div>

      {error && (
        <div className="setup-alert" style={{ color: '#8a2c21', background: '#fff0ee', borderColor: '#f2b7ae' }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Users', value: users.length, color: '#29b7a3' },
          { label: 'Pending Invites', value: invites.filter((i) => !i.accepted_at).length, color: '#e3a72f' },
          ...ALL_ROLES.slice(0, 6).map((r) => ({ label: r.label + 's', value: users.filter((u) => u.roles?.includes(r.name)).length, color: r.color })),
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}`, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.76rem', color: '#607478' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {[['users', `Users (${users.length})`], ['invites', `Invites (${invites.length})`], ['add', 'Add / Invite User']].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a999c' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px 0 34px', boxSizing: 'border-box' }} />
            </div>
            <button className="ghost-btn" onClick={loadUsers}><RefreshCw size={14} /></button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Country</th>
                  <th>Roles</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2f5f2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <User size={14} color="#2b8a7d" />
                        </div>
                        <strong style={{ fontSize: '0.88rem' }}>{u.full_name || '—'}</strong>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.84rem', color: '#607478' }}>{u.email}</td>
                    <td style={{ fontSize: '0.84rem' }}>{u.country || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(u.roles ?? []).map((r) => (
                          <RolePill key={r} role={r} />
                        ))}
                        {!u.roles?.length && <span style={{ color: '#8a999c', fontSize: '0.8rem' }}>No roles</span>}
                      </div>
                    </td>
                    <td style={{ color: '#607478', fontSize: '0.82rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="ghost-btn"
                          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                          disabled={!canManageSuperAdmins && u.roles?.includes('super_admin')}
                          title={!canManageSuperAdmins && u.roles?.includes('super_admin') ? 'Only a Super Admin can manage a Super Admin account' : 'Manage roles'}
                          onClick={() => openRoleModal(u)}
                        >
                          <Shield size={13} /> Roles
                        </button>
                        <button
                          className="ghost-btn"
                          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                          disabled={u.roles?.includes('super_admin')}
                          title={u.roles?.includes('super_admin') ? 'Super admins cannot be impersonated' : 'View the app as this user'}
                          onClick={() => setViewAsModal({ user: u, role: primaryRole(u), reason: 'Support troubleshooting' })}
                        >
                          <Eye size={13} /> View As
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Invites tab */}
      {tab === 'invites' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Revoke</th></tr></thead>
            <tbody>
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                return (
                  <tr key={inv.id}>
                    <td>{inv.full_name || '—'}</td>
                    <td style={{ fontSize: '0.84rem' }}>{inv.email}</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: (ROLE_COLORS[inv.role_name] ?? '#607478') + '22', color: ROLE_COLORS[inv.role_name] ?? '#607478' }}>
                        {inv.role_name?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {inv.accepted_at
                        ? <span className="status-badge status-paid">Accepted</span>
                        : expired
                        ? <span className="status-badge status-failed">Expired</span>
                        : <span className="status-badge status-pending">Pending</span>}
                    </td>
                    <td style={{ color: '#607478', fontSize: '0.82rem' }}>{new Date(inv.expires_at).toLocaleDateString()}</td>
                    <td>
                      {!inv.accepted_at && (
                        <button className="icon-btn" style={{ color: '#8a2c21' }} onClick={() => revokeInvite(inv.id)}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!invites.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#607478', padding: 24 }}>No invites sent yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add user tab */}
      {tab === 'add' && (
        <div className="qm-editor">
          <div className="qm-editor-header">
            <strong>Add or Invite User</strong>
          </div>

          {/* Toggle: invite vs direct create */}
          <div className="segmented-control" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
            <button type="button" className={form.invite_only ? 'segment-active' : ''} onClick={() => setForm((p) => ({ ...p, invite_only: true }))}>
              <Mail size={14} /> Send Invite Link
            </button>
            <button type="button" className={!form.invite_only ? 'segment-active' : ''} onClick={() => setForm((p) => ({ ...p, invite_only: false }))}>
              <UserCheck size={14} /> Create with Password
            </button>
          </div>

          <form onSubmit={handleAddUser}>
            <div className="qm-form-grid">
              <div className="qm-form-row">
                <label>Full Name</label>
                <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Abena Mensah" required />
              </div>
              <div className="qm-form-row">
                <label>Email Address</label>
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="user@email.com" required />
              </div>
              <div className="qm-form-row">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                  {manageableRoles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
                </select>
              </div>
              {!form.invite_only && (
                <div className="qm-form-row">
                  <label>Temporary Password</label>
                  <input type="password" minLength={6} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
                </div>
              )}
            </div>

            {form.role === 'instructor' && (
              <div style={{ margin: '16px 0', padding: 16, borderRadius: 12, border: '1px solid #dbe6e4', background: '#f8fbfa' }}>
                <strong style={{ display: 'block', marginBottom: 10 }}>Instructor details</strong>
                <div className="qm-form-grid">
                  <div className="qm-form-row">
                    <label>Institution</label>
                    <input value={form.institution} onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))} placeholder="e.g. NurseFaculty / University name" />
                  </div>
                  <div className="qm-form-row">
                    <label>Department</label>
                    <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} placeholder="e.g. Adult Health Nursing" />
                  </div>
                  <div className="qm-form-row">
                    <label>Nursing Specialty</label>
                    <input value={form.nursing_specialty} onChange={(e) => setForm((p) => ({ ...p, nursing_specialty: e.target.value }))} placeholder="e.g. Medical-Surgical, Pediatrics" />
                  </div>
                  <div className="qm-form-row">
                    <label>Professional Title</label>
                    <input value={form.professional_title} onChange={(e) => setForm((p) => ({ ...p, professional_title: e.target.value }))} placeholder="e.g. Lecturer, Clinical Instructor" />
                  </div>
                  <div className="qm-form-row">
                    <label>Staff ID</label>
                    <input value={form.staff_id} onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value }))} placeholder="Optional staff number" />
                  </div>
                  <div className="qm-form-row">
                    <label>Account Status</label>
                    <select value={form.account_status} onChange={(e) => setForm((p) => ({ ...p, account_status: e.target.value }))}>
                      <option value="invitation_pending">Invitation Pending</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="deactivated">Deactivated</option>
                    </select>
                  </div>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: '0.84rem', color: '#42585e' }}>
                  <input type="checkbox" checked={form.send_onboarding_email} onChange={(e) => setForm((p) => ({ ...p, send_onboarding_email: e.target.checked }))} />
                  Send onboarding email and redirect instructor to create first classroom after activation.
                </label>
              </div>
            )}

            {/* Role description */}
            <div style={{ padding: '10px 14px', background: '#f7faf9', borderRadius: 8, border: '1px solid #e1ebe9', marginBottom: 14, fontSize: '0.85rem', color: '#42585e' }}>
              <strong>{selectedRoleMeta?.label}: </strong>
              {selectedRoleMeta?.desc}
              <div style={{ marginTop: 6, color: '#607478' }}>
                Responsibility: {selectedRoleMeta?.responsibility}
              </div>
              <PermissionPreview roles={[form.role]} />
            </div>

            <div style={{ padding: '10px 14px', background: form.invite_only ? '#e0f0ff' : '#fff6df', borderRadius: 8, border: `1px solid ${form.invite_only ? '#b3d4f5' : '#f2d6a0'}`, marginBottom: 14, fontSize: '0.84rem', color: form.invite_only ? '#1a5a8a' : '#875f08' }}>
              {form.invite_only
                ? '📧 An invite link will be sent to this email. The user clicks the link to set their own password and activate their account.'
                : '🔐 The user account is created immediately with the password you set. Share the credentials with the user directly.'}
            </div>

            {msg && (
              <div style={{ padding: '10px 14px', background: '#e2f5f2', borderRadius: 8, color: '#135f55', fontSize: '0.86rem', marginBottom: 14 }}>
                <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 6 }} />{msg}
              </div>
            )}

            <div className="editor-footer">
              <button type="button" className="ghost-btn" onClick={() => { setForm(EMPTY_FORM); setMsg(''); }}>Reset</button>
              <button type="submit" className="primary-btn" disabled={saving || !form.email || !form.full_name}>
                {saving ? 'Working…' : form.invite_only ? <><Mail size={15} /> Send Invite</> : <><UserCheck size={15} /> Create Account</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role management modal */}
      {roleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 720, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>{roleModal.full_name || roleModal.email}</h3>
                <p style={{ margin: 0, color: '#607478', fontSize: '0.84rem' }}>{roleModal.email}</p>
              </div>
              <button className="icon-btn" onClick={() => setRoleModal(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {manageableRoles.map((role) => {
                const hasRole = roleModal.roles?.includes(role.name);
                return (
                  <div key={role.name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${hasRole ? role.color : '#dbe6e4'}`, background: hasRole ? role.color + '12' : '#fff' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: hasRole ? role.color : '#17212f', fontSize: '0.9rem' }}>{role.label}</div>
                      <div style={{ fontSize: '0.78rem', color: '#607478', marginTop: 2 }}>
                        <strong>{role.responsibility}:</strong> {role.desc}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#8a999c', marginTop: 4 }}>
                        {role.permissions.length} permissions
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (hasRole) removeRole(roleModal.id, role.name);
                        else assignRole(roleModal.id, role.name);
                      }}
                      style={{ padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', border: `1.5px solid ${hasRole ? role.color : '#dbe6e4'}`, background: hasRole ? role.color : 'transparent', color: hasRole ? '#fff' : '#607478', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {hasRole ? 'Remove' : 'Add Role'}
                    </button>
                  </div>
                );
              })}
            </div>
            <button className="ghost-btn" style={{ marginTop: 14 }} onClick={() => setPreviewOpen((value) => !value)}>
              <Eye size={14} /> {previewOpen ? 'Hide' : 'Preview'} Effective Permissions
            </button>
            {previewOpen && <PermissionPreview roles={roleModal.roles ?? []} overrides={permissionOverrides} />}
            <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: '#f8fbfa', border: '1px solid #dde8e6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <strong style={{ fontSize: '0.9rem' }}>Custom Permission Overrides</strong>
                <span style={{ fontSize: '0.76rem', color: '#607478' }}>Use sparingly</span>
              </div>
              <div style={{ display: 'grid', gap: 12, maxHeight: 300, overflow: 'auto' }}>
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.key}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2b8a7d', fontWeight: 800, marginBottom: 6 }}>{group.label}</div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {group.permissions.map(([permission, label]) => {
                        const effect = permissionOverrides[permission] ?? '';
                        const savingThis = overrideSaving === permission;
                        return (
                          <div key={permission} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '7px 8px', borderRadius: 8, background: '#fff', border: '1px solid #e1ebe9' }}>
                            <span style={{ fontSize: '0.8rem', color: '#42585e' }}>{label}</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[
                                ['', 'Inherited'],
                                ['allow', 'Allow'],
                                ['deny', 'Deny'],
                              ].map(([value, text]) => (
                                <button
                                  key={value || 'inherit'}
                                  type="button"
                                  disabled={savingThis}
                                  onClick={() => setOverride(permission, value)}
                                  style={{
                                    border: '1px solid #dbe6e4',
                                    borderRadius: 7,
                                    padding: '4px 7px',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    background: effect === value ? (value === 'deny' ? '#fff0ee' : value === 'allow' ? '#e2f5f2' : '#edf2f1') : '#fff',
                                    color: effect === value ? (value === 'deny' ? '#8a2c21' : value === 'allow' ? '#135f55' : '#42585e') : '#8a999c',
                                  }}
                                >
                                  {savingThis && effect !== value ? '...' : text}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#fff6df', border: '1px solid #f2d6a0', color: '#875f08', fontSize: '0.82rem' }}>
              Least privilege reminder: assign only the smallest role set this person needs. Multiple roles are supported, and the preview above shows the combined access.
            </div>
            <div className="editor-footer" style={{ marginTop: 16 }}>
              <button className="primary-btn" onClick={() => setRoleModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {viewAsModal && (
        <div className="modal-backdrop">
          <div className="qm-editor" style={{ maxWidth: 560, width: '100%' }}>
            <div className="qm-editor-header">
              <strong>View as {ROLE_LOOKUP[viewAsModal.role]?.label ?? viewAsModal.role}</strong>
              <button className="icon-btn" onClick={() => setViewAsModal(null)}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, color: '#42585e', lineHeight: 1.55 }}>
                You are about to view the platform as <strong>{viewAsModal.user.full_name || viewAsModal.user.email}</strong>.
              </p>
              <div className="qm-form-row">
                <label>Role to preview</label>
                <select value={viewAsModal.role} onChange={(e) => setViewAsModal((prev) => ({ ...prev, role: e.target.value }))}>
                  {availableViewRoles(viewAsModal.user).map((role) => (
                    <option key={role} value={role}>{ROLE_LOOKUP[role]?.label ?? role.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="qm-form-row">
                <label>Reason</label>
                <input value={viewAsModal.reason} onChange={(e) => setViewAsModal((prev) => ({ ...prev, reason: e.target.value }))} placeholder="e.g. Exam troubleshooting" />
              </div>
              <div className="setup-alert">
                While viewing as this user, restricted account changes remain blocked and the session is recorded in the audit log.
              </div>
              <div className="editor-footer">
                <button className="ghost-btn" onClick={() => setViewAsModal(null)}>Cancel</button>
                <button className="primary-btn" onClick={confirmViewAs}><Eye size={15} /> Continue</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
