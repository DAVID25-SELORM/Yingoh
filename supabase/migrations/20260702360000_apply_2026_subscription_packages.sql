-- NurseFaculty 2026 subscription packages and cumulative question access.
update public.payment_plans
set
  name = 'Explorer Pass',
  price_usd = 0,
  duration_days = 36500,
  question_limit = 150,
  sort_order = 1,
  features = '[
    "150 NCLEX-RN questions","20 flashcards","1 CAT exam","5 NGN case studies",
    "7-day study planner","Basic performance dashboard","Study Coach: 10 questions/day",
    "Daily Question of the Day","Progress tracking","Limited notes library"
  ]'::jsonb
where lower(name) in ('free', 'explorer pass');

update public.payment_plans
set
  name = '30-Day Pass',
  price_usd = 19,
  duration_days = 30,
  question_limit = 2000,
  sort_order = 2,
  features = '[
    "2,000+ questions","50+ NGN case studies","Unlimited practice and timed modes",
    "5 CAT exams","2 readiness assessments","All video lessons","High-yield notes and flashcards",
    "Study Coach and rationale support","Weak-area analysis","Study planner and daily goals"
  ]'::jsonb
where lower(name) in ('starter', 'basic', '30-day pass');

update public.payment_plans
set
  name = '90-Day Success Plan',
  price_usd = 49,
  duration_days = 90,
  question_limit = null,
  sort_order = 3,
  features = '[
    "Everything in the 30-Day Pass","Complete 7,000+ question bank","200+ NGN case studies",
    "Unlimited CAT and readiness exams","Custom exams and review mode","Personalized Study Coach",
    "Adaptive study plan and revision schedule","All courses, notes and drug guide",
    "Detailed analytics and pass probability","Achievement badges"
  ]'::jsonb
where lower(name) in ('pro', '90-day success plan');

update public.payment_plans
set
  name = '180-Day Master Plan',
  price_usd = 79,
  duration_days = 180,
  question_limit = null,
  sort_order = 4,
  features = '[
    "Everything in the 90-Day Success Plan","Weekly live classes and Q&A","Monthly masterclasses",
    "NCLEX strategy sessions","Mentor support","WhatsApp study community","Accountability program",
    "Personalized study review","Mock oral questions and clinical tutoring","U.S. nursing career resources"
  ]'::jsonb
where lower(name) in ('premium', '180-day master plan');

insert into public.payment_plans (
  name, price_usd, duration_days, question_limit, features, is_active, sort_order
)
select
  '365-Day Faculty Pass',
  129,
  365,
  null,
  '[
    "Everything in the 180-Day Master Plan","Full-year unlimited access",
    "All future question updates","New NGN questions and video courses",
    "Future Study Coach features","New study notes","Priority customer support",
    "Early access to new features","Faculty Member badge",
    "Exclusive webinars and annual NCLEX updates"
  ]'::jsonb,
  true,
  5
where not exists (
  select 1 from public.payment_plans where lower(name) = '365-day faculty pass'
);

with grouped as (
  select
    id,
    topic,
    question_type,
    row_number() over (
      partition by topic, question_type
      order by md5(id::text)
    ) as group_position
  from public.questions
  where status = 'published'
),
ranked as (
  select
    id,
    row_number() over (
      order by group_position, md5(coalesce(topic, '') || ':' || coalesce(question_type, '')), md5(id::text)
    ) as access_position
  from grouped
)
update public.questions q
set minimum_plan = case
  when ranked.access_position <= 150 then 'free'
  when ranked.access_position <= 2000 then 'starter'
  else 'pro'
end
from ranked
where q.id = ranked.id;

create or replace function public.current_question_access_level()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_role(array['admin', 'super_admin']) then 3
    else coalesce((
      select max(case
        when lower(coalesce(s.plan_name, '')) similar to '%(365|180|90|faculty|master|success|premium|pro)%' then 3
        when lower(coalesce(s.plan_name, '')) similar to '%(30-day|30 day|starter|basic)%' then 2
        else 1
      end)
      from public.subscriptions s
      where s.user_id = auth.uid()
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
    ), 1)
  end;
$$;

revoke all on function public.current_question_access_level() from public, anon;
grant execute on function public.current_question_access_level() to authenticated;

do $$
declare
  free_questions bigint;
  thirty_day_questions bigint;
  full_bank_questions bigint;
  active_plans bigint;
begin
  select count(*) filter (where minimum_plan = 'free'),
         count(*) filter (where minimum_plan in ('free', 'starter')),
         count(*)
  into free_questions, thirty_day_questions, full_bank_questions
  from public.questions
  where status = 'published';

  select count(*) into active_plans
  from public.payment_plans
  where is_active
    and name in (
      'Explorer Pass','30-Day Pass','90-Day Success Plan',
      '180-Day Master Plan','365-Day Faculty Pass'
    );

  if free_questions <> least(full_bank_questions, 150)
     or thirty_day_questions <> least(full_bank_questions, 2000)
     or active_plans <> 5
  then
    raise exception
      'Package audit failed: free %, 30-day %, full %, active plans %',
      free_questions, thirty_day_questions, full_bank_questions, active_plans;
  end if;
end
$$;
