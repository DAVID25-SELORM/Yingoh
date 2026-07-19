import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileBadge,
  GraduationCap,
  Medal,
  Printer,
  QrCode,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import { supabase } from '../services/supabase';

const ACHIEVEMENT_BADGES = [
  { type: 'readiness', label: 'NCLEX Readiness', color: '#29b7a3', icon: Trophy, desc: 'Pass probability reaches 85% or higher.', target: '85% readiness' },
  { type: 'completion', label: 'Question Bank Champion', color: '#2b8a7d', icon: BookOpenCheck, desc: 'Complete 500 or more practice questions.', target: '500 questions' },
  { type: 'streak', label: '30-Day Study Streak', color: '#e3a72f', icon: Sparkles, desc: 'Study consistently for 30 days in a row.', target: '30 days' },
  { type: 'attendance', label: 'Live Session Attendance', color: '#c17f44', icon: CalendarCheck, desc: 'Attend 5 or more live instructor-led sessions.', target: '5 sessions' },
  { type: 'perfect_quiz', label: 'Perfect Quiz', color: '#6d5dfc', icon: Star, desc: 'Score 100% on a timed or practice quiz.', target: '100% score' },
  { type: 'clinical_excellence', label: 'Clinical Excellence', color: '#ef5b52', icon: ShieldCheck, desc: 'Demonstrate strong clinical judgment across NGN cases.', target: 'NGN mastery' },
];

const DEMO_CERTS = [
  {
    id: 'demo-1',
    type: 'academic',
    title: 'NCLEX Bootcamp Completion',
    course_name: 'NCLEX-RN Intensive Bootcamp',
    instructor_name: 'NurseFaculty Instructor',
    institution_name: 'NurseFaculty',
    credit_hours: 24,
    grade: 'Pass',
    issued_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    expires_at: null,
    verification_code: 'NF-BOOT-24A9',
    status: 'active',
    metadata: { category: 'Academic Certificate', completion_date: new Date(Date.now() - 86400000 * 8).toISOString() },
  },
  {
    id: 'demo-2',
    type: 'professional',
    title: 'Medication Safety Certificate',
    course_name: 'Medication Safety for NCLEX Practice',
    instructor_name: 'NurseFaculty Clinical Team',
    institution_name: 'NurseFaculty',
    credit_hours: 8,
    grade: 'A',
    issued_at: new Date(Date.now() - 86400000 * 18).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 330).toISOString(),
    verification_code: 'NF-MEDS-81F2',
    status: 'active',
    metadata: { category: 'Professional Certificate', completion_date: new Date(Date.now() - 86400000 * 18).toISOString() },
  },
];

const DEMO_BADGES = [
  { id: 'b1', type: 'completion', title: 'Question Bank Champion', issued_at: new Date(Date.now() - 86400000 * 5).toISOString(), verification_code: 'NF-BADGE-A3F2', metadata: { questions_completed: 520 } },
  { id: 'b2', type: 'streak', title: '30-Day Study Streak', issued_at: new Date(Date.now() - 86400000 * 10).toISOString(), verification_code: 'NF-BADGE-9K12', metadata: { streak_days: 30 } },
];

const CATEGORY_STYLES = {
  academic: { label: 'Academic', color: '#2367ff', icon: GraduationCap },
  professional: { label: 'Professional', color: '#8a35ff', icon: ShieldCheck },
  attendance: { label: 'Attendance', color: '#e89d23', icon: CalendarCheck },
  achievement: { label: 'Achievement', color: '#29b7a3', icon: Medal },
  completion: { label: 'Achievement', color: '#2b8a7d', icon: Trophy },
  readiness: { label: 'Achievement', color: '#29b7a3', icon: Trophy },
  streak: { label: 'Achievement', color: '#e3a72f', icon: Sparkles },
};

const AVAILABLE_CERTIFICATES = [
  { title: 'Course Completion Certificate', category: 'Academic', criteria: 'Complete all course modules and pass the final assessment.' },
  { title: 'NCLEX Bootcamp Certificate', category: 'Academic', criteria: 'Complete bootcamp lessons, readiness exam, and instructor review.' },
  { title: 'Medication Safety Certificate', category: 'Professional', criteria: 'Score at least 80% in medication safety assessment.' },
  { title: 'Infection Prevention Training', category: 'Professional', criteria: 'Complete training and safety scenario review.' },
  { title: 'Live Webinar Attendance', category: 'Attendance', criteria: 'Attend eligible webinar and meet attendance threshold.' },
  { title: 'Clinical Judgment Workshop', category: 'Professional', criteria: 'Complete NGN case study workshop activities.' },
];

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCategory(cert) {
  return cert?.category || cert?.metadata?.category || cert?.type || 'academic';
}

function getStyle(cert) {
  const key = String(getCategory(cert)).toLowerCase().split(' ')[0];
  return CATEGORY_STYLES[key] || CATEGORY_STYLES.academic;
}

function CertificatePrint({ cert, userName }) {
  const style = getStyle(cert);
  const color = style.color;
  const verificationUrl = cert.verification_url || `${window.location.origin}/#/VerifyCertificate/${cert.verification_code}`;

  return (
    <div className="certificate-print">
      <div className="certificate-ornament certificate-ornament-tl" />
      <div className="certificate-ornament certificate-ornament-tr" />
      <div className="certificate-ornament certificate-ornament-bl" />
      <div className="certificate-ornament certificate-ornament-br" />

      <img src="/nursefaculty-mark.png" alt="NurseFaculty" className="certificate-print-logo" />
      <div className="certificate-kicker" style={{ color }}>{style.label} Certificate</div>
      <div className="certificate-institution">{cert.institution_name || 'NurseFaculty NCLEX Preparation'}</div>
      <div className="certificate-rule" style={{ background: color }} />

      <p>This certifies that</p>
      <h1>{userName || cert.student_name || 'NCLEX Student'}</h1>
      <p>has successfully completed</p>
      <h2 style={{ color }}>{cert.title || cert.course_name}</h2>

      <div className="certificate-print-meta">
        <span>Course: {cert.course_name || cert.title}</span>
        <span>Instructor: {cert.instructor_name || 'NurseFaculty Instructor'}</span>
        <span>Issue Date: {formatDate(cert.issued_at)}</span>
        <span>Credits: {cert.credit_hours ?? cert.metadata?.credit_hours ?? 'N/A'}</span>
        <span>Grade: {cert.grade || cert.metadata?.grade || 'Completed'}</span>
        <span>Expiry: {cert.expires_at ? formatDate(cert.expires_at) : 'No expiry'}</span>
      </div>

      <div className="certificate-verification-strip">
        <QrCode size={44} />
        <div>
          <strong>Verification ID: {cert.verification_code || cert.certificate_number}</strong>
          <small>{verificationUrl}</small>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className={`credential-stat credential-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyPanel({ title, text }) {
  return (
    <div className="credential-empty">
      <FileBadge size={42} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export default function CertificatesView({ session }) {
  const [certs, setCerts] = useState(supabase ? [] : DEMO_CERTS);
  const [badges, setBadges] = useState(supabase ? [] : DEMO_BADGES);
  const [activeTab, setActiveTab] = useState('certificates');
  const [preview, setPreview] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    supabase
      .from('user_certificates')
      .select('*')
      .eq('user_id', session.user.id)
      .order('issued_at', { ascending: false })
      .then(({ data }) => {
        if (!data?.length) return;
        const formal = data.filter((item) => ['academic', 'professional', 'attendance'].includes(String(item.category || item.type).toLowerCase()));
        const achievement = data.filter((item) => !['academic', 'professional', 'attendance'].includes(String(item.category || item.type).toLowerCase()));
        setCerts(formal);
        setBadges(achievement);
      });
  }, [session]);

  const userName = session?.user?.user_metadata?.full_name ?? session?.user?.email?.split('@')[0];
  const earnedBadges = badges;
  const missingBadges = ACHIEVEMENT_BADGES.filter((badge) => !earnedBadges.some((item) => item.type === badge.type));
  const transcriptRows = useMemo(() => certs.map((cert) => ({
    course: cert.course_name || cert.title,
    grade: cert.grade || cert.metadata?.grade || 'Completed',
    hours: cert.credit_hours ?? cert.metadata?.credit_hours ?? '—',
    status: cert.status === 'revoked' ? 'Revoked' : 'Completed',
    date: formatDate(cert.issued_at),
  })), [certs]);
  const expiringSoon = certs.filter((cert) => {
    if (!cert.expires_at) return false;
    const days = (new Date(cert.expires_at).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 45;
  }).length;

  function printCert() {
    window.print();
  }

  function exportTranscriptCsv() {
    const rows = [['Course', 'Grade', 'Hours', 'Status', 'Date'], ...transcriptRows.map((row) => [row.course, row.grade, row.hours, row.status, row.date])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nursefaculty-transcript.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const tabs = [
    { id: 'certificates', label: 'Certificates', icon: FileBadge },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'transcript', label: 'Transcript', icon: GraduationCap },
    { id: 'credentials', label: 'Digital Credentials', icon: QrCode },
  ];

  return (
    <section className="content-band credential-center">
      <div className="section-title">
        <div>
          <h2>Credentials Center</h2>
          <p>Formal certificates, achievement badges, transcripts, and verification records for your NurseFaculty learning.</p>
        </div>
        <Award size={22} />
      </div>

      <div className="credential-stats">
        <StatCard label="Earned" value={certs.length + earnedBadges.length} tone="earned" />
        <StatCard label="In Progress" value="3" tone="progress" />
        <StatCard label="Available" value={AVAILABLE_CERTIFICATES.length + missingBadges.length} tone="available" />
        <StatCard label="Expiring Soon" value={expiringSoon} tone="expiry" />
      </div>

      <div className="tab-bar credential-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'certificates' && (
        <div className="credential-section-grid">
          <div className="credential-main-panel">
            <h3>Academic & Professional Certificates</h3>
            {certs.length ? (
              <div className="credential-card-grid">
                {certs.map((cert) => {
                  const style = getStyle(cert);
                  const Icon = style.icon;
                  return (
                    <article key={cert.id} className="credential-card" style={{ borderTopColor: style.color }}>
                      <div className="credential-card-head">
                        <span style={{ color: style.color }}><Icon size={16} /> {style.label}</span>
                        <BadgeCheck size={18} color={style.color} />
                      </div>
                      <h4>{cert.title || cert.course_name}</h4>
                      <p>{cert.course_name || 'NurseFaculty learning credential'}</p>
                      <div className="credential-meta">
                        <span>Instructor: {cert.instructor_name || 'NurseFaculty'}</span>
                        <span>Issued: {formatDate(cert.issued_at)}</span>
                        <span>Credits: {cert.credit_hours ?? cert.metadata?.credit_hours ?? 'N/A'}</span>
                        <span>ID: {cert.verification_code || cert.certificate_number}</span>
                      </div>
                      <div className="credential-actions">
                        <button className="ghost-btn" onClick={() => setPreview(cert)}><ExternalLink size={13} /> View</button>
                        <button className="primary-btn" onClick={() => { setPreview(cert); setTimeout(printCert, 350); }}><Download size={13} /> PDF</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel title="No formal certificates yet" text="Complete eligible courses, workshops, or live sessions to receive verifiable certificates." />
            )}
          </div>

          <aside className="credential-side-panel">
            <h3>Available Certificates</h3>
            {AVAILABLE_CERTIFICATES.map((item) => (
              <div key={item.title} className="credential-available-row">
                <strong>{item.title}</strong>
                <span>{item.category}</span>
                <p>{item.criteria}</p>
              </div>
            ))}
          </aside>
        </div>
      )}

      {activeTab === 'achievements' && (
        <>
          <h3 className="credential-subtitle">Achievement Badges</h3>
          <div className="credential-card-grid">
            {[...earnedBadges, ...missingBadges.map((badge) => ({ ...badge, locked: true, title: badge.label }))].map((badge) => {
              const definition = ACHIEVEMENT_BADGES.find((item) => item.type === badge.type) || badge;
              const Icon = definition.icon || Medal;
              return (
                <article key={badge.id || badge.type} className={`achievement-card ${badge.locked ? 'achievement-locked' : ''}`} style={{ borderTopColor: definition.color }}>
                  <Icon size={30} color={definition.color} />
                  <h4>{badge.title || definition.label}</h4>
                  <p>{definition.desc}</p>
                  <span>{badge.locked ? `Target: ${definition.target}` : `Earned ${formatDate(badge.issued_at)}`}</span>
                </article>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'transcript' && (
        <div className="credential-main-panel">
          <div className="credential-panel-head">
            <h3>Student Transcript</h3>
            <div>
              <button className="ghost-btn" onClick={exportTranscriptCsv}><Download size={14} /> CSV</button>
              <button className="ghost-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            </div>
          </div>
          {transcriptRows.length ? (
            <div className="transcript-table-wrap">
              <table className="transcript-table">
                <thead><tr><th>Course</th><th>Grade</th><th>Hours</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>{transcriptRows.map((row) => <tr key={`${row.course}-${row.date}`}><td>{row.course}</td><td>{row.grade}</td><td>{row.hours}</td><td>{row.status}</td><td>{row.date}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <EmptyPanel title="Transcript will appear here" text="Your completed courses, grades, hours, and certificate outcomes will be grouped into one exportable transcript." />
          )}
        </div>
      )}

      {activeTab === 'credentials' && (
        <div className="credential-section-grid">
          <div className="credential-main-panel">
            <h3>Digital Credential Verification</h3>
            <div className="verification-preview">
              <SearchCheck size={42} />
              <h4>Certificate Verified</h4>
              <p>Employers, schools, and regulators can verify certificates using a public certificate ID or QR code.</p>
              <div>
                <span>Student</span><strong>{userName || 'Jane Doe'}</strong>
                <span>Issued by</span><strong>NurseFaculty</strong>
                <span>Status</span><strong>Verified</strong>
              </div>
            </div>
          </div>
          <aside className="credential-side-panel">
            <h3>Credential Standards</h3>
            <ul className="credential-checklist">
              <li><CheckCircle2 size={15} /> Certificate ID</li>
              <li><CheckCircle2 size={15} /> Verification URL</li>
              <li><CheckCircle2 size={15} /> QR-ready metadata</li>
              <li><CheckCircle2 size={15} /> Institution branding</li>
              <li><CheckCircle2 size={15} /> Revocation status</li>
              <li><CheckCircle2 size={15} /> Expiry tracking</li>
            </ul>
          </aside>
        </div>
      )}

      {preview && (
        <div className="modal-backdrop">
          <div className="certificate-modal">
            <div className="certificate-modal-head">
              <button className="ghost-btn" onClick={() => { setPreview(null); setTimeout(printCert, 300); }}><Download size={15} /> Print / Save PDF</button>
              <button className="icon-btn" onClick={() => setPreview(null)}>×</button>
            </div>
            <div id="cert-print-area" ref={printRef}>
              <CertificatePrint cert={preview} userName={userName} />
            </div>
          </div>
        </div>
      )}

      <style>{`@media print { body * { visibility: hidden; } #cert-print-area, #cert-print-area * { visibility: visible; } #cert-print-area { position: fixed; inset: 0; width: 100%; } }`}</style>
    </section>
  );
}
