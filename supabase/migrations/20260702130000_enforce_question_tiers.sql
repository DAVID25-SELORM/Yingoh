-- Enforce question-bank packages at the database layer, not only in React.
alter table public.questions
  add column if not exists minimum_plan text not null default 'pro'
  check (minimum_plan in ('free', 'starter', 'pro'));

-- Give Free the first 25 published items and Starter the next 475.
-- All later content defaults to Pro until an admin intentionally broadens access.
with ranked as (
  select id, row_number() over (order by created_at, id) as question_number
  from public.questions
  where status = 'published'
)
update public.questions q
set minimum_plan = case
  when ranked.question_number <= 25 then 'free'
  when ranked.question_number <= 500 then 'starter'
  else 'pro'
end
from ranked
where q.id = ranked.id;

create index if not exists questions_minimum_plan_idx
  on public.questions (minimum_plan, status);

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
        when lower(coalesce(s.plan_name, '')) = 'premium' then 3
        when lower(coalesce(s.plan_name, '')) = 'pro' then 3
        when lower(coalesce(s.plan_name, '')) in ('starter', 'basic') then 2
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

create or replace function public.published_question_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.questions where status = 'published';
$$;

revoke all on function public.published_question_count() from public, anon;
grant execute on function public.published_question_count() to authenticated;

drop policy if exists "questions_read_authenticated" on public.questions;
create policy "questions_read_authenticated" on public.questions
  for select to authenticated
  using (
    status = 'published'
    and case minimum_plan
      when 'free' then public.current_question_access_level() >= 1
      when 'starter' then public.current_question_access_level() >= 2
      when 'pro' then public.current_question_access_level() >= 3
      else false
    end
  );
