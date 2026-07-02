import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, MessageCircle, MessageSquare,
  Pin, PlusCircle, Send, User,
} from 'lucide-react';
import { supabase } from '../services/supabase';

const TOPICS = ['General', 'Pharmacology', 'Medical-Surgical', 'NGN Case Studies', 'Mental Health', 'Test Strategy', 'Maternal and Newborn', 'Pediatrics'];

const DEMO_THREADS = [
  { id: 't1', title: 'Welcome to the NurseFaculty Community!', content: 'Ask questions, share study strategies, and support fellow nurses preparing for the NCLEX.', topic: 'General', is_pinned: true, reply_count: 3, author_name: 'NurseFaculty Team', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: 't2', title: 'Struggling with pharmacology — any tips?', content: 'I have been going through the pharmacology flashcards but there are so many drug classes. How do you all organize and remember them? Any mnemonics that helped you?', topic: 'Pharmacology', is_pinned: false, reply_count: 5, author_name: 'Abena M.', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 't3', title: 'How is the CAT different from a regular exam?', content: 'I know CAT adapts to your answers but I am confused about how it decides when to stop and what the passing standard is. Can someone explain?', topic: 'Test Strategy', is_pinned: false, reply_count: 2, author_name: 'Kwame A.', created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 't4', title: 'NGN Bow Tie questions — how do you approach them?', content: 'The bow tie items are really throwing me off. I understand the format but I keep second-guessing the causes vs. outcomes. Anyone have a strategy?', topic: 'NGN Case Studies', is_pinned: false, reply_count: 1, author_name: 'Ama B.', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const DEMO_REPLIES = {
  t1: [
    { id: 'r1', content: 'Thank you! This platform is amazing. The flashcards really help with spaced repetition.', author_name: 'Abena M.', is_instructor_reply: false, created_at: new Date(Date.now() - 86400000 * 9).toISOString() },
    { id: 'r2', content: 'Glad to be here! The study planner feature is exactly what I needed to stay on track before my exam date.', author_name: 'Kofi A.', is_instructor_reply: false, created_at: new Date(Date.now() - 86400000 * 8).toISOString() },
    { id: 'r3', content: 'Welcome! Ask questions whenever you need guidance—we are here to help.', author_name: 'NurseFaculty Instructor', is_instructor_reply: true, created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  ],
  t2: [
    { id: 'r4', content: 'I group them by drug class and make up a story! For beta blockers I remember "olol" at the end — blocks stress (beta).', author_name: 'Ama B.', is_instructor_reply: false, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'r5', content: 'The pharmacology flashcard deck in the app is gold. I do 10-15 cards every morning before practice questions.', author_name: 'Kwame A.', is_instructor_reply: false, created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
  ],
  t3: [],
  t4: [],
};

const TOPIC_COLORS = { General: '#607478', Pharmacology: '#c17f44', 'Medical-Surgical': '#2b8a7d', 'NGN Case Studies': '#29b7a3', 'Mental Health': '#8b5cf6', 'Test Strategy': '#e3a72f', 'Maternal and Newborn': '#e94868', Pediatrics: '#e94868' };

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso);
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  return `${mins}m ago`;
}

export default function CommunityForum({ session }) {
  const [threads, setThreads] = useState(supabase ? [] : DEMO_THREADS);
  const [replies, setReplies] = useState(supabase ? {} : DEMO_REPLIES);
  const [selected, setSelected] = useState(null);
  const [topicFilter, setTopicFilter] = useState('All');
  const [replyText, setReplyText] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newThread, setNewThread] = useState({ title: '', content: '', topic: 'General' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('forum_threads').select('*, profiles(full_name)').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).then(({ data }) => {
      if (data?.length) setThreads(data.map((t) => ({ ...t, author_name: t.profiles?.full_name ?? 'Anonymous' })));
    });
  }, []);

  async function loadReplies(threadId) {
    if (!supabase) return;
    const { data } = await supabase.from('forum_replies').select('*, profiles(full_name)').eq('thread_id', threadId).order('created_at');
    if (data) setReplies((prev) => ({ ...prev, [threadId]: data.map((r) => ({ ...r, author_name: r.profiles?.full_name ?? 'Anonymous' })) }));
  }

  function openThread(t) {
    setSelected(t);
    loadReplies(t.id);
  }

  async function submitReply() {
    if (!replyText.trim()) return;
    setSubmitting(true);
    const reply = {
      content: replyText.trim(),
      author_name: session?.user?.email?.split('@')[0] ?? 'You',
      is_instructor_reply: false,
      created_at: new Date().toISOString(),
      id: `r${Date.now()}`,
    };
    if (supabase && session?.user?.id) {
      const { data } = await supabase.from('forum_replies').insert({ thread_id: selected.id, author_id: session.user.id, content: replyText.trim() }).select().single();
      if (data) reply.id = data.id;
      await supabase.from('forum_threads').update({ reply_count: (selected.reply_count ?? 0) + 1, last_reply_at: new Date().toISOString() }).eq('id', selected.id);
    }
    setReplies((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), reply] }));
    setThreads((prev) => prev.map((t) => t.id === selected.id ? { ...t, reply_count: (t.reply_count ?? 0) + 1 } : t));
    setSelected((t) => ({ ...t, reply_count: (t.reply_count ?? 0) + 1 }));
    setReplyText('');
    setSubmitting(false);
  }

  async function createThread() {
    if (!newThread.title.trim() || !newThread.content.trim()) return;
    setSubmitting(true);
    const thread = {
      ...newThread,
      id: `t${Date.now()}`,
      is_pinned: false,
      reply_count: 0,
      author_name: session?.user?.email?.split('@')[0] ?? 'You',
      created_at: new Date().toISOString(),
    };
    if (supabase && session?.user?.id) {
      const { data } = await supabase.from('forum_threads').insert({ title: newThread.title, content: newThread.content, topic: newThread.topic, author_id: session.user.id }).select().single();
      if (data) thread.id = data.id;
    }
    setThreads((prev) => [thread, ...prev]);
    setNewThread({ title: '', content: '', topic: 'General' });
    setShowNew(false);
    setSubmitting(false);
  }

  const filteredThreads = threads.filter((t) => topicFilter === 'All' || t.topic === topicFilter);

  // Thread view
  if (selected) {
    const threadReplies = replies[selected.id] ?? [];
    const color = TOPIC_COLORS[selected.topic] ?? '#607478';
    return (
      <section className="content-band">
        <button className="ghost-btn" onClick={() => setSelected(null)} style={{ marginBottom: 16 }}><ArrowLeft size={15} /> Back to Forum</button>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #dbe6e4', padding: '20px 24px', marginBottom: 16 }}>
          {selected.is_pinned && <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#e3a72f', fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}><Pin size={13} /> PINNED</div>}
          <div style={{ fontSize: '0.78rem', color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{selected.topic}</div>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.15rem' }}>{selected.title}</h2>
          <p style={{ margin: '0 0 14px', lineHeight: 1.65, color: '#42585e' }}>{selected.content}</p>
          <div style={{ fontSize: '0.8rem', color: '#8a999c', display: 'flex', gap: 10 }}>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><User size={12} />{selected.author_name}</span>
            <span>{timeAgo(selected.created_at)}</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><MessageCircle size={12} />{selected.reply_count} replies</span>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', color: '#42585e' }}>{threadReplies.length} Replies</h4>
          <div style={{ display: 'grid', gap: 10 }}>
            {threadReplies.map((r) => (
              <div key={r.id} style={{ background: r.is_instructor_reply ? '#e2f5f2' : '#fff', border: `1px solid ${r.is_instructor_reply ? '#b9e3dc' : '#dbe6e4'}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: r.is_instructor_reply ? '#29b7a3' : '#edf2f1', display: 'grid', placeItems: 'center' }}>
                    {r.is_instructor_reply ? <CheckCircle2 size={14} color="#fff" /> : <User size={13} color="#607478" />}
                  </div>
                  <strong style={{ fontSize: '0.88rem' }}>{r.author_name}</strong>
                  {r.is_instructor_reply && <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: '#135f55', color: '#fff', borderRadius: 12, fontWeight: 700 }}>Instructor</span>}
                  <span style={{ fontSize: '0.78rem', color: '#8a999c', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#42585e', lineHeight: 1.55 }}>{r.content}</p>
              </div>
            ))}
            {!threadReplies.length && <p style={{ color: '#607478', textAlign: 'center', padding: 20 }}>No replies yet. Be the first to respond!</p>}
          </div>
        </div>

        {/* Reply box */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #dbe6e4', padding: 16 }}>
          <textarea
            className="editor-textarea"
            rows={3}
            placeholder={session ? 'Write your reply…' : 'Sign in to reply to this thread.'}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={!session}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="primary-btn" onClick={submitReply} disabled={!replyText.trim() || !session || submitting}>
              <Send size={14} /> {submitting ? 'Posting…' : 'Post Reply'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Thread list
  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Community Forum</h2>
        <button className="primary-btn" onClick={() => setShowNew(true)} disabled={!session}><PlusCircle size={15} /> New Thread</button>
      </div>
      {!session && <div style={{ padding: '10px 14px', background: '#fff6df', borderRadius: 8, color: '#875f08', marginBottom: 14, fontSize: '0.86rem' }}>Sign in to post threads and replies.</div>}

      {/* New thread form */}
      {showNew && (
        <div className="qm-editor" style={{ marginBottom: 18 }}>
          <div className="qm-editor-header"><strong>New Thread</strong><button className="icon-btn" onClick={() => setShowNew(false)}>✕</button></div>
          <div className="qm-form-grid">
            <div className="qm-form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Title</label>
              <input value={newThread.title} onChange={(e) => setNewThread((p) => ({ ...p, title: e.target.value }))} placeholder="Thread title…" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
            </div>
            <div className="qm-form-row">
              <label>Topic</label>
              <select value={newThread.topic} onChange={(e) => setNewThread((p) => ({ ...p, topic: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="qm-form-row">
            <label>Content</label>
            <textarea className="editor-textarea" rows={4} value={newThread.content} onChange={(e) => setNewThread((p) => ({ ...p, content: e.target.value }))} placeholder="Share your question or topic…" />
          </div>
          <div className="editor-footer">
            <button className="ghost-btn" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="primary-btn" onClick={createThread} disabled={submitting || !newThread.title.trim() || !newThread.content.trim()}>Post Thread</button>
          </div>
        </div>
      )}

      {/* Topic filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['All', ...TOPICS].map((t) => (
          <button key={t} onClick={() => setTopicFilter(t)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, border: `1.5px solid ${topicFilter === t ? '#29b7a3' : '#dbe6e4'}`, background: topicFilter === t ? '#e9f6f4' : '#fff', color: topicFilter === t ? '#135f55' : '#607478', cursor: 'pointer' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <div style={{ display: 'grid', gap: 10 }}>
        {filteredThreads.map((t) => {
          const color = TOPIC_COLORS[t.topic] ?? '#607478';
          return (
            <div key={t.id} onClick={() => openThread(t)} className="forum-thread-row" style={{ borderLeft: t.is_pinned ? `4px solid #e3a72f` : `4px solid ${color}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  {t.is_pinned && <Pin size={12} color="#e3a72f" />}
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color }}>{t.topic}</span>
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem' }}>{t.title}</h4>
                <p style={{ margin: '0 0 6px', fontSize: '0.84rem', color: '#607478', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.content}</p>
                <div style={{ fontSize: '0.78rem', color: '#8a999c', display: 'flex', gap: 10 }}>
                  <span>{t.author_name}</span>
                  <span>{timeAgo(t.created_at)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', color: '#8a999c', fontSize: '0.84rem', flexShrink: 0 }}>
                <MessageCircle size={15} />{t.reply_count ?? 0}
              </div>
            </div>
          );
        })}
        {!filteredThreads.length && <p style={{ textAlign: 'center', color: '#607478', padding: 40 }}>No threads in this topic yet.</p>}
      </div>
    </section>
  );
}
