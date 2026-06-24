import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Link2, PlusCircle, Users, Video, X } from 'lucide-react';
import { supabase } from '../services/supabase';

const TOPICS = ['Pharmacology', 'Medical-Surgical', 'NGN Case Studies', 'Maternal and Newborn', 'Mental Health', 'Pediatrics', 'Safety and Infection Control', 'Leadership and Management', 'Test Strategy', 'Lab Values'];

const DEMO_SESSIONS = [
  { id: 's1', title: 'NGN Case Study Review', topic: 'NGN Case Studies', starts_at: new Date(Date.now() + 86400000 * 2).toISOString(), ends_at: new Date(Date.now() + 86400000 * 2 + 7200000).toISOString(), meeting_url: 'https://meet.yingoh.com/ngn-review', status: 'scheduled', attendee_count: 12 },
  { id: 's2', title: 'CAT Strategy Lab', topic: 'Test Strategy', starts_at: new Date(Date.now() + 86400000 * 4).toISOString(), ends_at: new Date(Date.now() + 86400000 * 4 + 5400000).toISOString(), meeting_url: 'https://meet.yingoh.com/cat-lab', status: 'scheduled', attendee_count: 8 },
  { id: 's3', title: 'Pharmacology High-Yield Review', topic: 'Pharmacology', starts_at: new Date(Date.now() - 86400000 * 3).toISOString(), ends_at: new Date(Date.now() - 86400000 * 3 + 7200000).toISOString(), meeting_url: 'https://meet.yingoh.com/pharm', recording_url: 'https://rec.yingoh.com/pharm-rev', status: 'completed', attendee_count: 23 },
  { id: 's4', title: 'Mental Health Nursing Essentials', topic: 'Mental Health', starts_at: new Date(Date.now() - 86400000 * 10).toISOString(), ends_at: new Date(Date.now() - 86400000 * 10 + 5400000).toISOString(), recording_url: 'https://rec.yingoh.com/mental-health', status: 'completed', attendee_count: 17 },
];

const EMPTY_SESSION = { title: '', topic: 'Pharmacology', description: '', starts_at: '', duration_mins: 90, meeting_url: '' };

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function InstructorTools({ session }) {
  const [sessions, setSessions] = useState(DEMO_SESSIONS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_SESSION);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    if (!supabase) return;
    supabase.from('class_schedules').select('*').order('starts_at', { ascending: false }).then(({ data }) => {
      if (data?.length) setSessions(data);
    });
  }, []);

  const upcoming = sessions.filter((s) => s.status === 'scheduled' && new Date(s.starts_at) > new Date());
  const past = sessions.filter((s) => s.status === 'completed' || new Date(s.starts_at) < new Date());
  const displayed = tab === 'upcoming' ? upcoming : past;

  async function saveSession() {
    if (!form.title || !form.starts_at) return;
    setSaving(true);
    const starts = new Date(form.starts_at).toISOString();
    const ends = new Date(new Date(form.starts_at).getTime() + form.duration_mins * 60000).toISOString();
    const payload = {
      instructor_id: session?.user?.id,
      title: form.title,
      topic: form.topic,
      description: form.description,
      starts_at: starts,
      ends_at: ends,
      meeting_url: form.meeting_url,
      status: 'scheduled',
    };

    if (supabase) {
      const { data } = await supabase.from('class_schedules').insert(payload).select().single();
      if (data) setSessions((prev) => [data, ...prev]);
    } else {
      setSessions((prev) => [{ ...payload, id: `s${Date.now()}`, attendee_count: 0 }, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_SESSION);
    setTab('upcoming');
  }

  async function cancelSession(id) {
    if (!window.confirm('Cancel this session?')) return;
    if (supabase) await supabase.from('class_schedules').update({ status: 'cancelled' }).eq('id', id);
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s));
  }

  const totalStudents = sessions.reduce((a, s) => a + (s.attendee_count ?? 0), 0);

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Instructor Tools</h2>
        <button className="primary-btn" onClick={() => setShowForm(true)}>
          <PlusCircle size={15} /> Schedule Session
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Upcoming', value: upcoming.length, icon: Calendar, color: '#29b7a3' },
          { label: 'Completed', value: past.length, icon: Video, color: '#2b8a7d' },
          { label: 'Total Students', value: totalStudents, icon: Users, color: '#e3a72f' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}`, textAlign: 'center' }}>
            <s.icon size={20} color={s.color} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.82rem', color: '#607478' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* New session form */}
      {showForm && (
        <div className="qm-editor" style={{ marginBottom: 20 }}>
          <div className="qm-editor-header">
            <strong>Schedule New Session</strong>
            <button className="icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>
          <div className="qm-form-grid">
            <div className="qm-form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Session Title</label>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Pharmacology High-Yield Review" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
            </div>
            <div className="qm-form-row">
              <label>Topic</label>
              <select value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="qm-form-row">
              <label>Duration (minutes)</label>
              <input type="number" min="30" step="15" value={form.duration_mins} onChange={(e) => setForm((p) => ({ ...p, duration_mins: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
            <div className="qm-form-row">
              <label>Start Date &amp; Time</label>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
            <div className="qm-form-row">
              <label>Meeting URL (Zoom/Google Meet)</label>
              <input type="url" value={form.meeting_url} onChange={(e) => setForm((p) => ({ ...p, meeting_url: e.target.value }))} placeholder="https://meet.google.com/…" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
          </div>
          <div className="qm-form-row">
            <label>Description</label>
            <textarea rows={3} className="editor-textarea" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What will students learn in this session?" />
          </div>
          <div className="editor-footer">
            <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="primary-btn" onClick={saveSession} disabled={saving || !form.title || !form.starts_at}>
              {saving ? 'Saving…' : 'Schedule Session'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 14 }}>
        <button className={`tab-btn ${tab === 'upcoming' ? 'tab-active' : ''}`} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</button>
        <button className={`tab-btn ${tab === 'past' ? 'tab-active' : ''}`} onClick={() => setTab('past')}>Past Sessions ({past.length})</button>
      </div>

      {/* Session cards */}
      <div style={{ display: 'grid', gap: 12 }}>
        {displayed.map((s) => (
          <div key={s.id} className="classroom-card">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#2b8a7d' }}>{s.topic}</span>
                <span className={`status-badge status-${s.status === 'scheduled' ? 'pending' : s.status === 'completed' ? 'paid' : 'failed'}`}>{s.status}</span>
              </div>
              <h4 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{s.title}</h4>
              <div style={{ display: 'flex', gap: 14, fontSize: '0.84rem', color: '#607478', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Calendar size={13} />{formatDateTime(s.starts_at)}</span>
                {s.ends_at && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Clock size={13} />{Math.round((new Date(s.ends_at) - new Date(s.starts_at)) / 60000)} min</span>}
                {s.attendee_count > 0 && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Users size={13} />{s.attendee_count} students</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {s.meeting_url && s.status === 'scheduled' && (
                <a href={s.meeting_url} target="_blank" rel="noreferrer" className="primary-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Video size={14} /> Start Session
                </a>
              )}
              {s.recording_url && (
                <a href={s.recording_url} target="_blank" rel="noreferrer" className="ghost-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={14} /> Recording
                </a>
              )}
              {s.status === 'scheduled' && (
                <button className="ghost-btn" style={{ color: '#8a2c21' }} onClick={() => cancelSession(s.id)}>Cancel</button>
              )}
            </div>
          </div>
        ))}
        {!displayed.length && (
          <div style={{ textAlign: 'center', padding: 40, color: '#607478' }}>
            <p>{tab === 'upcoming' ? 'No upcoming sessions. Schedule your first one!' : 'No past sessions yet.'}</p>
            {tab === 'upcoming' && <button className="primary-btn" onClick={() => setShowForm(true)}><PlusCircle size={15} /> Schedule Session</button>}
          </div>
        )}
      </div>
    </section>
  );
}
