import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { SubscriptionGate } from './SubscriptionGate';

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
  const correctChoices = (question.choices ?? []).filter((choice) => correctIds.includes(choice.id));
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
          <div className={`qb-result ${attempt.is_correct ? 'result-correct' : 'result-wrong'}`}>
            <div className="result-verdict">
              {attempt.is_correct ? <><CheckCircle2 size={20} /> Correct!</> : <><XCircle size={20} /> Incorrect</>}
            </div>
          </div>

          <div className="rationale">
            <strong>Correct answer{correctChoices.length === 1 ? '' : 's'}</strong>
            <p style={{ marginBottom: 14 }}>
              {correctChoices.map((choice) => `${choice.id.toUpperCase()}. ${choice.text}`).join('; ')}
            </p>
            <strong>Why this is the correct answer</strong>
            <p>{question.rationale}</p>
            {question.reference_url && (
              <a href={question.reference_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: '0.84rem', color: '#135f55', fontWeight: 700 }}>
                Review clinical source
              </a>
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
