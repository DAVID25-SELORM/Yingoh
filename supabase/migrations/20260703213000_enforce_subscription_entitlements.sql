-- Enforce NurseFaculty 2026 plan benefits at the API/database layer.

update public.payment_plans set features = '[
  "150 NCLEX-RN questions","20 flashcards","1 CAT exam","5 NGN case studies",
  "7-day study planner","Basic performance dashboard","Study Coach: 10 questions/day",
  "Practice and timed exams up to 50 questions","Progress tracking","Personal notebook"
]'::jsonb where lower(name) = 'explorer pass';

update public.payment_plans set features = '[
  "Everything in the 90-Day Success Plan","Live virtual classes and Q&A",
  "Class recordings when available","Instructor assignments and feedback",
  "Professional U.S. RN pathway","Visa and career preparation center",
  "CPD activity tracker","Clinical skills review","180-day adaptive study planner",
  "Instructor-led strategy sessions"
]'::jsonb where lower(name) = '180-day master plan';

update public.payment_plans set features = '[
  "Everything in the 180-Day Master Plan","Full-year unlimited access",
  "365-day adaptive study planner","All question-bank updates during membership",
  "New NGN questions and video courses","New Study Coach features during membership",
  "New study resources during membership","Faculty Member badge",
  "Faculty webinars in Live Classes","Annual NCLEX content updates"
]'::jsonb where lower(name) = '365-day faculty pass';

create or replace function public.current_subscription_plan_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_role(array['admin', 'super_admin']) then 'faculty'
    else coalesce((
      select case
        when lower(s.plan_name) similar to '%(365|faculty)%' then 'faculty'
        when lower(s.plan_name) similar to '%(180|master|premium)%' then 'master'
        when lower(s.plan_name) similar to '%(90|success|pro)%' then 'pro'
        when lower(s.plan_name) similar to '%(30-day|30 day|starter|basic)%' then 'basic'
        else 'free'
      end
      from public.subscriptions s
      where s.user_id = auth.uid()
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
      order by s.created_at desc
      limit 1
    ), 'free')
  end;
$$;

create or replace function public.current_subscription_level()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_subscription_plan_key()
    when 'faculty' then 4
    when 'master' then 3
    when 'pro' then 2
    when 'basic' then 1
    else 0
  end;
$$;

revoke all on function public.current_subscription_plan_key() from public, anon;
revoke all on function public.current_subscription_level() from public, anon;
grant execute on function public.current_subscription_plan_key() to authenticated;
grant execute on function public.current_subscription_level() to authenticated;

-- Free accounts receive the first 20 cards. Paid plans receive the full library.
alter table public.flashcards add column if not exists access_rank integer;

with ranked as (
  select id, row_number() over (order by created_at, id)::integer as access_rank
  from public.flashcards
)
update public.flashcards f
set access_rank = ranked.access_rank
from ranked
where ranked.id = f.id;

create index if not exists flashcards_access_rank_idx on public.flashcards(access_rank);

drop policy if exists "flashcards_read" on public.flashcards;
create policy "flashcards_read" on public.flashcards
  for select to authenticated
  using (
    public.current_subscription_level() >= 1
    or coalesce(access_rank, 2147483647) <= 20
  );

-- Premium-labelled videos are included from the 30-Day Pass upward.
drop policy if exists "videos_read" on public.video_lessons;
create policy "videos_read" on public.video_lessons
  for select to authenticated
  using (
    is_published = true
    and (not coalesce(is_premium, false) or public.current_subscription_level() >= 1)
  );

-- Live classes are a Master/Faculty benefit; staff retain operational access.
drop policy if exists "schedules_read" on public.class_schedules;
create policy "schedules_read" on public.class_schedules
  for select to authenticated
  using (
    public.current_subscription_level() >= 3
    or public.has_role(array['instructor', 'admin', 'super_admin'])
  );

-- Instructor assignments are included from the 180-Day Master Plan upward.
drop policy if exists "assignments_read" on public.assignments;
create policy "assignments_read" on public.assignments
  for select to authenticated
  using (
    public.current_subscription_level() >= 3
    or public.has_role(array['instructor', 'admin', 'super_admin'])
  );

drop policy if exists "submissions_insert" on public.assignment_submissions;
create policy "submissions_insert" on public.assignment_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.current_subscription_level() >= 3
  );

-- Certificates/achievement records are included from the 90-Day plan upward.
drop policy if exists "certs_own" on public.user_certificates;
create policy "certs_own" on public.user_certificates
  for select to authenticated
  using (auth.uid() = user_id and public.current_subscription_level() >= 2);

-- A saved planner cannot exceed the active package planning window.
create or replace function public.current_planner_days()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_subscription_plan_key()
    when 'faculty' then 365
    when 'master' then 180
    when 'pro' then 90
    when 'basic' then 30
    else 7
  end;
$$;

revoke all on function public.current_planner_days() from public, anon;
grant execute on function public.current_planner_days() to authenticated;

drop policy if exists "study_plans_own" on public.study_plans;
create policy "study_plans_select_own" on public.study_plans
  for select to authenticated using (auth.uid() = user_id);
create policy "study_plans_insert_entitled" on public.study_plans
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exam_date <= current_date + public.current_planner_days()
  );
create policy "study_plans_update_entitled" on public.study_plans
  for update to authenticated using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exam_date <= current_date + public.current_planner_days()
  );

-- Exam quotas: Explorer 1 CAT, 30-Day 5 CAT + 2 readiness, 90-Day+ unlimited.
create or replace function public.can_start_exam(requested_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  plan_key text := public.current_subscription_plan_key();
  allowed integer;
  used integer;
begin
  if requested_mode not in ('cat', 'assessment') then return true; end if;
  if plan_key in ('pro', 'master', 'faculty') then return true; end if;

  allowed := case
    when requested_mode = 'cat' and plan_key = 'free' then 1
    when requested_mode = 'cat' and plan_key = 'basic' then 5
    when requested_mode = 'assessment' and plan_key = 'basic' then 2
    else 0
  end;

  select count(*) into used
  from public.exam_sessions e
  where e.user_id = auth.uid()
    and e.mode = requested_mode
    and e.status in ('active', 'completed');

  return used < allowed;
end;
$$;

revoke all on function public.can_start_exam(text) from public, anon;
grant execute on function public.can_start_exam(text) to authenticated;

drop policy if exists "sessions_own" on public.exam_sessions;
drop policy if exists "exam_sessions_select_own" on public.exam_sessions;
drop policy if exists "exam_sessions_insert_entitled" on public.exam_sessions;
drop policy if exists "exam_sessions_update_own" on public.exam_sessions;
drop policy if exists "exam_sessions_delete_own" on public.exam_sessions;

create policy "exam_sessions_select_own" on public.exam_sessions
  for select to authenticated using (auth.uid() = user_id);
create policy "exam_sessions_insert_entitled" on public.exam_sessions
  for insert to authenticated
  with check (auth.uid() = user_id and public.can_start_exam(mode));
create policy "exam_sessions_update_own" on public.exam_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exam_sessions_delete_own" on public.exam_sessions
  for delete to authenticated using (auth.uid() = user_id);

-- Atomic Study Coach daily allowance. Paid plans are unlimited.
create table if not exists public.study_coach_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  question_count integer not null default 0 check (question_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.study_coach_daily_usage enable row level security;
drop policy if exists "study_coach_usage_own_read" on public.study_coach_daily_usage;
create policy "study_coach_usage_own_read" on public.study_coach_daily_usage
  for select to authenticated using (auth.uid() = user_id);
grant select on public.study_coach_daily_usage to authenticated;

create or replace function public.consume_study_coach_question()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_subscription_level() >= 1 then return -1; end if;

  insert into public.study_coach_daily_usage(user_id, usage_date, question_count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, usage_date) do update
    set question_count = public.study_coach_daily_usage.question_count + 1,
        updated_at = now()
    where public.study_coach_daily_usage.question_count < 10
  returning question_count into new_count;

  if new_count is null then
    raise exception 'Daily Study Coach limit reached';
  end if;
  return 10 - new_count;
end;
$$;

revoke all on function public.consume_study_coach_question() from public, anon;
grant execute on function public.consume_study_coach_question() to authenticated;
