import React, { useCallback, useEffect, useState } from 'react';
import {
  BookmarkPlus, BookmarkCheck, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Filter, RefreshCw,
} from 'lucide-react';
import {
  bookmarkQuestion, getBookmarkedQuestionIds, getQuestions,
  submitAttempt, unbookmarkQuestion,
} from '../services/supabase';
import { DEMO_QUESTIONS } from '../data/demoQuestions';

const TOPICS = [
  'All Topics', 'Pharmacology', 'Safety and Infection Control', 'Medical-Surgical',
  'NGN Case Studies', 'Maternal and Newborn', 'Mental Health', 'Pediatrics',
  'Leadership and Management',
];
const TYPES = ['All Types', 'mcq', 'sata'];
const TYPE_LABELS = { mcq: 'Multiple Choice', sata: 'Select All That Apply' };

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
  const [selected, setSelected] = useState([]);
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
      const { data } = await getQuestions({ limit: 100 });
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
    setSubmitted(false);
  }, [questions, topicFilter, typeFilter, showBookmarked, bookmarks]);

  const question = filtered[index];

  function toggleChoice(id) {
    if (submitted) return;
    if (question.question_type === 'mcq') {
      setSelected([id]);
    } else {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }
  }

  async function handleSubmit() {
    if (!selected.length) return;
    setSubmitted(true);
    const correct = question.question_type === 'sata'
      ? isSATACorrect(selected, question.correct_answer)
      : isMCQCorrect(selected, question.correct_answer);
    setSessionStats((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    if (userId) {
      await submitAttempt(userId, question.id, { ids: selected }, correct);
    }
  }

  async function toggleBookmark() {
    if (!userId) return;
    const isBookmarked = bookmarks.has(question.id);
    if (isBookmarked) {
      await unbookmarkQuestion(userId, question.id);
      setBookmarks((prev) => { const n = new Set(prev); n.delete(question.id); return n; });
    } else {
      await bookmarkQuestion(userId, question.id);
      setBookmarks((prev) => new Set([...prev, question.id]));
    }
  }

  function goNext() {
    setIndex((i) => Math.min(i + 1, filtered.length - 1));
    setSelected([]);
    setSubmitted(false);
  }

  function goPrev() {
    setIndex((i) => Math.max(i - 1, 0));
    setSelected([]);
    setSubmitted(false);
  }

  const isCorrectAnswer = useCallback((id) => {
    return question?.correct_answer?.ids?.includes(id) ?? false;
  }, [question]);

  if (loading) {
    return <div className="content-band" style={{ textAlign: 'center', padding: 48, color: '#607478' }}>Loading questions…</div>;
  }

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
  const isAnswerCorrect = submitted
    ? (question.question_type === 'sata' ? isSATACorrect(selected, question.correct_answer) : isMCQCorrect(selected, question.correct_answer))
    : null;

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chips"><span>{question.topic}</span></span>
          <span className="chips"><span>{TYPE_LABELS[question.question_type] ?? question.question_type}</span></span>
        </div>
        <button
          className="icon-btn"
          onClick={toggleBookmark}
          disabled={!userId}
          title={userId ? (isBookmarked ? 'Remove bookmark' : 'Bookmark question') : 'Sign in to bookmark'}
          style={{ color: isBookmarked ? '#e3a72f' : undefined }}
        >
          {isBookmarked ? <BookmarkCheck size={18} /> : <BookmarkPlus size={18} />}
        </button>
      </div>

      {/* Question prompt */}
      <div className="qb-prompt">
        <p>{question.prompt}</p>
        {question.question_type === 'sata' && (
          <div className="sata-hint">Select all that apply — there may be more than one correct answer.</div>
        )}
      </div>

      {/* Answer choices */}
      <div className="qb-choices">
        {(question.choices ?? []).map((choice) => {
          const isSelected = selected.includes(choice.id);
          const isCorrect = isCorrectAnswer(choice.id);
          let cls = 'qb-choice';
          if (submitted) {
            if (isCorrect) cls += ' choice-correct';
            else if (isSelected && !isCorrect) cls += ' choice-wrong';
          } else if (isSelected) {
            cls += ' choice-selected';
          }
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

      {/* Submit / result */}
      {!submitted ? (
        <button
          className="primary-btn"
          onClick={handleSubmit}
          disabled={!selected.length}
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
      {submitted && (
        <div className="rationale">
          <strong>Rationale</strong>
          <p>{question.rationale}</p>
          {question.question_type === 'sata' && (
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
