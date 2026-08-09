import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  feedbackModel,
  syncOptionExplanations,
  validateStructuredExplanation,
} from '../src/utils/structuredExplanations.js';

const choices = [
  { id: 'a', text: 'Continue the trigger' },
  { id: 'b', text: 'Give antipyretics only' },
  { id: 'c', text: 'Escalate rigidity and rising ETCO2' },
  { id: 'd', text: 'Wait for testing' },
];
const structured = {
  prompt: 'Which finding requires escalation?', question_type: 'mcq', choices,
  correct_answer: { ids: ['c'] }, rationale: 'Legacy fallback remains.',
  correct_answer_explanation: 'Rigidity plus rising ETCO2 indicates a hypermetabolic crisis.',
  option_explanations: Object.fromEntries(choices.map((choice) => [choice.id, {
    is_correct: choice.id === 'c', explanation: `Reviewed explanation for ${choice.id}`,
  }])),
  immediate_response: '1. Stop triggers.\n2. Give oxygen and dantrolene.',
  strategy: 'Link rigidity to rising metabolism.',
  reference_urls: [
    { title: 'Managing a Crisis', organization: 'MHAUS', url: 'https://www.mhaus.org/example', accessed_at: '2026-08-09' },
    { title: 'MH recommendations', organization: 'EMHG', url: 'https://www.emhg.org/example', accessed_at: '2026-08-09' },
  ],
  reviewed_by: '00000000-0000-0000-0000-000000000001', reviewed_at: '2026-08-09T00:00:00Z',
};

const checks = [];
function check(name, fn) {
  try { fn(); checks.push([name, true]); }
  catch (error) { checks.push([name, false, error.message]); }
}

check('legacy-question fallback', () => {
  const model = feedbackModel({ ...structured, correct_answer_explanation: '', option_explanations: {}, reference_urls: [] }, ['a']);
  assert.equal(model.correctAnswerExplanation, 'Legacy fallback remains.');
  assert.equal(model.usesLegacyFallback, true);
});
check('structured explanation rendering model', () => {
  const model = feedbackModel(structured, ['a']);
  assert.equal(model.selectedChoices[0].id, 'a');
  assert.equal(model.correctChoices[0].id, 'c');
  assert.equal(model.optionRows.length, 4);
  assert.equal(model.references.length, 2);
  assert.match(model.immediateResponse, /\n/);
});
check('correct and incorrect answer data remain distinct', () => {
  assert.notEqual(feedbackModel(structured, ['c']).selectedChoices[0].id, feedbackModel(structured, ['a']).selectedChoices[0].id);
});
check('admin approval validation passes complete content', () => assert.deepEqual(validateStructuredExplanation(structured), []));
check('changing correct option preserves text and updates correctness', () => {
  const next = syncOptionExplanations(choices, ['b'], structured.option_explanations);
  assert.equal(next.b.is_correct, true); assert.equal(next.c.is_correct, false);
  assert.equal(next.c.explanation, structured.option_explanations.c.explanation);
});
check('missing option explanation is rejected', () => {
  const broken = structuredClone(structured); broken.option_explanations.a.explanation = '';
  assert.match(validateStructuredExplanation(broken).join(' '), /Option A/);
});
check('invalid reference URL is rejected', () => {
  const broken = structuredClone(structured); broken.reference_urls[0].url = 'http://insecure.example';
  assert.match(validateStructuredExplanation(broken).join(' '), /HTTPS/);
});
check('future review date is rejected', () => {
  assert.match(validateStructuredExplanation({ ...structured, reviewed_at: '2999-01-01T00:00:00Z' }).join(' '), /future/);
});
check('migration has safe schema and controlled conversion', () => {
  const sql = readFileSync('supabase/migrations/20260809140000_structured_question_explanations.sql', 'utf8');
  for (const field of ['correct_answer_explanation', 'option_explanations', 'immediate_response', 'reference_urls']) assert.ok(sql.includes(field));
  assert.ok(sql.includes('affected_rows <> 1'));
  assert.ok(sql.includes('position(review_note'));
  assert.ok(sql.includes("'{\"ids\":[\"c\"]}'::jsonb"));
});
check('learner UI preserves formatted paragraphs and mobile layout', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  assert.ok(css.includes('.preserve-format { white-space: pre-line; }'));
  assert.ok(css.includes('@media (max-width: 760px)'));
});
check('pre-submission API strips every structured answer field', () => {
  const service = readFileSync('supabase/functions/question-service/index.ts', 'utf8');
  for (const field of ['correct_answer_explanation: _correctExplanation', 'option_explanations: _optionExplanations', 'immediate_response: _immediateResponse', 'reference_urls: _references']) assert.ok(service.includes(field));
});

let failures = 0;
for (const [name, passed, detail] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures += 1;
}
console.log(`\nStructured explanation checks: ${checks.length - failures}/${checks.length} passed`);
if (failures) process.exitCode = 1;
