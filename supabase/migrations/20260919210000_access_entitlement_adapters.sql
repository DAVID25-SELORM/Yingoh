begin;

-- Existing downstream RLS/quota functions continue to use this entry point.
-- Its paid-plan selection and the operational admin bypass are preserved.
create or replace function public.current_subscription_plan_key()
returns text language sql stable security definer set search_path=public as $$
 select case when auth.uid() is null then 'free' when public.has_role(array['admin','super_admin']) then 'faculty'
 else coalesce(public.my_effective_access()->>'plan_key','free') end;
$$;

-- Preserve the existing highest-valid-paid question tier, which intentionally
-- differs from the latest-paid subscription resolver. Grants are a fallback,
-- never an upgrade over a still-valid paid question tier.
create or replace function public.current_question_access_level()
returns integer language plpgsql stable security definer set search_path=public as $$
declare paid_level integer; access_key text;
begin
 if public.has_role(array['admin','super_admin']) then return 3; end if;
 select max(case
  when lower(coalesce(s.plan_name,'')) similar to '%(365|180|90|faculty|master|success|premium|pro)%' then 3
  when lower(coalesce(s.plan_name,'')) similar to '%(30-day|30 day|starter|basic)%' then 2
  else 1 end) into paid_level from public.subscriptions s
 where s.user_id=auth.uid() and s.status='active' and (s.current_period_end is null or s.current_period_end>now());
 if coalesce(paid_level,1)>1 then return paid_level; end if;
 if auth.uid() is null then return 1; end if;
 access_key:=public.my_effective_access()->>'plan_key';
 return case when access_key in ('faculty','master','pro') then 3 when access_key='basic' then 2 else 1 end;
end $$;

create or replace function public.has_daily_question_access()
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_role(array['admin','super_admin']) or exists(
  select 1 from public.subscriptions s where s.user_id=auth.uid() and s.status='active'
   and (s.current_period_end is null or s.current_period_end>now())
   and lower(trim(coalesce(s.plan_name,''))) not in ('','free')
 ) or case when auth.uid() is null then false else coalesce((public.my_effective_access()->>'has_access')::boolean,false) end;
$$;

revoke all on function public.current_subscription_plan_key(),public.current_question_access_level(),public.has_daily_question_access() from public,anon;
grant execute on function public.current_subscription_plan_key(),public.current_question_access_level(),public.has_daily_question_access() to authenticated;

-- Deliberately do not broaden the live daily-email recipient cohort here.
-- Grant email enrollment needs an explicit rollout decision and sending tests.
commit;
