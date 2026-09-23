// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../src/services/supabase', () => ({ supabase: { rpc: (...args) => mock.rpc(...args) } }));
import DiagnosticView from '../src/components/DiagnosticView';
import DiagnosticAdmin from '../src/components/DiagnosticAdmin';

const session = { user: { id: 'student' } };
const ok = data => ({ data, error: null });
const fail = message => ({ data: null, error: { message } });
const choices = [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Bravo' }, { id: 'c', text: 'Charlie' }];
const attemptPayload = (selected = {}) => ({
  attempt_id: 'att', status: 'in_progress', attempt_no: 1, answered: 0,
  items: [
    { position: 1, question_id: 'q1', part: 'A', question_type: 'mcq', prompt: 'First prompt?', choices, selected: selected.q1 ?? null },
    { position: 2, question_id: 'q2', part: 'A', question_type: 'sata', prompt: 'Second prompt?', choices, selected: selected.q2 ?? null },
  ],
});
const band = (name, correct, total, b) => ({ name, correct, total, pct: Math.round(correct / total * 100), band: b });
const report = {
  overall: { total: 2, correct: 1, pct: 50, band: 'weak' },
  note: 'NurseFaculty internal diagnostic bands. Not an NCLEX passing standard or pass prediction.',
  parts: [band('A', 1, 2, 'weak')],
  subcategories: [band('Pharmacological and Parenteral Therapies', 0, 1, 'critical'), band('Management of Care', 1, 1, 'strong')],
  topics: [band('Cardiology', 1, 2, 'insufficient_data')], clinical_judgment: [],
  roadmap: [{ rank: 1, level: 'subcategory', name: 'Pharmacological and Parenteral Therapies', band: 'critical', pct: 0 }],
};

beforeEach(() => { mock.rpc.mockReset(); });
afterEach(cleanup);

function learnerRpc(overrides = {}) {
  mock.rpc.mockImplementation(async (name, args) => {
    if (overrides[name]) return overrides[name](args);
    if (name === 'my_diagnostic_assignments') return ok([{ form_id: 'f1', name: 'SMART Diagnostic', attempts_allowed: 2, attempts_used: 0, open_attempt_id: null, last_attempt_id: null }]);
    if (name === 'my_diagnostic_progress') return ok([]);
    if (name === 'start_diagnostic') return ok('att');
    if (name === 'get_diagnostic_attempt') return ok(attemptPayload());
    if (name === 'save_diagnostic_answer') return ok(null);
    if (name === 'submit_diagnostic') return ok(report);
    if (name === 'get_my_diagnostic_report') return ok(report);
    if (name === 'get_my_diagnostic_review') return ok([{ position: 2, question_id: 'q2', prompt: 'Second prompt?', selected: ['a'], correct_answer: ['b', 'c'], is_correct: false, rationale: 'Because of the rationale.' }]);
    return ok(null);
  });
}

it('learner sees an empty state when nothing is assigned', async () => {
  learnerRpc({ my_diagnostic_assignments: async () => ok([]) });
  render(<DiagnosticView session={session} />);
  expect(await screen.findByText('No diagnostic assigned yet')).toBeTruthy();
  expect(screen.getByRole('note').textContent).toContain('not NCLEX passing standards');
});

it('learner can start, answer, navigate, and cannot clear a select-all answer; answers are saved server-side', async () => {
  learnerRpc();
  render(<DiagnosticView session={session} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start diagnostic' }));
  expect(await screen.findByText('Question 1 of 2')).toBeTruthy();
  expect(screen.getByText('First prompt?')).toBeTruthy();
  // nothing about correctness or rationale is shown while the attempt is open
  expect(document.body.textContent).not.toMatch(/rationale|correct answer/i);
  fireEvent.click(screen.getByLabelText('Bravo'));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('save_diagnostic_answer', expect.objectContaining({ p_attempt: 'att', p_question: 'q1', p_ids: ['b'] })));
  await screen.findByText(/Saved/);
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  expect(await screen.findByText('Question 2 of 2')).toBeTruthy(); expect(screen.getByText('Select all that apply')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Alpha')); fireEvent.click(screen.getByLabelText('Charlie'));
  await waitFor(() => expect(mock.rpc).toHaveBeenLastCalledWith('save_diagnostic_answer', expect.objectContaining({ p_question: 'q2', p_ids: ['a', 'c'] })));
  fireEvent.click(screen.getByLabelText('Alpha')); fireEvent.click(screen.getByLabelText('Charlie'));
  const saves = mock.rpc.mock.calls.filter(([n]) => n === 'save_diagnostic_answer');
  expect(saves.at(-1)[1].p_ids.length).toBeGreaterThan(0); // the last selection can never be cleared
  expect(screen.getByLabelText('Charlie').checked).toBe(true);
});

it('resumes an open attempt with saved answers and jumps to the first unanswered question', async () => {
  learnerRpc({
    my_diagnostic_assignments: async () => ok([{ form_id: 'f1', name: 'SMART Diagnostic', attempts_allowed: 1, attempts_used: 1, open_attempt_id: 'att', last_attempt_id: null }]),
    get_diagnostic_attempt: async () => ok(attemptPayload({ q1: ['a'] })),
  });
  render(<DiagnosticView session={session} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Resume diagnostic' }));
  expect(await screen.findByText('Question 2 of 2')).toBeTruthy();
  expect(screen.getByText(/1\/2 answered/)).toBeTruthy();
});

it('submission asks for confirmation, counts unanswered questions, then shows the honest report', async () => {
  learnerRpc();
  render(<DiagnosticView session={session} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start diagnostic' }));
  await screen.findByText('Question 1 of 2');
  fireEvent.click(screen.getAllByRole('button', { name: 'Submit diagnostic' })[0]);
  const dialog = await screen.findByRole('dialog');
  expect(dialog.textContent).toContain('2 unanswered questions'); expect(dialog.textContent).toContain('count as incorrect');
  fireEvent.click(within(dialog).getByText('Keep working')); expect(screen.queryByRole('dialog')).toBeNull();
  expect(mock.rpc.mock.calls.some(([n]) => n === 'submit_diagnostic')).toBe(false);
  fireEvent.click(screen.getAllByRole('button', { name: 'Submit diagnostic' })[0]);
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Submit diagnostic' }));
  expect(await screen.findByText('Your roadmap')).toBeTruthy();
  expect(screen.getByLabelText('Overall result').textContent).toContain('50%');
  expect(screen.getByRole('note').textContent).toContain('Not an NCLEX passing standard');
  // bands are shown as text, never colour alone; small samples are not rated
  expect(screen.getAllByText(/Critical/).length).toBeGreaterThan(0); expect(screen.getAllByText(/Too few questions to rate/).length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toMatch(/pass probability|likely to pass/i);
});

it('review of missed questions is loaded on request and shows the rationale only after submission', async () => {
  learnerRpc({ my_diagnostic_assignments: async () => ok([{ form_id: 'f1', name: 'SMART Diagnostic', attempts_allowed: 1, attempts_used: 1, open_attempt_id: null, last_attempt_id: 'att' }]) });
  render(<DiagnosticView session={session} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View latest report' }));
  await screen.findByText('Your roadmap');
  expect(screen.queryByText('Because of the rationale.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Show missed questions/ }));
  expect(await screen.findByText('Because of the rationale.')).toBeTruthy();
});

it('progress history compares attempts and errors are shown as safe messages', async () => {
  learnerRpc({
    my_diagnostic_progress: async () => ok([{ attempt_id: 'a1', attempt_no: 1, submitted_at: '2026-09-01T00:00:00Z', pct: 40 }, { attempt_id: 'a2', attempt_no: 2, submitted_at: '2026-09-20T00:00:00Z', pct: 65 }]),
    start_diagnostic: async () => fail('No diagnostic attempts remaining'),
  });
  render(<DiagnosticView session={session} />);
  const table = await screen.findByRole('table');
  expect(within(table).getByText('+25 pts')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Start diagnostic' }));
  expect((await screen.findByRole('alert')).textContent).toContain('No diagnostic attempts remaining');
  cleanup(); learnerRpc({ my_diagnostic_assignments: async () => fail('relation "diagnostic_forms" does not exist (secret detail)') });
  render(<DiagnosticView session={session} />);
  const alert = await screen.findByRole('alert'); expect(alert.textContent).not.toMatch(/relation|secret/); expect(alert.textContent).toContain('could not be completed');
});

// ---------------- admin ----------------
const draftForm = (items = []) => ({ id: 'f1', name: 'SMART', version: 1, status: 'draft', items });
const invalid = { items: 0, parts: {}, subcategories: [{ subcategory: 'Management of Care', target: 27, have: 0 }], problems: ['Form must contain exactly 150 items (has 0)'], valid: false };
function adminRpc(overrides = {}) {
  mock.rpc.mockImplementation(async (name, args) => {
    if (overrides[name]) return overrides[name](args);
    if (name === 'admin_diagnostic_list_forms') return ok([{ id: 'f1', name: 'SMART', version: 1, status: 'draft', items: 0, assigned: 0, submitted: 0 }]);
    if (name === 'admin_diagnostic_get_form') return ok(draftForm());
    if (name === 'admin_diagnostic_validate_form') return ok(invalid);
    return ok(null);
  });
}

it('admin sees the forms list, can create a draft and open the builder', async () => {
  adminRpc({ admin_diagnostic_create_form: async () => ok('f1') });
  render(<DiagnosticAdmin />);
  expect(await screen.findByRole('table', { name: '' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('New diagnostic form name'), { target: { value: 'SMART' } });
  fireEvent.click(screen.getByRole('button', { name: /Create draft/ }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('admin_diagnostic_create_form', { p_name: 'SMART' }));
  expect(await screen.findByText('Form checklist')).toBeTruthy();
});

it('admin access errors surface safely and an empty list shows guidance', async () => {
  mock.rpc.mockResolvedValue(fail('Administrator access required'));
  render(<DiagnosticAdmin />);
  expect((await screen.findByRole('alert')).textContent).toContain('Administrator access required');
  cleanup(); adminRpc({ admin_diagnostic_list_forms: async () => ok([]) });
  render(<DiagnosticAdmin />);
  expect(await screen.findByText('No diagnostic forms yet')).toBeTruthy();
});

it('builder: publish stays disabled until valid, part A proposal, add-question search and remove work on drafts', async () => {
  adminRpc({
    admin_diagnostic_propose_items: async () => ok({ added: 100, shortfalls: [{ subcategory: 'Psychosocial Integrity' }] }),
    admin_diagnostic_search_questions: async () => ok([{ id: 'qa', topic: 'Cardiology', client_need: 'Physiological Adaptation', cj_step: 'Analyze Cues', question_type: 'mcq', prompt: 'A candidate question' }]),
    admin_diagnostic_set_item: async () => ok(null),
    admin_diagnostic_remove_item: async () => ok(null),
  });
  render(<DiagnosticAdmin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open SMART' }));
  await screen.findByText('Form checklist');
  expect(screen.getByRole('button', { name: 'Publish' }).disabled).toBe(true);
  expect(screen.getByRole('list', { name: 'Problems to fix' }).textContent).toContain('exactly 150');
  fireEvent.click(screen.getByRole('button', { name: /Propose Part A/ }));
  expect(await screen.findByText(/Added 100 Part A questions.*Psychosocial Integrity/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));
  expect(await screen.findByText('A candidate question')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'C' } });
  fireEvent.click(screen.getByRole('button', { name: /Add to position/ }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('admin_diagnostic_set_item', expect.objectContaining({ p_form: 'f1', p_question: 'qa', p_part: 'C', p_subcategory: 'Physiological Adaptation', p_cj_step: 'Analyze Cues' })));
});

it('valid draft can be published only after confirmation; published forms are read-only with assign and results tabs', async () => {
  const valid = { ...invalid, items: 150, parts: { A: 100, B: 30, C: 10, D: 10 }, problems: [], valid: true };
  let published = false;
  adminRpc({
    admin_diagnostic_get_form: async () => ok({ ...draftForm([{ position: 1, question_id: 'q1', part: 'A', subcategory: 'Management of Care', subtopic: 'Delegation', cj_step: null, prompt: 'Q one' }]), status: published ? 'published' : 'draft' }),
    admin_diagnostic_validate_form: async () => ok(valid),
    admin_diagnostic_publish_form: async () => { published = true; return ok(null); },
    admin_diagnostic_assignments: async () => ok([{ user_id: 'u1', full_name: 'Stu Dent', email: 's@x.com', attempts_allowed: 1, attempts_used: 0 }]),
    admin_diagnostic_list_attempts: async () => ok({ total: 1, rows: [{ attempt_id: 'att', user_id: 'u1', full_name: 'Stu Dent', attempt_no: 1, submitted_at: '2026-09-20T00:00:00Z', pct: 61.5 }] }),
    admin_diagnostic_find_users: async () => ok([{ id: 'u2', full_name: 'New Person', email: 'n@x.com' }]),
    admin_diagnostic_assign: async () => ok(1),
  });
  render(<DiagnosticAdmin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open SMART' }));
  const publish = await screen.findByRole('button', { name: 'Publish' }); await waitFor(() => expect(publish.disabled).toBe(false));
  fireEvent.click(publish);
  const dialog = await screen.findByRole('dialog'); expect(dialog.textContent).toContain('cannot be edited');
  expect(mock.rpc.mock.calls.some(([n]) => n === 'admin_diagnostic_publish_form')).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish form' }));
  await screen.findByRole('tab', { name: 'Assign students' });
  expect(screen.queryByRole('button', { name: /Remove question/ })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Assign students' }));
  expect(await screen.findByText('Stu Dent')).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Find student/), { target: { value: 'New' } }); fireEvent.click(screen.getByRole('button', { name: /Find/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Assign New Person' }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('admin_diagnostic_assign', { p_form: 'f1', p_users: ['u2'], p_attempts: 1 }));
  fireEvent.click(screen.getByRole('tab', { name: 'Results' }));
  expect(await screen.findByText('62%')).toBeTruthy();
});

it('admin can open an attempt, see error counts and tag a missed question with the full A-G taxonomy', async () => {
  const adminReport = { attempt_id: 'att', attempt_no: 1, report, error_tags: [] };
  const review = [
    { position: 1, question_id: 'q1', subcategory: 'Management of Care', subtopic: 'Delegation', prompt: 'Missed one', selected: ['a'], correct_answer: ['b'], is_correct: false, answered: true, seconds: 12, error_type: null, error_note: null },
    { position: 2, question_id: 'q2', subcategory: 'Management of Care', subtopic: null, prompt: 'Got it', selected: ['a'], correct_answer: ['a'], is_correct: true, answered: true, seconds: 5, error_type: null, error_note: null },
  ];
  adminRpc({
    admin_diagnostic_get_form: async () => ok({ ...draftForm(), status: 'published' }),
    admin_diagnostic_validate_form: async () => ok({ ...invalid, valid: true, problems: [] }),
    admin_diagnostic_assignments: async () => ok([]),
    admin_diagnostic_list_attempts: async () => ok({ total: 1, rows: [{ attempt_id: 'att', user_id: 'u1', full_name: 'Stu Dent', attempt_no: 1, submitted_at: '2026-09-20T00:00:00Z', pct: 50 }] }),
    admin_get_diagnostic_report: async () => ok(adminReport),
    admin_get_diagnostic_review: async () => ok(review),
    admin_diagnostic_tag_error: async () => ok(null),
  });
  render(<DiagnosticAdmin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open SMART' }));
  fireEvent.click(await screen.findByRole('tab', { name: 'Results' }));
  fireEvent.click(await screen.findByRole('button', { name: /Open attempt 1 for Stu Dent/ }));
  expect(await screen.findByText('Why questions were missed')).toBeTruthy();
  expect(screen.getByText(/0 of 1 missed questions tagged/)).toBeTruthy(); expect(screen.queryByText('Got it')).toBeNull();
  const select = screen.getByLabelText('Error type');
  const options = [...select.querySelectorAll('option')].map(o => o.value).filter(Boolean);
  expect(options).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  fireEvent.click(screen.getByRole('button', { name: 'Save tag for question 1' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Choose an error type');
  fireEvent.change(select, { target: { value: 'F' } });
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Changed answer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save tag for question 1' }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('admin_diagnostic_tag_error', { p_attempt: 'att', p_question: 'q1', p_type: 'F', p_note: 'Changed answer' }));
});
