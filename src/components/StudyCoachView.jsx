import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, BookOpen, Bookmark, BookmarkCheck, CalendarDays, ClipboardList, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { consumeStudyCoachQuestion, getStudyCoachConversations, saveStudyCoachConversation, saveItem, supabase } from '../services/supabase';
import { useSubscription } from '../hooks/useSubscription';

const TABS = [
  { key: 'tutor', label: 'Chat Tutor', icon: Brain, placeholder: 'Ask an NCLEX question or paste answer choices...' },
  { key: 'explainer', label: 'Rationale Explainer', icon: BookOpen, placeholder: 'Paste a question and choices to explain...' },
  { key: 'quiz', label: 'Quiz Generator', icon: ClipboardList, placeholder: 'Generate 3 NGN questions on heart failure' },
  { key: 'planner', label: 'Study Planner', icon: CalendarDays, placeholder: 'Exam in 6 weeks, weak in pharmacology...' },
];

const DEMO_REPLY = `Concept:
This is an NCLEX priority question. Start by identifying the immediate risk to patient safety, then apply ABCs, nursing process, and expected vs unexpected findings.

Correct Answer:
Choose the option that addresses the most urgent physiologic problem or prevents harm first.

Why Wrong Options Are Wrong:
Distractors are often true nursing actions, but they are delayed, assessment-only, or less urgent than the priority intervention.

Clinical Tip:
On NCLEX, "first" usually means stabilize the patient before teaching, documenting, or calling the provider unless the patient is already stable.`;

const FRIENDLY_COACH_ERROR = `Study Coach is temporarily unavailable, but keep going.

Quick NCLEX thinking frame:
1. Identify the immediate safety risk.
2. Prioritize ABCs, circulation, neuro change, infection control, and unstable vital signs.
3. Choose assessment first only when you need missing data to act safely.
4. Teaching, documentation, and routine comfort usually come after stabilization.

Please try again shortly.`;

function makeTitle(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 70) || 'Study Coach Conversation';
}

export default function StudyCoachView({ session }) {
  const subscription = useSubscription(session);
  const [activeTab, setActiveTab] = useState('tutor');
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('Pharmacology');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedAnswerIds, setSavedAnswerIds] = useState(new Set());
  const bottomRef = useRef(null);

  const userId = session?.user?.id;
  const tabMeta = useMemo(() => TABS.find((t) => t.key === activeTab), [activeTab]);
  const today = new Date().toISOString().slice(0, 10);
  const coachUsedToday = conversations.reduce((total, conversation) => (
    total + (Array.isArray(conversation.messages) ? conversation.messages : [])
      .filter((message) => message.role === 'user' && String(message.created_at ?? '').startsWith(today)).length
  ), 0);
  const coachLimit = subscription.entitlements.coachDailyLimit;
  const coachLimitReached = Number.isFinite(coachLimit) && coachUsedToday >= coachLimit;

  useEffect(() => {
    async function load() {
      if (!userId) return;
      const { data } = await getStudyCoachConversations(userId);
      setConversations(data ?? []);
    }
    load();
  }, [userId]);

  function startNew(mode = activeTab) {
    setActiveTab(mode);
    setConversationId(null);
    setMessages([]);
    setInput('');
    setError('');
  }

  function openConversation(conv) {
    setActiveTab(conv.mode);
    setConversationId(conv.id);
    setMessages(Array.isArray(conv.messages) ? conv.messages : []);
    setError('');
  }

  async function persist(nextMessages, firstPrompt = input) {
    if (!userId) return null;
    const { data } = await saveStudyCoachConversation(userId, {
      id: conversationId,
      mode: activeTab,
      title: makeTitle(firstPrompt),
      messages: nextMessages,
      isSaved: false,
    });
    if (data) {
      setConversationId(data.id);
      setConversations((prev) => [data, ...prev.filter((c) => c.id !== data.id)].slice(0, 20));
    }
    return data;
  }

  async function send() {
    if (!input.trim() || loading) return;
    if (coachLimitReached) {
      setError(`You have used today’s ${coachLimit} Study Coach questions. Upgrade for unlimited coaching.`);
      return;
    }
    const prompt = input.trim();
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: prompt, created_at: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError('');

    try {
      let reply = DEMO_REPLY;
      if (supabase) {
        const { error: quotaError } = await consumeStudyCoachQuestion();
        if (quotaError) throw new Error(quotaError.message || 'Your Study Coach allowance has been used for today.');
        const apiHistory = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
        const { data, error: fnError } = await supabase.functions.invoke('study-coach', {
          body: {
            mode: activeTab,
            message: prompt,
            history: apiHistory.slice(0, -1),
            context: activeTab === 'quiz' ? `Topic: ${topic}` : undefined,
          },
        });
        if (fnError) throw fnError;
        reply = data?.reply ?? data?.answer ?? FRIENDLY_COACH_ERROR;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      const assistantMsg = { id: `a-${Date.now()}`, role: 'assistant', content: reply, created_at: new Date().toISOString() };
      const withReply = [...next, assistantMsg];
      setMessages(withReply);
      await persist(withReply, prompt);
    } catch (err) {
      const message = err.message ?? 'Study Coach could not respond.';
      console.error('Study Coach invocation failed', err);
      setError('Study Coach is temporarily unavailable. Please try again shortly.');
      const withError = [...next, { id: `e-${Date.now()}`, role: 'assistant', content: FRIENDLY_COACH_ERROR, created_at: new Date().toISOString(), is_error: true }];
      setMessages(withError);
      await persist(withError, prompt);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  async function saveAnswer(msg) {
    if (!userId) {
      setError('Sign in to save Study Coach answers.');
      return;
    }
    const itemId = `${conversationId ?? 'draft'}-${msg.id}`;
    const { error: saveError } = await saveItem(userId, {
      item_type: 'ai_answer',
      item_id: itemId,
      title: makeTitle(msg.content),
      summary: msg.content.slice(0, 220),
      metadata: { conversation_id: conversationId, mode: activeTab, content: msg.content },
    });
    if (!saveError) setSavedAnswerIds((prev) => new Set([...prev, msg.id]));
  }

  const emptyText = userId
    ? 'Ask a question to start a saved Study Coach conversation.'
    : 'Sign in to save Study Coach conversations. You can still try the demo response.';

  return (
    <section className="content-band">
      <div className="section-title">
        <div>
          <h2>Study Coach</h2>
          <p style={{ margin: '4px 0 0', color: '#607478', fontSize: '0.88rem' }}>NCLEX coaching with rationales, distractor review, and clinical tips.</p>
        </div>
        <button className="ghost-btn" onClick={() => startNew()}><RotateCcw size={15} /> New Chat</button>
      </div>

      {!supabase && (
        <div className="setup-alert" style={{ marginBottom: 14 }}>
          Preview mode. Connect the Study Coach service to enable live coaching responses.
        </div>
      )}
      {error && <div className="form-message" style={{ color: '#8a2c21', marginBottom: 12 }}>{error}</div>}

      <div className="coach-layout">
        <aside className="coach-history">
          <strong>Recent Chats</strong>
          <button className="ghost-btn" onClick={() => startNew()} style={{ width: '100%', margin: '10px 0' }}>New conversation</button>
          {conversations.length === 0 ? (
            <p>No saved conversations yet.</p>
          ) : conversations.map((conv) => (
            <button key={conv.id} className={conversationId === conv.id ? 'coach-history-active' : ''} onClick={() => openConversation(conv)}>
              <span>{conv.title}</span>
              <small>{conv.mode}</small>
            </button>
          ))}
        </aside>

        <div className="coach-main">
          <div className="tab-bar" style={{ marginBottom: 12 }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} className={`tab-btn ${activeTab === key ? 'tab-active' : ''}`} onClick={() => startNew(key)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'quiz' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#42585e' }}>Topic</label>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ height: 36, borderRadius: 8, border: '1.5px solid #dbe6e4', padding: '0 10px' }}>
                {['Pharmacology', 'Medical-Surgical', 'Mental Health', 'Maternal-Newborn', 'Pediatrics', 'NGN Clinical Judgment', 'Fluid & Electrolytes', 'Infection Control'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}

          <div className="coach-chat-window">
            {messages.length === 0 && (
              <div className="coach-empty">
                <tabMeta.icon size={36} />
                <strong>{emptyText}</strong>
                <span>{tabMeta.placeholder}</span>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`coach-row coach-row-${msg.role}`}>
                <div className={`coach-bubble coach-bubble-${msg.role} ${msg.is_error ? 'coach-bubble-error' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="coach-bubble-head">
                      <span><Brain size={12} /> NurseFaculty Study Coach</span>
                      <button className="icon-btn" title="Save answer" onClick={() => saveAnswer(msg)}>
                        {savedAnswerIds.has(msg.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </button>
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="coach-row coach-row-assistant">
                <div className="coach-bubble coach-bubble-assistant"><Loader2 size={15} className="spin" /> Thinking like an NCLEX coach...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {Number.isFinite(coachLimit) && (
            <p className="qb-coach-note">{Math.max(0, coachLimit - coachUsedToday)} of {coachLimit} Study Coach questions remaining today.</p>
          )}
          <div className="coach-input-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={tabMeta.placeholder}
              rows={3}
            />
            <button className="primary-btn" onClick={send} disabled={loading || !input.trim() || coachLimitReached}>
              {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Send
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#8a999c' }}>Enter to send. Shift+Enter for a new line.</p>
        </div>
      </div>
    </section>
  );
}
