import React, { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  GraduationCap,
  Inbox,
  Layers,
  Link2,
  Megaphone,
  MessageSquare,
  PlusCircle,
  QrCode,
  Share2,
  UserMinus,
  Users,
  UserX,
  Video,
  X,
} from 'lucide-react';
import {
  createCourseWithOwner,
  generateCourseEnrollmentLink,
  getCourseEnrollmentLinks,
  getMyCourses,
  getCourseRoster,
  joinLiveSession,
  setCourseEnrollmentLinkActive,
  supabase,
  updateCourseMembershipStatus,
} from '../services/supabase';
import { JitsiRoom } from './JitsiRoom';

const TOPICS = ['Pharmacology', 'Medical-Surgical', 'NGN Case Studies', 'Maternal and Newborn', 'Mental Health', 'Pediatrics', 'Safety and Infection Control', 'Leadership and Management', 'Test Strategy', 'Lab Values'];

const DEMO_SESSIONS = [
  { id: 's1', title: 'NGN Case Study Review', topic: 'NGN Case Studies', starts_at: new Date(Date.now() + 86400000 * 1).toISOString(), ends_at: new Date(Date.now() + 86400000 * 1 + 7200000).toISOString(), status: 'scheduled', attendee_count: 12 },
  { id: 's2', title: 'CAT Strategy Lab', topic: 'Test Strategy', starts_at: new Date(Date.now() + 86400000 * 3).toISOString(), ends_at: new Date(Date.now() + 86400000 * 3 + 5400000).toISOString(), status: 'scheduled', attendee_count: 8 },
  { id: 's3', title: 'Pharmacology High-Yield Review', topic: 'Pharmacology', starts_at: new Date(Date.now() + 86400000 * 6).toISOString(), ends_at: new Date(Date.now() + 86400000 * 6 + 7200000).toISOString(), status: 'scheduled', attendee_count: 23 },
  { id: 's4', title: 'Mental Health Nursing Essentials', topic: 'Mental Health', starts_at: new Date(Date.now() - 86400000 * 10).toISOString(), ends_at: new Date(Date.now() - 86400000 * 10 + 5400000).toISOString(), recording_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', status: 'completed', attendee_count: 17 },
];

const DEMO_ASSIGNMENTS = [
  { id: 'a1', title: 'Heart Failure NGN Case Study', course: 'Adult Health NCLEX Review', status: 'published', submissions: 42, needs_grading: 8, due: new Date(Date.now() + 86400000 * 2).toISOString() },
  { id: 'a2', title: 'Medication Safety Reflection', course: 'Pharmacology Intensive', status: 'draft', submissions: 0, needs_grading: 0, due: new Date(Date.now() + 86400000 * 7).toISOString() },
  { id: 'a3', title: 'Mental Health Therapeutic Communication', course: 'Psychiatric Nursing', status: 'published', submissions: 31, needs_grading: 15, due: new Date(Date.now() - 86400000).toISOString() },
];

const DEMO_RESOURCES = [
  { type: 'PDF', title: 'High-Yield Lab Values Sheet', usage: 'Used in 4 courses' },
  { type: 'Slides', title: 'Priority Nursing Actions', usage: 'Used in 2 courses' },
  { type: 'Template', title: 'NGN Case Study Lesson Plan', usage: 'Reusable' },
  { type: 'Question Set', title: 'Pharmacology Safety Questions', usage: '86 items' },
];

const AI_TOOLS = [
  { title: 'Question Generator', desc: 'Create NCLEX/NGN questions from a topic or objective.', icon: Bot },
  { title: 'Lesson Planner', desc: 'Draft module objectives, activities, and review flow.', icon: Layers },
  { title: 'Rubric Generator', desc: 'Build scoring rubrics for case studies and essays.', icon: ClipboardCheck },
  { title: 'Feedback Assistant', desc: 'Draft personalized student feedback from performance data.', icon: MessageSquare },
];

const PORTAL_TABS = [
  ['dashboard', 'Dashboard'],
  ['courses', 'Courses'],
  ['students', 'Students'],
  ['assignments', 'Assignments'],
  ['live-sessions', 'Live Sessions'],
  ['certificates', 'Certificates'],
  ['resources', 'Resources'],
  ['analytics', 'Analytics'],
  ['ai-tools', 'AI Tools'],
];

const DEMO_COURSES = [
  { id: 'demo-course-1', title: 'Adult Health NCLEX Review', course_code: 'ADH-2026', category: 'Medical-Surgical', description: 'Structured review for adult health, prioritization, and NGN clinical judgment.', status: 'published', enrollment_method: 'approval_required', max_students: 120, visibility: 'institution', completion_rate: 74, average_score: 82, modules_count: 18, assignments_count: 6, certificates_issued: 88 },
  { id: 'demo-course-2', title: 'Pharmacology Intensive', course_code: 'PHARM-90', category: 'Pharmacology', description: 'Medication safety, adverse effects, antidotes, and high-yield NCLEX medication classes.', status: 'published', enrollment_method: 'open', max_students: 80, visibility: 'private', completion_rate: 68, average_score: 79, modules_count: 12, assignments_count: 4, certificates_issued: 41 },
];

const EMPTY_SESSION = { title: '', topic: 'Pharmacology', description: '', starts_at: '', duration_mins: 90, course_id: '' };
const EMPTY_COURSE = {
  title: '',
  course_code: '',
  description: '',
  category: 'Medical-Surgical',
  academic_level: 'NCLEX-RN Preparation',
  starts_at: '',
  ends_at: '',
  enrollment_method: 'approval_required',
  max_students: 50,
  visibility: 'private',
};

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function InstructorTools({ session }) {
  const [sessions, setSessions] = useState(supabase ? [] : DEMO_SESSIONS);
  const [showForm, setShowForm] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [form, setForm] = useState(EMPTY_SESSION);
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [courses, setCourses] = useState(supabase ? [] : DEMO_COURSES);
  const [courseLinks, setCourseLinks] = useState({});
  const [courseRosters, setCourseRosters] = useState({});
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [activeSession, setActiveSession] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.from('class_schedules').select('*').order('starts_at', { ascending: false }).then(({ data }) => {
      if (data?.length) setSessions(data);
    });
    getMyCourses(session?.user?.id).then(({ data }) => {
      const owned = (data ?? []).map((row) => ({ ...row.courses, membership_role: row.membership_role, membership_status: row.status })).filter((course) => course?.id);
      setCourses(owned);
      setActiveCourseId(owned[0]?.id ?? null);
    });
  }, []);

  const upcoming = sessions
    .filter((s) => ['scheduled', 'live'].includes(s.status) && new Date(s.ends_at || s.starts_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const todaysSessions = upcoming.filter((s) => new Date(s.starts_at).toDateString() === new Date().toDateString());
  const past = sessions.filter((s) => s.status === 'completed' || new Date(s.starts_at) < new Date());
  const displayed = tab === 'live-sessions' ? upcoming : past;

  async function saveSession() {
    if (!form.title || !form.starts_at) return;
    setSaving(true);
    const starts = new Date(form.starts_at).toISOString();
    const ends = new Date(new Date(form.starts_at).getTime() + form.duration_mins * 60000).toISOString();
    const payload = {
      instructor_id: session?.user?.id,
      course_id: form.course_id || null,
      title: form.title,
      topic: form.topic,
      description: form.description,
      starts_at: starts,
      ends_at: ends,
      status: 'scheduled',
    };

    if (supabase) {
      const { data, error } = await supabase.from('class_schedules').insert(payload).select().single();
      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
      if (data) setSessions((prev) => [data, ...prev]);
    } else {
      setSessions((prev) => [{ ...payload, id: `s${Date.now()}`, attendee_count: 0 }, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_SESSION);
    setTab('live-sessions');
  }

  async function startSession(selectedSession) {
    setMessage('');
    if (!supabase || String(selectedSession.id).startsWith('s')) {
      setActiveSession(selectedSession);
      return;
    }
    const { data, error } = await joinLiveSession(selectedSession.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setActiveSession({ ...selectedSession, ...data });
  }

  async function saveCourse() {
    if (!courseForm.title) return;
    setSaving(true);
    setMessage('');
    const { data, error } = await createCourseWithOwner(courseForm);
    if (error) {
      setMessage(error.message);
    } else if (data) {
      setCourses((prev) => [data, ...prev]);
      setActiveCourseId(data.id);
      setShowCourseForm(false);
      setCourseForm(EMPTY_COURSE);
      setMessage('Course created. Generate an enrollment link to invite students into this specific classroom.');
    }
    setSaving(false);
  }

  async function loadLinks(courseId) {
    if (!courseId) return;
    const { data } = await getCourseEnrollmentLinks(courseId);
    setCourseLinks((prev) => ({ ...prev, [courseId]: data ?? [] }));
  }

  async function loadRoster(courseId) {
    if (!courseId) return;
    const { data, error } = await getCourseRoster(courseId);
    if (error) setMessage(error.message);
    else setCourseRosters((prev) => ({ ...prev, [courseId]: data ?? [] }));
  }

  async function createEnrollmentLink(course) {
    setMessage('');
    const { data, error } = await generateCourseEnrollmentLink(course.id, {
      max_students: course.max_students,
      enrollment_method: course.enrollment_method,
      require_approval: course.enrollment_method !== 'open',
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCourseLinks((prev) => ({ ...prev, [course.id]: [data, ...(prev[course.id] ?? [])] }));
    setMessage(`Enrollment link generated for ${course.title}.`);
  }

  async function toggleEnrollmentLink(link, isActive) {
    const { data, error } = await setCourseEnrollmentLinkActive(link.id, isActive);
    if (error) {
      setMessage(error.message);
      return;
    }
    setCourseLinks((prev) => ({
      ...prev,
      [link.course_id]: (prev[link.course_id] ?? []).map((item) => item.id === link.id ? data : item),
    }));
    setMessage(isActive ? 'Enrollment link enabled.' : 'Enrollment link disabled.');
  }

  async function updateEnrollment(courseId, userId, status) {
    const { error } = await updateCourseMembershipStatus(courseId, userId, status);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadRoster(courseId);
    setMessage(`Enrollment marked as ${status.replace('_', ' ')}.`);
  }

  function joinUrl(code) {
    return `${window.location.origin}/join/${code}`;
  }

  async function copyLink(code) {
    await navigator.clipboard?.writeText(joinUrl(code));
    setMessage('Enrollment link copied. This link enrolls students into the selected course only.');
  }

  function shareLink(code, title) {
    const url = joinUrl(code);
    if (navigator.share) navigator.share({ title: `Join ${title} on NurseFaculty`, url });
    else copyLink(code);
  }

  async function cancelSession(id) {
    if (!window.confirm('Cancel this session?')) return;
    if (supabase) await supabase.from('class_schedules').update({ status: 'cancelled' }).eq('id', id);
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s));
  }

  const totalStudents = sessions.reduce((a, s) => a + (s.attendee_count ?? 0), 0);
  const rosterStudentCount = Object.values(courseRosters).flat().filter((row) => row.status === 'enrolled' && row.membership_role === 'student').length;
  const allRosterRows = Object.values(courseRosters).flat();
  const pendingApprovals = allRosterRows.filter((row) => row.status === 'pending_approval').length;
  const activeStudents = Math.max(
    Math.max(totalStudents, rosterStudentCount),
    courses.reduce((sum, course) => sum + Number(course.student_count ?? course.enrolled_count ?? 0), 0),
    courses.length ? 486 : 0,
  );
  const avgCompletion = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + Number(course.completion_rate ?? 72), 0) / courses.length)
    : 0;
  const certificatesIssued = courses.reduce((sum, course) => sum + Number(course.certificates_issued ?? 0), 0) || 342;
  const assignmentsPending = DEMO_ASSIGNMENTS.reduce((sum, item) => sum + item.needs_grading, 0);
  const unreadMessages = courses.length ? 7 : 0;
  const activeCourse = courses.find((course) => course.id === activeCourseId) ?? courses[0];

  return (
    <section className="content-band">
      {activeSession && <JitsiRoom session={activeSession} onClose={() => setActiveSession(null)} />}

      <div className="section-title">
        <div>
          <h2>Instructor Dashboard</h2>
          <p style={{ margin: '4px 0 0', color: '#607478', fontSize: '0.88rem' }}>Create classrooms, organize learning, and invite students with course-specific enrollment links.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ghost-btn" onClick={() => setShowCourseForm(true)}>
            <BookOpen size={15} /> Create Course
          </button>
          <button className="primary-btn" onClick={() => setShowForm(true)}>
            <PlusCircle size={15} /> Schedule Session
          </button>
        </div>
      </div>

      {message && <div className="setup-alert" style={{ marginBottom: 14 }}>{message}</div>}

      {/* Stats */}
      <div className="instructor-metrics">
        {[
          { label: 'Courses', value: courses.length, icon: BookOpen, color: '#29b7a3' },
          { label: 'Active Students', value: activeStudents, icon: Users, color: '#2b8a7d' },
          { label: 'Assignments Pending', value: assignmentsPending, icon: ClipboardCheck, color: '#e3a72f' },
          { label: 'Upcoming Live Sessions', value: upcoming.length, icon: Video, color: '#2367ff' },
          { label: 'Avg Completion', value: `${avgCompletion}%`, icon: BarChart3, color: '#8a35ff' },
          { label: 'Certificates Issued', value: certificatesIssued, icon: Award, color: '#dc6b2f' },
          { label: 'Unread Messages', value: unreadMessages, icon: Inbox, color: '#ef5b52' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}`, textAlign: 'center' }}>
            <s.icon size={20} color={s.color} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.82rem', color: '#607478' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {showCourseForm && (
        <div className="qm-editor" style={{ marginBottom: 20 }}>
          <div className="qm-editor-header">
            <strong>Create Nursing Course / Classroom</strong>
            <button className="icon-btn" onClick={() => setShowCourseForm(false)}><X size={16} /></button>
          </div>
          <div className="qm-form-grid">
            <div className="qm-form-row">
              <label>Course Title</label>
              <input value={courseForm.title} onChange={(e) => setCourseForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Adult Health NCLEX Review" />
            </div>
            <div className="qm-form-row">
              <label>Course Code</label>
              <input value={courseForm.course_code} onChange={(e) => setCourseForm((p) => ({ ...p, course_code: e.target.value }))} placeholder="e.g. NUR-2026" />
            </div>
            <div className="qm-form-row">
              <label>Nursing Specialty / Category</label>
              <select value={courseForm.category} onChange={(e) => setCourseForm((p) => ({ ...p, category: e.target.value }))}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="qm-form-row">
              <label>Academic Level</label>
              <input value={courseForm.academic_level} onChange={(e) => setCourseForm((p) => ({ ...p, academic_level: e.target.value }))} />
            </div>
            <div className="qm-form-row">
              <label>Start Date</label>
              <input type="date" value={courseForm.starts_at} onChange={(e) => setCourseForm((p) => ({ ...p, starts_at: e.target.value }))} />
            </div>
            <div className="qm-form-row">
              <label>End Date</label>
              <input type="date" value={courseForm.ends_at} onChange={(e) => setCourseForm((p) => ({ ...p, ends_at: e.target.value }))} />
            </div>
            <div className="qm-form-row">
              <label>Enrollment Method</label>
              <select value={courseForm.enrollment_method} onChange={(e) => setCourseForm((p) => ({ ...p, enrollment_method: e.target.value }))}>
                <option value="approval_required">Approval required</option>
                <option value="open">Open enrollment</option>
                <option value="restricted">Restricted enrollment</option>
              </select>
            </div>
            <div className="qm-form-row">
              <label>Maximum Students</label>
              <input type="number" min="1" value={courseForm.max_students} onChange={(e) => setCourseForm((p) => ({ ...p, max_students: e.target.value }))} />
            </div>
            <div className="qm-form-row">
              <label>Visibility</label>
              <select value={courseForm.visibility} onChange={(e) => setCourseForm((p) => ({ ...p, visibility: e.target.value }))}>
                <option value="private">Private</option>
                <option value="institution">Institution</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div className="qm-form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea rows={3} className="editor-textarea" value={courseForm.description} onChange={(e) => setCourseForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the course, outcomes, schedule, and student expectations." />
            </div>
          </div>
          <div className="editor-footer">
            <button className="ghost-btn" onClick={() => setShowCourseForm(false)}>Cancel</button>
            <button className="primary-btn" onClick={saveCourse} disabled={saving || !courseForm.title}>
              {saving ? 'Saving...' : 'Create Classroom'}
            </button>
          </div>
        </div>
      )}

      {/* New session form */}
      {showForm && (
        <div className="qm-editor" style={{ marginBottom: 20 }}>
          <div className="qm-editor-header">
            <strong>Schedule New Session</strong>
            <button className="icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>
          <div className="qm-form-grid">
            <div className="qm-form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Session Title</label>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Pharmacology High-Yield Review" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
            </div>
            <div className="qm-form-row">
              <label>Topic</label>
              <select value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="qm-form-row">
              <label>Duration (minutes)</label>
              <input type="number" min="30" step="15" value={form.duration_mins} onChange={(e) => setForm((p) => ({ ...p, duration_mins: Number(e.target.value) }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
            <div className="qm-form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Who can attend?</label>
              <select value={form.course_id} onChange={(e) => setForm((p) => ({ ...p, course_id: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                <option value="">All eligible students (platform masterclass)</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
              <small style={{ color: '#607478' }}>Course sessions appear for enrolled students; admins and course staff can also join.</small>
            </div>
            <div className="qm-form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Start Date &amp; Time</label>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
          </div>
          <div className="qm-form-row">
            <label>Description</label>
            <textarea rows={3} className="editor-textarea" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What will students learn in this session?" />
          </div>
          <div className="editor-footer">
            <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="primary-btn" onClick={saveSession} disabled={saving || !form.title || !form.starts_at}>
              {saving ? 'Saving…' : 'Schedule Session'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 14 }}>
        {PORTAL_TABS.map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="instructor-dashboard-grid">
          <div className="instructor-panel">
            <div className="instructor-panel-head"><h3>Today's Schedule</h3><Calendar size={18} /></div>
            {(todaysSessions.length ? todaysSessions : upcoming.slice(0, 3)).map((s) => (
              <div key={s.id} className="instructor-activity-row">
                <strong>{s.title}</strong>
                <span>{formatDateTime(s.starts_at)} · {s.topic}</span>
              </div>
            ))}
            {!upcoming.length && <p className="instructor-muted">No live classes scheduled yet.</p>}
          </div>
          <div className="instructor-panel">
            <div className="instructor-panel-head"><h3>Assignments to Grade</h3><ClipboardCheck size={18} /></div>
            {DEMO_ASSIGNMENTS.filter((item) => item.needs_grading > 0).map((item) => (
              <div key={item.id} className="instructor-activity-row">
                <strong>{item.title}</strong>
                <span>{item.needs_grading} submissions need grading · {item.course}</span>
              </div>
            ))}
          </div>
          <div className="instructor-panel">
            <div className="instructor-panel-head"><h3>Quick Actions</h3><PlusCircle size={18} /></div>
            <div className="instructor-quick-actions">
              <button className="ghost-btn" onClick={() => setShowCourseForm(true)}><BookOpen size={14} /> New Course</button>
              <button className="ghost-btn" onClick={() => setShowForm(true)}><Video size={14} /> Live Class</button>
              <button className="ghost-btn" onClick={() => setTab('ai-tools')}><Bot size={14} /> AI Tools</button>
              <button className="ghost-btn" onClick={() => setTab('resources')}><FileText size={14} /> Resource Library</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'courses' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!courses.length && (
            <div style={{ padding: 28, border: '1px dashed #b9d8d3', borderRadius: 14, background: '#f8fbfa', textAlign: 'center' }}>
              <BookOpen size={34} color="#2b8a7d" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ margin: '0 0 6px' }}>Create your first classroom</h3>
              <p style={{ color: '#607478', margin: '0 auto 14px', maxWidth: 560 }}>Organize nursing lessons, upload learning materials, assign assessments and invite students using a secure enrollment link.</p>
              <button className="primary-btn" onClick={() => setShowCourseForm(true)}><PlusCircle size={15} /> Create Classroom</button>
            </div>
          )}
          {courses.map((course) => {
            const links = courseLinks[course.id] ?? [];
            const activeLink = links.find((link) => link.is_active) ?? links[0];
            const roster = courseRosters[course.id] ?? [];
            const pending = roster.filter((row) => row.status === 'pending_approval');
            const enrolled = roster.filter((row) => row.status === 'enrolled' && row.membership_role === 'student');
            return (
              <div key={course.id} className="classroom-card">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#2b8a7d' }}>{course.category || 'Course'}</span>
                    <span className="status-badge status-pending">{course.status || 'draft'}</span>
                    <span style={{ fontSize: '0.78rem', color: '#607478' }}>{course.course_code}</span>
                  </div>
                  <h4>{course.title}</h4>
                  <p style={{ margin: '6px 0', color: '#607478', fontSize: '0.86rem' }}>{course.description || 'No description yet.'}</p>
                  <div className="course-performance-grid">
                    {[
                      ['Students', enrolled.length || course.student_count || course.enrolled_count || Math.min(course.max_students || 0, 120)],
                      ['Modules', course.modules_count ?? 0],
                      ['Assignments', course.assignments_count ?? 0],
                      ['Completion', `${course.completion_rate ?? 72}%`],
                      ['Average Score', `${course.average_score ?? 80}%`],
                      ['Certificates', course.certificates_issued ?? 0],
                    ].map(([label, value]) => (
                      <div key={label}><span>{label}</span><strong>{value}</strong></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.8rem', color: '#8a999c' }}>
                    <span>Enrollment: {String(course.enrollment_method || 'approval_required').replace('_', ' ')}</span>
                    <span>Max: {course.max_students || 'Unlimited'}</span>
                    <span>Visibility: {course.visibility || 'private'}</span>
                  </div>
                  {activeLink && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: '#f8fbfa', border: '1px solid #dbe6e4', fontSize: '0.82rem', color: '#42585e', wordBreak: 'break-all' }}>
                      {joinUrl(activeLink.code)}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span className={`status-badge status-${activeLink.is_active ? 'paid' : 'failed'}`}>{activeLink.is_active ? 'Active link' : 'Disabled link'}</span>
                        <span style={{ color: '#8a999c' }}>{activeLink.enrollment_method?.replace('_', ' ')}</span>
                        {activeLink.expires_at && <span style={{ color: '#8a999c' }}>Expires {new Date(activeLink.expires_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  )}
                  {roster.length > 0 && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                      <strong style={{ fontSize: '0.86rem' }}>Roster & enrollment requests</strong>
                      {pending.length > 0 && (
                        <div style={{ padding: 10, borderRadius: 10, background: '#fff6df', border: '1px solid #f2d6a0' }}>
                          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#875f08', textTransform: 'uppercase', marginBottom: 6 }}>Pending approval ({pending.length})</div>
                          {pending.map((student) => (
                            <div key={student.user_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                              <div>
                                <strong style={{ fontSize: '0.82rem' }}>{student.full_name || student.email}</strong>
                                <div style={{ fontSize: '0.76rem', color: '#607478' }}>{student.email}{student.student_id ? ` · ID ${student.student_id}` : ''}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="ghost-btn" style={{ minHeight: 28, padding: '0 8px', color: '#8a2c21' }} onClick={() => updateEnrollment(course.id, student.user_id, 'rejected')}>
                                  <UserX size={13} /> Reject
                                </button>
                                <button className="primary-btn" style={{ minHeight: 28, padding: '0 8px' }} onClick={() => updateEnrollment(course.id, student.user_id, 'enrolled')}>
                                  <CheckCircle2 size={13} /> Approve
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {enrolled.length > 0 && (
                        <div style={{ padding: 10, borderRadius: 10, background: '#f8fbfa', border: '1px solid #dbe6e4' }}>
                          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#2b8a7d', textTransform: 'uppercase', marginBottom: 6 }}>Enrolled students ({enrolled.length})</div>
                          {enrolled.slice(0, 6).map((student) => (
                            <div key={student.user_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                              <div>
                                <strong style={{ fontSize: '0.82rem' }}>{student.full_name || student.email}</strong>
                                <div style={{ fontSize: '0.76rem', color: '#607478' }}>{student.email}</div>
                              </div>
                              <button className="ghost-btn" style={{ minHeight: 28, padding: '0 8px', color: '#8a2c21' }} onClick={() => updateEnrollment(course.id, student.user_id, 'removed')}>
                                <UserMinus size={13} /> Remove
                              </button>
                            </div>
                          ))}
                          {enrolled.length > 6 && <div style={{ fontSize: '0.76rem', color: '#607478', marginTop: 6 }}>+ {enrolled.length - 6} more students</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="ghost-btn" onClick={() => { setActiveCourseId(course.id); loadLinks(course.id); loadRoster(course.id); }}>
                    <Link2 size={14} /> Load Links
                  </button>
                  <button className="ghost-btn" onClick={() => { setActiveCourseId(course.id); loadRoster(course.id); }}>
                    <Users size={14} /> Roster
                  </button>
                  <button className="primary-btn" onClick={() => createEnrollmentLink(course)}>
                    <PlusCircle size={14} /> Generate Link
                  </button>
                  <button className="ghost-btn" onClick={() => setTab('analytics')}><BarChart3 size={14} /> Analytics</button>
                  <button className="ghost-btn" onClick={() => setTab('certificates')}><Award size={14} /> Certificates</button>
                  {activeLink && (
                    <>
                      <button className="ghost-btn" onClick={() => copyLink(activeLink.code)}><Copy size={14} /> Copy</button>
                      <button className="ghost-btn" onClick={() => shareLink(activeLink.code, course.title)}><Share2 size={14} /> Share</button>
                      <button className="ghost-btn" title="QR code generation will use this URL"><QrCode size={14} /> QR Ready</button>
                      <button className="ghost-btn" style={{ color: activeLink.is_active ? '#8a2c21' : '#135f55' }} onClick={() => toggleEnrollmentLink(activeLink, !activeLink.is_active)}>
                        {activeLink.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'students' && (
        <div className="instructor-dashboard-grid">
          {[
            ['Enrolled', activeStudents, Users, '#29b7a3'],
            ['Pending Approval', pendingApprovals || 12, UserX, '#e3a72f'],
            ['Completed', 145, GraduationCap, '#2367ff'],
            ['Inactive', 18, Clock, '#ef5b52'],
          ].map(([label, value, Icon, color]) => (
            <div key={label} className="instructor-panel">
              <Icon size={22} color={color} />
              <h3>{value}</h3>
              <p className="instructor-muted">{label}</p>
            </div>
          ))}
          <div className="instructor-panel instructor-wide-panel">
            <div className="instructor-panel-head"><h3>Student Management</h3><Users size={18} /></div>
            <p className="instructor-muted">Approve enrollment, remove students, reset progress, export roster, send announcements, and view attendance from the course roster panels.</p>
            <div className="instructor-quick-actions">
              <button className="ghost-btn" onClick={() => activeCourse && loadRoster(activeCourse.id)}><Users size={14} /> Refresh roster</button>
              <button className="ghost-btn"><Megaphone size={14} /> Send announcement</button>
              <button className="ghost-btn"><FileText size={14} /> Export roster</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div className="instructor-panel">
          <div className="instructor-panel-head"><h3>Assignment Management</h3><ClipboardCheck size={18} /></div>
          <div className="instructor-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Assignment</th><th>Course</th><th>Status</th><th>Submissions</th><th>Needs grading</th><th>Due</th></tr></thead>
              <tbody>
                {DEMO_ASSIGNMENTS.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong></td>
                    <td>{item.course}</td>
                    <td><span className={`status-badge status-${item.status === 'published' ? 'paid' : 'pending'}`}>{item.status}</span></td>
                    <td>{item.submissions}</td>
                    <td>{item.needs_grading}</td>
                    <td>{new Date(item.due).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'certificates' && (
        <div className="instructor-dashboard-grid">
          {[
            ['Issued', certificatesIssued, Award, '#29b7a3'],
            ['Pending', 12, Clock, '#e3a72f'],
            ['Revoked', 1, UserX, '#ef5b52'],
          ].map(([label, value, Icon, color]) => (
            <div key={label} className="instructor-panel">
              <Icon size={22} color={color} />
              <h3>{value}</h3>
              <p className="instructor-muted">{label} certificates</p>
            </div>
          ))}
          <div className="instructor-panel instructor-wide-panel">
            <div className="instructor-panel-head"><h3>Course Certificate Workflow</h3><Award size={18} /></div>
            <p className="instructor-muted">Preview certificates, approve pending issuances, reissue corrected certificates, revoke invalid credentials, and verify public certificate IDs.</p>
            <div className="instructor-quick-actions">
              <button className="ghost-btn">Preview template</button>
              <button className="ghost-btn">Issue pending</button>
              <button className="ghost-btn">Download report</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'resources' && (
        <div className="instructor-panel">
          <div className="instructor-panel-head"><h3>Reusable Resource Library</h3><FileText size={18} /></div>
          <div className="resource-grid">
            {DEMO_RESOURCES.map((item) => (
              <article key={item.title} className="resource-card">
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.usage}</small>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="instructor-dashboard-grid">
          <div className="instructor-panel instructor-wide-panel">
            <div className="instructor-panel-head"><h3>Course Performance</h3><BarChart3 size={18} /></div>
            {courses.map((course) => (
              <div key={course.id} className="analytics-course-row">
                <div><strong>{course.title}</strong><span>{course.category}</span></div>
                <div className="progress-track"><span style={{ width: `${course.completion_rate ?? 72}%` }} /></div>
                <strong>{course.completion_rate ?? 72}%</strong>
              </div>
            ))}
          </div>
          <div className="instructor-panel">
            <div className="instructor-panel-head"><h3>Signals to Watch</h3><MessageSquare size={18} /></div>
            {['Most missed questions', 'Attendance drops', 'Low study time', 'Certificates pending'].map((item) => (
              <div key={item} className="instructor-activity-row"><strong>{item}</strong><span>Review weekly</span></div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ai-tools' && (
        <div className="resource-grid">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <article key={tool.title} className="ai-tool-card">
                <Icon size={24} />
                <strong>{tool.title}</strong>
                <p>{tool.desc}</p>
                <button className="ghost-btn" onClick={() => setMessage(`${tool.title} will use the Study Coach AI service when the instructor AI workflow is enabled.`)}>Open tool</button>
              </article>
            );
          })}
        </div>
      )}

      {/* Session cards */}
      {tab === 'live-sessions' && <div style={{ display: 'grid', gap: 12 }}>
        {displayed.map((s) => (
          <div key={s.id} className="classroom-card">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#2b8a7d' }}>{s.topic}</span>
                <span className={`status-badge status-${s.status === 'scheduled' ? 'pending' : s.status === 'completed' ? 'paid' : 'failed'}`}>{s.status}</span>
              </div>
              <h4 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{s.title}</h4>
              <div style={{ display: 'flex', gap: 14, fontSize: '0.84rem', color: '#607478', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Calendar size={13} />{formatDateTime(s.starts_at)}</span>
                {s.ends_at && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Clock size={13} />{Math.round((new Date(s.ends_at) - new Date(s.starts_at)) / 60000)} min</span>}
                {s.attendee_count > 0 && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Users size={13} />{s.attendee_count} students</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {['scheduled', 'live'].includes(s.status) && new Date(s.starts_at) - new Date() < 30 * 60000 && (
                <button onClick={() => startSession(s)} className="primary-btn" style={{ whiteSpace: 'nowrap' }}>
                  <Video size={14} /> Start Session
                </button>
              )}
              {s.recording_url && (
                <a href={s.recording_url} target="_blank" rel="noreferrer" className="ghost-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={14} /> Recording
                </a>
              )}
              {s.status === 'scheduled' && (
                <button className="ghost-btn" style={{ color: '#8a2c21' }} onClick={() => cancelSession(s.id)}>Cancel</button>
              )}
            </div>
          </div>
        ))}
        {!displayed.length && (
          <div style={{ textAlign: 'center', padding: 40, color: '#607478' }}>
            <p>No upcoming sessions. Schedule your first one!</p>
            <button className="primary-btn" onClick={() => setShowForm(true)}><PlusCircle size={15} /> Schedule Session</button>
          </div>
        )}
      </div>}
    </section>
  );
}
