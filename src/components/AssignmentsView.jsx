import React, { useEffect, useState } from 'react';
import { ClipboardCheck, PlusCircle, Upload, CheckCircle2, Clock, X, Send, FileText } from 'lucide-react';
import { supabase } from '../services/supabase';

const DEMO_ASSIGNMENTS = [
  { id: 'a1', title: 'Pharmacology Case Study — Beta Blockers', description: 'Answer 5 short-answer questions about metoprolol and atenolol: mechanism, nursing implications, contraindications, and patient teaching.', due_date: new Date(Date.now() + 86400000 * 3).toISOString(), max_score: 100, topic: 'Pharmacology', status: 'open', created_by: 'instructor@nursefaculty.org' },
  { id: 'a2', title: 'NGN Practice: Heart Failure Case', description: 'Complete the 6-item NGN unfolding case study on a patient admitted with acute decompensated heart failure. Submit screenshot of your answers and rationale.', due_date: new Date(Date.now() + 86400000 * 7).toISOString(), max_score: 50, topic: 'Medical-Surgical', status: 'open', created_by: 'instructor@nursefaculty.org' },
  { id: 'a3', title: 'Mental Health: Therapeutic Communication Worksheet', description: 'For each non-therapeutic response provided, rewrite it using a therapeutic technique. Identify the technique used.', due_date: new Date(Date.now() - 86400000 * 1).toISOString(), max_score: 30, topic: 'Mental Health', status: 'closed', created_by: 'instructor@nursefaculty.org' },
];

const DEMO_SUBMISSIONS = [
  { id: 's1', assignment_id: 'a1', user_email: 'alice@student.com', submitted_at: new Date(Date.now() - 3600000).toISOString(), content: 'Metoprolol is a cardioselective beta-1 blocker used in hypertension, heart failure, and post-MI...', score: null, feedback: null, status: 'submitted' },
  { id: 's2', assignment_id: 'a3', user_email: 'bob@student.com', submitted_at: new Date(Date.now() - 86400000 * 2).toISOString(), content: 'Non-therapeutic: "Don\'t worry, everything will be fine." Therapeutic: "It sounds like you\'re feeling anxious. Can you tell me more?"', score: 27, feedback: 'Excellent identification of therapeutic techniques. Work on the active listening section.', status: 'graded' },
];

const TOPICS = ['Pharmacology', 'Medical-Surgical', 'Mental Health', 'Maternal and Newborn', 'Pediatrics', 'NGN Clinical Judgment', 'Infection Control', 'Leadership & Management'];

function isPast(dateStr) {
  return new Date(dateStr) < new Date();
}

export default function AssignmentsView({ session }) {
  const [assignments, setAssignments] = useState(supabase ? [] : DEMO_ASSIGNMENTS);
  const [submissions, setSubmissions] = useState(supabase ? [] : DEMO_SUBMISSIONS);
  const [tab, setTab] = useState('assignments');
  const [selected, setSelected] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [gradingId, setGradingId] = useState(null);
  const [gradeInput, setGradeInput] = useState({ score: '', feedback: '' });
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', topic: 'Pharmacology', due_date: '', max_score: 100 });

  const isInstructor = session?.user?.email?.includes('instructor') || session?.user?.user_metadata?.role === 'instructor';
  const userEmail = session?.user?.email;

  useEffect(() => {
    if (!supabase) return;
    supabase.from('assignments').select('*').order('due_date').then(({ data }) => { if (data?.length) setAssignments(data); });
    if (isInstructor) {
      supabase.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }).then(({ data }) => { if (data?.length) setSubmissions(data); });
    } else if (userEmail) {
      supabase.from('assignment_submissions').select('*').eq('user_email', userEmail).then(({ data }) => { if (data?.length) setSubmissions(data); });
    }
  }, []);

  async function submitAssignment() {
    if (!submissionText.trim() || !selected) return;
    setSubmitting(true);
    const payload = {
      assignment_id: selected.id,
      user_email: userEmail ?? 'demo@student.com',
      content: submissionText.trim(),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    };
    if (supabase) {
      const { data } = await supabase.from('assignment_submissions').insert(payload).select().single();
      if (data) setSubmissions((prev) => [data, ...prev]);
    } else {
      setSubmissions((prev) => [{ ...payload, id: `s${Date.now()}`, score: null, feedback: null }, ...prev]);
    }
    setSubmitting(false);
    setSelected(null);
    setSubmissionText('');
  }

  async function createAssignment() {
    if (!newAssignment.title || !newAssignment.due_date) return;
    const payload = { ...newAssignment, max_score: Number(newAssignment.max_score), status: 'open', created_by: userEmail ?? 'instructor', created_at: new Date().toISOString() };
    if (supabase) {
      const { data } = await supabase.from('assignments').insert(payload).select().single();
      if (data) setAssignments((prev) => [...prev, data]);
    } else {
      setAssignments((prev) => [...prev, { ...payload, id: `a${Date.now()}` }]);
    }
    setNewAssignment({ title: '', description: '', topic: 'Pharmacology', due_date: '', max_score: 100 });
    setShowCreate(false);
  }

  async function saveGrade() {
    const sub = submissions.find((s) => s.id === gradingId);
    if (!sub) return;
    const updates = { score: Number(gradeInput.score), feedback: gradeInput.feedback, status: 'graded' };
    if (supabase) await supabase.from('assignment_submissions').update(updates).eq('id', gradingId);
    setSubmissions((prev) => prev.map((s) => s.id === gradingId ? { ...s, ...updates } : s));
    setGradingId(null);
    setGradeInput({ score: '', feedback: '' });
  }

  const mySubmissions = submissions.filter((s) => s.user_email === userEmail);

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Assignments</h2>
        {isInstructor && (
          <button className="primary-btn" onClick={() => setShowCreate(true)}>
            <PlusCircle size={15} /> New Assignment
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {isInstructor ? [
          { label: 'Assignments', value: assignments.length, color: '#29b7a3' },
          { label: 'Submissions', value: submissions.length, color: '#2b8a7d' },
          { label: 'Pending Grade', value: submissions.filter((s) => s.status === 'submitted').length, color: '#e3a72f' },
          { label: 'Graded', value: submissions.filter((s) => s.status === 'graded').length, color: '#8b5cf6' },
        ] : [
          { label: 'Total', value: assignments.length, color: '#29b7a3' },
          { label: 'Open', value: assignments.filter((a) => !isPast(a.due_date)).length, color: '#2b8a7d' },
          { label: 'Submitted', value: mySubmissions.length, color: '#e3a72f' },
          { label: 'Graded', value: mySubmissions.filter((s) => s.status === 'graded').length, color: '#8b5cf6' },
        ].map((s) => (
          <div key={s.label} className="qm-stat" style={{ borderColor: s.color }}>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs for instructor */}
      {isInstructor && (
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {[['assignments', 'Assignments'], ['submissions', 'Submissions']].map(([key, label]) => (
            <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
      )}

      {/* Create assignment form */}
      {showCreate && (
        <div className="qm-editor" style={{ marginBottom: 18 }}>
          <div className="qm-editor-header">
            <strong>New Assignment</strong>
            <button className="icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button>
          </div>
          <div className="qm-form-grid">
            <div className="qm-form-row" style={{ gridColumn: '1/-1' }}>
              <label>Title</label>
              <input value={newAssignment.title} onChange={(e) => setNewAssignment((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. NGN Case Study: Sepsis" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
            </div>
            <div className="qm-form-row" style={{ gridColumn: '1/-1' }}>
              <label>Instructions</label>
              <textarea className="editor-textarea" rows={3} value={newAssignment.description} onChange={(e) => setNewAssignment((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the assignment task, submission format, and any resources to use…" />
            </div>
            <div className="qm-form-row">
              <label>Topic</label>
              <select value={newAssignment.topic} onChange={(e) => setNewAssignment((p) => ({ ...p, topic: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="qm-form-row">
              <label>Due Date</label>
              <input type="datetime-local" value={newAssignment.due_date} onChange={(e) => setNewAssignment((p) => ({ ...p, due_date: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
            <div className="qm-form-row">
              <label>Max Score</label>
              <input type="number" min="1" value={newAssignment.max_score} onChange={(e) => setNewAssignment((p) => ({ ...p, max_score: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
            </div>
          </div>
          <div className="editor-footer">
            <button className="ghost-btn" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="primary-btn" onClick={createAssignment} disabled={!newAssignment.title || !newAssignment.due_date}>Create Assignment</button>
          </div>
        </div>
      )}

      {/* Submission modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 600, width: '100%', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#17212f' }}>{selected.title}</h3>
                <div style={{ fontSize: '0.82rem', color: '#8a999c', marginTop: 4 }}>Due: {new Date(selected.due_date).toLocaleString()} · Max: {selected.max_score} pts</div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafb', borderRadius: 10, fontSize: '0.86rem', color: '#42585e', lineHeight: 1.6, marginBottom: 16 }}>{selected.description}</div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#17212f', display: 'block', marginBottom: 8 }}>Your Submission</label>
            <textarea className="editor-textarea" rows={8} value={submissionText} onChange={(e) => setSubmissionText(e.target.value)} placeholder="Type your answer here…" />
            <div className="editor-footer" style={{ marginTop: 14 }}>
              <button className="ghost-btn" onClick={() => setSelected(null)}>Cancel</button>
              <button className="primary-btn" onClick={submitAssignment} disabled={submitting || !submissionText.trim()}>
                {submitting ? 'Submitting…' : <><Send size={14} /> Submit</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grading modal */}
      {gradingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong>Grade Submission</strong>
              <button className="icon-btn" onClick={() => setGradingId(null)}><X size={18} /></button>
            </div>
            {(() => {
              const sub = submissions.find((s) => s.id === gradingId);
              const asgn = assignments.find((a) => a.id === sub?.assignment_id);
              return (
                <>
                  <div style={{ padding: '10px 14px', background: '#f8fafb', borderRadius: 10, fontSize: '0.86rem', color: '#42585e', lineHeight: 1.5, marginBottom: 14, maxHeight: 200, overflowY: 'auto' }}>{sub?.content}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <div className="qm-form-row" style={{ flex: 1 }}>
                      <label>Score (max {asgn?.max_score ?? 100})</label>
                      <input type="number" min="0" max={asgn?.max_score ?? 100} value={gradeInput.score} onChange={(e) => setGradeInput((p) => ({ ...p, score: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', width: '100%' }} />
                    </div>
                  </div>
                  <div className="qm-form-row">
                    <label>Feedback</label>
                    <textarea className="editor-textarea" rows={4} value={gradeInput.feedback} onChange={(e) => setGradeInput((p) => ({ ...p, feedback: e.target.value }))} placeholder="Write feedback for the student…" />
                  </div>
                  <div className="editor-footer" style={{ marginTop: 14 }}>
                    <button className="ghost-btn" onClick={() => setGradingId(null)}>Cancel</button>
                    <button className="primary-btn" onClick={saveGrade} disabled={gradeInput.score === ''}>Save Grade</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Assignments list */}
      {(!isInstructor || tab === 'assignments') && (
        <div style={{ display: 'grid', gap: 12 }}>
          {assignments.map((a) => {
            const past = isPast(a.due_date);
            const mySubmission = mySubmissions.find((s) => s.assignment_id === a.id);
            return (
              <div key={a.id} style={{ border: `1.5px solid ${past ? '#dbe6e4' : '#29b7a388'}`, borderLeft: `4px solid ${past ? '#8a999c' : '#29b7a3'}`, borderRadius: 12, padding: '14px 16px', background: '#fff', opacity: past ? 0.75 : 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.97rem', color: '#17212f' }}>{a.title}</strong>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                      <span style={{ color: past ? '#e94868' : '#29b7a3', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={12} /> Due {new Date(a.due_date).toLocaleDateString()}
                      </span>
                      <span style={{ color: '#8b5cf6' }}>Max {a.max_score} pts</span>
                      <span style={{ background: '#e9f1ef', color: '#2b8a7d', padding: '1px 8px', borderRadius: 12, fontWeight: 700 }}>{a.topic}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {mySubmission ? (
                      <span className={`status-badge ${mySubmission.status === 'graded' ? 'status-paid' : 'status-pending'}`}>
                        {mySubmission.status === 'graded' ? `Graded: ${mySubmission.score}/${a.max_score}` : 'Submitted'}
                      </span>
                    ) : !past && !isInstructor && (
                      <button className="primary-btn" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={() => setSelected(a)}>
                        <Upload size={13} /> Submit
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#607478', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.description}</p>
                {mySubmission?.feedback && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0faf8', borderRadius: 8, fontSize: '0.83rem', color: '#2b8a7d' }}>
                    <FileText size={12} style={{ display: 'inline', marginRight: 4 }} /> <strong>Instructor Feedback:</strong> {mySubmission.feedback}
                  </div>
                )}
              </div>
            );
          })}
          {assignments.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#8a999c' }}>
              <ClipboardCheck size={36} color="#dbe6e4" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p>No assignments yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Submissions list (instructor only) */}
      {isInstructor && tab === 'submissions' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Status</th><th>Score</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const asgn = assignments.find((a) => a.id === sub.assignment_id);
                return (
                  <tr key={sub.id}>
                    <td>{sub.user_email ?? sub.user_id?.slice(0, 8)}</td>
                    <td style={{ fontSize: '0.84rem', maxWidth: 180 }}>{asgn?.title ?? sub.assignment_id}</td>
                    <td style={{ fontSize: '0.83rem', color: '#607478' }}>{new Date(sub.submitted_at).toLocaleDateString()}</td>
                    <td><span className={`status-badge ${sub.status === 'graded' ? 'status-paid' : 'status-pending'}`}>{sub.status}</span></td>
                    <td>{sub.score !== null ? <strong style={{ color: '#29b7a3' }}>{sub.score}/{asgn?.max_score ?? '?'}</strong> : <span style={{ color: '#8a999c' }}>—</span>}</td>
                    <td>
                      <button className="primary-btn" style={{ fontSize: '0.78rem', padding: '4px 12px' }} onClick={() => { setGradingId(sub.id); setGradeInput({ score: sub.score ?? '', feedback: sub.feedback ?? '' }); }}>
                        <CheckCircle2 size={12} /> {sub.status === 'graded' ? 'Re-grade' : 'Grade'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {submissions.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#8a999c', padding: 24 }}>No submissions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
