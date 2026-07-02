import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen, Brain,
  BookmarkCheck, BookmarkPlus, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Filter, Loader2, RefreshCw, Sparkles,
} from 'lucide-react';
import {
  bookmarkQuestion, getBookmarkedQuestionIds, getQuestions,
  saveItem, submitAttempt, supabase, unbookmarkQuestion, unsaveItem,
} from '../services/supabase';
import { DEMO_QUESTIONS } from '../data/demoQuestions';
import { useSubscription } from '../hooks/useSubscription';
import {
  BowTieQuestion, bowTieIsCorrect, bowTieHasAnswer,
  MatrixQuestion, matrixIsCorrect, matrixHasAnswer,
  OrderedResponseQuestion, orderedIsCorrect,
  HighlightQuestion, highlightIsCorrect,
} from './NGNRenderer';

import { TOPICS as TOPIC_LIST } from '../data/topics';
const TOPICS = ['All Topics', ...TOPIC_LIST];
const TYPES = ['All Types', 'mcq', 'sata', 'bow_tie', 'matrix', 'ordered_response', 'highlight'];
const TYPE_LABELS = {
  mcq: 'Multiple Choice',
  sata: 'Select All That Apply',
  bow_tie: 'Bow Tie (NGN)',
  matrix: 'Matrix (NGN)',
  ordered_response: 'Ordered Response (NGN)',
  highlight: 'Highlight (NGN)',
};

const STUDY_COACH_ACTIONS = [
  { key: 'wrong', label: 'Why was I wrong?', icon: Brain },
  { key: 'simple', label: 'Explain simply', icon: BookOpen },
  { key: 'memory', label: 'Memory trick', icon: Sparkles },
  { key: 'similar', label: 'Similar question', icon: RefreshCw },
];

const DEMO_COACH_REPLY = `Study Coach:
Start with the clinical priority. Identify the patient safety risk, then apply ABCs, urgent vs expected findings, and whether the question is asking for assessment or intervention.

Why it matters:
NCLEX distractors are often true statements, but the correct answer is the safest or most urgent nursing action for this exact stem.

Next move:
Review the rationale, name the cue that changed the answer, then practice one similar question before moving on.`;

const PASSING_TARGET = 72;

function isSATACorrect(selected, correct) {
  const s = [...selected].sort();
  const c = [...(correct.ids ?? [])].sort();
  return s.length === c.length && s.every((v, i) => v === c[i]);
}

function isMCQCorrect(selected, correct) {
  return selected.length === 1 && selected[0] === correct.ids?.[0];
}

function getChoiceText(question, id) {
  return question?.choices?.find((choice) => choice.id === id)?.text ?? id;
}

function formatStudentAnswer(question, selected, ngnAnswer) {
  if (!question) return 'No answer selected';
  if (question.question_type === 'mcq' || question.question_type === 'sata') {
    return selected.length
      ? selected.map((id) => `${id.toUpperCase()}. ${getChoiceText(question, id)}`).join('; ')
      : 'No answer selected';
  }
  return JSON.stringify(ngnAnswer ?? {}, null, 2);
}

function buildCoachPrompt(action, question, selected, ngnAnswer, isCorrect) {
  const choices = question.choices?.length
    ? question.choices.map((choice) => `${choice.id.toUpperCase()}. ${choice.text}`).join('\n')
    : 'NGN structured item - use the prompt and submitted response.';
  const correctAnswer = question.correct_answer?.ids?.length
    ? question.correct_answer.ids.map((id) => `${id.toUpperCase()}. ${getChoiceText(question, id)}`).join('; ')
    : 'See NGN scoring data in the item.';
  const requests = {
    wrong: 'Explain why my selected answer was wrong and what cue I missed.',
    simple: 'Explain this rationale in simple student-friendly language.',
    memory: 'Give me a short memory trick and NCLEX tip for this concept.',
    similar: 'Generate one similar NCLEX-style practice question with answer and rationale.',
  };

  return `${requests[action] ?? requests.simple}

Topic: ${question.topic}
Question type: ${question.question_type}
Prompt: ${question.prompt}
Choices:
${choices}

My answer: ${formatStudentAnswer(question, selected, ngnAnswer)}
Correct answer: ${correctAnswer}
Result: ${isCorrect ? 'Correct' : 'Incorrect'}
Rationale: ${question.rationale ?? 'No rationale provided.'}
Strategy: ${question.strategy ?? 'No strategy provided.'}`;
}

function getPatternLabel(question) {
  const text = `${question.topic ?? ''} ${question.prompt ?? ''} ${question.rationale ?? ''} ${question.strategy ?? ''}`.toLowerCase();
  if (question.question_type !== 'mcq' && question.question_type !== 'sata') return 'NGN clinical judgment';
  if (text.includes('priority') || text.includes('first') || text.includes('immediate')) return 'Priority setting';
  if (text.includes('delegate') || text.includes('assignment') || text.includes('uap')) return 'Delegation';
  if (text.includes('safety') || text.includes('infection') || text.includes('precaution')) return 'Safety';
  if (text.includes('medication') || text.includes('administer') || text.includes('withhold') || text.includes('drug')) return 'Medication safety';
  if (text.includes('teach') || text.includes('instruction') || text.includes('discharge')) return 'Patient teaching';
  if (text.includes('assess') || text.includes('finding') || text.includes('report')) return 'Assessment cues';
  return 'Content knowledge';
}

function buildCorrectionPlan(attempts) {
  const total = attempts.length;
  const missed = attempts.filter((attempt) => !attempt.isCorrect);
  const correct = total - missed.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  const byTopic = {};
  const byPattern = {};
  attempts.forEach((attempt) => {
    const topic = attempt.question.topic ?? 'Mixed Topics';
    if (!byTopic[topic]) byTopic[topic] = { topic, correct: 0, total: 0, missed: 0 };
    byTopic[topic].total += 1;
    if (attempt.isCorrect) byTopic[topic].correct += 1;
    else byTopic[topic].missed += 1;
  });
  missed.forEach((attempt) => {
    const pattern = getPatternLabel(attempt.question);
    byPattern[pattern] = (byPattern[pattern] ?? 0) + 1;
  });

  const weakTopics = Object.values(byTopic)
    .map((topic) => ({ ...topic, pct: Math.round((topic.correct / topic.total) * 100) }))
    .filter((topic) => topic.pct < PASSING_TARGET || topic.missed > 0)
    .sort((a, b) => b.missed - a.missed || a.pct - b.pct);
  const patterns = Object.entries(byPattern)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { total, correct, missed, accuracy, weakTopics, patterns };
}

function getPlanTasks(plan) {
  const topTopic = plan.weakTopics[0]?.topic ?? 'mixed NCLEX topics';
  const topPattern = plan.patterns[0]?.label ?? 'clinical reasoning';
  if (!plan.total) return [];
  if (!plan.missed.length) {
    return [
      `Do 10 harder questions in ${topTopic} to protect your momentum.`,
      'Review one NGN case before ending this study block.',
      'Save one rationale that felt high-yield for final-week review.',
    ];
  }
  return [
    `Review ${Math.min(plan.missed.length, 5)} missed rationale${plan.missed.length === 1 ? '' : 's'} before new questions.`,
    `Practice 10 similar questions in ${topTopic}.`,
    `Ask Study Coach to explain your ${topPattern.toLowerCase()} pattern.`,
  ];
}

export default function QuestionBankView({ session }) {
  const { planLabel, questionLimit, hasAdminAccess, loading: subscriptionLoading } = useSubscription(session);
  const [questions, setQuestions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);       // MCQ / SATA
  const [ngnAnswer, setNgnAnswer] = useState(null);   // bow_tie / matrix / ordered / highlight
  const [submitted, setSubmitted] = useState(false);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [coachReply, setCoachReply] = useState('');
  const [coachPrompt, setCoachPrompt] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachSaved, setCoachSaved] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState([]);
  const [planSaved, setPlanSaved] = useState(false);

  const userId = session?.user?.id;
  const correctionPlan = buildCorrectionPlan(sessionAttempts);
  const planTasks = getPlanTasks(correctionPlan);

  useEffect(() => {
    if (subscriptionLoading) return;
    async function load() {
      setLoading(true);
      const { data } = await getQuestions({
        limit: questionLimit,
        includeUnpublished: hasAdminAccess,
      });
      const fallbackLimit = Number.isFinite(questionLimit) ? questionLimit : DEMO_QUESTIONS.length;
      const qs = data?.length ? data : DEMO_QUESTIONS.slice(0, fallbackLimit);
      setQuestions(qs);
      if (userId) {
        const { data: bIds } = await getBookmarkedQuestionIds(userId);
        setBookmarks(new Set(bIds));
      }
      setLoading(false);
    }
    load();
  }, [userId, questionLimit, hasAdminAccess, subscriptionLoading]);

  useEffect(() => {
    let qs = questions;
    if (topicFilter !== 'All Topics') qs = qs.filter((q) => q.topic === topicFilter);
    if (typeFilter !== 'All Types') qs = qs.filter((q) => q.question_type === typeFilter);
    if (showBookmarked) qs = qs.filter((q) => bookmarks.has(q.id));
    setFiltered(qs);
    setIndex(0);
    setSelected([]);
    setNgnAnswer(null);
    setSubmitted(false);
    resetCoach();
  }, [questions, topicFilter, typeFilter, showBookmarked, bookmarks]);

  const question = filtered[index];

  function toggleChoice(id) {
    if (submitted) return;
    if (question.question_type === 'mcq') setSelected([id]);
    else setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function resetCoach() {
    setCoachReply('');
    setCoachPrompt('');
    setCoachLoading(false);
    setCoachError('');
    setCoachSaved(false);
  }

  function checkIsCorrect() {
    const qt = question.question_type;
    if (qt === 'sata') return isSATACorrect(selected, question.correct_answer);
    if (qt === 'mcq') return isMCQCorrect(selected, question.correct_answer);
    if (qt === 'bow_tie') return bowTieIsCorrect(question, ngnAnswer);
    if (qt === 'matrix') return matrixIsCorrect(question, ngnAnswer);
    if (qt === 'ordered_response') return orderedIsCorrect(question, ngnAnswer);
    if (qt === 'highlight') return highlightIsCorrect(question, ngnAnswer);
    return false;
  }

  function hasAnswer() {
    const qt = question.question_type;
    if (qt === 'mcq' || qt === 'sata') return selected.length > 0;
    if (qt === 'bow_tie') return bowTieHasAnswer(ngnAnswer);
    if (qt === 'matrix') return matrixHasAnswer(ngnAnswer);
    if (qt === 'ordered_response') return (ngnAnswer?.length ?? 0) > 0;
    if (qt === 'highlight') return (ngnAnswer?.length ?? 0) > 0;
    return false;
  }

  async function handleSubmit() {
    if (!hasAnswer()) return;
    setSubmitted(true);
    const correct = checkIsCorrect();
    setSessionStats((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    setSessionAttempts((prev) => {
      const withoutCurrent = prev.filter((attempt) => attempt.question.id !== question.id);
      return [
        ...withoutCurrent,
        {
          question,
          selected: [...selected],
          ngnAnswer,
          isCorrect: correct,
          answeredAt: new Date().toISOString(),
        },
      ];
    });
    setPlanSaved(false);
    if (userId) await submitAttempt(userId, question.id, { ids: selected, ngn: ngnAnswer }, correct);
  }

  async function toggleBookmark() {
    if (!userId) return;
    const isBookmarked = bookmarks.has(question.id);
    if (isBookmarked) {
      await unbookmarkQuestion(userId, question.id);
      setBookmarks((prev) => { const n = new Set(prev); n.delete(question.id); return n; });
    } else {
      await bookmarkQuestion(userId, question.id);
      await saveItem(userId, {
        item_type: 'question',
        item_id: question.id,
        title: question.prompt.slice(0, 90),
        summary: question.rationale?.slice(0, 220) ?? question.topic,
        metadata: { topic: question.topic, question_type: question.question_type },
      });
      setBookmarks((prev) => new Set([...prev, question.id]));
    }
    if (isBookmarked) await unsaveItem(userId, 'question', question.id);
  }

  function goNext() {
    setIndex((i) => Math.min(i + 1, filtered.length - 1));
    setSelected([]);
    setNgnAnswer(null);
    setSubmitted(false);
    resetCoach();
  }

  function goPrev() {
    setIndex((i) => Math.max(i - 1, 0));
    setSelected([]);
    setNgnAnswer(null);
    setSubmitted(false);
    resetCoach();
  }

  async function askStudyCoach(action) {
    if (!question || coachLoading) return;
    const prompt = buildCoachPrompt(action, question, selected, ngnAnswer, Boolean(isAnswerCorrect));
    setCoachPrompt(prompt);
    setCoachLoading(true);
    setCoachError('');
    setCoachSaved(false);

    try {
      let reply = DEMO_COACH_REPLY;
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('ai-tutor', {
          body: {
            mode: action === 'similar' ? 'quiz' : 'explainer',
            message: prompt,
            history: [],
            context: `Embedded Study Coach question review for ${question.topic}`,
          },
        });
        if (error) throw error;
        reply = data?.reply ?? 'Study Coach did not return a response.';
      } else {
        await new Promise((resolve) => setTimeout(resolve, 550));
      }
      setCoachReply(reply);
    } catch (err) {
      setCoachError(err.message ?? 'Study Coach could not respond.');
    } finally {
      setCoachLoading(false);
    }
  }

  async function saveCoachReply() {
    if (!userId || !coachReply || !question) return;
    const { error } = await saveItem(userId, {
      item_type: 'ai_answer',
      item_id: `question-${question.id}-${Date.now()}`,
      title: `Study Coach: ${question.prompt.slice(0, 80)}`,
      summary: coachReply.slice(0, 220),
      metadata: {
        question_id: question.id,
        topic: question.topic,
        question_type: question.question_type,
        prompt: coachPrompt,
        content: coachReply,
      },
    });
    if (error) setCoachError(error.message);
    else setCoachSaved(true);
  }

  function reviewQuestion(questionId) {
    const nextIndex = filtered.findIndex((item) => item.id === questionId);
    if (nextIndex < 0) return;
    setIndex(nextIndex);
    setSelected([]);
    setNgnAnswer(null);
    setSubmitted(false);
    resetCoach();
  }

  function practiceTopic(topic) {
    setTopicFilter(topic);
    setTypeFilter('All Types');
    setShowBookmarked(false);
  }

  function resetSessionReview() {
    setSessionStats({ correct: 0, total: 0 });
    setSessionAttempts([]);
    setPlanSaved(false);
  }

  async function saveCorrectionPlan() {
    if (!userId || !correctionPlan.total) return;
    const weakSummary = correctionPlan.weakTopics
      .slice(0, 3)
      .map((topic) => `${topic.topic}: ${topic.pct}%`)
      .join(', ') || 'No weak topics in this session';
    const taskSummary = planTasks.join(' ');
    const { error } = await saveItem(userId, {
      item_type: 'correction_plan',
      item_id: `practice-session-${Date.now()}`,
      title: `Correction Plan: ${correctionPlan.accuracy}% session accuracy`,
      summary: `${weakSummary}. ${taskSummary}`.slice(0, 260),
      metadata: {
        total: correctionPlan.total,
        correct: correctionPlan.correct,
        missed_count: correctionPlan.missed.length,
        accuracy: correctionPlan.accuracy,
        weak_topics: correctionPlan.weakTopics,
        patterns: correctionPlan.patterns,
        tasks: planTasks,
      },
    });
    if (!error) setPlanSaved(true);
  }

  const isCorrectAnswer = useCallback((id) => question?.correct_answer?.ids?.includes(id) ?? false, [question]);

  if (loading) return <div className="content-band" style={{ textAlign: 'center', padding: 48, color: '#607478' }}>Loading questions…</div>;

  if (!filtered.length) {
    return (
      <section className="content-band">
        <div style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: '#607478' }}>No questions match these filters.</p>
          <button className="ghost-btn" onClick={() => { setTopicFilter('All Topics'); setTypeFilter('All Types'); setShowBookmarked(false); }}>
            <RefreshCw size={16} /> Reset filters
          </button>
        </div>
      </section>
    );
  }

  const isBookmarked = bookmarks.has(question?.id);
  const correctIds = question?.correct_answer?.ids ?? [];
  const qt = question?.question_type;
  const isNGN = ['bow_tie', 'matrix', 'ordered_response', 'highlight'].includes(qt);
  const isAnswerCorrect = submitted ? checkIsCorrect() : null;

  return (
    <section className="content-band">
      {/* Filter bar */}
      <div className="qb-filters">
        <Filter size={16} color="#607478" />
        <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t === 'All Types' ? t : TYPE_LABELS[t]}</option>)}
        </select>
        <button
          className={showBookmarked ? 'primary-btn' : 'ghost-btn'}
          onClick={() => setShowBookmarked((v) => !v)}
          style={{ minHeight: 36, padding: '0 10px', fontSize: '0.85rem' }}
        >
          <BookmarkCheck size={15} /> Bookmarked
        </button>
        <div style={{ marginLeft: 'auto', color: '#607478', fontSize: '0.88rem', display: 'flex', gap: 16 }}>
          <span>{index + 1} / {filtered.length}</span>
          {sessionStats.total > 0 && (
            <span style={{ color: '#135f55', fontWeight: 700 }}>
              Session: {sessionStats.correct}/{sessionStats.total} ({Math.round((sessionStats.correct / sessionStats.total) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {correctionPlan.total > 0 && (
        <div className="correction-plan">
          <div className="correction-plan-head">
            <div>
              <span className="eyebrow">Mistake Review</span>
              <h3>Session Correction Plan</h3>
            </div>
            <div className="correction-plan-actions">
              <button className="ghost-btn" onClick={saveCorrectionPlan} disabled={!userId || planSaved}>
                <BookmarkCheck size={15} /> {planSaved ? 'Saved' : 'Save Plan'}
              </button>
              <button className="ghost-btn" onClick={resetSessionReview}>
                <RefreshCw size={15} /> Reset
              </button>
            </div>
          </div>

          <div className="correction-metrics">
            <div>
              <span>Accuracy</span>
              <strong className={correctionPlan.accuracy >= PASSING_TARGET ? 'metric-good-text' : 'metric-risk-text'}>
                {correctionPlan.accuracy}%
              </strong>
            </div>
            <div>
              <span>Correct</span>
              <strong>{correctionPlan.correct}/{correctionPlan.total}</strong>
            </div>
            <div>
              <span>Missed</span>
              <strong className={correctionPlan.missed.length ? 'metric-risk-text' : 'metric-good-text'}>
                {correctionPlan.missed.length}
              </strong>
            </div>
          </div>

          <div className="correction-grid">
            <div>
              <h4>Today&apos;s tasks</h4>
              <ul className="correction-task-list">
                {planTasks.map((task) => <li key={task}>{task}</li>)}
              </ul>
            </div>
            <div>
              <h4>Weak signals</h4>
              {correctionPlan.weakTopics.length ? (
                <div className="weak-topic-list">
                  {correctionPlan.weakTopics.slice(0, 4).map((topic) => (
                    <button key={topic.topic} onClick={() => practiceTopic(topic.topic)}>
                      <span>{topic.topic}</span>
                      <b>{topic.pct}%</b>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="correction-empty">No weak topic yet. Keep going until a pattern appears.</p>
              )}
            </div>
            <div>
              <h4>Mistake pattern</h4>
              {correctionPlan.patterns.length ? (
                <div className="pattern-list">
                  {correctionPlan.patterns.slice(0, 3).map((pattern) => (
                    <span key={pattern.label}>{pattern.label} <b>{pattern.count}</b></span>
                  ))}
                </div>
              ) : (
                <p className="correction-empty">No missed pattern yet.</p>
              )}
            </div>
          </div>

          {correctionPlan.missed.length > 0 && (
            <div className="missed-review-list">
              <h4>Missed questions to review</h4>
              {correctionPlan.missed.slice(0, 5).map((attempt) => {
                const canReview = filtered.some((item) => item.id === attempt.question.id);
                return (
                  <div key={attempt.question.id} className="missed-review-row">
                    <div>
                      <strong>{attempt.question.topic}</strong>
                      <span>{attempt.question.prompt}</span>
                    </div>
                    <button className="ghost-btn" onClick={() => reviewQuestion(attempt.question.id)} disabled={!canReview}>
                      Review
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {!userId && (
            <p className="correction-empty">Sign in to save correction plans across study sessions.</p>
          )}
        </div>
      )}

      {/* Question header */}
      <div className="qb-header">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chips"><span>{question.topic}</span></span>
          <span className="chips" style={isNGN ? { background: '#e9f0ff', color: '#3a5ca8' } : {}}>
            <span>{TYPE_LABELS[qt] ?? qt}</span>
          </span>
          {isNGN && <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', background: '#e9f0ff', color: '#3a5ca8', borderRadius: 12 }}>NGN Item</span>}
        </div>
        <button
          className="icon-btn"
          onClick={toggleBookmark}
          disabled={!userId}
          title={userId ? (isBookmarked ? 'Remove bookmark' : 'Bookmark') : 'Sign in to bookmark'}
          style={{ color: isBookmarked ? '#e3a72f' : undefined }}
        >
          {isBookmarked ? <BookmarkCheck size={18} /> : <BookmarkPlus size={18} />}
        </button>
      </div>

      {/* Prompt */}
      <div className="qb-prompt">
        <p>{question.prompt}</p>
        {qt === 'sata' && <div className="sata-hint">Select all that apply — there may be more than one correct answer.</div>}
        {isNGN && <div className="sata-hint" style={{ background: '#eef1ff', color: '#3a5ca8', borderColor: '#c5cef5' }}>
          Next Generation NCLEX item — use clinical judgment to complete all sections.
        </div>}
      </div>

      {/* Answer area — MCQ / SATA */}
      {(qt === 'mcq' || qt === 'sata') && (
        <div className="qb-choices">
          {(question.choices ?? []).map((choice) => {
            const isSelected = selected.includes(choice.id);
            const isCorrect = isCorrectAnswer(choice.id);
            let cls = 'qb-choice';
            if (submitted) {
              if (isCorrect) cls += ' choice-correct';
              else if (isSelected && !isCorrect) cls += ' choice-wrong';
            } else if (isSelected) cls += ' choice-selected';
            return (
              <button key={choice.id} className={cls} onClick={() => toggleChoice(choice.id)} disabled={submitted}>
                <span className="choice-letter">{choice.id.toUpperCase()}</span>
                <span className="choice-text">{choice.text}</span>
                {submitted && isCorrect && <CheckCircle2 size={18} style={{ marginLeft: 'auto', color: '#135f55', flexShrink: 0 }} />}
                {submitted && isSelected && !isCorrect && <XCircle size={18} style={{ marginLeft: 'auto', color: '#8a2c21', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* NGN renderers */}
      {qt === 'bow_tie' && <BowTieQuestion question={question} submitted={submitted} onAnswer={setNgnAnswer} />}
      {qt === 'matrix' && <MatrixQuestion question={question} submitted={submitted} onAnswer={setNgnAnswer} />}
      {qt === 'ordered_response' && <OrderedResponseQuestion question={question} submitted={submitted} onAnswer={setNgnAnswer} />}
      {qt === 'highlight' && <HighlightQuestion question={question} submitted={submitted} onAnswer={setNgnAnswer} />}

      {/* Submit / result */}
      {!submitted ? (
        <button
          className="primary-btn"
          onClick={handleSubmit}
          disabled={!hasAnswer()}
          style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
        >
          Submit Answer
        </button>
      ) : (
        <div className={`qb-result ${isAnswerCorrect ? 'result-correct' : 'result-wrong'}`}>
          <div className="result-verdict">
            {isAnswerCorrect
              ? <><CheckCircle2 size={22} /> Correct!</>
              : <><XCircle size={22} /> Incorrect — review the rationale below.</>}
          </div>
        </div>
      )}

      {/* Rationale */}
      {submitted && question.rationale && (
        <div className="rationale">
          <strong>Rationale</strong>
          <p>{question.rationale}</p>
          {qt === 'sata' && (
            <div style={{ marginTop: 10, fontSize: '0.88rem', color: '#607478' }}>
              <strong>Correct answers:</strong> {correctIds.map((id) => id.toUpperCase()).join(', ')}
            </div>
          )}
          {question.strategy && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0f4ff', borderLeft: '3px solid #6750a4', borderRadius: '0 8px 8px 0' }}>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#3b2d6b' }}>
                <strong style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6750a4' }}>Test-Taking Strategy</strong>
                {question.strategy}
              </p>
            </div>
          )}
        </div>
      )}

      {submitted && (
        <div className="qb-study-coach">
          <div className="qb-study-coach-head">
            <div>
              <span className="eyebrow">Study Coach</span>
              <h3>Turn this answer into a correction plan</h3>
            </div>
            {coachReply && (
              <button className="ghost-btn" onClick={saveCoachReply} disabled={!userId || coachSaved}>
                <BookmarkCheck size={15} /> {coachSaved ? 'Saved' : 'Save'}
              </button>
            )}
          </div>
          <div className="qb-coach-actions">
            {STUDY_COACH_ACTIONS.map(({ key, label, icon: Icon }) => (
              <button key={key} className="ghost-btn" onClick={() => askStudyCoach(key)} disabled={coachLoading}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {coachLoading && (
            <div className="qb-coach-loading">
              <Loader2 size={16} className="spin" /> Study Coach is reviewing your answer...
            </div>
          )}
          {coachError && <div className="form-message" style={{ color: '#8a2c21' }}>{coachError}</div>}
          {coachReply && (
            <div className="qb-coach-reply">
              <Brain size={16} />
              <pre>{coachReply}</pre>
            </div>
          )}
          {!supabase && !coachReply && (
            <p className="qb-coach-note">Demo mode will show a sample coaching response. Connect Supabase for live AI coaching.</p>
          )}
          {coachReply && !userId && (
            <p className="qb-coach-note">Sign in to save Study Coach answers to Saved Items.</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="qb-nav">
        <button className="ghost-btn" onClick={goPrev} disabled={index === 0}>
          <ChevronLeft size={18} /> Previous
        </button>
        <div className="qb-dots">
          {filtered.slice(Math.max(0, index - 2), Math.min(filtered.length, index + 3)).map((_, i) => {
            const real = i + Math.max(0, index - 2);
            return <span key={real} className={real === index ? 'dot dot-active' : 'dot'} />;
          })}
        </div>
        <button className="primary-btn" onClick={goNext} disabled={index === filtered.length - 1}>
          Next <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
