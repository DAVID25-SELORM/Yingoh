import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildImportSql, buildReviewSheet } from './build-diagnostic-content.mjs';
import { ITEMS, PLAN } from '../diagnostic-content/parts-b-d.mjs';

const SUBCATEGORIES = ['Management of Care', 'Safety and Infection Prevention and Control', 'Health Promotion and Maintenance', 'Psychosocial Integrity',
  'Basic Care and Comfort', 'Pharmacological and Parenteral Therapies', 'Reduction of Risk Potential', 'Physiological Adaptation'];
const CJ = ['Recognize Cues', 'Analyze Cues', 'Prioritize Hypotheses', 'Generate Solutions', 'Take Action', 'Evaluate Outcomes'];
const TOPICS = ['Pharmacology', 'Medical-Surgical', 'Cardiovascular', 'Respiratory', 'Neurologic and Sensory', 'Mental Health', 'Safety and Infection Control',
  'Fundamentals', 'Leadership and Delegation', 'Maternal and Newborn', 'Laboratory and Diagnostics', 'Health Promotion', 'Pediatrics', 'Emergency and Critical Care'];
const count = (list, key) => list.reduce((acc, item) => { const k = typeof key === 'function' ? key(item) : item[key]; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});

// Independent recomputation of every calculation item.
const round = (value, decimals = 0) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const COMPUTE = {
  rate: c => c.volumeMl / c.hours,
  gtt: c => round((c.volumeMl * c.dropFactor) / (c.hours * 60)),
  weightVolume: c => round((c.mgPerKg * c.weightKg) / c.mgPerMl, c.decimals),
  tablets: c => (c.orderedMg * 1000) / c.tabletMcg,
  lbWeightVolume: c => round((c.mgPerKg * (c.weightLb / 2.2)) / c.mgPerMl, c.decimals),
  unitsInfusion: c => c.unitsPerHour / (c.totalUnits / c.bagMl),
  pushTime: c => c.doseMg / c.maxMgPerMin,
  mcgKgMin: c => (c.mcgPerKgMin * c.weightKg * 60) / ((c.bagMg * 1000) / c.bagMl),
  safeRange: c => { const perDay = (c.doseMg * c.dosesPerDay) / c.weightKg; return perDay < c.minMgKgDay || perDay > c.maxMgKgDay ? 'unsafe' : 'safe'; },
};

test('there are exactly 50 items with unique ids and prompts', () => {
  assert.equal(ITEMS.length, 50);
  assert.equal(new Set(ITEMS.map(i => i.id)).size, 50);
  assert.equal(new Set(ITEMS.map(i => i.prompt.trim().toLowerCase())).size, 50);
});

test('parts and subcategories match the corrected blueprint plan', () => {
  assert.deepEqual(count(ITEMS, 'part'), PLAN.parts);
  const bySub = count(ITEMS, 'subcategory');
  assert.deepEqual(bySub, PLAN.bySubcategory);
  for (const sub of Object.keys(bySub)) assert.ok(SUBCATEGORIES.includes(sub), sub);
  // Part C is entirely medication calculations; Part D is Management of Care plus two acute-care priorities
  assert.ok(ITEMS.filter(i => i.part === 'C').every(i => i.subcategory === 'Pharmacological and Parenteral Therapies' && i.calc));
  assert.deepEqual(count(ITEMS.filter(i => i.part === 'D'), 'subcategory'), { 'Management of Care': 8, 'Physiological Adaptation': 2 });
});

test('Part B fills the clinical-judgment steps the existing bank lacks', () => {
  const b = ITEMS.filter(i => i.part === 'B');
  assert.deepEqual(count(b, 'cj_step'), PLAN.partBSteps);
  for (const item of ITEMS) assert.ok(CJ.includes(item.cj_step), item.id);
});

test('every item is structurally valid for the diagnostic (mcq/sata only, valid answers, review-length rationale)', () => {
  for (const item of ITEMS) {
    assert.ok(['mcq', 'sata'].includes(item.type), item.id);
    assert.ok(['easy', 'medium', 'hard'].includes(item.difficulty), item.id);
    assert.ok(TOPICS.includes(item.topic), `${item.id} topic ${item.topic}`);
    assert.ok(item.prompt.length >= 40, item.id);
    assert.ok(item.rationale.trim().length >= 80, `${item.id} rationale too short for the question-bank review gate`);
    const ids = item.choices.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length, item.id);
    assert.equal(new Set(item.choices.map(c => c.text.trim().toLowerCase())).size, item.choices.length, `${item.id} duplicate options`);
    for (const c of item.choices) assert.ok(c.id && c.text.trim(), item.id);
    assert.ok(item.correct.length >= 1 && item.correct.every(id => ids.includes(id)), item.id);
    if (item.type === 'mcq') { assert.equal(item.choices.length, 4, item.id); assert.equal(item.correct.length, 1, item.id); }
    else { assert.equal(item.choices.length, 5, item.id); assert.ok(item.correct.length >= 2 && item.correct.length < item.choices.length, item.id); }
    assert.ok(!/all of the above|none of the above/i.test(item.choices.map(c => c.text).join(' ')), `${item.id} uses all/none of the above`);
    assert.ok(!/\bcorrect answer\b/i.test(item.prompt), item.id);
  }
});

test('every option has its own explanation and correctness flags match the key (bank structured-explanation standard)', () => {
  for (const item of ITEMS) {
    assert.deepEqual(Object.keys(item.option_explanations).sort(), item.choices.map(c => c.id).sort(), item.id);
    for (const choice of item.choices) {
      const entry = item.option_explanations[choice.id];
      assert.ok(entry.explanation.trim().length >= 20, `${item.id} option ${choice.id} needs an explanation`);
      assert.equal(entry.is_correct, item.correct.includes(choice.id), `${item.id} option ${choice.id} correctness mismatch`);
    }
    assert.ok(item.correct_answer_explanation.trim().length >= 80, item.id);
  }
  // explanations that call an option correct must sit on a correct option (calculation items say "This is correct")
  for (const item of ITEMS.filter(i => i.calc && i.calc.expected !== 'unsafe')) {
    for (const choice of item.choices) assert.equal(/^This is correct/.test(item.option_explanations[choice.id].explanation), item.correct.includes(choice.id), item.id);
  }
});

test('every calculation is recomputed independently and matches the marked correct option', () => {
  const calcs = ITEMS.filter(i => i.calc);
  assert.equal(calcs.length, 10);
  for (const item of calcs) {
    const computed = COMPUTE[item.calc.kind](item.calc);
    if (item.calc.expected === 'unsafe') {
      assert.equal(computed, 'unsafe', item.id);
      assert.equal(round((item.calc.doseMg * item.calc.dosesPerDay) / item.calc.weightKg), item.calc.mgKgDay, item.id);
      assert.match(item.choices.find(c => c.id === item.correct[0]).text, /hold the dose and clarify/i);
    } else {
      assert.ok(Math.abs(computed - item.calc.expected) < 1e-9, `${item.id}: computed ${computed}, stated ${item.calc.expected}`);
      const marked = parseFloat(item.choices.find(c => c.id === item.correct[0]).text.replace(/,/g, '').match(/[\d.]+/)[0]);
      assert.equal(marked, item.calc.expected, `${item.id}: marked option ${marked} != ${item.calc.expected}`);
      // no distractor equals the right answer, and options are in ascending numeric order
      const numbers = item.choices.map(c => parseFloat(c.text.replace(/,/g, '').match(/[\d.]+/)[0]));
      assert.equal(new Set(numbers).size, 4, `${item.id} duplicate numeric options`);
      assert.deepEqual([...numbers].sort((x, y) => x - y), numbers, `${item.id} options must be ascending`);
    }
  }
});

test('correct-answer positions are balanced so the key cannot be guessed', () => {
  const positions = count(ITEMS.filter(i => i.type === 'mcq'), i => i.correct[0]);
  const total = ITEMS.filter(i => i.type === 'mcq').length;
  for (const id of ['a', 'b', 'c', 'd']) {
    const share = (positions[id] ?? 0) / total;
    assert.ok(share >= 0.15 && share <= 0.35, `position ${id} holds ${Math.round(share * 100)}% of answers`);
  }
});

test('the content is deterministic: rebuilding gives the same order', async () => {
  const again = (await import('../diagnostic-content/parts-b-d.mjs?again')).ITEMS;
  assert.deepEqual(again.map(i => [i.id, i.correct.join('')]), ITEMS.map(i => [i.id, i.correct.join('')]));
});

// ---- Import script: drafts are inert until approved, and approved drafts are eligible for the diagnostic ----
const db = new PGlite();
after(() => db.close());
test('the import script inserts 50 inert drafts (idempotent) that only become diagnostic-eligible after approval', async () => {
  await db.exec(`
   create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
   create table profiles(id uuid primary key);
   create function public.has_role(text[]) returns boolean language sql stable as $$ select false $$;
   create table questions(id uuid primary key default gen_random_uuid(),topic text not null,question_type text not null,prompt text not null,choices jsonb not null default '[]',
    correct_answer jsonb not null default '{}',rationale text,status text not null default 'draft',client_need text,clinical_judgment text,minimum_plan text not null default 'pro',
    clinical_review_status text not null default 'pending' check(clinical_review_status in ('legacy','pending','changes_requested','approved')),source_batch text,quality_notes text,
    correct_answer_explanation text,option_explanations jsonb not null default '{}',ngn_data jsonb,strategy text);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20260921020000_smart_diagnostic_system.sql', import.meta.url), 'utf8'));
  const sql = buildImportSql();
  await db.exec(sql);
  await db.exec(sql); // second run must not duplicate
  const rows = (await db.query("select count(*)::int c, count(*) filter(where status='draft' and clinical_review_status='pending')::int inert, count(distinct prompt)::int uniq from questions")).rows[0];
  assert.deepEqual(rows, { c: 50, inert: 50, uniq: 50 });
  const eligible = async () => (await db.query('select count(*)::int c from questions q where public.diagnostic_question_ok(q)')).rows[0].c;
  assert.equal(await eligible(), 0, 'drafts must not be eligible for a diagnostic form');
  // round trip: stored key and options equal the source content
  const stored = (await db.query("select prompt,question_type,choices,correct_answer,option_explanations,client_need,clinical_judgment from questions order by prompt")).rows;
  for (const item of ITEMS) {
    const row = stored.find(r => r.prompt === item.prompt);
    assert.equal(row.question_type, item.type); assert.equal(row.client_need, item.subcategory); assert.equal(row.clinical_judgment, item.cj_step);
    assert.deepEqual(row.correct_answer.ids, item.correct); assert.deepEqual(row.choices, item.choices.map(({ id, text }) => ({ id, text })));
    assert.deepEqual(row.option_explanations, item.option_explanations);
  }
  await db.exec("update questions set status='published', clinical_review_status='approved' where source_batch='diagnostic-parts-b-d-2026-09'");
  assert.equal(await eligible(), 50, 'approved drafts must satisfy the diagnostic eligibility rule');
});

test('the review sheet lists every item with its key, rationale and per-option reasons', () => {
  const sheet = buildReviewSheet();
  for (const item of ITEMS) assert.ok(sheet.includes('### ' + item.id + ' '), item.id);
  assert.equal((sheet.match(/\*\*✓ correct\*\*/g) ?? []).length, ITEMS.reduce((n, i) => n + i.correct.length, 0));
  assert.match(sheet, /\*\*not\*\* clinically approved/i);
});
