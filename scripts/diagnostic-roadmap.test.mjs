import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';

const db = new PGlite();
after(() => db.close());
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ADMIN = uid(1), S1 = uid(11), S2 = uid(12);
const SUBS = ['Management of Care', 'Safety and Infection Prevention and Control', 'Health Promotion and Maintenance', 'Psychosocial Integrity',
  'Basic Care and Comfort', 'Pharmacological and Parenteral Therapies', 'Reduction of Risk Potential', 'Physiological Adaptation'];
const TARGET = [27, 20, 14, 14, 14, 24, 18, 19];

await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated,service_role; grant usage on schema public to anon,authenticated,service_role;
create table profiles(id uuid primary key,full_name text,email text);
create table questions(id uuid primary key default gen_random_uuid(),topic text,question_type text,prompt text,choices jsonb,correct_answer jsonb,rationale text,
 status text,client_need text,clinical_judgment text,clinical_review_status text,ngn_data jsonb,strategy text);
create function public.has_role(text[]) returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
insert into profiles values('${ADMIN}','Admin','a@x.com'),('${S1}','Student One','s1@x.com'),('${S2}','Student Two','s2@x.com');
`);
// 60 eligible questions per subcategory + a few ineligible ones that must never be selected.
await db.exec(`
insert into questions(topic,question_type,prompt,choices,correct_answer,rationale,status,client_need,clinical_judgment,clinical_review_status,ngn_data,strategy)
select 'Topic '||(n%6),case when n%4=0 then 'sata' else 'mcq' end,'Prompt '||sn||'-'||n,
 '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]'::jsonb,
 case when n%4=0 then '{"ids":["a","c"]}'::jsonb else jsonb_build_object('ids',jsonb_build_array(case n%3 when 0 then 'a' when 1 then 'b' else 'd' end)) end,
 repeat('Rationale text. ',10),'published',sn,(array['Recognize Cues','Analyze Cues','Generate Solutions','Take Action','Evaluate Outcomes','Prioritize Hypotheses'])[1+n%6],'approved',
 '{"secret":"ngn-key"}'::jsonb,'strategy-secret'
from unnest(array['${SUBS.join("','")}']) sn cross join generate_series(1,60) n;
insert into questions(topic,question_type,prompt,choices,correct_answer,rationale,status,client_need,clinical_review_status)
values('T','mcq','draft one','[{"id":"a","text":"A"},{"id":"b","text":"B"}]','{"ids":["a"]}',repeat('R ',60),'draft','Management of Care','approved'),
('T','matrix','ngn type','[{"id":"a","text":"A"},{"id":"b","text":"B"}]','{"ids":["a"]}',repeat('R ',60),'published','Management of Care','approved'),
('T','mcq','short rationale','[{"id":"a","text":"A"},{"id":"b","text":"B"}]','{"ids":["a"]}','short','published','Management of Care','approved'),
('T','mcq','pending review','[{"id":"a","text":"A"},{"id":"b","text":"B"}]','{"ids":["a"]}',repeat('R ',60),'published','Management of Care','pending');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260921020000_smart_diagnostic_system.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260922020000_diagnostic_ui_support.sql', import.meta.url), 'utf8'));

const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const as = async (who, fn) => {
  await db.exec(`reset role; set test.uid='${who}'; set test.admin='${who === ADMIN ? 'true' : 'false'}'; set role authenticated`);
  try { return await fn(); } finally { await db.exec('reset role'); }
};
const rpc = async (name, args = {}) => {
  const keys = Object.keys(args);
  const cast = v => Array.isArray(v) ? '::' + (typeof v[0] === 'string' && /^[0-9a-f]{8}-/.test(v[0]) ? 'uuid[]' : 'text[]') : '';
  return (await query(`select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}${cast(args[k])}`).join(',')}) value`, Object.values(args)))[0].value;
};
const state = {};

test('band thresholds are the NurseFaculty internal bands; small samples are flagged, not labelled', async () => {
  const band = async (c, t, m = 1) => (await query('select public.diagnostic_band($1,$2,$3) b', [c, t, m]))[0].b;
  assert.equal(await band(80, 100), 'strong'); assert.equal(await band(79, 100), 'developing'); assert.equal(await band(65, 100), 'developing');
  assert.equal(await band(64, 100), 'weak'); assert.equal(await band(50, 100), 'weak'); assert.equal(await band(49, 100), 'critical');
  assert.equal(await band(3, 3, 4), 'insufficient_data'); assert.equal(await band(0, 0), 'no_data');
});

test('Part A quota allocates exactly 100 across the blueprint by largest remainder', async () => {
  const q = await query('select sub_name,quota from public.diagnostic_quota(100) order by sub_sort');
  assert.deepEqual(q.map(r => r.quota), [18, 13, 9, 9, 10, 16, 12, 13]);
  assert.equal(q.reduce((a, r) => a + r.quota, 0), 100);
  assert.equal((await query('select sum(sub_target)::int s from public.diagnostic_blueprint()'))[0].s, 150);
});

test('only admins can author; clients cannot call internal helpers; anon has no access', async () => {
  await assert.rejects(as(S1, () => rpc('admin_diagnostic_create_form', { p_name: 'X' })), /Administrator access required/);
  const priv = async (fn, role) => (await query(`select has_function_privilege('${role}','public.${fn}','execute') v`))[0].v;
  for (const fn of ['diagnostic_build_report(uuid)', 'diagnostic_quota(integer)', 'diagnostic_items_guard()']) assert.equal(await priv(fn, 'authenticated'), false, fn);
  for (const fn of ['start_diagnostic(uuid)', 'submit_diagnostic(uuid)', 'admin_diagnostic_publish_form(uuid)']) { assert.equal(await priv(fn, 'anon'), false, fn); assert.equal(await priv(fn, 'authenticated'), true, fn); }
  await assert.rejects(query("select count(*) from public.diagnostic_answers").then(async () => { await db.exec('set role authenticated'); try { await query('select count(*) from public.diagnostic_answers'); } finally { await db.exec('reset role'); } }), /permission denied/);
});

test('proposal picks only eligible, unused questions by blueprint quota; forms complete to 150 and publish; published forms are immutable', async () => {
  state.form = await as(ADMIN, () => rpc('admin_diagnostic_create_form', { p_name: 'SMART Diagnostic' }));
  const res = await as(ADMIN, () => rpc('admin_diagnostic_propose_items', { p_form: state.form, p_seed: 'seed-1' }));
  assert.equal(res.added, 100); assert.deepEqual(res.shortfalls, []);
  const perSub = await query('select subcategory,count(*)::int n from diagnostic_items where form_id=$1 group by 1', [state.form]);
  const byName = Object.fromEntries(perSub.map(r => [r.subcategory, r.n]));
  assert.equal(byName['Management of Care'], 18); assert.equal(byName['Basic Care and Comfort'], 10); assert.equal(byName['Physiological Adaptation'], 13);
  assert.equal((await query(`select count(*)::int c from diagnostic_items i join questions q on q.id=i.question_id where q.prompt in ('draft one','ngn type','short rationale','pending review')`))[0].c, 0);
  assert.equal((await query('select count(*)::int c from diagnostic_items i join questions q on q.id=i.question_id where i.subcategory<>q.client_need'))[0].c, 0);
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_propose_items', { p_form: state.form })), /already has items/);
  // incomplete forms cannot be published
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_publish_form', { p_form: state.form })), /incomplete/);
  const check = await as(ADMIN, () => rpc('admin_diagnostic_validate_form', { p_form: state.form }));
  assert.equal(check.valid, false); assert.equal(check.items, 100);
  // ineligible question is refused by manual add
  const [bad] = await query("select id from questions where prompt='ngn type'");
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_set_item', { p_form: state.form, p_position: 101, p_question: bad.id, p_part: 'B', p_subcategory: 'Management of Care' })), /not eligible/);
  // complete Parts B (30), C (10), D (10) to hit each subcategory target exactly
  let pos = 101;
  for (let s = 0; s < SUBS.length; s++) {
    const need = TARGET[s] - byName[SUBS[s]];
    const spare = await query('select id from questions q where client_need=$1 and prompt like \'Prompt %\' and status=\'published\' and question_type in (\'mcq\',\'sata\') and not exists(select 1 from diagnostic_items i where i.question_id=q.id) order by id limit $2', [SUBS[s], need]);
    assert.equal(spare.length, need);
    for (const q of spare) {
      const part = pos <= 130 ? 'B' : pos <= 140 ? 'C' : 'D';
      await as(ADMIN, () => rpc('admin_diagnostic_set_item', { p_form: state.form, p_position: pos, p_question: q.id, p_part: part, p_subcategory: SUBS[s], p_difficulty: 'medium' }));
      pos++;
    }
  }
  const dupQ = (await query('select question_id from diagnostic_items where form_id=$1 and position=1', [state.form]))[0].question_id;
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_set_item', { p_form: state.form, p_position: 150, p_question: dupQ, p_part: 'D', p_subcategory: 'Management of Care' })), /duplicate|unique/i);
  const ok = await as(ADMIN, () => rpc('admin_diagnostic_validate_form', { p_form: state.form }));
  assert.equal(ok.valid, true); assert.equal(ok.items, 150); assert.deepEqual(ok.parts, { A: 100, B: 30, C: 10, D: 10 });
  await as(ADMIN, () => rpc('admin_diagnostic_publish_form', { p_form: state.form }));
  assert.equal((await query('select status from diagnostic_forms where id=$1', [state.form]))[0].status, 'published');
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_remove_item', { p_form: state.form, p_position: 1 })), /immutable/);
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_propose_items', { p_form: state.form })), /Draft form not found/);
});

test('assignment gates access; attempts resume; answers and rationale never leak before submission', async () => {
  await assert.rejects(as(S1, () => rpc('start_diagnostic', { p_form: state.form })), /not assigned/);
  await as(ADMIN, () => rpc('admin_diagnostic_assign', { p_form: state.form, p_users: [S1], p_attempts: 1 }));
  await assert.rejects(as(S2, () => rpc('start_diagnostic', { p_form: state.form })), /not assigned/);
  state.attempt = await as(S1, () => rpc('start_diagnostic', { p_form: state.form }));
  assert.equal(await as(S1, () => rpc('start_diagnostic', { p_form: state.form })), state.attempt);
  const open = await as(S1, () => rpc('get_diagnostic_attempt', { p_attempt: state.attempt }));
  assert.equal(open.items.length, 150);
  const text = JSON.stringify(open);
  for (const secret of ['correct_answer', 'rationale', 'Rationale text', 'ngn-key', 'strategy-secret']) assert.ok(!text.includes(secret), secret);
  await assert.rejects(as(S2, () => rpc('get_diagnostic_attempt', { p_attempt: state.attempt })), /Not authorized/);
  await assert.rejects(as(S1, () => rpc('get_my_diagnostic_review', { p_attempt: state.attempt })), /Not authorized/);
  await assert.rejects(as(S2, () => rpc('save_diagnostic_answer', { p_attempt: state.attempt, p_question: open.items[0].question_id, p_ids: ['a'] })), /Not authorized/);
});

test('answers are validated and scored server-side; submission builds a bounded, honest report', async () => {
  const items = await query(`select i.position,i.question_id,q.question_type,q.correct_answer->'ids' correct from diagnostic_items i join questions q on q.id=i.question_id where i.form_id=$1 order by i.position`, [state.form]);
  await assert.rejects(as(S1, () => rpc('save_diagnostic_answer', { p_attempt: state.attempt, p_question: items[0].question_id, p_ids: ['zzz'] })), /valid answer options/);
  const mcq = items.find(i => i.question_type === 'mcq');
  await assert.rejects(as(S1, () => rpc('save_diagnostic_answer', { p_attempt: state.attempt, p_question: mcq.question_id, p_ids: ['a', 'b'] })), /one answer/);
  // answer the first 60 correctly, the next 90 incorrectly (never the right option)
  for (const it of items.slice(0, 150)) {
    const right = [...it.correct];
    const ids = it.position <= 60 ? right : (it.question_type === 'sata' ? ['b'] : [['a', 'b', 'c', 'd'].find(x => !right.includes(x))]);
    await as(S1, () => rpc('save_diagnostic_answer', { p_attempt: state.attempt, p_question: it.question_id, p_ids: ids, p_seconds: 20 }));
  }
  const report = await as(S1, () => rpc('submit_diagnostic', { p_attempt: state.attempt }));
  assert.deepEqual(report.overall, { total: 150, correct: 60, pct: 40.0, band: 'critical' });
  assert.match(report.note, /Not an NCLEX passing standard/); assert.ok(!('pass_probability' in report));
  assert.equal(report.subcategories.reduce((a, s) => a + s.total, 0), 150);
  assert.equal(report.subcategories.length, 8); assert.equal(report.parts.length, 4);
  assert.ok(report.roadmap.length > 0 && report.roadmap.length <= 20);
  assert.equal(report.roadmap[0].band, 'critical'); assert.equal(report.roadmap[0].rank, 1);
  assert.ok(report.topics.every(t => t.total >= 4 || t.band === 'insufficient_data'));
  assert.deepEqual(await as(S1, () => rpc('submit_diagnostic', { p_attempt: state.attempt })), report);
  await assert.rejects(as(S1, () => rpc('save_diagnostic_answer', { p_attempt: state.attempt, p_question: items[0].question_id, p_ids: ['a'] })), /Not authorized/);
  const review = await as(S1, () => rpc('get_my_diagnostic_review', { p_attempt: state.attempt }));
  assert.equal(review.length, 150); assert.equal(review.filter(r => r.is_correct).length, 60); assert.ok(review[0].rationale.includes('Rationale text'));
  assert.deepEqual(await as(S1, () => rpc('get_my_diagnostic_report', { p_attempt: state.attempt })), report);
  assert.equal(await as(S2, () => rpc('get_my_diagnostic_report', { p_attempt: state.attempt })), null);
  state.missed = items[100].question_id; state.right = items[0].question_id;
});

test('retest requires more attempts, then progress compares attempts; admins can tag missed questions only', async () => {
  await assert.rejects(as(S1, () => rpc('start_diagnostic', { p_form: state.form })), /No diagnostic attempts remaining/);
  await as(ADMIN, () => rpc('admin_diagnostic_assign', { p_form: state.form, p_users: [S1], p_attempts: 2 }));
  const second = await as(S1, () => rpc('start_diagnostic', { p_form: state.form }));
  assert.notEqual(second, state.attempt);
  const items = await query(`select i.question_id,q.correct_answer->'ids' correct from diagnostic_items i join questions q on q.id=i.question_id where i.form_id=$1`, [state.form]);
  for (const it of items) await as(S1, () => rpc('save_diagnostic_answer', { p_attempt: second, p_question: it.question_id, p_ids: [...it.correct] }));
  const r2 = await as(S1, () => rpc('submit_diagnostic', { p_attempt: second }));
  assert.equal(r2.overall.pct, 100.0); assert.equal(r2.overall.band, 'strong'); assert.deepEqual(r2.roadmap, []);
  const progress = await as(S1, () => rpc('my_diagnostic_progress'));
  assert.deepEqual(progress.map(p => [p.attempt_no, p.pct]), [[1, 40.0], [2, 100.0]]);
  assert.equal((await as(ADMIN, () => rpc('admin_diagnostic_progress', { p_user: S1 }))).length, 2);
  assert.equal((await as(ADMIN, () => rpc('admin_diagnostic_list_attempts', { p_form: state.form }))).total, 2);
  await assert.rejects(as(S1, () => rpc('admin_diagnostic_progress', { p_user: S1 })), /Administrator access required/);
  await assert.rejects(as(S1, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.missed, p_type: 'A' })), /Administrator access required/);
  await as(ADMIN, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.missed, p_type: 'C', p_note: 'Skipped prioritization step' }));
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.right, p_type: 'A' })), /Only missed questions/);
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.missed, p_type: 'Z' })), /Invalid error type/);
  const adminView = await as(ADMIN, () => rpc('admin_get_diagnostic_report', { p_attempt: state.attempt }));
  assert.equal(adminView.error_tags.length, 1); assert.equal(adminView.error_tags[0].error_type, 'C');
});

test('screen support functions: learner assignments, admin lists, bounded search, review and access control', async () => {
  const mine = await as(S1, () => rpc('my_diagnostic_assignments'));
  assert.equal(mine.length, 1); assert.equal(mine[0].form_id, state.form); assert.equal(mine[0].attempts_allowed, 2); assert.equal(mine[0].attempts_used, 2);
  assert.equal(mine[0].open_attempt_id, null); assert.ok(mine[0].last_attempt_id);
  assert.deepEqual(await as(S2, () => rpc('my_diagnostic_assignments')), []);
  await assert.rejects(as(S1, () => rpc('admin_diagnostic_list_forms')), /Administrator access required/);
  const forms = await as(ADMIN, () => rpc('admin_diagnostic_list_forms'));
  assert.equal(forms[0].items, 150); assert.equal(forms[0].assigned, 1); assert.equal(forms[0].submitted, 2);
  const form = await as(ADMIN, () => rpc('admin_diagnostic_get_form', { p_form: state.form }));
  assert.equal(form.items.length, 150); assert.ok(form.items.every(i => i.prompt.length <= 200));
  assert.equal(JSON.stringify(form).includes('correct_answer'), false);
  const assignments = await as(ADMIN, () => rpc('admin_diagnostic_assignments', { p_form: state.form }));
  assert.equal(assignments[0].attempts_used, 2);
  // search: eligible + unused only, bounded, wildcard-safe
  const found = await as(ADMIN, () => rpc('admin_diagnostic_search_questions', { p_query: '', p_limit: 500 }));
  assert.ok(found.length <= 30);
  const used = new Set((await query('select question_id from diagnostic_items')).map(r => r.question_id));
  assert.ok(found.every(f => !used.has(f.id)));
  assert.deepEqual(await as(ADMIN, () => rpc('admin_diagnostic_search_questions', { p_query: '%' })), []);
  await assert.rejects(as(S1, () => rpc('admin_diagnostic_search_questions', { p_query: '' })), /Administrator access required/);
  assert.equal((await as(ADMIN, () => rpc('admin_diagnostic_find_users', { p_query: 'Student' }))).length, 2);
  assert.deepEqual(await as(ADMIN, () => rpc('admin_diagnostic_find_users', { p_query: 'S' })), []);
  await assert.rejects(as(S1, () => rpc('admin_diagnostic_find_users', { p_query: 'Student' })), /Administrator access required/);
  const review = await as(ADMIN, () => rpc('admin_get_diagnostic_review', { p_attempt: state.attempt }));
  assert.equal(review.length, 150); assert.equal(review.filter(r => r.is_correct).length, 60);
  assert.equal(review.find(r => r.question_id === state.missed).error_type, 'C');
  // taxonomy A-G: Test-Taking Reasoning and Careless Error are valid, H is not
  await as(ADMIN, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.missed, p_type: 'F', p_note: 'Changed a correct answer' }));
  await as(ADMIN, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.missed, p_type: 'G' }));
  await assert.rejects(as(ADMIN, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.missed, p_type: 'H' })), /Invalid error type/);
  await as(ADMIN, () => rpc('admin_diagnostic_tag_error', { p_attempt: state.attempt, p_question: state.missed, p_type: 'C', p_note: 'Skipped prioritization step' }));
  await assert.rejects(as(S1, () => rpc('admin_get_diagnostic_review', { p_attempt: state.attempt })), /Administrator access required/);
  const anon = async fn => (await query("select has_function_privilege('anon','public." + fn + "','execute') v"))[0].v;
  for (const fn of ['my_diagnostic_assignments()', 'admin_diagnostic_list_forms()', 'admin_get_diagnostic_review(uuid)']) assert.equal(await anon(fn), false, fn);
});
