import React, { useEffect, useState } from 'react';
import { Activity, BarChart3, Target, TrendingUp, Users } from 'lucide-react';
import { calculatePassProbability, getAttemptStats, getExamHistory } from '../services/supabase';

const DEMO_TOPIC_STATS = [
  { topic: 'Pharmacology', correct: 34, total: 50, trend: -2 },
  { topic: 'Safety and Infection Control', correct: 41, total: 50, trend: +5 },
  { topic: 'Medical-Surgical', correct: 38, total: 49, trend: +3 },
  { topic: 'NGN Case Studies', correct: 30, total: 49, trend: -1 },
  { topic: 'Maternal and Newborn', correct: 37, total: 50, trend: +2 },
  { topic: 'Mental Health', correct: 35, total: 49, trend: +1 },
  { topic: 'Pediatrics', correct: 40, total: 50, trend: +4 },
  { topic: 'Leadership and Management', correct: 37, total: 49, trend: +2 },
];

const DEMO_WEEKLY = [45, 22, 38, 50, 17, 42, 30];
const DEMO_EXAM_HISTORY = [
  { mode: 'practice', score_pct: 68, total_questions: 25, completed_at: new Date(Date.now() - 86400000 * 1).toISOString() },
  { mode: 'timed', score_pct: 72, total_questions: 50, completed_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { mode: 'cat', score_pct: 75, total_questions: 25, completed_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { mode: 'practice', score_pct: 64, total_questions: 10, completed_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { mode: 'assessment', score_pct: 78, total_questions: 100, completed_at: new Date(Date.now() - 86400000 * 10).toISOString() },
];

// Peer percentile lookup (simulated benchmark)
function getPeerPercentile(score) {
  if (score >= 90) return 97;
  if (score >= 82) return 90;
  if (score >= 76) return 80;
  if (score >= 70) return 65;
  if (score >= 65) return 50;
  if (score >= 58) return 35;
  return 20;
}

function PassGauge({ value }) {
  const color = value >= 75 ? '#29b7a3' : value >= 55 ? '#e3a72f' : '#e85d4f';
  const label = value >= 75 ? 'Likely to pass' : value >= 55 ? 'Developing' : 'Needs focus';
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, value) / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#edf2f1" strokeWidth="12" />
        <circle
          cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="65" y="60" textAnchor="middle" fontSize="22" fontWeight="800" fill={color}>{value}%</text>
        <text x="65" y="78" textAnchor="middle" fontSize="10" fill="#8a999c">Pass Probability</text>
      </svg>
      <span style={{ color, fontWeight: 700, fontSize: '0.9rem' }}>{label}</span>
    </div>
  );
}

function TopicBar({ topic, correct, total, trend }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passing = pct >= 72;
  return (
    <div className="analytics-topic-row">
      <div className="analytics-topic-name">
        <span>{topic}</span>
        {trend !== 0 && (
          <span style={{ color: trend > 0 ? '#135f55' : '#8a2c21', fontSize: '0.8rem', fontWeight: 700 }}>
            {trend > 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>
      <div className="progress-track" style={{ flex: 1, margin: '0 12px' }}>
        <span style={{
          width: `${pct}%`,
          background: passing ? '#29b7a3' : pct >= 60 ? '#e3a72f' : '#e85d4f',
        }} />
      </div>
      <div style={{ display: 'flex', gap: 10, minWidth: 100, justifyContent: 'flex-end' }}>
        <strong style={{ color: passing ? '#135f55' : '#8a2c21' }}>{pct}%</strong>
        <span style={{ color: '#8a999c', fontSize: '0.85rem' }}>{correct}/{total}</span>
      </div>
    </div>
  );
}

function MiniBarChart({ data, label }) {
  const max = Math.max(...data, 1);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div>
      <div className="activity-bars" style={{ height: 80 }}>
        {data.map((v, i) => (
          <div key={i} className="activity-bar-col">
            <div className="activity-bar-track" style={{ height: 60 }}>
              <div className="activity-bar-fill" style={{ height: `${(v / max) * 100}%` }} />
            </div>
            <span style={{ fontSize: '0.72rem' }}>{days[i]}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.82rem', color: '#607478', marginTop: 4 }}>
        {data.reduce((a, b) => a + b, 0)} {label} this week
      </div>
    </div>
  );
}

const MODE_LABELS = { practice: 'Practice', timed: 'Timed', cat: 'CAT', assessment: 'Assessment' };

export default function AnalyticsView({ session }) {
  const [topicStats, setTopicStats] = useState(DEMO_TOPIC_STATS);
  const [passProbability, setPassProbability] = useState(74);
  const [totalAttempts, setTotalAttempts] = useState(244);
  const [overallPct, setOverallPct] = useState(74);
  const [examHistory, setExamHistory] = useState(DEMO_EXAM_HISTORY);
  const [weeklyData, setWeeklyData] = useState(DEMO_WEEKLY);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const { data: attempts } = await getAttemptStats(userId);
      if (attempts?.length) {
        const prob = calculatePassProbability(attempts);
        if (prob !== null) setPassProbability(prob);

        const byTopic = {};
        attempts.forEach((a) => {
          const topic = a.questions?.topic;
          if (!topic) return;
          if (!byTopic[topic]) byTopic[topic] = { correct: 0, total: 0 };
          byTopic[topic].total++;
          if (a.is_correct) byTopic[topic].correct++;
        });
        const stats = Object.entries(byTopic).map(([topic, s]) => ({
          topic, correct: s.correct, total: s.total, trend: 0,
        }));
        if (stats.length) setTopicStats(stats);

        setTotalAttempts(attempts.length);
        const overall = attempts.filter((a) => a.is_correct).length;
        setOverallPct(Math.round((overall / attempts.length) * 100));

        // Weekly data from attempts
        const now = new Date();
        const days = Array(7).fill(0);
        attempts.forEach((a) => {
          const dayDiff = Math.floor((now - new Date(a.created_at)) / 86400000);
          if (dayDiff < 7) days[6 - dayDiff]++;
        });
        setWeeklyData(days);
      }

      const { data: history } = await getExamHistory(userId);
      if (history?.length) setExamHistory(history);
    }
    load();
  }, [userId]);

  const peerPercentile = getPeerPercentile(overallPct);
  const weakTopics = topicStats.filter((s) => s.total > 0 && Math.round((s.correct / s.total) * 100) < 72);
  const strongTopics = topicStats.filter((s) => s.total > 0 && Math.round((s.correct / s.total) * 100) >= 80);
  const ngnScore = topicStats.find((s) => s.topic === 'NGN Case Studies');
  const ngnPct = ngnScore ? Math.round((ngnScore.correct / ngnScore.total) * 100) : 61;

  return (
    <section className="content-band">
      <div className="section-title"><h2>Performance Analytics</h2><BarChart3 size={22} /></div>

      {/* Top metrics */}
      <div className="metrics-row" style={{ marginBottom: 20 }}>
        <div className="metric">
          <span>Overall Score</span>
          <strong style={{ color: overallPct >= 72 ? '#135f55' : '#8a2c21' }}>{overallPct}%</strong>
          <small>{totalAttempts} questions attempted</small>
        </div>
        <div className="metric metric-coral">
          <span>NGN Readiness</span>
          <strong style={{ color: ngnPct >= 72 ? '#135f55' : '#8a2c21' }}>{ngnPct}%</strong>
          <small>Next Gen NCLEX items</small>
        </div>
        <div className="metric metric-gold">
          <span>Peer Percentile</span>
          <strong>{peerPercentile}<sup style={{ fontSize: '1rem' }}>th</sup></strong>
          <small>vs. other NCLEX candidates</small>
        </div>
        <div className="metric metric-violet">
          <span>Areas Mastered</span>
          <strong>{strongTopics.length}</strong>
          <small>topics at ≥80%</small>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Pass probability + at-risk alerts */}
        <div className="surface" style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <PassGauge value={passProbability} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <h3 style={{ margin: '0 0 8px' }}>NCLEX Readiness</h3>
              <p style={{ margin: 0, color: '#5b6d72', lineHeight: 1.5, fontSize: '0.92rem' }}>
                {passProbability >= 75
                  ? 'Your performance indicates a high likelihood of passing. Maintain your momentum and focus on NGN case studies.'
                  : passProbability >= 55
                    ? 'You are making progress. Prioritize weak areas and aim for 72%+ across all topics.'
                    : 'Increase your daily practice and focus on high-yield topics. Consider booking a coaching session.'}
              </p>
              {weakTopics.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: '#fff0ee', borderRadius: 8, border: '1px solid #f2b7ae' }}>
                  <strong style={{ color: '#8a2c21', fontSize: '0.88rem' }}>⚠️ At-risk topics:</strong>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {weakTopics.map((t) => (
                      <span key={t.topic} style={{ background: '#fff5df', color: '#875f08', borderRadius: 999, padding: '3px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
                        {t.topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Weekly activity */}
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>
              <h3>Weekly Activity</h3>
              <Activity size={18} />
            </div>
            <MiniBarChart data={weeklyData} label="questions" />
          </div>
        </div>

        {/* Peer benchmarking */}
        <div className="surface">
          <div className="section-title">
            <h3>Peer Comparison</h3>
            <Users size={18} />
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { label: 'Your overall score', you: overallPct, peers: 71 },
              { label: 'Pharmacology', you: topicStats.find((t) => t.topic === 'Pharmacology') ? Math.round((topicStats.find((t) => t.topic === 'Pharmacology').correct / topicStats.find((t) => t.topic === 'Pharmacology').total) * 100) : 68, peers: 70 },
              { label: 'NGN Case Studies', you: ngnPct, peers: 65 },
              { label: 'Medical-Surgical', you: topicStats.find((t) => t.topic === 'Medical-Surgical') ? Math.round((topicStats.find((t) => t.topic === 'Medical-Surgical').correct / topicStats.find((t) => t.topic === 'Medical-Surgical').total) * 100) : 77, peers: 73 },
            ].map(({ label, you, peers }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: '#42585e' }}>{label}</span>
                  <span>
                    <strong style={{ color: you >= peers ? '#135f55' : '#8a2c21' }}>You: {you}%</strong>
                    <span style={{ color: '#8a999c' }}> vs Avg: {peers}%</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, height: 8 }}>
                  <div style={{ flex: you, background: you >= 72 ? '#29b7a3' : '#e85d4f', borderRadius: 4 }} />
                  <div style={{ flex: 100 - you, background: '#edf2f1', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: '#f0edff', borderRadius: 8, fontSize: '0.86rem', color: '#51408c' }}>
            <strong>Peer Percentile: {peerPercentile}th</strong><br />
            You are scoring higher than {peerPercentile}% of NCLEX candidates in our platform.
          </div>
        </div>
      </div>

      {/* Topic breakdown */}
      <div className="surface" style={{ marginTop: 16 }}>
        <div className="section-title">
          <h3>Topic Performance Breakdown</h3>
          <TrendingUp size={18} />
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {topicStats.map((s) => (
            <TopicBar key={s.topic} {...s} />
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: '0.82rem', color: '#607478' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#29b7a3', display: 'inline-block' }} /> ≥72% Passing
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e3a72f', display: 'inline-block' }} /> 60–71% Building
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e85d4f', display: 'inline-block' }} /> &lt;60% Focus needed
          </span>
        </div>
      </div>

      {/* Exam history */}
      {examHistory.length > 0 && (
        <div className="surface" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Exam History</h3><Target size={18} /></div>
          <div style={{ display: 'grid', gap: 10 }}>
            {examHistory.map((exam, i) => {
              const score = Math.round(exam.score_pct ?? 0);
              return (
                <div key={i} className="exam-history-row">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="chips"><span>{MODE_LABELS[exam.mode] ?? exam.mode}</span></span>
                    <span style={{ color: '#42585e', fontSize: '0.88rem' }}>
                      {exam.total_questions} questions
                    </span>
                    <span style={{ color: '#8a999c', fontSize: '0.82rem' }}>
                      {new Date(exam.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="progress-track" style={{ width: 120 }}>
                      <span style={{ width: `${score}%`, background: score >= 72 ? '#29b7a3' : '#e3a72f' }} />
                    </div>
                    <strong style={{ color: score >= 72 ? '#135f55' : '#875f08', minWidth: 40 }}>{score}%</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
