-- Restore Study Coach daily usage tracking if the entitlement migration was
-- applied manually without registering or creating the RPC.

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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Paid plans and super admins have unlimited Study Coach usage.
  if public.current_subscription_level() >= 1 then
    return -1;
  end if;

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
