import React, { useEffect, useState } from 'react';
import { CheckCircle2, Edit3, Eye, EyeOff, FilePlus, Save, Star, Trash2, X } from 'lucide-react';
import { supabase } from '../services/supabase';

const TOPICS = ['Pharmacology', 'NGN Case Studies', 'Test Strategy', 'Medical-Surgical', 'Mental Health', 'Maternal and Newborn', 'Pediatrics', 'Safety and Infection Control', 'Leadership and Management'];

const DEMO_VIDEOS = [
  { id: 'v1', title: 'NCLEX Pharmacology: High-Yield Drug Classes', topic: 'Pharmacology', video_url: 'https://www.youtube.com/embed/si67310XO80', duration_mins: 45, is_published: true, is_premium: false, view_count: 1240, sort_order: 1, description: 'Cover the 20 most-tested drug classes. Focus on nursing considerations, antidotes, side effects, and NCLEX priority questions.' },
  { id: 'v2', title: 'NGN Case Study Walkthrough', topic: 'NGN Case Studies', video_url: 'https://www.youtube.com/embed/mPDa_ypIS0o', duration_mins: 38, is_published: true, is_premium: false, view_count: 987, sort_order: 2, description: 'Full-length NGN case walkthrough. Demonstrates clinical judgment across bow-tie, matrix, and highlight items.' },
  { id: 'v3', title: 'CAT Strategy: How the NCLEX Adapts to You', topic: 'Test Strategy', video_url: 'https://www.youtube.com/embed/3TdnyZDG44Q', duration_mins: 20, is_published: true, is_premium: false, view_count: 2103, sort_order: 3, description: 'How Computer Adaptive Testing works on the Next Generation NCLEX and strategies to approach hard questions.' },
  { id: 'v4', title: 'Critical Lab Values You Must Know', topic: 'Medical-Surgical', video_url: 'https://www.youtube.com/embed/cnE5EvJ_mdY', duration_mins: 25, is_published: true, is_premium: true, view_count: 756, sort_order: 4, description: 'Critical lab values: sodium, potassium, glucose, CBC, ABGs, and more.' },
  { id: 'v5', title: 'Mental Health Nursing: Therapeutic Communication NCLEX Review', topic: 'Mental Health', video_url: 'https://www.youtube.com/embed/V1WbahXiFlw', duration_mins: 35, is_published: true, is_premium: false, view_count: 614, sort_order: 5, description: 'The ultimate NCLEX review for therapeutic communication techniques, do\'s and don\'ts, and mental health priority interventions.' },
  { id: 'v6', title: 'Maternal-Newborn: Priority Nursing Actions', topic: 'Maternal and Newborn', video_url: 'https://www.youtube.com/embed/r3W3wFR5ubM', duration_mins: 35, is_published: true, is_premium: true, view_count: 432, sort_order: 6, description: 'High-yield maternal and newborn content: labor stages, postpartum complications, and newborn assessments.' },
];

const EMPTY = { title: '', topic: 'Pharmacology', video_url: '', description: '', duration_mins: '', is_published: false, is_premium: false, sort_order: '' };

export default function VideoManager({ session }) {
  const [videos, setVideos] = useState(supabase ? [] : DEMO_VIDEOS);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('video_lessons').select('*').order('sort_order').then(({ data }) => { if (data?.length) setVideos(data); });
  }, []);

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openEdit(v) { setEditing({ ...v }); setIsNew(false); }
  function close() { setEditing(null); setIsNew(false); }

  async function save(publish) {
    if (!editing.title || !editing.video_url) return;
    setSaving(true);
    const payload = { ...editing, is_published: publish !== undefined ? publish : editing.is_published, duration_mins: editing.duration_mins ? Number(editing.duration_mins) : null, sort_order: editing.sort_order ? Number(editing.sort_order) : 0 };
    delete payload.id;

    if (supabase) {
      if (isNew) {
        const { data } = await supabase.from('video_lessons').insert(payload).select().single();
        if (data) setVideos((p) => [...p, data]);
      } else {
        const { data } = await supabase.from('video_lessons').update(payload).eq('id', editing.id).select().single();
        if (data) setVideos((p) => p.map((v) => v.id === data.id ? data : v));
      }
    } else {
      const v = { ...payload, id: editing.id ?? `v${Date.now()}` };
      setVideos((p) => isNew ? [...p, v] : p.map((x) => x.id === v.id ? v : x));
    }
    setSaving(false);
    close();
  }

  async function togglePublish(v) {
    const next = !v.is_published;
    if (supabase) await supabase.from('video_lessons').update({ is_published: next }).eq('id', v.id);
    setVideos((p) => p.map((x) => x.id === v.id ? { ...x, is_published: next } : x));
  }

  async function del(v) {
    if (!window.confirm('Delete this video lesson?')) return;
    if (supabase) await supabase.from('video_lessons').delete().eq('id', v.id);
    setVideos((p) => p.filter((x) => x.id !== v.id));
  }

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Video Manager</h2>
        <button className="primary-btn" onClick={openNew}><FilePlus size={15} /> Add Video</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total Videos', value: videos.length, color: '#29b7a3' }, { label: 'Published', value: videos.filter((v) => v.is_published).length, color: '#2b8a7d' }, { label: 'Premium', value: videos.filter((v) => v.is_premium).length, color: '#e3a72f' }, { label: 'Total Views', value: videos.reduce((s, v) => s + (v.view_count ?? 0), 0).toLocaleString(), color: '#c17f44' }].map((s) => (
          <div key={s.label} className="qm-stat" style={{ borderColor: s.color }}>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Editor */}
      {editing && (
        <div className="qm-editor" style={{ marginBottom: 18 }}>
          <div className="qm-editor-header">
            <strong>{isNew ? 'Add Video Lesson' : 'Edit Video'}</strong>
            <button className="icon-btn" onClick={close}><X size={16} /></button>
          </div>
          <div className="qm-form-grid">
            <div className="qm-form-row" style={{ gridColumn: '1/-1' }}>
              <label>Title</label>
              <input value={editing.title} onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. NCLEX Pharmacology: High-Yield Drug Classes" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
            </div>
            <div className="qm-form-row">
              <label>Topic</label>
              <select value={editing.topic} onChange={(e) => setEditing((p) => ({ ...p, topic: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="qm-form-row">
              <label>Duration (minutes)</label>
              <input type="number" min="1" value={editing.duration_mins} onChange={(e) => setEditing((p) => ({ ...p, duration_mins: e.target.value }))} placeholder="e.g. 45" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
            <div className="qm-form-row" style={{ gridColumn: '1/-1' }}>
              <label>YouTube Embed URL</label>
              <input type="url" value={editing.video_url} onChange={(e) => setEditing((p) => ({ ...p, video_url: e.target.value }))} placeholder="https://www.youtube.com/embed/VIDEO_ID" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
              <span style={{ fontSize: '0.78rem', color: '#8a999c' }}>Use the embed URL format: youtube.com/embed/VIDEO_ID</span>
            </div>
            <div className="qm-form-row" style={{ gridColumn: '1/-1' }}>
              <label>Description</label>
              <textarea className="editor-textarea" rows={3} value={editing.description} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} placeholder="Describe what students will learn…" />
            </div>
            <div className="qm-form-row">
              <label>Sort Order</label>
              <input type="number" min="0" value={editing.sort_order} onChange={(e) => setEditing((p) => ({ ...p, sort_order: e.target.value }))} placeholder="0" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
            <div className="qm-form-row">
              <label>Access</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', height: 38 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontWeight: 400 }}>
                  <input type="checkbox" checked={editing.is_premium} onChange={(e) => setEditing((p) => ({ ...p, is_premium: e.target.checked }))} />
                  <Star size={14} color="#e3a72f" /> Premium only
                </label>
              </div>
            </div>
          </div>
          <div className="editor-footer">
            <button className="ghost-btn" onClick={close}>Cancel</button>
            <button className="ghost-btn" onClick={() => save(false)} disabled={saving || !editing.title || !editing.video_url}><Save size={14} /> Save as Draft</button>
            <button className="primary-btn" onClick={() => save(true)} disabled={saving || !editing.title || !editing.video_url}>
              <CheckCircle2 size={14} /> {saving ? 'Saving…' : 'Save & Publish'}
            </button>
          </div>
        </div>
      )}

      {/* Video table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Topic</th><th>Duration</th><th>Views</th><th>Status</th><th>Access</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id}>
                <td><strong style={{ fontSize: '0.88rem' }}>{v.title}</strong></td>
                <td style={{ fontSize: '0.83rem', color: '#2b8a7d' }}>{v.topic}</td>
                <td style={{ color: '#607478', fontSize: '0.84rem' }}>{v.duration_mins ? `${v.duration_mins}m` : '—'}</td>
                <td>{(v.view_count ?? 0).toLocaleString()}</td>
                <td><span className={`status-badge ${v.is_published ? 'status-paid' : 'status-pending'}`}>{v.is_published ? 'Published' : 'Draft'}</span></td>
                <td>{v.is_premium ? <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#875f08', background: '#fff6df', padding: '2px 8px', borderRadius: 12 }}>PRO</span> : <span style={{ color: '#8a999c', fontSize: '0.82rem' }}>Free</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="icon-btn" onClick={() => togglePublish(v)} title={v.is_published ? 'Unpublish' : 'Publish'}>
                      {v.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button className="icon-btn" onClick={() => openEdit(v)}><Edit3 size={14} /></button>
                    <button className="icon-btn" style={{ color: '#8a2c21' }} onClick={() => del(v)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
