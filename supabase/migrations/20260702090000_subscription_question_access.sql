-- Question-bank entitlements based on the Yingoh package strategy.
alter table public.payment_plans
  add column if not exists question_limit integer check (question_limit is null or question_limit >= 0);

update public.payment_plans
set
  name = 'Free',
  price_usd = 0,
  duration_days = 36500,
  question_limit = 25,
  features = '["25 NCLEX questions","Basic readiness dashboard","Limited flashcards"]'::jsonb,
  sort_order = 1
where lower(name) = 'free';

update public.payment_plans
set
  name = 'Starter',
  price_usd = 9.99,
  question_limit = 500,
  features = '["500 NCLEX questions","Practice and timed modes","High-yield notes and videos","Flashcards","Study planner"]'::jsonb,
  sort_order = 2
where lower(name) in ('basic', 'starter');

update public.payment_plans
set
  name = 'Pro',
  price_usd = 19.99,
  question_limit = null,
  features = '["Complete growing question bank","NGN clinical judgment simulator","CAT exams","AI rationale coach","Adaptive study plan","Readiness analytics"]'::jsonb,
  sort_order = 3
where lower(name) = 'pro';

update public.payment_plans
set
  name = 'Premium',
  price_usd = 29.99,
  question_limit = null,
  features = '["Everything in Pro","Live classes","Mentorship and coaching","International nurse pathway","Priority WhatsApp support"]'::jsonb,
  sort_order = 4
where lower(name) = 'premium';

-- Admins can review the complete bank, including drafts and archived questions.
drop policy if exists "questions_admin_read_all" on public.questions;
create policy "questions_admin_read_all" on public.questions
  for select to authenticated
  using (public.has_role(array['admin', 'super_admin']));

grant select on public.questions to authenticated;
