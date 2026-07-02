import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function ContentReviewer() {
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    if (!supabase) {
      setQueue([]);
      return;
    }
    const { data } = await supabase.from('questions').select('*').eq('status', 'draft').order('created_at', { ascending: true });
    setQueue(data ?? []);
  }

  async function approve(q) {
    if (supabase) await supabase.from('questions').update({ status: 'published' }).eq('id', q.id);
    setQueue((prev) => prev.filter((x) => x.id !== q.id));
    if (selected?.id === q.id) setSelected(null);
  }

  async function reject(q) {
    if (supabase) await supabase.from('questions').update({ status: 'rejected', review_note: rejectNote }).eq('id', q.id);
    setQueue((prev) => prev.filter((x) => x.id !== q.id));
    if (selected?.id === q.id) setSelected(null);
    setRejectNote('');
    setShowRejectModal(false);
  }

  return (
    <section className="content-band">
      <div className="section-title"><h2>Content Reviewer</h2></div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
        {/* Queue list */}
        <div>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: '0.92rem' }}>Draft Queue</strong>
            <span style={{ padding: '2px 9px', background: '#e3a72f', color: '#fff', borderRadius: 20, fontSize: '0.76rem', fontWeight: 700 }}>{queue.length}</span>
          </div>
          {queue.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#607478', background: '#f7faf9', borderRadius: 10, border: '1px dashed #c9d8d5' }}>
              <CheckCircle2 size={32} color="#29b7a3" style={{ margin: '0 auto 10px' }} />
              <p style={{ margin: 0 }}>All caught up! No questions pending review.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {queue.map((q) => (
                <div
                  key={q.id}
                  onClick={() => setSelected(selected?.id === q.id ? null : q)}
                  style={{ padding: 12, borderRadius: 10, border: `2px solid ${selected?.id === q.id ? '#29b7a3' : '#dbe6e4'}`, background: selected?.id === q.id ? '#e9f6f4' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#2b8a7d', marginBottom: 4 }}>{q.topic} · {q.question_type?.toUpperCase()}</div>
                  <p style={{ margin: '0 0 8px', fontSize: '0.85rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {q.prompt}
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="primary-btn" style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '5px 0' }} onClick={(e) => { e.stopPropagation(); approve(q); }}>
                      <ThumbsUp size={12} /> Approve
                    </button>
                    <button className="ghost-btn" style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '5px 0', color: '#8a2c21' }} onClick={(e) => { e.stopPropagation(); setSelected(q); setShowRejectModal(true); }}>
                      <ThumbsDown size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question detail */}
        {selected && !showRejectModal && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #dbe6e4', padding: 20 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: '#2b8a7d' }}>{selected.topic}</span>
              <span style={{ fontSize: '0.8rem', color: '#8a999c' }}>·</span>
              <span style={{ fontSize: '0.8rem', color: '#8a999c' }}>{selected.question_type === 'sata' ? 'Select All That Apply' : 'Multiple Choice'}</span>
            </div>
            <p style={{ fontSize: '0.98rem', lineHeight: 1.6, marginBottom: 16, fontWeight: 500 }}>{selected.prompt}</p>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {(selected.choices ?? []).map((c) => {
                const correct = selected.correct_answer?.ids?.includes(c.id);
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 8, padding: '7px 12px', borderRadius: 8, background: correct ? '#e9f6f4' : '#f7faf9', border: `1px solid ${correct ? '#b9e3dc' : '#e1ebe9'}` }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: correct ? '#29b7a3' : '#edf2f1', color: correct ? '#fff' : '#42585e', display: 'grid', placeItems: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>{c.id?.toUpperCase()}</span>
                    <span style={{ fontSize: '0.88rem', alignSelf: 'center' }}>{c.text}</span>
                    {correct && <CheckCircle2 size={14} color="#29b7a3" style={{ marginLeft: 'auto', alignSelf: 'center' }} />}
                  </div>
                );
              })}
            </div>
            {selected.rationale && (
              <div style={{ padding: 12, background: '#fff6ef', borderRadius: 8, border: '1px solid #f2d6bd', fontSize: '0.86rem', color: '#4a3020' }}>
                <strong style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><MessageSquare size={14} /> Rationale</strong>
                {selected.rationale}
              </div>
            )}
            <div className="editor-footer" style={{ marginTop: 16 }}>
              <button className="ghost-btn" style={{ color: '#8a2c21' }} onClick={() => setShowRejectModal(true)}>
                <XCircle size={15} /> Reject
              </button>
              <button className="primary-btn" onClick={() => approve(selected)}>
                <CheckCircle2 size={15} /> Approve &amp; Publish
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 6px' }}>Reject Question</h3>
            <p style={{ color: '#607478', fontSize: '0.88rem', margin: '0 0 16px' }}>Provide feedback to the question author explaining what needs to be changed.</p>
            <textarea
              className="editor-textarea"
              rows={4}
              placeholder="e.g. The rationale needs more clinical context. Please clarify why option B is incorrect and add a reference to NCSBN guidelines…"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="editor-footer" style={{ marginTop: 14 }}>
              <button className="ghost-btn" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="primary-btn" style={{ background: '#c0392b' }} onClick={() => reject(selected)} disabled={!rejectNote.trim()}>
                <XCircle size={15} /> Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
