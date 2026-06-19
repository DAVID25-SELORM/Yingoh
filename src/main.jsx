import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileBadge,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  MonitorPlay,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Users,
  Video,
} from 'lucide-react';
import dashboardImage from './assets/nclex-dashboard.png';
import './styles.css';

const modules = [
  { name: 'User Accounts & Identity', phase: 'MVP', priority: 'High', icon: ShieldCheck, summary: 'Email, Google, Apple login, profile editing, 2FA, password reset, and device limits.' },
  { name: 'Student Dashboard', phase: 'MVP', priority: 'High', icon: LayoutDashboard, summary: 'Progress, exam countdown, daily goals, weak area alerts, recommendations, streaks, and activity.' },
  { name: 'NCLEX Question Bank', phase: 'MVP', priority: 'High', icon: ClipboardCheck, summary: 'NGN case studies, bow tie, matrix, cloze, SATA, drag and drop, ordered response, media questions.' },
  { name: 'Payments', phase: 'MVP', priority: 'High', icon: CreditCard, summary: 'Free plan, subscriptions, promo codes, referrals, Mobile Money, cards, Stripe, PayPal, and receipts.' },
  { name: 'Admin & Instructor Tools', phase: 'MVP', priority: 'High', icon: Users, summary: 'User management, uploads, exam creation, analytics, subscriptions, announcements, grading, and messages.' },
  { name: 'Virtual Classroom', phase: 'Growth', priority: 'Medium', icon: Video, summary: 'HD video, screen share, whiteboard, chat, raise hand, polls, breakout rooms, waiting room, attendance, recordings.' },
  { name: 'Video Learning', phase: 'Growth', priority: 'Medium', icon: MonitorPlay, summary: 'Recorded lectures, playlists, offline premium downloads, playback speed, picture-in-picture, resume position.' },
  { name: 'Practice & Exam Modes', phase: 'Growth', priority: 'Medium', icon: Target, summary: 'Practice, tutor mode, timed exams, CAT simulator, custom quiz builder, readiness exams, daily quiz, weekly challenge.' },
  { name: 'Rationales & Review', phase: 'Growth', priority: 'Medium', icon: BookOpen, summary: 'Answer explanations, nursing tips, references, bookmarks, personal notes, and error reports.' },
  { name: 'Analytics', phase: 'Growth', priority: 'Medium', icon: BarChart3, summary: 'Overall score, topic performance, NGN readiness, pass probability, reports, at-risk student detection.' },
  { name: 'AI Learning Assistant', phase: 'Growth', priority: 'Medium', icon: Brain, summary: 'AI tutor, rationale explainer, quiz generator, study planner, weak area detector, lesson summarizer.' },
  { name: 'Flashcards & Pharmacology', phase: 'Growth', priority: 'Medium', icon: Stethoscope, summary: 'Drug cards, disease cards, lab values, spaced repetition, MOA, side effects, contraindications.' },
  { name: 'Resources', phase: 'Growth', priority: 'Medium', icon: BookOpen, summary: 'Notes, care plans, concept maps, ECG, ABG, isolation precautions, drug handbook, worksheets.' },
  { name: 'Community', phase: 'Growth', priority: 'Medium', icon: MessageSquareText, summary: 'Discussion forum, study groups, ask instructors, comments, announcements, mentor groups, success stories.' },
  { name: 'Assignments', phase: 'Growth', priority: 'Medium', icon: ClipboardCheck, summary: 'Homework, quiz submissions, uploads, instructor grading, feedback, and deadlines.' },
  { name: 'Certificates', phase: 'Growth', priority: 'Medium', icon: FileBadge, summary: 'Completion, attendance, and readiness exam certificates with verification codes.' },
  { name: 'Professional Add-ons', phase: 'Expansion', priority: 'Medium', icon: GraduationCap, summary: 'Sponsor portal, career center, USRN checklist, visa prep, resume builder, job board, CPD and OSCE.' },
  { name: 'Security', phase: 'Expansion', priority: 'Medium', icon: LockKeyhole, summary: 'Encrypted data, role access, audit logs, backups, screenshot controls, suspicious activity tracking.' },
  { name: 'Scalability', phase: 'Expansion', priority: 'Medium', icon: Activity, summary: 'Web, Android, iOS, cloud database, push notifications, offline capability, AI integration.' },
];

const roles = [
  { name: 'Student', scope: 'Learn, practice, attend classes, download allowed materials, view results and certificates.' },
  { name: 'Instructor', scope: 'Schedule classes, upload lessons, create quizzes, mark attendance, grade, and view class analytics.' },
  { name: 'Admin', scope: 'Manage users, courses, payments, announcements, support tickets, reports, and subscriptions.' },
  { name: 'Sponsor/Parent', scope: 'Pay fees, view attendance, track high-level progress, and download receipts.' },
  { name: 'Finance Officer', scope: 'View payments, invoices, receipts, refunds, promo code performance, and reconciliation.' },
  { name: 'Content Reviewer', scope: 'Review questions, rationales, references, and reported errors before publishing.' },
];

const topics = [
  { label: 'Pharmacology', score: 68, status: 'Priority area' },
  { label: 'Safety and Infection Control', score: 82, status: 'On track' },
  { label: 'Maternal and Newborn', score: 74, status: 'Building' },
  { label: 'NGN Case Studies', score: 61, status: 'Coaching focus' },
];

const questionTypes = ['SATA', 'Bow Tie', 'Matrix', 'Cloze', 'Ordered Response', 'Highlight Text'];

function Metric({ label, value, detail, tone = 'teal' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="progress-track" aria-label={`${value}%`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function ModuleCard({ module }) {
  const Icon = module.icon;
  return (
    <article className="module-card">
      <div className="module-card-head">
        <Icon size={20} />
        <span className={`phase phase-${module.phase.toLowerCase()}`}>{module.phase}</span>
      </div>
      <h3>{module.name}</h3>
      <p>{module.summary}</p>
      <div className="module-meta">
        <span>{module.priority} priority</span>
        <ChevronRight size={18} />
      </div>
    </article>
  );
}

function StudentDashboard() {
  return (
    <section className="view-grid">
      <div className="hero-panel">
        <img src={dashboardImage} alt="Nursing students preparing for NCLEX" />
        <div className="hero-copy">
          <span className="eyebrow">Yingoh NCLEX Coaching Platform</span>
          <h1>Adaptive NCLEX prep, live coaching, and progress intelligence in one workspace.</h1>
          <p>Personalized study plans, clinical reasoning practice, instructor-led sessions, and readiness tracking for NCLEX candidates.</p>
          <div className="hero-actions">
            <button className="primary-btn"><PlayCircle size={18} /> Start learning</button>
            <button className="icon-btn" aria-label="Notifications"><Bell size={19} /></button>
          </div>
        </div>
      </div>

      <div className="metrics-row">
        <Metric label="Readiness" value="Adaptive" detail="Performance-based study guidance" />
        <Metric label="Daily goal" value="Flexible" detail="Question targets by study plan" tone="coral" />
        <Metric label="Progress" value="Tracked" detail="Topic mastery and activity history" tone="gold" />
        <Metric label="Exam plan" value="Scheduled" detail="Countdowns and readiness milestones" tone="violet" />
      </div>

      <div className="split-layout">
        <section className="surface">
          <div className="section-title">
            <h2>Weak Area Planner</h2>
            <Sparkles size={20} />
          </div>
          {topics.map((topic) => (
            <div className="topic-row" key={topic.label}>
              <div>
                <strong>{topic.label}</strong>
                <span>{topic.status}</span>
              </div>
              <ProgressBar value={topic.score} />
              <b>{topic.score}%</b>
            </div>
          ))}
        </section>

        <section className="surface schedule">
          <div className="section-title">
            <h2>Live Coaching</h2>
            <CalendarDays size={20} />
          </div>
          <div className="class-item active">
            <span>Live session</span>
            <strong>NGN Case Study Review</strong>
            <small>Instructor-led review with attendance tracking</small>
          </div>
          <div className="class-item">
            <span>Strategy lab</span>
            <strong>CAT Strategy Lab</strong>
            <small>Recording, polls, and breakout rooms supported</small>
          </div>
        </section>
      </div>
    </section>
  );
}

function QuestionBank() {
  return (
    <section className="content-band">
      <div className="section-title">
        <h2>NCLEX/NGN Question Bank</h2>
        <ClipboardCheck size={22} />
      </div>
      <div className="question-workbench">
        <div className="case-panel">
          <span className="eyebrow">NGN Case Study</span>
          <h3>Priority nursing action after a medication reaction</h3>
          <p>A learner reviews symptoms, vitals, medication history, and lab values before selecting linked actions.</p>
          <div className="chips">
            {questionTypes.map((type) => <span key={type}>{type}</span>)}
          </div>
        </div>
        <div className="answer-panel">
          <div className="answer-row selected"><CheckCircle2 size={18} /> Stop infusion and assess airway</div>
          <div className="answer-row"><CheckCircle2 size={18} /> Notify provider after stabilization</div>
          <div className="answer-row muted"><CheckCircle2 size={18} /> Document findings in chart</div>
          <div className="rationale">
            <strong>Rationale engine</strong>
            <p>Shows why each response is safe or unsafe, links nursing tips, and flags topics for spaced review.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminConsole() {
  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Admin, Instructor, Finance</h2>
        <ShieldCheck size={22} />
      </div>
      <div className="admin-grid">
        {roles.map((role) => (
          <article className="role-card" key={role.name}>
            <strong>{role.name}</strong>
            <p>{role.scope}</p>
            <span>RBAC + audit log enabled</span>
          </article>
        ))}
      </div>
      <div className="reports-row">
        <Metric label="Subscriptions" value="Ready" detail="Plans, receipts, and reconciliation" />
        <Metric label="Attendance" value="Tracked" detail="Live class participation records" tone="coral" />
        <Metric label="Intervention" value="Flagged" detail="Students needing coaching support" tone="violet" />
      </div>
    </section>
  );
}

function ModuleRoadmap() {
  const grouped = useMemo(() => ({
    MVP: modules.filter((module) => module.phase === 'MVP'),
    Growth: modules.filter((module) => module.phase === 'Growth'),
    Expansion: modules.filter((module) => module.phase === 'Expansion'),
  }), []);

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Feature Roadmap From Pack</h2>
        <BookOpen size={22} />
      </div>
      {Object.entries(grouped).map(([phase, items]) => (
        <div className="phase-block" key={phase}>
          <h3>{phase}</h3>
          <div className="module-grid">
            {items.map((module) => <ModuleCard key={module.name} module={module} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

function App() {
  const [activeView, setActiveView] = useState('Student');
  const nav = [
    { label: 'Student', icon: LayoutDashboard },
    { label: 'Questions', icon: ClipboardCheck },
    { label: 'Operations', icon: Users },
    { label: 'Roadmap', icon: BookOpen },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span><Stethoscope size={24} /></span>
          <div>
            <strong>Yingoh</strong>
            <small>NCLEX Coaching</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={activeView === item.label ? 'nav-active' : ''}
                onClick={() => setActiveView(item.label)}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-card">
          <span className="eyebrow">Platform Status</span>
          <strong>Launch-ready interface</strong>
          <p>Auth, dashboard, payments, question bank, and admin workflows are organized for implementation handoff.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Professional Learning Suite</span>
            <h2>{activeView}</h2>
          </div>
          <div className="topbar-actions">
            <button className="ghost-btn"><Brain size={18} /> AI planner</button>
            <button className="primary-btn"><CreditCard size={18} /> Subscribe</button>
          </div>
        </header>

        {activeView === 'Student' && <StudentDashboard />}
        {activeView === 'Questions' && <QuestionBank />}
        {activeView === 'Operations' && <AdminConsole />}
        {activeView === 'Roadmap' && <ModuleRoadmap />}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
