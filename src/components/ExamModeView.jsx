import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock, LockKeyhole, Target, Timer, Trophy, XCircle } from 'lucide-react';
import { calculatePassProbability, completeExamSession, createExamSession, getQuestions, submitExamAnswer } from '../services/supabase';
import { DEMO_QUESTIONS } from '../data/demoQuestions';
import { UpgradeCTA } from './SubscriptionGate';
import { useSubscription } from '../hooks/useSubscription';

const MODES = [
  {
    id: 'practice',
    label: 'Practice Mode',
    desc: 'Immediate feedback and rationale after each question. No time limit.',
    icon: '📝',
    timeLimit: null,
    color: '#29b7a3',
  },
  {
    id: 'timed',
    label: 'Timed Exam',
    desc: 'Questions locked until exam ends. 1 minute per question.',
    icon: '⏱️',
    timeLimit: 'per_question',
    color: '#e3a72f',
  },
  {
    id: 'cat',
    label: 'CAT Simulator',
    desc: 'Computer Adaptive Testing — difficulty adjusts based on your performance.',
    icon: '🎯',
    timeLimit: null,
    color: '#6750a4',
  },
  {
    id: 'assessment',
    label: 'Self-Assessment',
    desc: '100-question full-length exam with score report and pass probability.',
    icon: '📊',
    timeLimit: 360,
    color: '#e85d4f',
  },
];

const QUESTION_COUNTS = [10, 25, 50, 75, 100];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function isSATACorrect(selected, correct) {
  const s = [...selected].sort();
  const c = [...(correct?.ids ?? [])].sort();
  return s.length === c.length && s.every((v, i) => v === c[i]);
}

function isAnswerCorrect(question, selected) {
  if (!question || !selected.length) return false;
  if (question.question_type === 'sata') return isSATACorrect(selected, question.correct_answer);
  return selected.length === 1 && selected[0] === question.correct_answer?.ids?.[0];
}

function ResultScreen({ answers, questions, mode, timeUsed, onRestart }) {
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const score = Math.round((correct / total) * 100);
  const prob = calculatePassProbability(answers.map((a) => ({ is_correct: a.correct })));
  const passed = score >= 72;

  const byTopic = {};
  answers.forEach((a) => {
    const q = questions.find((x) => x.id === a.questionId);
    if (!q) return;
    if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
    byTopic[q.topic].total++;
    if (a.correct) byTopic[q.topic].correct++;
  });

  return (
    <div className="exam-result">
      <div className="result-hero">
        <Trophy size={48} color={passed ? '#29b7a3' : '#e3a72f'} />
        <h2>{passed ? 'Excellent Work!' : 'Keep Studying!'}</h2>
        <div className="result-score" style={{ color: passed ? '#135f55' : '#875f08' }}>
          {score}%
        </div>
        <div style={{ color: '#607478' }}>{correct} of {total} correct • {formatTime(timeUsed)} taken</div>
        {prob !== null && (
          <div className="result-prob" style={{ background: prob >= 75 ? '#e9f6f4' : '#fff5df', borderColor: prob >= 75 ? '#b9e3dc' : '#ecd49d' }}>
            <span style={{ color: prob >= 75 ? '#135f55' : '#875f08' }}>
              Pass Probability: <strong>{prob}%</strong>
            </span>
          </div>
        )}
      </div>

      <h3 style={{ marginBottom: 12 }}>Performance by Topic</h3>
      <div className="result-topics">
        {Object.entries(byTopic).map(([topic, stats]) => {
          const pct = Math.round((stats.correct / stats.total) * 100);
          return (
            <div key={topic} className="result-topic-row">
              <span>{topic}</span>
              <div className="progress-track">
                <span style={{ width: `${pct}%`, background: pct >= 72 ? '#29b7a3' : '#e3a72f' }} />
              </div>
              <b>{pct}%</b>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="primary-btn" style={{ flex: 1 }} onClick={onRestart}>
          Take Another Exam
        </button>
      </div>
    </div>
  );
}

export default function ExamModeView({ session, onNavigate }) {
  const [phase, setPhase] = useState('setup'); // setup | exam | result
  const [selectedMode, setSelectedMode] = useState('practice');
  const [questionCount, setQuestionCount] = useState(25);
  const [questions, setQuestions] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [totalTimeUsed, setTotalTimeUsed] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [qStartTime, setQStartTime] = useState(null);
  const timerRef = useRef(null);

  const userId = session?.user?.id;
  const subscription = useSubscription(session);

  function requiredPlanForMode(modeId) {
    return modeId === 'cat' || modeId === 'assessment' ? 'pro' : null;
  }

  function modeIsLocked(modeId) {
    const requiredPlan = requiredPlanForMode(modeId);
    return Boolean(requiredPlan && !subscription.canAccess(requiredPlan));
  }

  useEffect(() => {
    getQuestions({ limit: 200 }).then(({ data }) => {
      setAllQuestions(data?.length ? data : DEMO_QUESTIONS);
    });
  }, []);

  function shuffleAndSlice(arr, n) {
    return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
  }

  async function startExam() {
    if (!selectedMode) return;
    if (modeIsLocked(selectedMode)) return;
    const qs = shuffleAndSlice(allQuestions, questionCount);
    setQuestions(qs);
    setIndex(0);
    setSelected([]);
    setSubmitted(false);
    setAnswers([]);
    setPhase('exam');
    const now = Date.now();
    setStartTime(now);
    setQStartTime(now);

    const mode = MODES.find((m) => m.id === selectedMode);
    const timeLimitSeconds = selectedMode === 'timed'
      ? questionCount * 60
      : selectedMode === 'assessment' ? 360 * 60 : null;

    if (timeLimitSeconds) {
      setTimeLeft(timeLimitSeconds);
    }

    if (userId) {
      const { data } = await createExamSession(userId, selectedMode, qs.map((q) => q.id), timeLimitSeconds);
      if (data?.id) setSessionId(data.id);
    }
  }

  useEffect(() => {
    if (phase !== 'exam' || timeLeft === null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          endExam();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, timeLeft !== null]);

  function toggleChoice(id) {
    if (submitted && selectedMode !== 'practice') return;
    if (submitted) return;
    const q = questions[index];
    if (q.question_type === 'mcq') {
      setSelected([id]);
    } else {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }
  }

  async function handleSubmit() {
    if (!selected.length) return;
    const q = questions[index];
    const correct = isAnswerCorrect(q, selected);
    const timeTaken = Math.round((Date.now() - qStartTime) / 1000);

    const newAnswer = { questionId: q.id, selected, correct, timeTaken };
    const newAnswers = [...answers, newAnswer];

    if (userId && sessionId) {
      await submitExamAnswer(sessionId, q.id, { ids: selected }, correct, timeTaken);
    }

    if (selectedMode === 'practice') {
      setSubmitted(true);
      setAnswers(newAnswers);
    } else {
      setAnswers(newAnswers);
      if (index + 1 >= questions.length) {
        await finishExam(newAnswers);
      } else {
        setIndex((i) => i + 1);
        setSelected([]);
        setQStartTime(Date.now());
      }
    }
  }

  async function finishExam(finalAnswers) {
    clearInterval(timerRef.current);
    const used = Math.round((Date.now() - startTime) / 1000);
    setTotalTimeUsed(used);
    const correct = finalAnswers.filter((a) => a.correct).length;
    const total = finalAnswers.length;
    const score = Math.round((correct / total) * 100);
    const prob = calculatePassProbability(finalAnswers.map((a) => ({ is_correct: a.correct })));

    if (userId && sessionId) {
      await completeExamSession(sessionId, {
        correctCount: correct, totalQuestions: total,
        scorePercent: score, passProbability: prob, timeUsedSeconds: used,
      });
    }
    setAnswers(finalAnswers);
    setPhase('result');
  }

  async function endExam() {
    await finishExam(answers);
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      endExam();
    } else {
      setIndex((i) => i + 1);
      setSelected([]);
      setSubmitted(false);
      setQStartTime(Date.now());
    }
  }

  const question = questions[index];
  const mode = MODES.find((m) => m.id === selectedMode);

  if (phase === 'setup') {
    return (
      <section className="content-band">
        <div className="section-title"><h2>Choose Your Exam Mode</h2><Target size={22} /></div>
        <div className="exam-mode-grid">
          {MODES.map((m) => {
            const locked = modeIsLocked(m.id);
            return (
              <button
                key={m.id}
                className={`exam-mode-card ${selectedMode === m.id ? 'exam-mode-selected' : ''} ${locked ? 'exam-mode-locked' : ''}`}
                onClick={() => setSelectedMode(m.id)}
                style={{ '--em-color': m.color }}
              >
                <span className="em-icon">{locked ? <LockKeyhole size={24} /> : m.icon}</span>
                <strong>{m.label}</strong>
                <p>{m.desc}</p>
                {locked && <span className="premium-mode-note">Requires Pro</span>}
                {selectedMode === m.id && !locked && <CheckCircle2 size={18} className="em-check" />}
              </button>
            );
          })}
        </div>

        {selectedMode && modeIsLocked(selectedMode) && (
          <UpgradeCTA session={session} requiredPlan="pro" onUpgrade={() => onNavigate?.('Payments')} style={{ marginTop: 16 }} />
        )}

        {selectedMode && selectedMode !== 'assessment' && (
          <div className="exam-count-picker">
            <strong>Number of Questions</strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  className={questionCount === n ? 'primary-btn' : 'ghost-btn'}
                  style={{ minHeight: 38, padding: '0 16px' }}
                  onClick={() => setQuestionCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="primary-btn"
          style={{ marginTop: 20, width: '100%', justifyContent: 'center', minHeight: 48, fontSize: '1rem' }}
          onClick={startExam}
          disabled={!selectedMode || !allQuestions.length || modeIsLocked(selectedMode)}
        >
          Start Exam <ChevronRight size={20} />
        </button>
      </section>
    );
  }

  if (phase === 'result') {
    return (
      <section className="content-band">
        <ResultScreen
          answers={answers}
          questions={questions}
          mode={selectedMode}
          timeUsed={totalTimeUsed}
          onRestart={() => { setPhase('setup'); setAnswers([]); setSessionId(null); }}
        />
      </section>
    );
  }

  const correctIds = question?.correct_answer?.ids ?? [];
  const showRationale = submitted && selectedMode === 'practice';

  return (
    <section className="content-band">
      {/* Exam header */}
      <div className="exam-header">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: mode?.color, fontWeight: 800 }}>{mode?.label}</span>
          <span className="eyebrow">{index + 1} / {questions.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {answers.length > 0 && (
            <span style={{ color: '#135f55', fontWeight: 700, fontSize: '0.88rem' }}>
              {answers.filter((a) => a.correct).length}/{answers.length} correct
            </span>
          )}
          {timeLeft !== null && (
            <div className={`exam-timer ${timeLeft < 300 ? 'timer-warning' : ''}`}>
              <Timer size={16} /> {formatTime(timeLeft)}
            </div>
          )}
          {selectedMode !== 'practice' && (
            <button className="ghost-btn" style={{ fontSize: '0.85rem' }} onClick={endExam}>
              End &amp; Score
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-track" style={{ marginBottom: 20, height: 6 }}>
        <span style={{ width: `${((index) / questions.length) * 100}%`, background: mode?.color }} />
      </div>

      {/* Question */}
      <div className="qb-prompt">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <span className="chips"><span>{question?.topic}</span></span>
          {question?.question_type === 'sata' && <span className="chips"><span>Select All That Apply</span></span>}
        </div>
        <p>{question?.prompt}</p>
      </div>

      {/* Choices */}
      <div className="qb-choices">
        {(question?.choices ?? []).map((choice) => {
          const isSel = selected.includes(choice.id);
          const isCorrect = correctIds.includes(choice.id);
          let cls = 'qb-choice';
          if (showRationale) {
            if (isCorrect) cls += ' choice-correct';
            else if (isSel && !isCorrect) cls += ' choice-wrong';
          } else if (isSel) {
            cls += ' choice-selected';
          }
          return (
            <button key={choice.id} className={cls} onClick={() => toggleChoice(choice.id)} disabled={submitted}>
              <span className="choice-letter">{choice.id.toUpperCase()}</span>
              <span className="choice-text">{choice.text}</span>
              {showRationale && isCorrect && <CheckCircle2 size={18} style={{ marginLeft: 'auto', color: '#135f55', flexShrink: 0 }} />}
              {showRationale && isSel && !isCorrect && <XCircle size={18} style={{ marginLeft: 'auto', color: '#8a2c21', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {showRationale && (
        <div className="rationale">
          <strong>Rationale</strong>
          <p>{question?.rationale}</p>
        </div>
      )}

      {!submitted ? (
        <button
          className="primary-btn"
          onClick={handleSubmit}
          disabled={!selected.length}
          style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
        >
          {selectedMode === 'practice' ? 'Submit & See Rationale' : 'Confirm Answer'} <ChevronRight size={18} />
        </button>
      ) : (
        <button className="primary-btn" onClick={nextQuestion} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
          {index + 1 >= questions.length ? 'View Results' : 'Next Question'} <ChevronRight size={18} />
        </button>
      )}
    </section>
  );
}
