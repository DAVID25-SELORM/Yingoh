import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Save, Sparkles, Target } from 'lucide-react';
import { getAttemptStats, getStudyPlan, saveStudyPlan } from '../services/supabase';

const ALL_TOPICS = [
  'Pharmacology', 'Safety and Infection Control', 'Medical-Surgical',
  'NGN Case Studies', 'Maternal and Newborn', 'Mental Health',
  'Pediatrics', 'Leadership and Management',
];

const TOPIC_WEIGHTS = {
  'Pharmacology': 15,
  'Safety and Infection Control': 12,
  'Medical-Surgical': 18,
  'NGN Case Studies': 20,
  'Maternal and Newborn': 10,
  'Mental Health': 9,
  'Pediatrics': 8,
  'Leadership and Management': 8,
};

function getDaysBetween(from, to) {
  return Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));
}

function getWeekDays(startDate, count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function buildWeeklySchedule(examDate, dailyTarget, weakTopics) {
  const days = getDaysBetween(new Date(), examDate);
  const topicQueue = [...weakTopics, ...ALL_TOPICS.filter((t) => !weakTopics.includes(t))];
  const week = getWeekDays(new Date(), 7);
  return week.map((date, i) => {
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const target = isWeekend ? Math.ceil(dailyTarget * 1.3) : dailyTarget;
    const focusTopic = topicQueue[i % topicQueue.length];
    return { date, target, focusTopic, isToday: i === 0 };
  });
}

function TopicScoreBar({ topic, score, isWeak }) {
  return (
    <div className="planner-topic-row">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: isWeak ? 700 : 400, color: isWeak ? '#8a2c21' : '#17212f' }}>
          {topic} {isWeak && '⚠️'}
        </span>
        <span style={{ color: isWeak ? '#8a2c21' : '#135f55', fontWeight: 700 }}>{score}%</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${score}%`, background: score >= 72 ? '#29b7a3' : score >= 60 ? '#e3a72f' : '#e85d4f' }} />
      </div>
    </div>
  );
}

export default function StudyPlannerView({ session }) {
  const [examDate, setExamDate] = useState('');
  const [dailyTarget, setDailyTarget] = useState(25);
  const [topicScores, setTopicScores] = useState({});
  const [weakTopics, setWeakTopics] = useState([]);
  const [saved, setSaved] = useState(false);
  const [daysLeft, setDaysLeft] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [saving, setSaving] = useState(false);

  const userId = session?.user?.id;

  // Demo topic scores when no real data
  const DEMO_SCORES = {
    'Pharmacology': 68,
    'Safety and Infection Control': 82,
    'Medical-Surgical': 77,
    'NGN Case Studies': 61,
    'Maternal and Newborn': 74,
    'Mental Health': 71,
    'Pediatrics': 80,
    'Leadership and Management': 75,
  };

  useEffect(() => {
    async function load() {
      let scores = { ...DEMO_SCORES };

      if (userId) {
        const { data: attempts } = await getAttemptStats(userId);
        if (attempts?.length) {
          const byTopic = {};
          attempts.forEach((a) => {
            const topic = a.questions?.topic;
            if (!topic) return;
            if (!byTopic[topic]) byTopic[topic] = { correct: 0, total: 0 };
            byTopic[topic].total++;
            if (a.is_correct) byTopic[topic].correct++;
          });
          Object.entries(byTopic).forEach(([t, s]) => {
            if (s.total >= 5) scores[t] = Math.round((s.correct / s.total) * 100);
          });
        }

        const { data: plan } = await getStudyPlan(userId);
        if (plan) {
          setExamDate(plan.exam_date);
          setDailyTarget(plan.daily_question_target);
          setSaved(true);
        }
      }

      setTopicScores(scores);
      const weak = ALL_TOPICS.filter((t) => (scores[t] ?? 100) < 72).sort((a, b) => scores[a] - scores[b]);
      setWeakTopics(weak);
    }
    load();
  }, [userId]);

  useEffect(() => {
    if (!examDate) return;
    const days = getDaysBetween(new Date(), examDate);
    setDaysLeft(days);
    const weak = ALL_TOPICS.filter((t) => (topicScores[t] ?? 100) < 72).sort((a, b) => topicScores[a] - topicScores[b]);
    setSchedule(buildWeeklySchedule(examDate, dailyTarget, weak));
  }, [examDate, dailyTarget, topicScores]);

  async function handleSave() {
    setSaving(true);
    const weak = ALL_TOPICS.filter((t) => (topicScores[t] ?? 100) < 72);
    if (userId) {
      await saveStudyPlan(userId, examDate, dailyTarget, weak);
    }
    setSaved(true);
    setSaving(false);
  }

  const totalQuestions = daysLeft ? daysLeft * dailyTarget : 0;
  const perTopicPerDay = Object.fromEntries(
    ALL_TOPICS.map((t) => [t, Math.max(1, Math.round((TOPIC_WEIGHTS[t] / 100) * dailyTarget))])
  );

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <section className="content-band">
      <div className="section-title"><h2>Dynamic Study Planner</h2><CalendarDays size={22} /></div>
      <p style={{ color: '#5b6d72', marginTop: 0 }}>
        Set your exam date and daily goal. Your plan auto-adjusts based on weak areas detected from your practice history.
      </p>

      {/* Setup */}
      <div className="planner-setup">
        <div className="planner-field">
          <label>
            <CalendarDays size={16} /> Target Exam Date
          </label>
          <input
            type="date"
            value={examDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => { setExamDate(e.target.value); setSaved(false); }}
          />
        </div>
        <div className="planner-field">
          <label>
            <Target size={16} /> Daily Questions: <strong>{dailyTarget}</strong>
          </label>
          <input
            type="range" min="10" max="75" step="5"
            value={dailyTarget}
            onChange={(e) => { setDailyTarget(Number(e.target.value)); setSaved(false); }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#607478' }}>
            <span>10</span><span>25 (recommended)</span><span>75</span>
          </div>
        </div>
        <button
          className="primary-btn"
          onClick={handleSave}
          disabled={!examDate || saving}
          style={{ alignSelf: 'flex-end' }}
        >
          {saved ? <><CheckCircle2 size={16} /> Saved</> : <><Save size={16} /> Save Plan</>}
        </button>
      </div>

      {/* Summary stats */}
      {daysLeft && (
        <div className="metrics-row" style={{ margin: '20px 0' }}>
          <div className="metric">
            <span>Days Until Exam</span>
            <strong>{daysLeft}</strong>
            <small>{new Date(examDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</small>
          </div>
          <div className="metric metric-coral">
            <span>Daily Target</span>
            <strong>{dailyTarget}</strong>
            <small>questions per day</small>
          </div>
          <div className="metric metric-gold">
            <span>Total Questions</span>
            <strong>{totalQuestions.toLocaleString()}</strong>
            <small>planned over {daysLeft} days</small>
          </div>
          <div className="metric metric-violet">
            <span>Weak Areas</span>
            <strong>{weakTopics.length}</strong>
            <small>{weakTopics.length ? 'need focused study' : 'all on track!'}</small>
          </div>
        </div>
      )}

      <div className="planner-grid">
        {/* Topic performance */}
        <div className="surface">
          <div className="section-title">
            <h3>Topic Performance</h3>
            <Sparkles size={18} />
          </div>
          {ALL_TOPICS.map((topic) => (
            <TopicScoreBar
              key={topic}
              topic={topic}
              score={topicScores[topic] ?? 0}
              isWeak={(topicScores[topic] ?? 100) < 72}
            />
          ))}
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff5df', borderRadius: 8, fontSize: '0.86rem', color: '#875f08' }}>
            <strong>Passing threshold:</strong> 72% per topic. Topics below this threshold are prioritized in your daily plan.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {/* Daily breakdown */}
          <div className="surface">
            <div className="section-title"><h3>Daily Breakdown ({dailyTarget} Questions)</h3></div>
            {ALL_TOPICS.map((topic) => {
              const isWeak = (topicScores[topic] ?? 100) < 72;
              const count = Math.max(1, Math.round(((TOPIC_WEIGHTS[topic] + (isWeak ? 5 : 0)) / 100) * dailyTarget));
              return (
                <div key={topic} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #edf2f1', fontSize: '0.88rem' }}>
                  <span style={{ color: isWeak ? '#8a2c21' : '#17212f' }}>{topic} {isWeak && '⚠️'}</span>
                  <strong>{count} Qs</strong>
                </div>
              );
            })}
          </div>

          {/* 7-day schedule */}
          {schedule.length > 0 && (
            <div className="surface">
              <div className="section-title"><h3>This Week</h3><CalendarDays size={18} /></div>
              {schedule.map((day, i) => (
                <div key={i} className={`schedule-day ${day.isToday ? 'schedule-today' : ''}`}>
                  <div className="schedule-day-header">
                    <strong>{day.isToday ? 'Today' : DAY_NAMES[day.date.getDay()]}</strong>
                    <span>{day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="schedule-day-body">
                    <span className="schedule-target">{day.target} questions</span>
                    <span className="schedule-focus">Focus: {day.focusTopic}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
