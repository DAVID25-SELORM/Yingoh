import React, { useEffect, useState } from 'react';
import {
  BookmarkCheck, Brain, CheckCircle2, ChevronLeft, ChevronRight,
  Filter, Play, RotateCcw, Settings2, XCircle,
} from 'lucide-react';
import { getQuestions, submitAttempt } from '../services/supabase';
import { DEMO_QUESTIONS } from '../data/demoQuestions';

const TOPICS = ['Pharmacology', 'Safety and Infection Control', 'Medical-Surgical', 'NGN Case Studies', 'Maternal and Newborn', 'Mental Health', 'Pediatrics', 'Leadership and Management'];
const MODES = [
  { id: 'tutor', label: 'Tutor Mode', desc: 'See rationale immediately after each answer.' },
  { id: 'timed', label: 'Timed Mode', desc: 'Race the clock — 90 seconds per question.' },
  { id: 'practice', label: 'Practice Mode', desc: 'No timer, review at the end.' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CustomQuizBuilder({ session }) {
  const [allQuestions, setAllQuestions] = useState([]);
  const [setup, setSetup] = useState({ topics: [], types: [], count: 10, mode: 'tutor', onlyBookmarked: false });
  const [quiz, setQuiz] = useState(null); // null = setup screen
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState([]); // {questionId, correct}
  const [timeLeft, setTimeLeft] = useState(90);
  const [timerActive, setTimerActive] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    getQuestions({ limit: 200 }).then(({ data }) => setAllQuestions(data?.length ? data : DEMO_QUESTIONS));
  }, []);

  useEffect(() => {
    if (!timerActive || setup.mode !== 'timed') return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, timerActive, setup.mode]);

  function toggleTopic(t) {
    setSetup((p) => ({ ...p, topics: p.topics.includes(t) ? p.topics.filter((x) => x !== t) : [...p.topics, t] }));
  }
  function toggleType(t) {
    setSetup((p) => ({ ...p, types: p.types.includes(t) ? p.types.filter((x) => x !== t) : [...p.types, t] }));
  }

  function buildQuiz() {
    let pool = allQuestions;
    if (setup.topics.length) pool = pool.filter((q) => setup.topics.includes(q.topic));
    if (setup.types.length) pool = pool.filter((q) => setup.types.includes(q.question_type));
    const selected = shuffle(pool).slice(0, Math.min(setup.count, pool.length));
    if (!selected.length) return;
    setQuiz(selected);
    setIdx(0);
    setSelected([]);
    setSubmitted(false);
    setResults([]);
    setFinished(false);
    if (setup.mode === 'timed') { setTimeLeft(90); setTimerActive(true); }
  }

  function toggleChoice(id) {
    if (submitted) return;
    const q = quiz[idx];
    if (q.question_type === 'mcq') setSelected([id]);
    else setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  async function handleSubmit(autoTimeout = false) {
    if (!selected.length && !autoTimeout) return;
    setSubmitted(true);
    setTimerActive(false);
    const q = quiz[idx];
    const correct = q.question_type === 'sata'
      ? [...selected].sort().join() === [...(q.correct_answer?.ids ?? [])].sort().join()
      : selected[0] === q.correct_answer?.ids?.[0];
    setResults((p) => [...p, { questionId: q.id, correct }]);
    if (session?.user?.id) await submitAttempt(session.user.id, q.id, { ids: selected }, correct);
  }

  function goNext() {
    if (idx + 1 >= quiz.length) { setFinished(true); return; }
    setIdx((i) => i + 1);
    setSelected([]);
    setSubmitted(false);
    if (setup.mode === 'timed') { setTimeLeft(90); setTimerActive(true); }
  }

  function reset() { setQuiz(null); setFinished(false); setResults([]); }

  const q = quiz?.[idx];
  const correctIds = q?.correct_answer?.ids ?? [];
  const isAnswerCorrect = submitted
    ? (q?.question_type === 'sata'
      ? [...selected].sort().join() === [...correctIds].sort().join()
      : selected[0] === correctIds[0])
    : null;

  // Setup screen
  if (!quiz) {
    const eligible = allQuestions.filter((q) =>
      (!setup.topics.length || setup.topics.includes(q.topic)) &&
      (!setup.types.length || setup.types.includes(q.question_type))
    ).length;
    return (
      <section className="content-band">
        <div className="section-title"><h2>Custom Quiz Builder</h2><Settings2 size={22} /></div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* Topic filter */}
          <div className="qm-editor">
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Topics <span style={{ color: '#607478', fontWeight: 400 }}>({setup.topics.length ? setup.topics.length + ' selected' : 'All'})</span></h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {TOPICS.map((t) => {
                const on = setup.topics.includes(t);
                return (
                  <button key={t} onClick={() => toggleTopic(t)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${on ? '#29b7a3' : '#dbe6e4'}`, background: on ? '#e9f6f4' : '#fff', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${on ? '#29b7a3' : '#c0cece'}`, background: on ? '#29b7a3' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {on && <CheckCircle2 size={12} color="#fff" />}
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: on ? 700 : 400, color: on ? '#135f55' : '#42585e' }}>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            {/* Question type */}
            <div className="qm-editor">
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Question Type</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {[['mcq', 'Multiple Choice (MCQ)'], ['sata', 'Select All That Apply (SATA)']].map(([id, label]) => {
                  const on = setup.types.includes(id);
                  return (
                    <button key={id} onClick={() => toggleType(id)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${on ? '#29b7a3' : '#dbe6e4'}`, background: on ? '#e9f6f4' : '#fff', textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${on ? '#29b7a3' : '#c0cece'}`, background: on ? '#29b7a3' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {on && <CheckCircle2 size={12} color="#fff" />}
                      </div>
                      <span style={{ fontSize: '0.88rem', fontWeight: on ? 700 : 400 }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Count */}
            <div className="qm-editor">
              <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>Number of Questions: <strong style={{ color: '#29b7a3' }}>{setup.count}</strong></h3>
              <input type="range" min={5} max={Math.min(75, eligible || 75)} step={5} value={setup.count}
                onChange={(e) => setSetup((p) => ({ ...p, count: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: '#29b7a3' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#8a999c', marginTop: 4 }}>
                <span>5</span><span style={{ color: '#607478' }}>{eligible} available</span><span>75</span>
              </div>
            </div>

            {/* Mode */}
            <div className="qm-editor">
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Quiz Mode</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {MODES.map((m) => (
                  <button key={m.id} onClick={() => setSetup((p) => ({ ...p, mode: m.id }))} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${setup.mode === m.id ? '#29b7a3' : '#dbe6e4'}`, background: setup.mode === m.id ? '#e9f6f4' : '#fff', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${setup.mode === m.id ? '#29b7a3' : '#c0cece'}`, background: setup.mode === m.id ? '#29b7a3' : 'transparent', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: setup.mode === m.id ? '#135f55' : '#17212f' }}>{m.label}</div>
                      <div style={{ fontSize: '0.78rem', color: '#607478' }}>{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button className="primary-btn" style={{ justifyContent: 'center', width: '100%', padding: '14px 0' }} onClick={buildQuiz} disabled={!eligible}>
              <Play size={18} /> Start Quiz ({Math.min(setup.count, eligible)} questions)
            </button>
            {!eligible && <p style={{ color: '#8a2c21', fontSize: '0.84rem', textAlign: 'center' }}>No questions match these filters. Try clearing some selections.</p>}
          </div>
        </div>
      </section>
    );
  }

  // Finished screen
  if (finished) {
    const correct = results.filter((r) => r.correct).length;
    const pct = Math.round((correct / results.length) * 100);
    return (
      <section className="content-band">
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto', padding: '32px 0' }}>
          <Brain size={48} color="#29b7a3" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 8px' }}>Quiz Complete!</h2>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: pct >= 70 ? '#135f55' : '#8a2c21', lineHeight: 1 }}>{pct}%</div>
          <div style={{ color: '#607478', marginBottom: 24 }}>{correct} of {results.length} correct</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="primary-btn" onClick={buildQuiz}><RotateCcw size={15} /> Retry Same</button>
            <button className="ghost-btn" onClick={reset}><Settings2 size={15} /> New Quiz</button>
          </div>
        </div>
      </section>
    );
  }

  // Quiz screen
  return (
    <section className="content-band">
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8rem', color: '#607478' }}>{q.topic} · {q.question_type?.toUpperCase()}</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Question {idx + 1} of {quiz.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {setup.mode === 'timed' && (
            <div style={{ padding: '6px 14px', borderRadius: 20, background: timeLeft <= 15 ? '#fce8e6' : '#e2f5f2', color: timeLeft <= 15 ? '#8a2c21' : '#135f55', fontWeight: 800, fontSize: '1rem' }}>
              ⏱ {timeLeft}s
            </div>
          )}
          <button className="ghost-btn" onClick={reset} style={{ fontSize: '0.8rem', padding: '5px 10px' }}>Exit</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: '#e9f1ef', borderRadius: 3, marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${((idx) / quiz.length) * 100}%`, background: '#29b7a3', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>

      <div className="qb-prompt"><p>{q.prompt}</p></div>

      <div className="qb-choices">
        {(q.choices ?? []).map((c) => {
          const isSel = selected.includes(c.id);
          const isCorr = correctIds.includes(c.id);
          let cls = 'qb-choice';
          if (submitted) { if (isCorr) cls += ' choice-correct'; else if (isSel) cls += ' choice-wrong'; }
          else if (isSel) cls += ' choice-selected';
          return (
            <button key={c.id} className={cls} onClick={() => toggleChoice(c.id)} disabled={submitted}>
              <span className="choice-letter">{c.id.toUpperCase()}</span>
              <span className="choice-text">{c.text}</span>
              {submitted && isCorr && <CheckCircle2 size={16} style={{ marginLeft: 'auto', color: '#135f55', flexShrink: 0 }} />}
              {submitted && isSel && !isCorr && <XCircle size={16} style={{ marginLeft: 'auto', color: '#8a2c21', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {!submitted
        ? <button className="primary-btn" onClick={() => handleSubmit()} disabled={!selected.length} style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>Submit</button>
        : (
          <>
            <div className={`qb-result ${isAnswerCorrect ? 'result-correct' : 'result-wrong'}`}>
              <div className="result-verdict">
                {isAnswerCorrect ? <><CheckCircle2 size={20} /> Correct!</> : <><XCircle size={20} /> Incorrect</>}
              </div>
            </div>
            {(setup.mode === 'tutor' || setup.mode === 'practice') && (
              <div className="rationale"><strong>Rationale</strong><p>{q.rationale}</p></div>
            )}
            <div className="qb-nav" style={{ marginTop: 14 }}>
              <button className="ghost-btn" onClick={() => { setIdx((i) => Math.max(0, i - 1)); setSelected([]); setSubmitted(false); }} disabled={idx === 0}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="primary-btn" onClick={goNext}>
                {idx + 1 >= quiz.length ? 'Finish' : 'Next'} <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
    </section>
  );
}
