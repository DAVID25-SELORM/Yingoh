import React, { useEffect, useState } from 'react';
import {
  Activity, Bell, Brain, CalendarDays, CheckCircle2, ChevronRight,
  Flame, PlayCircle, Sparkles, Target, TrendingUp,
} from 'lucide-react';
import dashboardImage from '../assets/nclex-dashboard.png';
import { calculatePassProbability, getRecentAttempts, getStudyPlan, getUserProgress } from '../services/supabase';

const DEMO_TOPICS = [
  { label: 'Pharmacology', score: 68, status: 'Priority area', color: '#e85d4f' },
  { label: 'Safety & Infection Control', score: 82, status: 'On track', color: '#29b7a3' },
  { label: 'Maternal and Newborn', score: 74, status: 'Building', color: '#e3a72f' },
  { label: 'NGN Case Studies', score: 61, status: 'Coaching focus', color: '#6750a4' },
  { label: 'Medical-Surgical', score: 77, status: 'Progressing', color: '#29b7a3' },
  { label: 'Mental Health', score: 71, status: 'Building', color: '#e3a72f' },
];

const DEMO_ACTIVITY = [45, 22, 38, 50, 17, 42, 30];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function PassProbabilityGauge({ value }) {
  const color = value >= 75 ? '#29b7a3' : value >= 55 ? '#e3a72f' : '#e85d4f';
  const label = value >= 75 ? 'High' : value >= 55 ? 'Moderate' : 'Developing';
  const pct = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="pass-gauge">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#edf2f1" strokeWidth="10" />
        <circle
          cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>{value}%</text>
        <text x="50" y="62" textAnchor="middle" fontSize="9" fill="#8a999c">{label}</text>
      </svg>
      <span>Pass Probability</span>
    </div>
  );
}

function WeeklyActivity({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div className="activity-bars">
      {data.map((val, i) => (
        <div key={i} className="activity-bar-col">
          <div className="activity-bar-track">
            <div className="activity-bar-fill" style={{ height: `${(val / max) * 100}%` }} title={`${val} questions`} />
          </div>
          <span>{DAYS[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function StudentDashboard({ session, onNavigate }) {
  const [passProbability, setPassProbability] = useState(74);
  const [streak, setStreak] = useState(7);
  const [doneToday, setDoneToday] = useState(18);
  const [dailyTarget, setDailyTarget] = useState(25);
  const [examDate, setExamDate] = useState(null);
  const [daysUntilExam, setDaysUntilExam] = useState(42);

  useEffect(() => {
    if (!session?.user) return;
    const userId = session.user.id;

    getUserProgress(userId).then(({ data }) => {
      if (!data) return;
      setStreak(data.current_streak ?? 0);
      setDoneToday(data.daily_goal_completed ?? 0);
      setDailyTarget(data.daily_goal_target ?? 25);
    });

    getRecentAttempts(userId, 75).then(({ data }) => {
      if (data?.length) {
        const prob = calculatePassProbability(data);
        if (prob !== null) setPassProbability(prob);
        const today = new Date().toDateString();
        const todayCount = data.filter((a) => new Date(a.created_at).toDateString() === today).length;
        setDoneToday(todayCount);
      }
    });

    getStudyPlan(userId).then(({ data }) => {
      if (data) {
        setDailyTarget(data.daily_question_target);
        setExamDate(data.exam_date);
        const days = Math.ceil((new Date(data.exam_date) - new Date()) / 86400000);
        setDaysUntilExam(Math.max(0, days));
      }
    });
  }, [session]);

  const goalPct = Math.min(100, Math.round((doneToday / dailyTarget) * 100));

  return (
    <section className="view-grid">
      <div className="hero-panel">
        <img src={dashboardImage} alt="Nursing students preparing for NCLEX" />
        <div className="hero-copy">
          <span className="hero-brand"><img src="/yingoh-mark.svg" alt="" /> Yingoh NCLEX Coaching Platform</span>
          <h1>Adaptive NCLEX prep, live coaching, and progress intelligence.</h1>
          <p>Personalized study plans, clinical reasoning practice, and readiness tracking for NCLEX candidates.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => onNavigate('Questions')}>
              <PlayCircle size={18} /> Start practicing
            </button>
            <button className="ghost-btn" onClick={() => onNavigate('Exam')}>
              <Target size={18} /> Take exam
            </button>
            <button className="icon-btn" aria-label="Notifications"><Bell size={19} /></button>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="metrics-row">
        <div className="metric">
          <span>Pass Probability</span>
          <strong style={{ color: passProbability >= 75 ? '#135f55' : passProbability >= 55 ? '#875f08' : '#8a2c21' }}>
            {passProbability}%
          </strong>
          <small>Based on recent performance</small>
        </div>
        <div className="metric metric-coral">
          <span>Daily Goal</span>
          <strong>{doneToday}/{dailyTarget}</strong>
          <small>
            <div className="progress-track" style={{ marginTop: 4 }}>
              <span style={{ width: `${goalPct}%` }} />
            </div>
          </small>
        </div>
        <div className="metric metric-gold">
          <span>Study Streak</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong>{streak}</strong>
            <Flame size={22} color="#e3a72f" />
          </div>
          <small>Days in a row — keep it up!</small>
        </div>
        <div className="metric metric-violet">
          <span>Exam Countdown</span>
          <strong>{daysUntilExam}</strong>
          <small>days {examDate ? `until ${new Date(examDate).toLocaleDateString()}` : '— set your date'}</small>
        </div>
      </div>

      <div className="split-layout">
        {/* Weak Area Planner */}
        <section className="surface">
          <div className="section-title">
            <h2>Weak Area Planner</h2>
            <Sparkles size={20} />
          </div>
          {DEMO_TOPICS.map((topic) => (
            <div className="topic-row" key={topic.label}>
              <div>
                <strong>{topic.label}</strong>
                <span>{topic.status}</span>
              </div>
              <div className="progress-track" aria-label={`${topic.score}%`}>
                <span style={{ width: `${topic.score}%`, background: `linear-gradient(90deg, ${topic.color}, ${topic.color}aa)` }} />
              </div>
              <b>{topic.score}%</b>
            </div>
          ))}
          <button className="ghost-btn" style={{ marginTop: 14, width: '100%' }} onClick={() => onNavigate('Analytics')}>
            <TrendingUp size={16} /> View full analytics
          </button>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Pass probability gauge */}
          <section className="surface" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <PassProbabilityGauge value={passProbability} />
            <div>
              <strong style={{ display: 'block', marginBottom: 6 }}>NCLEX Readiness</strong>
              <p style={{ margin: 0, color: '#5b6d72', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {passProbability >= 75
                  ? 'You are on track to pass. Keep up your study pace and focus on NGN case studies.'
                  : passProbability >= 55
                    ? 'Good progress. Prioritize weak areas daily and aim for 72%+ on practice tests.'
                    : 'Focus on high-yield topics and increase daily question count. Consider coaching sessions.'}
              </p>
            </div>
          </section>

          {/* Weekly activity */}
          <section className="surface">
            <div className="section-title">
              <h2>This Week</h2>
              <Activity size={20} />
            </div>
            <WeeklyActivity data={DEMO_ACTIVITY} />
            <div style={{ marginTop: 10, color: '#607478', fontSize: '0.88rem' }}>
              {DEMO_ACTIVITY.reduce((a, b) => a + b, 0)} questions this week
            </div>
          </section>

          {/* Live coaching */}
          <section className="surface">
            <div className="section-title">
              <h2>Live Coaching</h2>
              <CalendarDays size={20} />
            </div>
            <div className="class-item active">
              <span>Live session</span>
              <strong>NGN Case Study Review</strong>
              <small>Today 6:00 PM — Instructor-led with attendance tracking</small>
            </div>
            <div className="class-item" style={{ marginTop: 8 }}>
              <span>Strategy lab</span>
              <strong>CAT Strategy Lab</strong>
              <small>Thursday 7:00 PM — Recordings and polls available</small>
            </div>
          </section>
        </div>
      </div>

      {/* Quick actions */}
      <section className="surface">
        <div className="section-title"><h2>Quick Actions</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { label: 'Practice Questions', view: 'Questions', icon: CheckCircle2, color: '#29b7a3' },
            { label: 'Timed Exam', view: 'Exam', icon: Target, color: '#e85d4f' },
            { label: 'Flashcards', view: 'Flashcards', icon: Brain, color: '#6750a4' },
            { label: 'Study Planner', view: 'Planner', icon: CalendarDays, color: '#e3a72f' },
            { label: 'My Notebook', view: 'Notebook', icon: Sparkles, color: '#29b7a3' },
            { label: 'Analytics', view: 'Analytics', icon: TrendingUp, color: '#e85d4f' },
          ].map(({ label, view, icon: Icon, color }) => (
            <button
              key={label}
              className="quick-action-btn"
              onClick={() => onNavigate(view)}
              style={{ '--qa-color': color }}
            >
              <Icon size={20} />
              <span>{label}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
