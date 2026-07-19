import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, CheckCircle2, Loader2, LockKeyhole, UserPlus } from 'lucide-react';
import {
  getCourseByEnrollmentCode,
  joinCourseByEnrollmentCode,
  signInWithEmail,
  signUpWithEmail,
} from '../services/supabase';

function getJoinCode() {
  const pathMatch = window.location.pathname.match(/\/join\/([^/?#]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  const hashMatch = window.location.hash.match(/#\/join\/([^/?#]+)/i);
  return hashMatch?.[1] ? decodeURIComponent(hashMatch[1]) : '';
}

export default function CourseJoinView({ session, onJoined }) {
  const code = useMemo(getJoinCode, []);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', studentId: '', accept: false });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await getCourseByEnrollmentCode(code);
      if (loadError) setError(loadError.message);
      setCourse(data);
      setLoading(false);
    }
    load();
  }, [code]);

  async function authenticateIfNeeded() {
    if (session) return true;
    if (!form.email || !form.password) {
      setError('Enter your email and password first.');
      return false;
    }
    const result = mode === 'signup'
      ? await signUpWithEmail({ email: form.email, password: form.password, fullName: form.fullName })
      : await signInWithEmail({ email: form.email, password: form.password });
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    setMessage(mode === 'signup'
      ? 'Account created. If email verification is required, confirm your email then open this join link again.'
      : 'Signed in. Click Join Course again to confirm enrollment.');
    return false;
  }

  async function join() {
    setError('');
    setMessage('');
    if (!form.accept) {
      setError('Please accept the course terms before joining.');
      return;
    }
    setJoining(true);
    const ready = await authenticateIfNeeded();
    if (!ready) {
      setJoining(false);
      return;
    }
    const { data, error: joinError } = await joinCourseByEnrollmentCode(code, form.studentId);
    if (joinError) setError(joinError.message);
    else {
      setMessage(data === 'enrolled'
        ? 'You are enrolled. Welcome to the classroom.'
        : 'Your request was submitted. The instructor will approve or reject your enrollment.');
      onJoined?.();
    }
    setJoining(false);
  }

  if (loading) {
    return <main className="app-loading"><Loader2 className="spin" /><strong>Loading course invitation...</strong></main>;
  }

  return (
    <main className="public-site">
      <section className="public-hero" style={{ minHeight: '100vh', alignItems: 'center' }}>
        <div className="public-hero-copy">
          <span className="public-kicker"><BookOpen size={15} /> NurseFaculty Course Enrollment</span>
          <h1>{course?.title ?? 'Course link unavailable'}</h1>
          {course ? (
            <>
              <p>{course.description || 'Confirm your enrollment to join this nursing classroom.'}</p>
              <div className="public-trust-row" style={{ justifyContent: 'flex-start' }}>
                <span><CheckCircle2 size={16} /> {course.enrollment_method?.replace('_', ' ')}</span>
                {course.instructor_name && <span><CheckCircle2 size={16} /> {course.instructor_name}</span>}
                {course.starts_at && <span><Calendar size={16} /> {new Date(course.starts_at).toLocaleDateString()}</span>}
              </div>
              <p style={{ fontSize: '0.9rem', color: '#607478' }}>
                Institution: {course.institution || 'NurseFaculty'} · Department: {course.department || 'Nursing Education'}
              </p>
            </>
          ) : (
            <p>This enrollment link is disabled, expired, or does not exist.</p>
          )}
        </div>

        {course && (
          <div className="public-auth-card" id="join-course">
            <div className="auth-tabs">
              <button className={mode === 'signin' ? 'auth-tab-active' : ''} onClick={() => setMode('signin')}>Sign in</button>
              <button className={mode === 'signup' ? 'auth-tab-active' : ''} onClick={() => setMode('signup')}>Create account</button>
            </div>
            {session ? (
              <div className="setup-alert" style={{ marginBottom: 12 }}>Signed in as {session.user.email}. Confirm enrollment below.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {mode === 'signup' && (
                  <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Full name" />
                )}
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email address" />
                <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password" />
              </div>
            )}
            <input style={{ marginTop: 10 }} value={form.studentId} onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))} placeholder="Student ID (if required)" />
            <label style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: '0.85rem', color: '#42585e' }}>
              <input type="checkbox" checked={form.accept} onChange={(e) => setForm((p) => ({ ...p, accept: e.target.checked }))} />
              I confirm I am joining the correct course and agree to the classroom terms.
            </label>
            {error && <div className="form-message" style={{ color: '#8a2c21', marginTop: 10 }}>{error}</div>}
            {message && <div className="form-message" style={{ color: '#135f55', marginTop: 10 }}>{message}</div>}
            <button className="public-primary-link" style={{ width: '100%', marginTop: 14, justifyContent: 'center', border: 0 }} onClick={join} disabled={joining}>
              {joining ? <Loader2 size={15} className="spin" /> : session ? <UserPlus size={15} /> : <LockKeyhole size={15} />}
              {session ? 'Join Course' : mode === 'signup' ? 'Create Account & Continue' : 'Sign In & Continue'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
