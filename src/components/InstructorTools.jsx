import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, CheckCircle2, Clock, Copy, Link2, PlusCircle, QrCode, Share2, UserMinus, Users, UserX, Video, X } from 'lucide-react';
import {
  createCourseWithOwner,
  generateCourseEnrollmentLink,
  getCourseEnrollmentLinks,
  getMyCourses,
  getCourseRoster,
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

const EMPTY_SESSION = { title: '', topic: 'Pharmacology', description: '', starts_at: '', duration_mins: 90 };
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
  const [courses, setCourses] = useState([]);
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

  const upcoming = sessions.filter((s) => s.status === 'scheduled' && new Date(s.starts_at) > new Date());
  const past = sessions.filter((s) => s.status === 'completed' || new Date(s.starts_at) < new Date());
  const displayed = tab === 'upcoming' ? upcoming : past;

  async function saveSession() {
    if (!form.title || !form.starts_at) return;
    setSaving(true);
    const starts = new Date(form.starts_at).toISOString();
    const ends = new Date(new Date(form.starts_at).getTime() + form.duration_mins * 60000).toISOString();
    const payload = {
      instructor_id: session?.user?.id,
      title: form.title,
      topic: form.topic,
      description: form.description,
      starts_at: starts,
      ends_at: ends,
      status: 'scheduled',
    };

    if (supabase) {
      const { data } = await supabase.from('class_schedules').insert(payload).select().single();
      if (data) setSessions((prev) => [data, ...prev]);
    } else {
      setSessions((prev) => [{ ...payload, id: `s${Date.now()}`, attendee_count: 0 }, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_SESSION);
    setTab('upcoming');
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Upcoming', value: upcoming.length, icon: Calendar, color: '#29b7a3' },
          { label: 'My Courses', value: courses.length, icon: BookOpen, color: '#2b8a7d' },
          { label: 'Total Students', value: Math.max(totalStudents, rosterStudentCount), icon: Users, color: '#e3a72f' },
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
        <button className={`tab-btn ${tab === 'dashboard' ? 'tab-active' : ''}`} onClick={() => setTab('dashboard')}>My Courses ({courses.length})</button>
        <button className={`tab-btn ${tab === 'upcoming' ? 'tab-active' : ''}`} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</button>
        <button className={`tab-btn ${tab === 'past' ? 'tab-active' : ''}`} onClick={() => setTab('past')}>Past Sessions ({past.length})</button>
      </div>

      {tab === 'dashboard' && (
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

      {/* Session cards */}
      {tab !== 'dashboard' && <div style={{ display: 'grid', gap: 12 }}>
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
              {s.status === 'scheduled' && (
                <button onClick={() => setActiveSession(s)} className="primary-btn" style={{ whiteSpace: 'nowrap' }}>
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
            <p>{tab === 'upcoming' ? 'No upcoming sessions. Schedule your first one!' : 'No past sessions yet.'}</p>
            {tab === 'upcoming' && <button className="primary-btn" onClick={() => setShowForm(true)}><PlusCircle size={15} /> Schedule Session</button>}
          </div>
        )}
      </div>}
    </section>
  );
}
