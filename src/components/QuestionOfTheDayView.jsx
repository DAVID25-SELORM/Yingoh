import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { SubscriptionGate } from './SubscriptionGate';
import AnswerExplanation from './AnswerExplanation';

function QuestionOfTheDayContent({ session }) {
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dailyQuestion, setDailyQuestion] = useState(null);
  const [question, setQuestion] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase || !userId) { setLoading(false); return; }
      setLoading(true);
      setError('');
      const { data: rows, error: dqError } = await supabase.rpc('get_daily_question_content');
      const dq = Array.isArray(rows) ? rows[0] : rows;
      if (!mounted) return;
      if (dqError || !dq) {
        setError(dqError?.message ?? "Could not load today's question.");
        setLoading(false);
        return;
      }
      const existing = dq.existing_attempt ?? null;
      setDailyQuestion({ id: dq.daily_question_id, question_id: dq.question_id, date: dq.question_date });
      setQuestion({
        id: dq.question_id,
        topic: dq.topic,
        question_type: dq.question_type,
        prompt: dq.prompt,
        choices: dq.choices,
        correct_answer: dq.correct_answer,
        rationale: dq.rationale,
        strategy: dq.strategy,
        reference_url: dq.reference_url,
        correct_answer_explanation: dq.correct_answer_explanation,
        option_explanations: dq.option_explanations,
        immediate_response: dq.immediate_response,
        reference_urls: dq.reference_urls,
        reviewed_at: dq.reviewed_at,
      });
      setAttempt(existing);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [userId]);

  function toggleChoice(id) {
    if (!question) return;
    if (question.question_type === 'mcq') {
      setSelected([id]);
    } else {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  }

  async function handleSubmit() {
    if (!selected.length || !question || !dailyQuestion || !userId) return;
    setSubmitting(true);
    const { data, error: insertError } = await supabase
      .rpc('submit_daily_question_answer_secure', {
        p_daily_question_id: dailyQuestion.id,
        p_selected_ids: selected,
      });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message ?? 'Could not save your answer.');
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    setAttempt(result?.attempt ?? null);
    setQuestion((current) => current ? {
      ...current,
      correct_answer: result?.correct_answer,
      rationale: result?.rationale,
      strategy: result?.strategy,
      reference_url: result?.reference_url,
      correct_answer_explanation: result?.correct_answer_explanation,
      option_explanations: result?.option_explanations,
      immediate_response: result?.immediate_response,
      reference_urls: result?.reference_urls,
      reviewed_at: result?.reviewed_at,
    } : current);
  }

  if (loading) {
    return <section className="content-band"><p style={{ color: '#607478' }}>Loading today's question…</p></section>;
  }

  if (error) {
    return <section className="content-band"><div className="form-message" style={{ color: '#8a2c21' }}>{error}</div></section>;
  }

  if (!question || !dailyQuestion) {
    return <section className="content-band"><p style={{ color: '#607478' }}>No question available today. Check back soon.</p></section>;
  }

  const correctIds = question.correct_answer?.ids ?? [];
  const answered = Boolean(attempt);
  const answerIds = answered ? (attempt.answer?.ids ?? []) : selected;

  return (
    <section className="content-band qotd-view">
      <div className="section-title">
        <h2>Question of the Day</h2>
        <CalendarDays size={22} />
      </div>
      <p className="qotd-date">
        {new Date(`${dailyQuestion.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="qb-prompt">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <span className="chips"><span>{question.topic}</span></span>
          {question.question_type === 'sata' && <span className="chips"><span>Select All That Apply</span></span>}
        </div>
        <p>{question.prompt}</p>
      </div>

      <div className="qb-choices">
        {(question.choices ?? []).map((choice) => {
          const isSel = answerIds.includes(choice.id);
          const isCorrect = correctIds.includes(choice.id);
          let cls = 'qb-choice';
          if (answered) {
            if (isCorrect) cls += ' choice-correct';
            else if (isSel && !isCorrect) cls += ' choice-wrong';
          } else if (isSel) {
            cls += ' choice-selected';
          }
          return (
            <button key={choice.id} className={cls} onClick={() => toggleChoice(choice.id)} disabled={answered}>
              <span className="choice-letter">{choice.id.toUpperCase()}</span>
              <span className="choice-text">{choice.text}</span>
              {answered && isCorrect && <CheckCircle2 size={18} style={{ marginLeft: 'auto', color: '#135f55', flexShrink: 0 }} />}
              {answered && isSel && !isCorrect && <XCircle size={18} style={{ marginLeft: 'auto', color: '#8a2c21', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {!answered ? (
        <button
          className="primary-btn"
          onClick={handleSubmit}
          disabled={!selected.length || submitting}
          style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
        >
          {submitting ? 'Submitting…' : 'Submit Answer'}
        </button>
      ) : (
        <>
          <AnswerExplanation question={question} selectedIds={answerIds} isCorrect={Boolean(attempt.is_correct)} />

          <p className="qotd-tomorrow">Come back tomorrow for a new question.</p>
        </>
      )}
    </section>
  );
}

export default function QuestionOfTheDayView({ session }) {
  return (
    <SubscriptionGate session={session} requiredPlan="basic" featureName="the daily Question of the Day">
      <QuestionOfTheDayContent session={session} />
    </SubscriptionGate>
  );
}
