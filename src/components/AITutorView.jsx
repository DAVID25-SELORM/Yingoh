import React, { useRef, useState } from 'react';
import { Brain, BookOpen, ClipboardList, CalendarDays, Send, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { supabase } from '../services/supabase';

const TABS = [
  { key: 'tutor',     label: 'Chat Tutor',          icon: Brain,         placeholder: 'Ask anything about NCLEX…' },
  { key: 'explainer', label: 'Rationale Explainer',  icon: BookOpen,      placeholder: 'Paste a question or answer choice to explain…' },
  { key: 'quiz',      label: 'Quiz Generator',       icon: ClipboardList, placeholder: 'e.g. "Generate 3 NGN questions on heart failure"' },
  { key: 'planner',   label: 'Study Planner',        icon: CalendarDays,  placeholder: 'e.g. "Exam in 6 weeks, weak in pharmacology and mental health"' },
];

const DEMO_REPLIES = {
  tutor: `Great question! For NCLEX clinical judgment, always follow the Clinical Judgment Measurement Model (CJMM):

1. Recognize Cues — What data stands out?
2. Analyze Cues — What do they mean?
3. Prioritize Hypotheses — What is most likely / most dangerous?
4. Generate Solutions — What can I do?
5. Take Action — What do I do first?
6. Evaluate Outcomes — Did it work?

For ABC prioritization: Airway beats Breathing beats Circulation — but psychosocial safety always comes first (e.g., suicidal patient).

What specific topic would you like to go deeper on?`,

  explainer: `Rationale for this answer:

Correct: Administer oxygen via non-rebreather mask at 15 L/min
This patient has signs of acute respiratory distress. Oxygen is the priority intervention to correct hypoxia before further assessment. The non-rebreather mask delivers the highest FiO2 (approximately 0.95) of any non-invasive delivery system.

Why the distractors are wrong:
- "Elevate the head of bed to 90°" — helpful but secondary; oxygen is more urgent
- "Notify the physician" — do this after initial intervention, not before
- "Prepare for intubation" — premature without trying oxygen first

Key Nursing Takeaway: In respiratory distress, oxygen first, then assess, then escalate.`,

  quiz: `NGN NCLEX Sample Question — Heart Failure

SCENARIO: A 67-year-old patient with chronic heart failure is admitted for acute exacerbation. Vital signs: BP 158/94, HR 112, RR 26, SpO2 88% on room air. The patient has bilateral crackles to the mid-lung fields, 3+ pitting edema bilaterally, and reports "can't catch my breath." Weight is 8 lbs more than last week.

Question: Which actions should the nurse take FIRST? (Select all that apply)

A. Administer furosemide (Lasix) 40 mg IV as ordered
B. Apply oxygen at 2-4 L/min via nasal cannula
C. Place patient in high Fowler's position
D. Insert urinary catheter to monitor urine output
E. Restrict oral fluids to 1,000 mL per day
F. Weigh the patient immediately

Correct Answers: A, B, C

Rationale: The priority is to reduce preload (furosemide), improve oxygenation (O2), and improve breathing mechanics (high Fowler). Catheter and fluid restriction are important but secondary. Weighing should occur daily at the same time — not acutely.`,

  planner: `6-Week NCLEX Study Plan

Exam Date: 6 weeks from today
Focus Areas: Pharmacology, Mental Health (your weak areas), plus comprehensive review

Week 1-2: Foundation Review
- Mon-Wed: Pharmacology (drug classes, priority nursing considerations, antidotes)
- Thu-Fri: Mental Health (therapeutic communication, psychiatric medications, safety)
- Weekend: Practice 75 NGN questions, review rationales

Week 3-4: High-Yield Systems
- Mon-Tue: Cardiovascular + respiratory (priority ABCs)
- Wed-Thu: Fluid/electrolytes + ABG interpretation
- Fri: Infection control, isolation precautions
- Weekend: 100-question timed exam, weakness review

Week 5: NGN Mastery
- Daily: 20 NGN case studies (BowTie, Matrix, Highlight)
- Focus on clinical judgment decision-making, not just facts
- Review CJMM at least twice this week

Week 6: Final Prep
- Mon-Wed: Targeted review of your lowest-scoring areas
- Thu: Rest, light review only
- Fri: Full 145-question CAT practice exam
- Weekend before exam: Rest, confidence-building review

Daily targets: 2-3 hours study + 50 practice questions minimum.`,
};

export default function AITutorView({ session }) {
  const [activeTab, setActiveTab] = useState('tutor');
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('Pharmacology');
  const bottomRef = useRef(null);

  const history = messages[activeTab] ?? [];
  const tabMeta = TABS.find((t) => t.key === activeTab);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newHistory = [...history, userMsg];
    setMessages((prev) => ({ ...prev, [activeTab]: newHistory }));
    setInput('');
    setLoading(true);

    try {
      let reply = '';
      if (supabase) {
        const apiHistory = newHistory.slice(0, -1).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const { data, error } = await supabase.functions.invoke('ai-tutor', {
          body: {
            mode: activeTab,
            message: userMsg.content,
            history: apiHistory,
            context: activeTab === 'quiz' ? `Topic: ${topic}` : undefined,
          },
        });
        if (error) throw error;
        reply = data?.reply ?? 'No response from AI.';
      } else {
        await new Promise((r) => setTimeout(r, 900));
        reply = DEMO_REPLIES[activeTab] ?? 'AI response would appear here.';
      }
      setMessages((prev) => ({
        ...prev,
        [activeTab]: [...newHistory, { role: 'assistant', content: reply }],
      }));
    } catch (err) {
      setMessages((prev) => ({
        ...prev,
        [activeTab]: [...newHistory, { role: 'assistant', content: `Error: ${err.message}. Make sure ANTHROPIC_API_KEY is set in your Supabase Edge Function secrets.` }],
      }));
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function clearChat() {
    setMessages((prev) => ({ ...prev, [activeTab]: [] }));
  }

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>AI Learning Assistant</h2>
        <Brain size={22} />
      </div>

      {!supabase && (
        <div style={{ background: '#fff8e1', border: '1.5px solid #e3a72f', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem', color: '#875f08' }}>
          <Sparkles size={13} style={{ display: 'inline', marginRight: 6 }} />
          Demo mode — connect Supabase and add <strong>ANTHROPIC_API_KEY</strong> to Edge Function secrets for live AI responses.
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`tab-btn ${activeTab === key ? 'tab-active' : ''}`} onClick={() => setActiveTab(key)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Quiz topic selector */}
      {activeTab === 'quiz' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#42585e', whiteSpace: 'nowrap' }}>Topic:</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ height: 36, borderRadius: 8, border: '1.5px solid #dbe6e4', padding: '0 10px', fontSize: '0.88rem' }}>
            {['Pharmacology', 'Medical-Surgical', 'Mental Health', 'Maternal-Newborn', 'Pediatrics', 'NGN Clinical Judgment', 'Fluid & Electrolytes', 'Infection Control', 'Leadership & Management', 'Test Strategy'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Chat window */}
      <div style={{ background: '#f8fafb', border: '1.5px solid #dbe6e4', borderRadius: 14, minHeight: 380, maxHeight: 480, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {history.length === 0 && (
          <div style={{ textAlign: 'center', color: '#8a999c', paddingTop: 60 }}>
            <tabMeta.icon size={36} color="#dbe6e4" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: '0.92rem' }}>Ask your {tabMeta.label.toLowerCase()} anything to get started.</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#b0bec2' }}>{tabMeta.placeholder}</p>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%',
              padding: '11px 15px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
              background: msg.role === 'user' ? '#29b7a3' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#17212f',
              fontSize: '0.9rem',
              lineHeight: 1.55,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.role === 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, fontSize: '0.74rem', fontWeight: 700, color: '#29b7a3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Brain size={11} /> Yingoh AI
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '12px 16px', background: '#fff', borderRadius: '4px 16px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 8, color: '#8a999c', fontSize: '0.88rem' }}>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={tabMeta.placeholder}
          rows={2}
          style={{ flex: 1, borderRadius: 10, border: '1.5px solid #dbe6e4', padding: '10px 14px', fontSize: '0.9rem', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="primary-btn" onClick={send} disabled={loading || !input.trim()} style={{ height: 42 }}>
            {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
            Send
          </button>
          {history.length > 0 && (
            <button className="ghost-btn" onClick={clearChat} style={{ height: 36, fontSize: '0.8rem' }}>
              <RotateCcw size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#8a999c' }}>
        Shift+Enter for new line · Enter to send · Powered by Claude Opus 4.8
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
