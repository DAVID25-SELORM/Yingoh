import { readFileSync } from 'node:fs';

const files = Object.fromEntries([
  ['service', 'src/services/supabase.js'],
  ['daily', 'src/components/QuestionOfTheDayView.jsx'],
  ['coach', 'supabase/functions/study-coach/index.ts'],
  ['questions', 'supabase/functions/question-service/index.ts'],
  ['adminUsers', 'supabase/functions/admin-users/index.ts'],
  ['migration', 'supabase/migrations/20260808120000_security_legal_and_refunds.sql'],
  ['main', 'src/main.jsx'],
  ['payments', 'src/components/PaymentsView.jsx'],
  ['readiness', 'src/utils/questionReadiness.js'],
  ['structuredMigration', 'supabase/migrations/20260809140000_structured_question_explanations.sql'],
  ['feedback', 'src/components/AnswerExplanation.jsx'],
].map(([key, path]) => [key, readFileSync(path, 'utf8')]));

const checks = [
  ['learner questions use the protected Edge Function', files.service.includes("functions.invoke('question-service'")],
  ['daily question uses sanitized content RPC', files.daily.includes("rpc('get_daily_question_content'")],
  ['daily answer uses secure grading RPC', files.daily.includes("rpc('submit_daily_question_answer_secure'")],
  ['Study Coach authenticates the JWT', files.coach.includes('auth.getUser()')],
  ['Study Coach consumes quota server-side', files.coach.includes("rpc('consume_study_coach_question'")],
  ['question service sanitizes answer keys', files.questions.includes('sanitizedQuestion') && files.questions.includes('correct_answer: _answer')],
  ['question service sanitizes structured explanations', files.questions.includes('option_explanations: _optionExplanations') && files.questions.includes('reference_urls: _references')],
  ['question service grades server-side', files.questions.includes("body.action==='grade'")],
  ['learner question filtering accepts sanitized content', files.readiness.includes('isLearnerReadyQuestion') && !files.readiness.match(/isLearnerReadyQuestion[\s\S]*?hasDetailedRationale/)],
  ['admin user creation uses admin auth API', files.adminUsers.includes('auth.admin.createUser') && files.adminUsers.includes('auth.admin.inviteUserByEmail')],
  ['legacy learner question policy is removed', files.migration.includes('drop policy if exists "questions_read_authenticated"')],
  ['public enrollment table policy is removed', files.migration.includes('drop policy if exists "enrollment_links_public_read"')],
  ['audit inserts are bound to auth.uid', files.migration.includes('user_id = auth.uid()')],
  ['legal acceptance is explicit at signup and checkout', files.main.includes('legalAccepted') && files.payments.includes('recordLegalAcceptance')],
  ['refund requests have RLS', files.migration.includes('alter table public.refund_requests enable row level security')],
  ['structured approval is enforced in PostgreSQL', files.structuredMigration.includes('question_structured_explanation_errors') && files.structuredMigration.includes('questions_clinical_review_gate')],
  ['structured audit is staff restricted', files.structuredMigration.includes("public.has_role(array['content_reviewer','question_bank_manager','admin','super_admin'])")],
  ['learner explanations render only in post-answer components', files.feedback.includes('Correct answer') && files.feedback.includes('Why each option is correct or incorrect')],
];

let failures = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`);
  if (!passed) failures += 1;
}
console.log(`\nSecurity contracts: ${checks.length - failures}/${checks.length} passed`);
if (failures) process.exitCode = 1;
