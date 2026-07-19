import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, BarChart3, BookOpen, Brain, CalendarDays, CheckCircle2,
  ClipboardCheck, CreditCard, FileBadge, GraduationCap, LayoutDashboard,
  LockKeyhole, MessageSquareText, MonitorPlay, ShieldCheck, Sparkles, BookmarkCheck,
  Stethoscope, Target, Users, Video, ChevronRight, Bell, Menu, X, CreditCard as PayIcon,
} from 'lucide-react';
import {
  checkTableAvailability, getCurrentSession, onAuthStateChange,
  isConfiguredSuperAdmin, resendEmailConfirmation, sendPasswordResetEmail, signInWithEmail, signOut,
  signUpWithEmail, supabaseConfig, updatePassword, nurseFacultyTables,
} from './services/supabase';
import StudentDashboard from './components/StudentDashboard';
import QuestionBankView from './components/QuestionBankView';
import ExamModeView from './components/ExamModeView';
import FlashcardsView from './components/FlashcardsView';
import StudyPlannerView from './components/StudyPlannerView';
import NotebookView from './components/NotebookView';
import AnalyticsView from './components/AnalyticsView';
import SuperAdminPanel from './components/SuperAdminPanel';
import QuestionManager from './components/QuestionManager';
import PaymentsView from './components/PaymentsView';
import InstructorTools from './components/InstructorTools';
import ContentReviewer from './components/ContentReviewer';
import AnnouncementsView from './components/AnnouncementsView';
import VirtualClassroom from './components/VirtualClassroom';
import UserManagement from './components/UserManagement';
import CourseJoinView from './components/CourseJoinView';
import CustomQuizBuilder from './components/CustomQuizBuilder';
import VideoLearning from './components/VideoLearning';
import CommunityForum from './components/CommunityForum';
import CertificatesView from './components/CertificatesView';
import NotificationsBell from './components/NotificationsBell';
import VideoManager from './components/VideoManager';
import StudyCoachView from './components/StudyCoachView';
import ResourcesView from './components/ResourcesView';
import ProfessionalAddons from './components/ProfessionalAddons';
import AssignmentsView from './components/AssignmentsView';
import AuditLogView from './components/AuditLogView';
import { SubscriptionGate } from './components/SubscriptionGate';
import SavedItemsView from './components/SavedItemsView';
import { useSubscription } from './hooks/useSubscription';
import './styles.css';

if (typeof window !== 'undefined' && window.location.hostname === 'yingoh.vercel.app') {
  window.location.replace(`https://nursefaculty.org${window.location.pathname}${window.location.search}${window.location.hash}`);
}

// â”€â”€â”€ Existing inline views kept for continuity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  { name: 'Study Coach', phase: 'Growth', priority: 'Medium', icon: Brain, summary: 'Rationale support, quiz generation, study planning, weak-area detection, and lesson summaries.' },
  { name: 'Flashcards & Pharmacology', phase: 'Growth', priority: 'Medium', icon: Stethoscope, summary: 'Drug cards, disease cards, lab values, spaced repetition, MOA, side effects, contraindications.' },
  { name: 'Resources', phase: 'Growth', priority: 'Medium', icon: BookOpen, summary: 'Notes, care plans, concept maps, ECG, ABG, isolation precautions, drug handbook, worksheets.' },
  { name: 'Community', phase: 'Growth', priority: 'Medium', icon: MessageSquareText, summary: 'Discussion forum, study groups, ask instructors, comments, announcements, mentor groups, success stories.' },
  { name: 'Assignments', phase: 'Growth', priority: 'Medium', icon: ClipboardCheck, summary: 'Homework, quiz submissions, uploads, instructor grading, feedback, and deadlines.' },
  { name: 'Certificates', phase: 'Growth', priority: 'Medium', icon: FileBadge, summary: 'Completion, attendance, and readiness exam certificates with verification codes.' },
  { name: 'Professional Add-ons', phase: 'Expansion', priority: 'Medium', icon: GraduationCap, summary: 'Sponsor portal, career center, USRN checklist, visa prep, resume builder, job board, and CPD tracking.' },
  { name: 'Security', phase: 'Expansion', priority: 'Medium', icon: LockKeyhole, summary: 'Encrypted data, role access, audit logs, backups, screenshot controls, suspicious activity tracking.' },
  { name: 'Scalability', phase: 'Expansion', priority: 'Medium', icon: Activity, summary: 'Web, Android, iOS, cloud database, push notifications, offline capability, and coaching services.' },
];

const roles = [
  { name: 'Student', scope: 'Learn, practice, attend classes, download allowed materials, view results and certificates.' },
  { name: 'Instructor', scope: 'Schedule classes, upload lessons, create quizzes, mark attendance, grade, and view class analytics.' },
  { name: 'Admin', scope: 'Manage users, courses, payments, announcements, support tickets, reports, and subscriptions.' },
  { name: 'Sponsor/Parent', scope: 'Pay fees, view attendance, track high-level progress, and download receipts.' },
  { name: 'Finance Officer', scope: 'View payments, invoices, receipts, refunds, promo code performance, and reconciliation.' },
  { name: 'Content Reviewer', scope: 'Review questions, rationales, references, and reported errors before publishing.' },
];

const developerSignature = {
  name: 'Neon Digital Technologies',
  email: 'neondigitaltechnologies@gmail.com',
};

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
  const requiredTables = Object.values(nurseFacultyTables);
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

function AccountAccess({ session, isPasswordRecovery }) {
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userEmail = session?.user?.email;
  const isSuperAdmin = isConfiguredSuperAdmin(userEmail);
  const isEmailVerified = Boolean(
    !userEmail || session?.user?.email_confirmed_at || session?.user?.confirmed_at,
  );

  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('updatePassword');
      setMessage('Enter a new password to finish resetting your account.');
    }
  }, [isPasswordRecovery]);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    if (mode === 'reset') {
      const { error } = await sendPasswordResetEmail(email);
      setMessage(error ? error.message : 'Password reset link sent. Check your inbox.');
    } else if (mode === 'updatePassword') {
      if (password !== confirmPassword) {
        setMessage('Passwords do not match.');
      } else {
        const { error } = await updatePassword(password);
        if (error) setMessage(error.message);
        else {
          setPassword('');
          setConfirmPassword('');
          setMode('signin');
          setMessage('Password updated. You can continue using your account.');
        }
      }
    } else {
      const action = mode === 'signup'
        ? signUpWithEmail({ email, password, fullName })
        : signInWithEmail(email, password);
      const { error } = await action;
      if (error) setMessage(error.message);
      else if (mode === 'signup') {
        setMode('signin');
        setPassword('');
        setMessage('Account created. Check your inbox and confirm your email before signing in.');
      }
      else setMessage('Signed in successfully.');
    }
    setIsSubmitting(false);
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    const { error } = await signOut();
    setMessage(error ? error.message : 'Signed out.');
    setIsSubmitting(false);
  }

  async function handleResendConfirmation() {
    if (!userEmail) return;
    setIsSubmitting(true);
    const { error } = await resendEmailConfirmation(userEmail);
    setMessage(error ? error.message : 'Verification email sent. Check your inbox.');
    setIsSubmitting(false);
  }

  const accountChecklist = [
    'Keep your question history, notes, and bookmarks together',
    'Track readiness and weak areas across every study session',
    'Continue your study plan securely from any device',
    'Reset your password at any time by email',
  ];

  return (
    <section className="content-band">
      <div className="section-title"><h2>Account Access</h2><LockKeyhole size={22} /></div>
      <div className="account-layout">
        <div className="account-panel">
          <span className="eyebrow">{userEmail ? 'Your account' : 'Welcome back'}</span>
          <h3>{userEmail ? 'Session active' : mode === 'signup' ? 'Create account' : 'Sign in to NurseFaculty'}</h3>
          <p>{userEmail
            ? 'Manage your NurseFaculty session and account security.'
            : 'Sign in to continue your personalized NCLEX preparation.'}
          </p>
          {userEmail ? (
            mode === 'updatePassword' ? (
              <form className="auth-form" onSubmit={handleSubmit}>
                <label>New password<input type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
                <label>Confirm password<input type="password" minLength="6" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>
                <button className="primary-btn" type="submit" disabled={!supabaseConfig.isConfigured || isSubmitting}>
                  {isSubmitting ? 'Working...' : 'Update password'}
                </button>
              </form>
            ) : (
              <div className="session-card">
                <span>Signed in as</span>
                <strong>{userEmail}</strong>
                {isSuperAdmin && <small>Administrator account</small>}
                {!isEmailVerified && (
                  <div className="setup-alert" style={{ margin: '4px 0', color: '#8a5b12' }}>
                    Please verify your email before using protected learning features.
                    <button className="link-btn" type="button" onClick={handleResendConfirmation} disabled={isSubmitting} style={{ display: 'block', marginTop: 6, padding: 0 }}>
                      Resend verification email
                    </button>
                  </div>
                )}
                <button className="ghost-btn" onClick={handleSignOut} disabled={isSubmitting}>Sign out</button>
              </div>
            )
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
              {mode !== 'reset' && (
                <label>Password<input type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
              )}
              {mode === 'reset' && (
                <button className="primary-btn" type="submit" disabled={!supabaseConfig.isConfigured || isSubmitting}>
                  {isSubmitting ? 'Working...' : 'Send reset link'}
                </button>
              )}
              {mode !== 'reset' && (
              <button className="primary-btn" type="submit" disabled={!supabaseConfig.isConfigured || isSubmitting}>
                {isSubmitting ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
              )}
              <button className="link-btn" type="button" onClick={() => setMode(mode === 'reset' ? 'signin' : 'reset')}>
                {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
              </button>
            </form>
          )}
          {message && <p className="form-message">{message}</p>}
        </div>
        <div className="account-checklist">
          {accountChecklist.map((item) => (
            <div key={item}><CheckCircle2 size={18} /><span>{item}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

// â”€â”€â”€ Navigation config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, group: 'learn' },
  { label: 'Questions', icon: ClipboardCheck, group: 'learn' },
  { label: 'Exam', icon: Target, group: 'learn' },
  { label: 'Flashcards', icon: Brain, group: 'learn' },
  { label: 'Study Coach', icon: Brain, group: 'learn' },
  { label: 'Analytics', icon: BarChart3, group: 'learn' },
  { label: 'Planner', icon: CalendarDays, group: 'learn' },
  { label: 'Notebook', icon: Sparkles, group: 'learn', more: true },
  { label: 'Saved Items', icon: BookmarkCheck, group: 'learn', more: true },
  { label: 'Videos', icon: MonitorPlay, group: 'learn', more: true },
  { label: 'Quiz Builder', icon: Target, group: 'learn', more: true },
  { label: 'Live Classes', icon: Video, group: 'learn', more: true },
  { label: 'Community', icon: MessageSquareText, group: 'learn', more: true },
  { label: 'Certificates', icon: FileBadge, group: 'learn', more: true },
  { label: 'Resources', icon: BookOpen, group: 'learn', more: true },
  { label: 'Assignments', icon: ClipboardCheck, group: 'learn', more: true },
  { label: 'Professional', icon: GraduationCap, group: 'learn', more: true },
  { label: 'Billing', icon: CreditCard, group: 'learn', more: true },
  { label: 'Account', icon: LockKeyhole, group: 'manage' },
  { label: 'Super Admin', icon: ShieldCheck, group: 'admin' },
  { label: 'Users', icon: Users, group: 'admin' },
  { label: 'Questions', icon: ClipboardCheck, group: 'admin', viewKey: 'AdminQuestions' },
  { label: 'Payments', icon: CreditCard, group: 'admin' },
  { label: 'Instructors', icon: GraduationCap, group: 'admin' },
  { label: 'Content Review', icon: CheckCircle2, group: 'admin' },
  { label: 'Announcements', icon: Bell, group: 'admin' },
  { label: 'Classroom', icon: Video, group: 'admin' },
  { label: 'Video Manager', icon: MonitorPlay, group: 'admin' },
  { label: 'Audit Logs', icon: ShieldCheck, group: 'admin' },
];

const VALID_VIEW_KEYS = new Set(NAV.map((n) => n.viewKey ?? n.label));
const DEFAULT_VIEW = 'Dashboard';
const ACTIVE_VIEW_STORAGE_KEY = 'nursefaculty.activeView';

function getInitialView() {
  if (typeof window === 'undefined') return DEFAULT_VIEW;
  const fromHash = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  if (VALID_VIEW_KEYS.has(fromHash)) return fromHash;
  const saved = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
  return VALID_VIEW_KEYS.has(saved) ? saved : DEFAULT_VIEW;
}

function isCourseJoinRoute() {
  if (typeof window === 'undefined') return false;
  return /^\/join\/[^/]+/i.test(window.location.pathname) || /^#\/join\/[^/]+/i.test(window.location.hash);
}

const SUPER_ADMIN_VIEWS = new Set(['Super Admin']);
const ADMIN_VIEWS = new Set(['AdminQuestions', 'Audit Logs']);
const FINANCE_VIEWS = new Set(['Payments']);
const INSTRUCTOR_VIEWS = new Set(['Instructors', 'Announcements', 'Classroom', 'Video Manager']);
const REVIEWER_VIEWS = new Set(['Content Review', 'AdminQuestions']);

function PublicLanding({ isPasswordRecovery }) {
  return (
    <main className="public-site">
      <header className="public-header">
        <a className="public-brand" href="#top" aria-label="NurseFaculty home">
          <img src="/nursefaculty-mark.png" alt="" />
          <span><strong>NurseFaculty</strong><small>Learn. Practice. Pass.</small></span>
        </a>
        <a className="public-signin-link" href="#signin">Sign in</a>
      </header>

      <section className="public-hero" id="top">
        <div className="public-hero-copy">
          <span className="public-kicker"><Sparkles size={15} /> Built for international nurses</span>
          <h1>Your personal path to NCLEX confidence.</h1>
          <p>Learn the concept, practice clinical judgment, understand every rationale, and focus each day on what will move your score.</p>
          <div className="public-hero-actions">
            <a className="public-primary-link" href="#signin">Start studying</a>
            <a className="public-secondary-link" href="#why-nursefaculty">Explore NurseFaculty</a>
          </div>
          <div className="public-trust-row">
            <span><CheckCircle2 size={16} /> NGN practice</span>
            <span><CheckCircle2 size={16} /> Adaptive study plans</span>
            <span><CheckCircle2 size={16} /> Clear rationales</span>
          </div>
        </div>
        <div className="public-hero-card">
          <span className="eyebrow">The NurseFaculty method</span>
          {[
            ['01', 'Learn', 'Focused lessons and high-yield resources'],
            ['02', 'Practice', 'NCLEX and NGN questions with teaching rationales'],
            ['03', 'Improve', 'A Study Coach that targets your weak areas'],
            ['04', 'Simulate', 'CAT exams and readiness analytics'],
          ].map(([number, title, text]) => (
            <div className="method-step" key={number}>
              <span>{number}</span><div><strong>{title}</strong><p>{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-features" id="why-nursefaculty">
        <div className="public-section-heading">
          <span className="eyebrow">More than a question bank</span>
          <h2>A complete NCLEX preparation system</h2>
          <p>Everything works together to turn practice results into a clear next step.</p>
        </div>
        <div className="public-feature-grid">
          {[
            [Brain, 'Study Coach', 'Understand why each option is right or wrong, with memory cues and clinical reasoning.'],
            [Target, 'NGN + CAT practice', 'Build clinical judgment with modern item types and realistic adaptive exams.'],
            [BarChart3, 'Readiness insights', 'See strengths, weak areas, timing, and progress without false pass guarantees.'],
            [CalendarDays, 'Adaptive planning', 'Convert your exam date and performance into focused daily study goals.'],
            [BookOpen, 'High-yield library', 'Review labs, pharmacology, isolation, ECG, ABG, maternity, and delegation.'],
            [Users, 'Human support', 'Add live classes, mentorship, and international nurse guidance when you need it.'],
          ].map(([Icon, title, text]) => (
            <article key={title}><span><Icon size={21} /></span><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="public-auth-section" id="signin">
        <div className="public-auth-intro">
          <span className="eyebrow">Your study space</span>
          <h2>Ready when you are.</h2>
          <p>Sign in to continue, or create an account and begin building your personalized study plan.</p>
        </div>
        <AccountAccess session={null} isPasswordRecovery={isPasswordRecovery} />
      </section>

      <footer className="public-footer">
        <div className="public-brand">
          <img src="/nursefaculty-mark.png" alt="" />
          <span><strong>NurseFaculty</strong><small>Learn. Practice. Pass.</small></span>
        </div>
        <div className="signature-block">
          <p>Personalized NCLEX coaching for thoughtful, confident nursing practice.</p>
          <span>
            Built by {developerSignature.name} · <a href={`mailto:${developerSignature.email}`}>{developerSignature.email}</a>
          </span>
        </div>
      </footer>
    </main>
  );
}

function App() {
  const [activeView, setActiveView] = useState(getInitialView);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const { roles, hasAdminAccess, planLabel, isFaculty, loading: accessLoading } = useSubscription(session);
  const navigateTo = (view) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  useEffect(() => {
    if (!VALID_VIEW_KEYS.has(activeView)) return;
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
    const hash = `#/${encodeURIComponent(activeView)}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [activeView]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    let mounted = true;
    getCurrentSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthReady(true);
      }
    });
    const { data } = onAuthStateChange((event, s) => {
      setSession(s);
      setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setActiveView('Account');
      }
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  const learnNavCore = NAV.filter((n) => n.group === 'learn' && !n.more);
  const learnNavMore = NAV.filter((n) => n.group === 'learn' && n.more);
  const isActiveInMore = learnNavMore.some((n) => n.label === activeView);
  const [navExpanded, setNavExpanded] = useState(false);
  const learnNav = (navExpanded || isActiveInMore) ? [...learnNavCore, ...learnNavMore] : learnNavCore;
  const manageNav = NAV.filter((n) => n.group === 'manage');
  const isInstructor = roles.includes('instructor');
  const isFinance = roles.includes('finance');
  const isReviewer = roles.includes('content_reviewer') || roles.includes('question_bank_manager') || roles.includes('guest_reviewer');
  const isQuestionManager = roles.includes('question_bank_manager');
  const isExamOfficer = roles.includes('exam_officer');
  const isDepartmentAdmin = roles.includes('department_admin');
  const isSupportOfficer = roles.includes('support_officer');
  const isRegistrar = roles.includes('academic_registrar');
  const isLibraryManager = roles.includes('library_manager');
  const isAnalyticsManager = roles.includes('analytics_manager');
  const isSuperAdmin = roles.includes('super_admin') || isConfiguredSuperAdmin(session?.user?.email);
  const canAccessView = (view) => {
    if (SUPER_ADMIN_VIEWS.has(view)) return isSuperAdmin;
    if (view === 'Users') return isSuperAdmin || isDepartmentAdmin || isSupportOfficer || isRegistrar;
    if (view === 'Analytics') return true;
    if (ADMIN_VIEWS.has(view)) return hasAdminAccess || (view === 'AdminQuestions' && (isReviewer || isInstructor || isQuestionManager || isExamOfficer));
    if (FINANCE_VIEWS.has(view)) return hasAdminAccess || isFinance;
    if (INSTRUCTOR_VIEWS.has(view)) return hasAdminAccess || isInstructor || isDepartmentAdmin || (view === 'Video Manager' && isLibraryManager) || (view === 'Classroom' && isExamOfficer);
    if (REVIEWER_VIEWS.has(view)) return hasAdminAccess || isReviewer || isQuestionManager;
    if (view === 'Resources') return true;
    return true;
  };
  const adminNav = NAV.filter((n) => n.group === 'admin' && canAccessView(n.viewKey ?? n.label));
  const showStaffNav = adminNav.length > 0;

  useEffect(() => {
    if (!session || accessLoading) return;
    if (!canAccessView(activeView)) setActiveView('Dashboard');
  }, [session, accessLoading, activeView, hasAdminAccess, isSuperAdmin, isInstructor, isFinance, isReviewer, isQuestionManager, isExamOfficer, isDepartmentAdmin, isSupportOfficer, isRegistrar, isLibraryManager, isAnalyticsManager]);

  if (!authReady || (session && accessLoading)) {
    return (
      <main className="app-loading">
        <img src="/nursefaculty-mark.png" alt="" />
        <strong>NurseFaculty</strong>
        <span>Preparing your study space…</span>
      </main>
    );
  }

  if (isCourseJoinRoute()) {
    return <CourseJoinView session={session} onJoined={() => setActiveView('Classroom')} />;
  }

  if (!session) return <PublicLanding isPasswordRecovery={isPasswordRecovery} />;

  return (
    <main className="app-shell">
      {mobileNavOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`} id="primary-navigation">
        <div className="brand">
          <span className="brand-mark"><img src="/nursefaculty-mark.png" alt="" /></span>
          <div><strong>NurseFaculty</strong><small>NCLEX Preparation</small></div>
          <button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav>
          <div className="nav-group-label">STUDY</div>
          {learnNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={activeView === label ? 'nav-active' : ''}
              onClick={() => navigateTo(label)}
            >
              <Icon size={18} />{label}
            </button>
          ))}
          <button
            onClick={() => setNavExpanded((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '6px 12px', fontSize: '0.78rem', color: '#8a999c', cursor: 'pointer', borderRadius: 6, marginTop: 2 }}
          >
            {navExpanded ? '▲ Less' : `▼ More (${learnNavMore.length})`}
          </button>
          <div className="nav-group-label" style={{ marginTop: 8 }}>MANAGE</div>
          {manageNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={activeView === label ? 'nav-active' : ''}
              onClick={() => navigateTo(label)}
            >
              <Icon size={18} />{label}
            </button>
          ))}
          {showStaffNav && (
            <>
              <div className="nav-group-label" style={{ marginTop: 8 }}>ADMIN</div>
              {adminNav.map(({ label, icon: Icon, viewKey }) => {
                const key = viewKey ?? label;
                return (
                  <button
                    key={key}
                    className={activeView === key ? 'nav-active' : ''}
                    onClick={() => navigateTo(key)}
                  >
                    <Icon size={18} />{label}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">Your plan</span>
          <strong>{planLabel}</strong>
          {isFaculty && <span className="faculty-member-badge">Faculty Member</span>}
          <p>Keep building momentum—your questions, notes, and progress are saved automatically.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="topbar-heading">
              <button
                className="mobile-nav-toggle"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                aria-controls="primary-navigation"
                aria-expanded={mobileNavOpen}
              >
                <Menu size={21} />
              </button>
              <span className="topbar-brand"><img src="/nursefaculty-mark.png" alt="" /> NurseFaculty NCLEX Preparation</span>
            </div>
            <h2>{activeView}</h2>
          </div>
          <div className="topbar-actions">
            <NotificationsBell session={session} />
            <button className="ghost-btn" onClick={() => setActiveView('Analytics')}>
              <BarChart3 size={18} /> Analytics
            </button>
            <button className="primary-btn" onClick={() => setActiveView('Account')}>
              <LockKeyhole size={18} /> {session ? session.user.email?.split('@')[0] : 'Sign in'}
            </button>
          </div>
        </header>

        {activeView === 'Dashboard' && <StudentDashboard session={session} onNavigate={setActiveView} />}
        {activeView === 'Questions' && <QuestionBankView session={session} />}
        {activeView === 'Exam' && <ExamModeView session={session} onNavigate={setActiveView} />}
        {activeView === 'Flashcards' && <FlashcardsView session={session} />}
        {activeView === 'Planner' && <StudyPlannerView session={session} />}
        {activeView === 'Notebook' && <NotebookView session={session} />}
        {activeView === 'Saved Items' && <SavedItemsView session={session} />}
        {activeView === 'Analytics' && <AnalyticsView session={session} onNavigate={setActiveView} />}
        {activeView === 'Account' && <AccountAccess session={session} isPasswordRecovery={isPasswordRecovery} />}
        {activeView === 'Videos' && <VideoLearning session={session} onNavigate={setActiveView} />}
        {activeView === 'Quiz Builder' && (
          <SubscriptionGate session={session} requiredPlan="pro" featureName="custom exams and review mode" onUpgrade={() => setActiveView('Billing')}>
            <CustomQuizBuilder session={session} />
          </SubscriptionGate>
        )}
        {activeView === 'Live Classes' && (
          <SubscriptionGate session={session} requiredPlan="master" featureName="weekly live classes and masterclasses" onUpgrade={() => setActiveView('Billing')}>
            <VirtualClassroom session={session} />
          </SubscriptionGate>
        )}
        {activeView === 'Community' && <CommunityForum session={session} />}
        {activeView === 'Certificates' && (
          <SubscriptionGate session={session} requiredPlan="pro" featureName="certificates" onUpgrade={() => setActiveView('Billing')}>
            <CertificatesView session={session} />
          </SubscriptionGate>
        )}
        {activeView === 'Super Admin' && isSuperAdmin && <SuperAdminPanel session={session} />}
        {activeView === 'Users' && isSuperAdmin && <UserManagement session={session} />}
        {activeView === 'AdminQuestions' && (hasAdminAccess || isReviewer) && <QuestionManager session={session} />}
        {activeView === 'Billing' && <PaymentsView session={session} />}
        {activeView === 'Payments' && (hasAdminAccess || isFinance) && <PaymentsView session={session} canManage />}
        {activeView === 'Instructors' && (hasAdminAccess || isInstructor) && <InstructorTools session={session} />}
        {activeView === 'Content Review' && (hasAdminAccess || isReviewer) && <ContentReviewer session={session} />}
        {activeView === 'Announcements' && (hasAdminAccess || isInstructor) && <AnnouncementsView session={session} />}
        {activeView === 'Classroom' && (hasAdminAccess || isInstructor) && <VirtualClassroom session={session} />}
        {activeView === 'Video Manager' && (hasAdminAccess || isInstructor) && <VideoManager session={session} />}
        {activeView === 'Audit Logs' && hasAdminAccess && <AuditLogView session={session} />}
        {activeView === 'Study Coach' && <StudyCoachView session={session} />}
        {activeView === 'Resources' && (
          <SubscriptionGate session={session} requiredPlan="pro" featureName="all courses, notes, and drug guide" onUpgrade={() => setActiveView('Billing')}>
            <ResourcesView session={session} />
          </SubscriptionGate>
        )}
        {activeView === 'Assignments' && (
          <SubscriptionGate session={session} requiredPlan="master" featureName="assignments and instructor feedback" onUpgrade={() => setActiveView('Billing')}>
            <AssignmentsView session={session} />
          </SubscriptionGate>
        )}
        {activeView === 'Professional' && (
          <SubscriptionGate session={session} requiredPlan="master" featureName="professional resources" onUpgrade={() => setActiveView('Billing')}>
            <ProfessionalAddons session={session} />
          </SubscriptionGate>
        )}
        <footer className="app-signature" aria-label="Developer signature">
          <span>Built by {developerSignature.name}</span>
          <a href={`mailto:${developerSignature.email}`}>{developerSignature.email}</a>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
