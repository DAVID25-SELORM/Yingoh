-- Question of the Day: one shared question per calendar day for Basic+ subscribers,
-- with per-user attempt tracking and an idempotency log for the daily email cron.

create table if not exists public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id),
  date date unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_question_id uuid not null references public.daily_questions(id),
  question_id uuid not null references public.questions(id),
  answer jsonb not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, daily_question_id)
);

create table if not exists public.daily_question_emails_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_questions enable row level security;
alter table public.daily_question_attempts enable row level security;
alter table public.daily_question_emails_sent enable row level security;

create or replace function public.has_daily_question_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['admin', 'super_admin'])
    or exists (
      select 1
      from public.subscriptions s
      where s.user_id = auth.uid()
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
        and lower(trim(coalesce(s.plan_name, ''))) not in ('', 'free')
    );
$$;

revoke all on function public.has_daily_question_access() from public, anon;
grant execute on function public.has_daily_question_access() to authenticated;

drop policy if exists "daily_questions_read_subscribers" on public.daily_questions;
create policy "daily_questions_read_subscribers" on public.daily_questions
  for select to authenticated
  using (public.has_daily_question_access());

drop policy if exists "daily_question_attempts_read_own" on public.daily_question_attempts;
create policy "daily_question_attempts_read_own" on public.daily_question_attempts
  for select to authenticated
  using (user_id = auth.uid() and public.has_daily_question_access());

drop policy if exists "daily_question_attempts_insert_own" on public.daily_question_attempts;
-- Attempts are inserted only by submit_daily_question_answer(), which grades
-- against the server-side answer key. Clients cannot claim their own result.

-- daily_question_emails_sent: RLS enabled, no client policies — service-role only.

create index if not exists daily_question_attempts_user_idx
  on public.daily_question_attempts (user_id, daily_question_id);

-- Lazily selects (or creates) today's shared question. Race-safe: concurrent
-- callers around midnight resolve to the same row via the unique(date) conflict.
create or replace function public.get_or_create_daily_question()
returns public.daily_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.daily_questions;
  candidate_id uuid;
begin
  if auth.role() <> 'service_role' and not public.has_daily_question_access() then
    raise exception 'An active paid subscription is required';
  end if;

  select * into result from public.daily_questions where date = current_date;
  if found then
    return result;
  end if;

  select id into candidate_id
  from public.questions
  where status = 'published'
    and question_type in ('mcq', 'sata')
    and minimum_plan in ('free', 'starter')
    and length(trim(coalesce(rationale, ''))) >= 80
    and jsonb_array_length(case when jsonb_typeof(choices) = 'array' then choices else '[]'::jsonb end) >= 2
    and jsonb_array_length(case when jsonb_typeof(correct_answer->'ids') = 'array' then correct_answer->'ids' else '[]'::jsonb end) >= 1
    and id not in (select question_id from public.daily_questions)
  order by random()
  limit 1;

  if candidate_id is null then
    select id into candidate_id
    from public.questions
    where status = 'published'
      and question_type in ('mcq', 'sata')
      and minimum_plan in ('free', 'starter')
      and length(trim(coalesce(rationale, ''))) >= 80
      and jsonb_array_length(case when jsonb_typeof(choices) = 'array' then choices else '[]'::jsonb end) >= 2
      and jsonb_array_length(case when jsonb_typeof(correct_answer->'ids') = 'array' then correct_answer->'ids' else '[]'::jsonb end) >= 1
    order by random()
    limit 1;
  end if;

  if candidate_id is null then
    raise exception 'No published mcq/sata questions available for Question of the Day';
  end if;

  insert into public.daily_questions (question_id, date)
  values (candidate_id, current_date)
  on conflict (date) do nothing;

  select * into result from public.daily_questions where date = current_date;
  return result;
end;
$$;

revoke all on function public.get_or_create_daily_question() from public, anon;
grant execute on function public.get_or_create_daily_question() to authenticated, service_role;

create or replace function public.submit_daily_question_answer(
  p_daily_question_id uuid,
  p_selected_ids text[]
)
returns public.daily_question_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_row public.daily_questions%rowtype;
  question_row public.questions%rowtype;
  result public.daily_question_attempts%rowtype;
  expected_ids text[];
  submitted_ids text[];
  answer_is_correct boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if not public.has_daily_question_access() then
    raise exception 'An active paid subscription is required';
  end if;
  if coalesce(array_length(p_selected_ids, 1), 0) = 0 then
    raise exception 'Select at least one answer';
  end if;

  select * into daily_row
  from public.daily_questions
  where id = p_daily_question_id and date = current_date;
  if not found then
    raise exception 'Today''s question is unavailable';
  end if;

  select * into question_row from public.questions where id = daily_row.question_id;
  if not found then
    raise exception 'Question content is unavailable';
  end if;

  select coalesce(array_agg(value order by value), array[]::text[])
  into expected_ids
  from jsonb_array_elements_text(question_row.correct_answer->'ids') value;

  select coalesce(array_agg(distinct value order by value), array[]::text[])
  into submitted_ids
  from unnest(p_selected_ids) value;

  if question_row.question_type = 'mcq' and array_length(submitted_ids, 1) <> 1 then
    raise exception 'Select exactly one answer';
  end if;

  answer_is_correct := submitted_ids = expected_ids;

  insert into public.daily_question_attempts (
    user_id, daily_question_id, question_id, answer, is_correct
  ) values (
    auth.uid(), daily_row.id, question_row.id,
    jsonb_build_object('ids', to_jsonb(submitted_ids)), answer_is_correct
  )
  on conflict (user_id, daily_question_id) do nothing
  returning * into result;

  if result.id is null then
    select * into result
    from public.daily_question_attempts
    where user_id = auth.uid() and daily_question_id = daily_row.id;
  end if;

  return result;
end;
$$;

revoke all on function public.submit_daily_question_answer(uuid, text[]) from public, anon;
grant execute on function public.submit_daily_question_answer(uuid, text[]) to authenticated;

grant select on public.daily_questions to authenticated;
grant select on public.daily_question_attempts to authenticated;

-- Service-role helper for the daily email cron: active Basic+ subscribers who
-- haven't already been emailed today. Not callable by regular users (auth.uid()
-- context is irrelevant here — this intentionally lists OTHER users' contact info).
create or replace function public.list_daily_question_recipients()
returns table (user_id uuid, email text, full_name text)
language sql
security definer
set search_path = public
as $$
  select distinct on (p.id) p.id, p.email, p.full_name
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  where s.status = 'active'
    and (s.current_period_end is null or s.current_period_end > now())
    and lower(coalesce(s.plan_name, '')) not in ('free', '')
    and nullif(trim(p.email), '') is not null
    and not exists (
      select 1 from public.daily_question_emails_sent d
      where d.user_id = s.user_id and d.date = current_date
    )
  order by p.id;
$$;

revoke all on function public.list_daily_question_recipients() from public, anon, authenticated;
grant execute on function public.list_daily_question_recipients() to service_role;
