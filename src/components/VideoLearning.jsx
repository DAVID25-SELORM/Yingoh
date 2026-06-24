import React, { useEffect, useState } from 'react';
import { Clock, Film, Lock, Play, Search, Star } from 'lucide-react';
import { supabase } from '../services/supabase';

const TOPICS = ['All', 'Pharmacology', 'NGN Case Studies', 'Test Strategy', 'Medical-Surgical', 'Mental Health', 'Maternal and Newborn', 'Pediatrics', 'Safety and Infection Control'];

const DEMO_VIDEOS = [
  { id: 'v1', title: 'NCLEX Pharmacology: High-Yield Drug Classes', description: 'Cover the 20 most-tested drug classes. Focus on nursing considerations, antidotes, side effects, and NCLEX priority questions.', topic: 'Pharmacology', video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration_mins: 45, is_published: true, is_premium: false, view_count: 1240, sort_order: 1 },
  { id: 'v2', title: 'NGN Case Study Walkthrough', description: 'Step-by-step breakdown of a Next Generation NCLEX case study. Demonstrates clinical judgment across bow-tie, matrix, and highlight items.', topic: 'NGN Case Studies', video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration_mins: 38, is_published: true, is_premium: false, view_count: 987, sort_order: 2 },
  { id: 'v3', title: 'CAT Strategy: How to Think Like a Nurse', description: 'Understand how the Computer Adaptive Test works and develop strategies for approaching hard questions with confidence.', topic: 'Test Strategy', video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration_mins: 30, is_published: true, is_premium: false, view_count: 2103, sort_order: 3 },
  { id: 'v4', title: 'Critical Lab Values You Must Know', description: 'Master the critical lab values most likely on NCLEX. Includes sodium, potassium, glucose, CBC, ABGs, and more.', topic: 'Medical-Surgical', video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration_mins: 25, is_published: true, is_premium: true, view_count: 756, sort_order: 4 },
  { id: 'v5', title: 'Mental Health Nursing: Therapeutic Communication', description: 'NCLEX-focused review of therapeutic vs. non-therapeutic communication with practice questions and rationales.', topic: 'Mental Health', video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration_mins: 28, is_published: true, is_premium: false, view_count: 614, sort_order: 5 },
  { id: 'v6', title: 'Maternal-Newborn: Priority Nursing Actions', description: 'High-yield maternal and newborn content. Covers labor stages, postpartum complications, and newborn assessments.', topic: 'Maternal and Newborn', video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration_mins: 35, is_published: true, is_premium: true, view_count: 432, sort_order: 6 },
];

const TOPIC_COLORS = { Pharmacology: '#c17f44', 'NGN Case Studies': '#29b7a3', 'Test Strategy': '#e3a72f', 'Medical-Surgical': '#2b8a7d', 'Mental Health': '#8b5cf6', 'Maternal and Newborn': '#e94868', Pediatrics: '#e94868', 'Safety and Infection Control': '#607478' };

export default function VideoLearning({ session }) {
  const [videos, setVideos] = useState(DEMO_VIDEOS);
  const [topic, setTopic] = useState('All');
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('video_lessons').select('*').eq('is_published', true).order('sort_order').then(({ data }) => {
      if (data?.length) setVideos(data);
    });
  }, []);

  async function openVideo(v) {
    setPlaying(v);
    if (supabase && session?.user?.id) {
      await supabase.from('video_progress').upsert({ user_id: session.user.id, video_id: v.id, last_watched_at: new Date().toISOString() }, { onConflict: 'user_id,video_id' });
      await supabase.from('video_lessons').update({ view_count: (v.view_count ?? 0) + 1 }).eq('id', v.id);
    }
  }

  const filtered = videos.filter((v) =>
    (topic === 'All' || v.topic === topic) &&
    (!search || v.title.toLowerCase().includes(search.toLowerCase()) || v.description?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <section className="content-band">
      <div className="section-title"><h2>Video Learning</h2><Film size={22} /></div>

      {/* Player */}
      {playing && (
        <div style={{ marginBottom: 24, background: '#000', borderRadius: 14, overflow: 'hidden' }}>
          <iframe
            src={playing.video_url + '?autoplay=1'}
            title={playing.title}
            width="100%"
            height="400"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ display: 'block' }}
          />
          <div style={{ padding: '14px 18px', background: '#17212f' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: '#fff' }}>{playing.title}</h3>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem', color: '#8a999c' }}>
                  <span style={{ color: TOPIC_COLORS[playing.topic] ?? '#29b7a3' }}>{playing.topic}</span>
                  <span><Clock size={12} style={{ display: 'inline', marginRight: 3 }} />{playing.duration_mins} min</span>
                  <span>{playing.view_count?.toLocaleString()} views</span>
                </div>
              </div>
              <button onClick={() => setPlaying(null)} className="ghost-btn" style={{ color: '#8a999c', borderColor: '#2e4047' }}>Close</button>
            </div>
            {playing.description && <p style={{ margin: '10px 0 0', color: '#8a999c', fontSize: '0.88rem', lineHeight: 1.5 }}>{playing.description}</p>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a999c' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos…" style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px 0 34px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', 'Pharmacology', 'NGN Case Studies', 'Test Strategy', 'Medical-Surgical', 'Mental Health'].map((t) => (
            <button key={t} onClick={() => setTopic(t)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, border: `1.5px solid ${topic === t ? '#29b7a3' : '#dbe6e4'}`, background: topic === t ? '#e9f6f4' : '#fff', color: topic === t ? '#135f55' : '#607478', cursor: 'pointer' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Video grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map((v) => {
          const color = TOPIC_COLORS[v.topic] ?? '#607478';
          return (
            <div key={v.id} className="video-card" onClick={() => openVideo(v)}>
              {/* Thumbnail placeholder */}
              <div style={{ position: 'relative', background: `linear-gradient(135deg, ${color}33, ${color}11)`, height: 160, display: 'grid', placeItems: 'center', borderRadius: '12px 12px 0 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, display: 'grid', placeItems: 'center', boxShadow: `0 4px 16px ${color}55` }}>
                  <Play size={22} color="#fff" style={{ marginLeft: 2 }} />
                </div>
                {v.is_premium && (
                  <div style={{ position: 'absolute', top: 10, right: 10, padding: '3px 10px', background: '#e3a72f', color: '#fff', borderRadius: 12, fontSize: '0.72rem', fontWeight: 800, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Star size={10} /> PRO
                  </div>
                )}
                {v.is_premium && !session && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', borderRadius: '12px 12px 0 0', display: 'grid', placeItems: 'center' }}>
                    <Lock size={28} color="#fff" />
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color, marginBottom: 4 }}>{v.topic}</div>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.92rem', lineHeight: 1.35 }}>{v.title}</h4>
                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#607478', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.description}</p>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: '#8a999c' }}>
                  <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}><Clock size={12} />{v.duration_mins} min</span>
                  <span>{v.view_count?.toLocaleString()} views</span>
                </div>
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 48, color: '#607478' }}>
            <Film size={36} color="#dbe6e4" style={{ margin: '0 auto 12px' }} />
            <p>No videos match your search.</p>
          </div>
        )}
      </div>
    </section>
  );
}
