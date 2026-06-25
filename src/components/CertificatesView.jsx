import React, { useEffect, useRef, useState } from 'react';
import { Award, CheckCircle2, Download, ExternalLink, Star } from 'lucide-react';
import { supabase } from '../services/supabase';

const CERT_TYPES = [
  { type: 'readiness', label: 'NCLEX Readiness', color: '#29b7a3', icon: '🎯', desc: 'Awarded when your pass probability reaches 85% or higher.' },
  { type: 'completion', label: 'Question Bank Champion', color: '#2b8a7d', icon: '📚', desc: 'Complete 500 or more practice questions.' },
  { type: 'streak', label: '30-Day Study Streak', color: '#e3a72f', icon: '🔥', desc: 'Study consistently for 30 days in a row.' },
  { type: 'attendance', label: 'Live Session Attendance', color: '#c17f44', icon: '🎓', desc: 'Attend 5 or more live instructor-led sessions.' },
];

const DEMO_CERTS = [
  { id: 'c1', type: 'completion', title: 'Question Bank Champion', issued_at: new Date(Date.now() - 86400000 * 5).toISOString(), verification_code: 'YNG-A3F2B8', metadata: { questions_completed: 520 } },
  { id: 'c2', type: 'streak', title: '30-Day Study Streak', issued_at: new Date(Date.now() - 86400000 * 10).toISOString(), verification_code: 'YNG-9K12CD', metadata: { streak_days: 30 } },
];

const CERT_COLORS = Object.fromEntries(CERT_TYPES.map((c) => [c.type, c.color]));
const CERT_ICONS = Object.fromEntries(CERT_TYPES.map((c) => [c.type, c.icon]));

function CertificatePrint({ cert, userName }) {
  const color = CERT_COLORS[cert.type] ?? '#29b7a3';
  const issued = new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="certificate-print" style={{ background: '#fff', border: `6px solid ${color}`, borderRadius: 16, padding: '48px 56px', maxWidth: 680, margin: '0 auto', textAlign: 'center', fontFamily: 'Georgia, serif', position: 'relative' }}>
      {/* Corner ornaments */}
      <div style={{ position: 'absolute', top: 12, left: 12, width: 40, height: 40, border: `3px solid ${color}44`, borderRadius: 4 }} />
      <div style={{ position: 'absolute', top: 12, right: 12, width: 40, height: 40, border: `3px solid ${color}44`, borderRadius: 4 }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, width: 40, height: 40, border: `3px solid ${color}44`, borderRadius: 4 }} />
      <div style={{ position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, border: `3px solid ${color}44`, borderRadius: 4 }} />

      <img src="/yingoh-mark.svg" alt="Yingoh" style={{ width: 78, height: 78, objectFit: 'contain', marginBottom: 10 }} />
      <div style={{ fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: color, fontWeight: 700, marginBottom: 6 }}>Certificate of Achievement</div>
      <div style={{ fontSize: '0.8rem', color: '#8a999c', marginBottom: 20 }}>Yingoh NCLEX Coaching Platform</div>
      <div style={{ width: 60, height: 2, background: color, margin: '0 auto 24px' }} />
      <div style={{ fontSize: '0.9rem', color: '#607478', marginBottom: 6 }}>This certifies that</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#17212f', marginBottom: 6 }}>{userName || 'NCLEX Student'}</div>
      <div style={{ fontSize: '0.9rem', color: '#607478', marginBottom: 12 }}>has successfully earned</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, marginBottom: 20 }}>{cert.title}</div>

      {cert.metadata && Object.keys(cert.metadata).length > 0 && (
        <div style={{ padding: '10px 20px', background: color + '11', borderRadius: 8, marginBottom: 20, fontSize: '0.88rem', color: '#42585e' }}>
          {cert.metadata.questions_completed && `${cert.metadata.questions_completed.toLocaleString()} questions completed`}
          {cert.metadata.streak_days && `${cert.metadata.streak_days}-day study streak achieved`}
          {cert.metadata.sessions_attended && `${cert.metadata.sessions_attended} live sessions attended`}
        </div>
      )}

      <div style={{ width: 60, height: 2, background: color + '44', margin: '0 auto 20px' }} />
      <div style={{ fontSize: '0.82rem', color: '#8a999c' }}>Issued on {issued}</div>
      <div style={{ fontSize: '0.78rem', color: '#c0cece', marginTop: 8, letterSpacing: '0.08em' }}>Verification Code: {cert.verification_code}</div>
    </div>
  );
}

export default function CertificatesView({ session }) {
  const [certs, setCerts] = useState(DEMO_CERTS);
  const [preview, setPreview] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    supabase.from('user_certificates').select('*').eq('user_id', session.user.id).order('issued_at', { ascending: false }).then(({ data }) => {
      if (data?.length) setCerts(data);
    });
  }, [session]);

  const userName = session?.user?.user_metadata?.full_name ?? session?.user?.email?.split('@')[0];
  const earned = certs;
  const notEarned = CERT_TYPES.filter((ct) => !certs.some((c) => c.type === ct.type));

  function printCert() {
    window.print();
  }

  return (
    <section className="content-band">
      <div className="section-title"><h2>My Certificates</h2><Award size={22} /></div>

      {/* Earned */}
      {earned.length > 0 && (
        <>
          <h3 style={{ margin: '0 0 12px', color: '#2b8a7d', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earned Certificates ({earned.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 28 }}>
            {earned.map((cert) => {
              const color = CERT_COLORS[cert.type] ?? '#29b7a3';
              const icon = CERT_ICONS[cert.type] ?? '🏅';
              return (
                <div key={cert.id} className="cert-card" style={{ borderTop: `4px solid ${color}`, background: '#fff' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>{icon}</div>
                  <h4 style={{ margin: '0 0 6px', color }}>{cert.title}</h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <CheckCircle2 size={14} color={color} />
                    <span style={{ fontSize: '0.8rem', color: '#607478' }}>
                      Issued {new Date(cert.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ padding: '6px 10px', background: '#f7faf9', borderRadius: 6, fontSize: '0.76rem', color: '#8a999c', marginBottom: 12, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {cert.verification_code}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ghost-btn" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => setPreview(cert)}>
                      <ExternalLink size={13} /> View
                    </button>
                    <button className="primary-btn" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => { setPreview(cert); setTimeout(printCert, 400); }}>
                      <Download size={13} /> Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Not yet earned */}
      {notEarned.length > 0 && (
        <>
          <h3 style={{ margin: '0 0 12px', color: '#8a999c', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Certificates to Earn ({notEarned.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
            {notEarned.map((ct) => (
              <div key={ct.type} style={{ padding: '20px', borderRadius: 14, border: '2px dashed #dbe6e4', background: '#fafcfb', opacity: 0.8 }}>
                <div style={{ fontSize: '2rem', marginBottom: 8, filter: 'grayscale(1) opacity(0.4)' }}>{ct.icon}</div>
                <h4 style={{ margin: '0 0 6px', color: '#8a999c' }}>{ct.label}</h4>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#8a999c' }}>{ct.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {earned.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Star size={40} color="#dbe6e4" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ color: '#607478' }}>No certificates yet</h3>
          <p style={{ color: '#8a999c' }}>Complete milestones to earn your certificates. Start by answering 500 questions or maintaining a 30-day study streak!</p>
        </div>
      )}

      {/* Certificate preview modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'auto', maxHeight: '90vh', maxWidth: 740, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderBottom: '1px solid #e5eeec' }}>
              <button className="ghost-btn" onClick={() => { setPreview(null); setTimeout(printCert, 300); }}><Download size={15} /> Print / Save PDF</button>
              <button className="icon-btn" style={{ marginLeft: 8 }} onClick={() => setPreview(null)}>✕</button>
            </div>
            <div id="cert-print-area" ref={printRef} style={{ padding: 24 }}>
              <CertificatePrint cert={preview} userName={userName} />
            </div>
          </div>
        </div>
      )}

      <style>{`@media print { body * { visibility: hidden; } #cert-print-area, #cert-print-area * { visibility: visible; } #cert-print-area { position: fixed; top: 0; left: 0; width: 100%; } }`}</style>
    </section>
  );
}
