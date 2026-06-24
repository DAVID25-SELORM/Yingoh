import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, BarChart3, BookOpen, Brain, CalendarDays, CheckCircle2,
  ClipboardCheck, CreditCard, FileBadge, GraduationCap, LayoutDashboard,
  LockKeyhole, MessageSquareText, MonitorPlay, ShieldCheck, Sparkles,
  Stethoscope, Target, Users, Video, ChevronRight, Bell, CreditCard as PayIcon,
} from 'lucide-react';
import {
  checkTableAvailability, getCurrentSession, onAuthStateChange,
  isConfiguredSuperAdmin, signInWithEmail, signOut, signUpWithEmail, supabaseConfig, yingohTables,
} from './services/supabase';
import StudentDashboard from './components/StudentDashboard';
import QuestionBankView from './components/QuestionBankView';
import ExamModeView from './components/ExamModeView';
import FlashcardsView from './components/FlashcardsView';
import StudyPlannerView from './components/StudyPlannerView';
import NotebookView from './components/NotebookView';
import AnalyticsView from './components/AnalyticsView';
import './styles.css';

// ─── Existing inline views kept for continuity ─────────────

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

function ModuleRoadmap() {
  const grouped = useMemo(() => ({
    MVP: modules.filter((m) => m.phase === 'MVP'),
    Growth: modules.filter((m) => m.phase === 'Growth'),
    Expansion: modules.filter((m) => m.phase === 'Expansion'),
  }), []);
  return (
    <section className="content-band">
      <div className="section-title"><h2>Feature Roadmap</h2><BookOpen size={22} /></div>
      {Object.entries(grouped).map(([phase, items]) => (
        <div className="phase-block" key={phase}>
          <h3>{phase}</h3>
          <div className="module-grid">{items.map((m) => <ModuleCard key={m.name} module={m} />)}</div>
        </div>
      ))}
    </section>
  );
}

function AdminConsole() {
  const requiredTables = Object.values(yingohTables);
  const [tableHealth, setTableHealth] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsChecking(true);
    checkTableAvailability(requiredTables).then((health) => {
      if (mounted) { setTableHealth(health); setIsChecking(false); }
    });
    return () => { mounted = false; };
  }, []);

  return (
    <section className="content-band">
      <div className="section-title"><h2>Admin, Instructor, Finance</h2><ShieldCheck size={22} /></div>
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
        <div className="metric"><span>Subscriptions</span><strong>Ready</strong><small>Plans, receipts, and reconciliation</small></div>
        <div className="metric metric-coral"><span>Attendance</span><strong>Tracked</strong><small>Live class participation records</small></div>
        <div className="metric metric-violet"><span>Intervention</span><strong>Flagged</strong><small>Students needing coaching support</small></div>
      </div>
      <div className="surface">
        <span className="eyebrow">Super Admin</span>
        <h3>{supabaseConfig.superAdminEmail}</h3>
        <p>This email is configured as the bootstrap owner for admin access in Supabase and the deployed app environment.</p>
      </div>
      <div className="integration-panel">
        <div>
          <span className="eyebrow">Supabase Backend</span>
          <h3>{supabaseConfig.isConfigured ? 'Connected for runtime use' : 'Awaiting environment key'}</h3>
          <p>{supabaseConfig.isConfigured
            ? 'The app can create a Supabase client from the deployed environment.'
            : 'Add VITE_SUPABASE_ANON_KEY in your environment to activate auth, database, and subscription workflows.'}
          </p>
        </div>
        <div className="env-list">
          <span className={supabaseConfig.hasUrl ? 'status-ok' : 'status-missing'}>
            <CheckCircle2 size={16} /> VITE_SUPABASE_URL
          </span>
          <span className={supabaseConfig.hasAnonKey ? 'status-ok' : 'status-missing'}>
            <CheckCircle2 size={16} /> VITE_SUPABASE_ANON_KEY
          </span>
        </div>
        <div className="table-list" aria-label="Supabase tables">
          {(tableHealth.length
            ? tableHealth
            : requiredTables.map((name) => ({ name, status: 'checking', detail: 'Checking' }))
          ).map((table) => (
            <span className={`table-${table.status}`} title={table.detail} key={table.name}>{table.name}</span>
          ))}
        </div>
        <p className="table-health-note">
          {isChecking ? 'Checking database tables…' : 'Table chips update from the live Supabase API.'}
        </p>
      </div>
    </section>
  );
}

function AccountAccess({ session }) {
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userEmail = session?.user?.email;
  const isSuperAdmin = isConfiguredSuperAdmin(userEmail);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    const action = mode === 'signup'
      ? signUpWithEmail({ email, password, fullName })
      : signInWithEmail(email, password);
    const { error } = await action;
    if (error) setMessage(error.message);
    else if (mode === 'signup') setMessage('Account created. Check your inbox if email verification is enabled.');
    else setMessage('Signed in successfully.');
    setIsSubmitting(false);
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    const { error } = await signOut();
    setMessage(error ? error.message : 'Signed out.');
    setIsSubmitting(false);
  }

  return (
    <section className="content-band">
      <div className="section-title"><h2>Account Access</h2><LockKeyhole size={22} /></div>
      <div className="account-layout">
        <div className="account-panel">
          <span className="eyebrow">Supabase Auth</span>
          <h3>{userEmail ? 'Session active' : mode === 'signup' ? 'Create account' : 'Sign in to Yingoh'}</h3>
          <p>{userEmail
            ? 'The current browser has an active Supabase session.'
            : 'Email and password access for students, instructors, finance, and administrators.'}
          </p>
          {!supabaseConfig.isConfigured && (
            <div className="setup-alert">Add <strong>VITE_SUPABASE_ANON_KEY</strong> before live authentication can run.</div>
          )}
          {userEmail ? (
            <div className="session-card">
              <span>Signed in as</span>
              <strong>{userEmail}</strong>
              {isSuperAdmin && <small>Super admin access configured</small>}
              <button className="ghost-btn" onClick={handleSignOut} disabled={isSubmitting}>Sign out</button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="segmented-control">
                <button type="button" className={mode === 'signin' ? 'segment-active' : ''} onClick={() => setMode('signin')}>Sign in</button>
                <button type="button" className={mode === 'signup' ? 'segment-active' : ''} onClick={() => setMode('signup')}>Sign up</button>
              </div>
              {mode === 'signup' && (
                <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
              )}
              <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label>Password<input type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
              <button className="primary-btn" type="submit" disabled={!supabaseConfig.isConfigured || isSubmitting}>
                {isSubmitting ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          )}
          {message && <p className="form-message">{message}</p>}
        </div>
        <div className="account-checklist">
          {[
            'Email/password authentication wired to Supabase',
            'Session persistence and automatic refresh enabled',
            'Profile creation via database trigger',
            `Super admin bootstrap: ${supabaseConfig.superAdminEmail}`,
            'Role tables: student, instructor, admin, finance, content reviewer, super admin',
            'Question bookmarks, flashcard progress, exam sessions — all user-scoped',
            'Notebook and study plan saved per user account',
          ].map((item) => (
            <div key={item}><CheckCircle2 size={18} /><span>{item}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Navigation config ─────────────────────────────────────
const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, group: 'learn' },
  { label: 'Questions', icon: ClipboardCheck, group: 'learn' },
  { label: 'Exam', icon: Target, group: 'learn' },
  { label: 'Flashcards', icon: Brain, group: 'learn' },
  { label: 'Planner', icon: CalendarDays, group: 'learn' },
  { label: 'Notebook', icon: Sparkles, group: 'learn' },
  { label: 'Analytics', icon: BarChart3, group: 'learn' },
  { label: 'Account', icon: LockKeyhole, group: 'manage' },
  { label: 'Operations', icon: Users, group: 'manage' },
  { label: 'Roadmap', icon: BookOpen, group: 'manage' },
];

function App() {
  const [activeView, setActiveView] = useState('Dashboard');
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    getCurrentSession().then(({ data }) => { if (mounted) setSession(data.session); });
    const { data } = onAuthStateChange((_e, s) => setSession(s));
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  const learnNav = NAV.filter((n) => n.group === 'learn');
  const manageNav = NAV.filter((n) => n.group === 'manage');

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span><Stethoscope size={24} /></span>
          <div><strong>Yingoh</strong><small>NCLEX Coaching</small></div>
        </div>

        <nav>
          <div className="nav-group-label">STUDY</div>
          {learnNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={activeView === label ? 'nav-active' : ''}
              onClick={() => setActiveView(label)}
            >
              <Icon size={18} />{label}
            </button>
          ))}
          <div className="nav-group-label" style={{ marginTop: 8 }}>MANAGE</div>
          {manageNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={activeView === label ? 'nav-active' : ''}
              onClick={() => setActiveView(label)}
            >
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">Platform Status</span>
          <strong>Full-featured build</strong>
          <p>Question bank, CAT exam, spaced-repetition flashcards, study planner, digital notebook, and analytics are live.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Yingoh NCLEX Coaching</span>
            <h2>{activeView}</h2>
          </div>
          <div className="topbar-actions">
            <button className="ghost-btn" onClick={() => setActiveView('Analytics')}>
              <BarChart3 size={18} /> Analytics
            </button>
            <button className="ghost-btn" onClick={() => setActiveView('Planner')}>
              <CalendarDays size={18} /> Planner
            </button>
            <button className="primary-btn" onClick={() => setActiveView('Account')}>
              <LockKeyhole size={18} /> {session ? session.user.email?.split('@')[0] : 'Sign in'}
            </button>
          </div>
        </header>

        {activeView === 'Dashboard' && <StudentDashboard session={session} onNavigate={setActiveView} />}
        {activeView === 'Questions' && <QuestionBankView session={session} />}
        {activeView === 'Exam' && <ExamModeView session={session} />}
        {activeView === 'Flashcards' && <FlashcardsView session={session} />}
        {activeView === 'Planner' && <StudyPlannerView session={session} />}
        {activeView === 'Notebook' && <NotebookView session={session} />}
        {activeView === 'Analytics' && <AnalyticsView session={session} />}
        {activeView === 'Account' && <AccountAccess session={session} />}
        {activeView === 'Operations' && <AdminConsole />}
        {activeView === 'Roadmap' && <ModuleRoadmap />}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
