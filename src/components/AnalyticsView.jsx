import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, Target, TrendingUp, Zap } from 'lucide-react';
import { calculatePassProbability, getAttemptStats, getExamHistory } from '../services/supabase';

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

export default function AnalyticsView({ session, onNavigate }) {
  const [topicStats, setTopicStats] = useState([]);
  const [passProbability, setPassProbability] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [overallPct, setOverallPct] = useState(0);
  const [examHistory, setExamHistory] = useState([]);
  const [weeklyData, setWeeklyData] = useState(Array(7).fill(0));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      setLoadError('');
      const { data: attempts, error: attemptsError } = await getAttemptStats(userId);
      if (attemptsError) {
        setLoadError('Your analytics could not be loaded. Please retry.');
        setLoading(false);
        return;
      }
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
          if (dayDiff >= 0 && dayDiff < 7) days[6 - dayDiff]++;
        });
        setWeeklyData(days);
      }

      const { data: history, error: historyError } = await getExamHistory(userId);
      if (historyError) setLoadError('Question analytics loaded, but exam history is temporarily unavailable.');
      if (history?.length) setExamHistory(history);
      setLoading(false);
    }
    load();
  }, [userId, reloadKey]);

  const weakTopics = topicStats.filter((s) => s.total > 0 && Math.round((s.correct / s.total) * 100) < 72);
  const strongTopics = topicStats.filter((s) => s.total > 0 && Math.round((s.correct / s.total) * 100) >= 80);
  const ngnScore = topicStats.find((s) => s.topic === 'NGN Case Studies');
  const ngnPct = ngnScore ? Math.round((ngnScore.correct / ngnScore.total) * 100) : 0;
  const goalRows = [
    { label: 'Overall accuracy', value: overallPct, total: totalAttempts },
    ...topicStats
      .map((topic) => ({
        label: topic.topic,
        value: Math.round((topic.correct / topic.total) * 100),
        total: topic.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3),
  ];

  if (loading) {
    return (
      <section className="content-band">
        <div className="section-title"><h2>Performance Analytics</h2><BarChart3 size={22} /></div>
        <div className="surface" style={{ padding: 42, textAlign: 'center', color: '#607478' }}>
          <Activity size={30} style={{ margin: '0 auto 12px', color: '#2b8a7d' }} />
          <strong style={{ display: 'block', color: '#17212f', marginBottom: 6 }}>Preparing your performance dashboard</strong>
          <span>Loading practice activity, topic accuracy, and exam history…</span>
        </div>
      </section>
    );
  }

  if (!loading && totalAttempts === 0) {
    return (
      <section className="content-band">
        <div className="section-title"><h2>Performance Analytics</h2><BarChart3 size={22} /></div>
        {loadError && (
          <div style={{ padding: '11px 14px', marginBottom: 14, borderRadius: 10, background: '#fff1ed', color: '#8a2c21', border: '1px solid #f2b9ae' }}>
            {loadError} <button className="ghost-btn" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
          </div>
        )}
        <div className="surface" style={{ padding: '38px 28px', textAlign: 'center' }}>
          <Activity size={34} style={{ margin: '0 auto 12px', color: '#2b8a7d' }} />
          <h3 style={{ margin: '0 0 8px' }}>Build your first performance baseline</h3>
          <p style={{ maxWidth: 600, margin: '0 auto 24px', color: '#607478', lineHeight: 1.55 }}>
            Complete a short practice set. NurseFaculty will use your real answers—not sample data—to identify strengths, weak areas, study consistency, and readiness trends.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, margin: '0 auto 24px', maxWidth: 760, textAlign: 'left' }}>
            {[
              [ClipboardCheck, '1. Practice', 'Answer at least 10 questions to establish an initial accuracy baseline.'],
              [TrendingUp, '2. Review', 'See performance by topic and the areas that need focused correction.'],
              [CalendarDays, '3. Improve', 'Use weekly activity and your planner to build a consistent study rhythm.'],
            ].map(([Icon, title, description]) => (
              <div key={title} style={{ padding: 16, border: '1px solid #dbe6e4', borderRadius: 12, background: '#f8fbfa' }}>
                <Icon size={19} color="#2b8a7d" />
                <strong style={{ display: 'block', margin: '8px 0 5px', color: '#17212f' }}>{title}</strong>
                <span style={{ color: '#607478', fontSize: '0.82rem', lineHeight: 1.45 }}>{description}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="primary-btn" onClick={() => onNavigate?.('Questions')}>Start a practice set</button>
            <button className="ghost-btn" onClick={() => onNavigate?.('Planner')}>Set up study planner</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="content-band">
      <div className="section-title"><h2>Performance Analytics</h2><BarChart3 size={22} /></div>
      {loadError && (
        <div style={{ padding: '11px 14px', marginBottom: 14, borderRadius: 10, background: '#fff8e8', color: '#72520a', border: '1px solid #f1d59b' }}>
          {loadError} <button className="ghost-btn" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
        </div>
      )}

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
          <span>Completed Exams</span>
          <strong>{examHistory.length}</strong>
          <small>CAT, timed, and readiness exams</small>
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
              {totalAttempts < 50 && (
                <p style={{ margin: '10px 0 0', color: '#875f08', fontSize: '0.8rem', lineHeight: 1.45 }}>
                  Early estimate based on {totalAttempts} answered question{totalAttempts === 1 ? '' : 's'}. Complete at least 50 across several topics for a more stable readiness signal.
                </p>
              )}
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

        {/* Personal goal comparison */}
        <div className="surface">
          <div className="section-title">
            <h3>72% Goal Comparison</h3>
            <CheckCircle2 size={18} />
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {goalRows.map(({ label, value, total }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: '#42585e' }}>{label}</span>
                  <span>
                    <strong style={{ color: value >= 72 ? '#135f55' : '#8a2c21' }}>{value}%</strong>
                    <span style={{ color: '#8a999c' }}> · {total} answered</span>
                  </span>
                </div>
                <div className="progress-track" style={{ position: 'relative' }}>
                  <span style={{ width: `${value}%`, background: value >= 72 ? '#29b7a3' : '#e85d4f' }} />
                  <i title="72% goal" style={{ position: 'absolute', left: '72%', top: -3, bottom: -3, width: 2, background: '#102027', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: '#eef7f5', borderRadius: 8, fontSize: '0.86rem', color: '#135f55' }}>
            <strong>Your data only</strong><br />
            Comparisons use your completed NurseFaculty questions against the 72% study goal. No simulated peer scores are shown.
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

      {/* Weakness Detector */}
      {weakTopics.length > 0 && (
        <div className="surface" style={{ marginTop: 16, borderLeft: '4px solid #e85d4f' }}>
          <div className="section-title" style={{ marginBottom: 12 }}>
            <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={18} color="#e85d4f" /> Weakness Detector</h3>
          </div>
          <p style={{ margin: '0 0 14px', color: '#607478', fontSize: '0.88rem' }}>
            These topics are below the 72% NCLEX passing threshold. Prioritize them in your study plan.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {weakTopics.map((t) => {
              const pct = Math.round((t.correct / t.total) * 100);
              const gap = 72 - pct;
              const severity = pct < 50 ? 'critical' : pct < 60 ? 'high' : 'medium';
              const color = severity === 'critical' ? '#e85d4f' : severity === 'high' ? '#e3a72f' : '#c17f44';
              return (
                <div key={t.topic} style={{ padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${color}33`, background: color + '08' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <strong style={{ fontSize: '0.92rem' }}>{t.topic}</strong>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: color + '22', color }}>{severity.toUpperCase()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 3, height: 8, marginBottom: 4, borderRadius: 4, overflow: 'hidden', background: '#e9f1ef' }}>
                        <div style={{ width: `${pct}%`, background: color, borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#607478' }}>
                        <strong style={{ color }}>{pct}%</strong> correct ({t.correct}/{t.total}) · Need <strong>{gap}%</strong> more to pass threshold
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button className="ghost-btn" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => onNavigate?.('Questions')}>
                        Practice Now
                      </button>
                      <button className="ghost-btn" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => onNavigate?.('Videos')}>
                        <Zap size={13} /> Watch Video
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f7faf9', borderRadius: 8, fontSize: '0.84rem', color: '#607478' }}>
            <strong>Recommended daily target:</strong> Answer 20+ questions per weak topic. Use the Study Planner to schedule these automatically.
            <button className="ghost-btn" style={{ marginLeft: 10, fontSize: '0.78rem', padding: '4px 10px' }} onClick={() => onNavigate?.('Planner')}>Open Planner →</button>
          </div>
        </div>
      )}

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
