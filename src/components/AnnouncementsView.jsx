import React, { useEffect, useState } from 'react';
import { Bell, Edit3, PlusCircle, Trash2, X } from 'lucide-react';
import { supabase } from '../services/supabase';

const DEMO_ANNOUNCEMENTS = [
  { id: 'a1', title: 'Welcome to NurseFaculty!', content: 'Start your NCLEX journey with our adaptive question bank, clinical judgment practice, study coaching, and spaced-repetition flashcards.', audience: 'all', is_active: true, created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'a2', title: 'New NGN Case Studies Added', content: '25 new Next Generation NCLEX (NGN) case study questions have been added to the question bank, covering bow tie, matrix, and highlight-text item types. These align with the latest NCSBN Clinical Judgment Measurement Model.', audience: 'students', is_active: true, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'a3', title: 'Instructor Webinar — Pharmacology Focus', content: 'Join us this Saturday at 6PM for a live instructor-led pharmacology review session. Topics: High-alert medications, IV compatibility, and NCLEX pharmacology question strategies. Recording will be available.', audience: 'all', is_active: true, created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
];

const AUDIENCE_LABELS = { all: 'All Users', students: 'Students', instructors: 'Instructors', admins: 'Admins' };
const AUDIENCE_COLORS = { all: '#29b7a3', students: '#2b8a7d', instructors: '#e3a72f', admins: '#c17f44' };

const EMPTY = { title: '', content: '', audience: 'all' };

export default function AnnouncementsView() {
  const [announcements, setAnnouncements] = useState(supabase ? [] : DEMO_ANNOUNCEMENTS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data?.length) setAnnouncements(data);
    });
  }, []);

  function openEdit(a) {
    setForm({ title: a.title, content: a.content, audience: a.audience });
    setEditingId(a.id);
    setShowForm(true);
  }

  function closeForm() { setForm(EMPTY); setEditingId(null); setShowForm(false); }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const payload = { title: form.title.trim(), content: form.content.trim(), audience: form.audience, is_active: true };

    if (supabase) {
      if (editingId) {
        const { data } = await supabase.from('announcements').update(payload).eq('id', editingId).select().single();
        if (data) setAnnouncements((prev) => prev.map((a) => a.id === editingId ? data : a));
      } else {
        const { data } = await supabase.from('announcements').insert(payload).select().single();
        if (data) setAnnouncements((prev) => [data, ...prev]);
      }
    } else {
      if (editingId) {
        setAnnouncements((prev) => prev.map((a) => a.id === editingId ? { ...a, ...payload } : a));
      } else {
        setAnnouncements((prev) => [{ ...payload, id: `a${Date.now()}`, created_at: new Date().toISOString() }, ...prev]);
      }
    }
    setSaving(false);
    closeForm();
  }

  async function toggle(a) {
    const newVal = !a.is_active;
    if (supabase) await supabase.from('announcements').update({ is_active: newVal }).eq('id', a.id);
    setAnnouncements((prev) => prev.map((x) => x.id === a.id ? { ...x, is_active: newVal } : x));
  }

  async function remove(a) {
    if (!window.confirm('Delete this announcement?')) return;
    if (supabase) await supabase.from('announcements').delete().eq('id', a.id);
    setAnnouncements((prev) => prev.filter((x) => x.id !== a.id));
  }

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Announcements</h2>
        <button className="primary-btn" onClick={() => { setForm(EMPTY); setEditingId(null); setShowForm(true); }}>
          <PlusCircle size={15} /> New Announcement
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="qm-editor" style={{ marginBottom: 20 }}>
          <div className="qm-editor-header">
            <strong>{editingId ? 'Edit Announcement' : 'New Announcement'}</strong>
            <button className="icon-btn" onClick={closeForm}><X size={16} /></button>
          </div>
          <div className="qm-form-grid">
            <div className="qm-form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Announcement title…" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
            </div>
            <div className="qm-form-row">
              <label>Audience</label>
              <select value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="qm-form-row">
            <label>Content</label>
            <textarea className="editor-textarea" rows={5} value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} placeholder="Announcement message…" />
          </div>
          <div className="editor-footer">
            <button className="ghost-btn" onClick={closeForm}>Cancel</button>
            <button className="primary-btn" onClick={save} disabled={saving || !form.title.trim() || !form.content.trim()}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {/* Announcement list */}
      <div style={{ display: 'grid', gap: 12 }}>
        {announcements.map((a) => {
          const color = AUDIENCE_COLORS[a.audience] ?? '#607478';
          return (
            <div key={a.id} className="announcement-card" style={{ borderLeft: `4px solid ${color}`, opacity: a.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Bell size={18} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>{a.title}</h4>
                    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: color + '22', color }}>{AUDIENCE_LABELS[a.audience]}</span>
                    {!a.is_active && <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: '#f2e2e1', color: '#8a2c21' }}>Hidden</span>}
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: '0.9rem', color: '#42585e', lineHeight: 1.55 }}>{a.content}</p>
                  <span style={{ fontSize: '0.78rem', color: '#8a999c' }}>{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="ghost-btn" style={{ fontSize: '0.78rem', padding: '5px 10px' }} onClick={() => toggle(a)}>
                    {a.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button className="icon-btn" onClick={() => openEdit(a)}><Edit3 size={14} /></button>
                  <button className="icon-btn" style={{ color: '#8a2c21' }} onClick={() => remove(a)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {!announcements.length && (
          <div style={{ textAlign: 'center', padding: 40, color: '#607478' }}>
            <Bell size={32} color="#dbe6e4" style={{ margin: '0 auto 10px' }} />
            <p>No announcements yet. Create your first one!</p>
          </div>
        )}
      </div>
    </section>
  );
}
