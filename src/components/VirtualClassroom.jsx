import React, { useEffect, useState } from 'react';
import { Calendar, Clock, ExternalLink, Film, Mic, Users, Video } from 'lucide-react';
import { supabase } from '../services/supabase';
import { JitsiRoom } from './JitsiRoom';

const DEMO_SESSIONS = [
  { id: 's1', title: 'NGN Case Study Review', topic: 'NGN Case Studies', starts_at: new Date(Date.now() + 86400000 * 1).toISOString(), ends_at: new Date(Date.now() + 86400000 * 1 + 7200000).toISOString(), status: 'scheduled', attendee_count: 12, description: 'Instructor-led review of Next Generation NCLEX case studies including bow tie, matrix, and highlight-text question types.' },
  { id: 's2', title: 'CAT Strategy Lab', topic: 'Test Strategy', starts_at: new Date(Date.now() + 86400000 * 3).toISOString(), ends_at: new Date(Date.now() + 86400000 * 3 + 5400000).toISOString(), status: 'scheduled', attendee_count: 8, description: 'Learn how CAT works and how to approach it strategically with live adaptive practice.' },
  { id: 's3', title: 'Pharmacology High-Yield Review', topic: 'Pharmacology', starts_at: new Date(Date.now() + 86400000 * 6).toISOString(), ends_at: new Date(Date.now() + 86400000 * 6 + 7200000).toISOString(), status: 'scheduled', attendee_count: 23, description: 'High-yield pharmacology: top drug classes, antidotes, and nursing considerations for NCLEX.' },
  { id: 's4', title: 'Mental Health Nursing Essentials', topic: 'Mental Health', starts_at: new Date(Date.now() - 86400000 * 10).toISOString(), ends_at: new Date(Date.now() - 86400000 * 10 + 5400000).toISOString(), recording_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', status: 'completed', attendee_count: 17, description: 'Therapeutic communication, psychiatric medications, and priority interventions.' },
];

const TOPIC_COLORS = { 'NGN Case Studies': '#29b7a3', 'Test Strategy': '#e3a72f', 'Pharmacology': '#c17f44', 'Mental Health': '#8b5cf6', 'Medical-Surgical': '#2b8a7d', 'Pediatrics': '#e94868', 'Maternal and Newborn': '#e94868', 'Safety and Infection Control': '#607478' };

function timeUntil(iso) {
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return 'Now';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function addToCalendar(session) {
  const start = new Date(session.starts_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = session.ends_at
    ? new Date(session.ends_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    : start;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: `NurseFaculty: ${session.title}`, details: session.description ?? '', dates: `${start}/${end}` });
  window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank');
}

export default function VirtualClassroom() {
  const [sessions, setSessions] = useState(supabase ? [] : DEMO_SESSIONS);
  const [tab, setTab] = useState('live');
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('class_schedules').select('*').order('starts_at', { ascending: false }).then(({ data }) => {
      if (data?.length) setSessions(data);
    });
  }, []);

  const upcoming = sessions.filter((s) => s.status === 'scheduled' && new Date(s.starts_at) > new Date());
  const recordings = sessions.filter((s) => s.status === 'completed' && s.recording_url);
  const nextSession = upcoming[0];
  const isLive = nextSession && (new Date(nextSession.starts_at) - new Date()) < 30 * 60000;

  return (
    <section className="content-band">
      {activeSession && <JitsiRoom session={activeSession} onClose={() => setActiveSession(null)} />}

      <div className="section-title"><h2>Virtual Classroom</h2></div>

      {nextSession && (
        <div style={{ background: 'linear-gradient(135deg, #17313a 0%, #2b8a7d 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 22, color: '#fff', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75, marginBottom: 6 }}>
              {isLive ? '🔴 LIVE NOW' : `Next Session · Starts in ${timeUntil(nextSession.starts_at)}`}
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 800 }}>{nextSession.title}</h3>
            <p style={{ margin: '0 0 14px', opacity: 0.82, fontSize: '0.9rem', lineHeight: 1.5 }}>{nextSession.description}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.84rem', opacity: 0.8, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', gap: 5 }}><Calendar size={14} />{new Date(nextSession.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span style={{ display: 'flex', gap: 5 }}><Clock size={14} />{new Date(nextSession.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ display: 'flex', gap: 5 }}><Users size={14} />{nextSession.attendee_count} enrolled</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setActiveSession(nextSession)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#fff', color: '#17313a', borderRadius: 10, fontWeight: 800, fontSize: '0.92rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
              <Video size={16} /> {isLive ? 'Join Now' : 'Join Session'}
            </button>
            {!isLive && (
              <button onClick={() => addToCalendar(nextSession)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', border: '1.5px solid rgba(255,255,255,0.3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Calendar size={15} /> Add to Calendar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="tab-bar" style={{ marginBottom: 16 }}>
        <button className={`tab-btn ${tab === 'live' ? 'tab-active' : ''}`} onClick={() => setTab('live')}>Upcoming ({upcoming.length})</button>
        <button className={`tab-btn ${tab === 'recordings' ? 'tab-active' : ''}`} onClick={() => setTab('recordings')}>Recordings ({recordings.length})</button>
      </div>

      {tab === 'live' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {upcoming.map((s) => {
            const color = TOPIC_COLORS[s.topic] ?? '#607478';
            const inThirty = (new Date(s.starts_at) - new Date()) < 30 * 60000;
            return (
              <div key={s.id} className="classroom-card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color }}>{s.topic}</span>
                    {inThirty && <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#fef3f2', color: '#e94868', padding: '2px 8px', borderRadius: 12 }}>Starting soon</span>}
                  </div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem' }}>{s.title}</h4>
                  {s.description && <p style={{ margin: '0 0 6px', fontSize: '0.84rem', color: '#607478' }}>{s.description}</p>}
                  <div style={{ display: 'flex', gap: 14, fontSize: '0.82rem', color: '#8a999c', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', gap: 4 }}><Calendar size={13} />{new Date(s.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span style={{ display: 'flex', gap: 4 }}><Clock size={13} />{new Date(s.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    {s.attendee_count > 0 && <span style={{ display: 'flex', gap: 4 }}><Users size={13} />{s.attendee_count} enrolled</span>}
                    <span style={{ color, fontWeight: 600 }}>In {timeUntil(s.starts_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {inThirty ? (
                    <button onClick={() => setActiveSession(s)} className="primary-btn" style={{ whiteSpace: 'nowrap' }}>
                      <Mic size={14} /> Join Now
                    </button>
                  ) : (
                    <button onClick={() => addToCalendar(s)} className="ghost-btn" style={{ whiteSpace: 'nowrap' }}>
                      <Calendar size={14} /> Add to Calendar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!upcoming.length && (
            <div style={{ textAlign: 'center', padding: 48, color: '#607478' }}>
              <Calendar size={36} color="#dbe6e4" style={{ margin: '0 auto 12px' }} />
              <p>No upcoming sessions. Check back soon!</p>
            </div>
          )}
        </div>
      )}

      {tab === 'recordings' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {recordings.map((s) => {
            const color = TOPIC_COLORS[s.topic] ?? '#607478';
            const duration = s.ends_at ? Math.round((new Date(s.ends_at) - new Date(s.starts_at)) / 60000) : null;
            return (
              <div key={s.id} className="classroom-card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ width: 60, height: 60, borderRadius: 10, background: color + '22', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Film size={24} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color, marginBottom: 3 }}>{s.topic}</div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem' }}>{s.title}</h4>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem', color: '#8a999c', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', gap: 4 }}><Calendar size={13} />{new Date(s.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {duration && <span style={{ display: 'flex', gap: 4 }}><Clock size={13} />{duration} min</span>}
                    {s.attendee_count > 0 && <span style={{ display: 'flex', gap: 4 }}><Users size={13} />{s.attendee_count} attended</span>}
                  </div>
                </div>
                <a href={s.recording_url} target="_blank" rel="noreferrer" className="ghost-btn" style={{ textDecoration: 'none', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                  <ExternalLink size={14} /> Watch
                </a>
              </div>
            );
          })}
          {!recordings.length && (
            <div style={{ textAlign: 'center', padding: 48, color: '#607478' }}>
              <Film size={36} color="#dbe6e4" style={{ margin: '0 auto 12px' }} />
              <p>No recordings available yet. Past sessions will appear here.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
