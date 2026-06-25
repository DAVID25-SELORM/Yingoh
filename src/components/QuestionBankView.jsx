import React, { useCallback, useEffect, useState } from 'react';
import {
  BookmarkCheck, BookmarkPlus, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Filter, RefreshCw,
} from 'lucide-react';
import {
  bookmarkQuestion, getBookmarkedQuestionIds, getQuestions,
  saveItem, submitAttempt, unbookmarkQuestion, unsaveItem,
} from '../services/supabase';
import { DEMO_QUESTIONS } from '../data/demoQuestions';
import {
  BowTieQuestion, bowTieIsCorrect, bowTieHasAnswer,
  MatrixQuestion, matrixIsCorrect, matrixHasAnswer,
  OrderedResponseQuestion, orderedIsCorrect,
  HighlightQuestion, highlightIsCorrect,
} from './NGNRenderer';

const TOPICS = [
  'All Topics', 'Pharmacology', 'Safety and Infection Control', 'Medical-Surgical',
  'NGN Case Studies', 'Maternal and Newborn', 'Mental Health', 'Pediatrics',
  'Leadership and Management',
];
const TYPES = ['All Types', 'mcq', 'sata', 'bow_tie', 'matrix', 'ordered_response', 'highlight'];
const TYPE_LABELS = {
  mcq: 'Multiple Choice',
  sata: 'Select All That Apply',
  bow_tie: 'Bow Tie (NGN)',
  matrix: 'Matrix (NGN)',
  ordered_response: 'Ordered Response (NGN)',
  highlight: 'Highlight (NGN)',
};

function isSATACorrect(selected, correct) {
  const s = [...selected].sort();
  const c = [...(correct.ids ?? [])].sort();
  return s.length === c.length && s.every((v, i) => v === c[i]);
}

function isMCQCorrect(selected, correct) {
  return selected.length === 1 && selected[0] === correct.ids?.[0];
}

export default function QuestionBankView({ session }) {
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

  const userId = session?.user?.id;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await getQuestions({ limit: 200 });
      const qs = data?.length ? data : DEMO_QUESTIONS;
      setQuestions(qs);
      if (userId) {
        const { data: bIds } = await getBookmarkedQuestionIds(userId);
        setBookmarks(new Set(bIds));
      }
      setLoading(false);
    }
    load();
  }, [userId]);

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
  }, [questions, topicFilter, typeFilter, showBookmarked, bookmarks]);

  const question = filtered[index];

  function toggleChoice(id) {
    if (submitted) return;
    if (question.question_type === 'mcq') setSelected([id]);
    else setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
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
  }

  function goPrev() {
    setIndex((i) => Math.max(i - 1, 0));
    setSelected([]);
    setNgnAnswer(null);
    setSubmitted(false);
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
