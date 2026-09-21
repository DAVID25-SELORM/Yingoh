begin;
-- Admin-selectable audience for daily emails: 'paid' (existing behaviour, default) or 'all'.
-- Additive: default keeps today's recipient selection; nothing is enabled or sent by this migration.
alter table public.daily_email_config add column if not exists audience text not null default 'paid';
do $$ begin
 if not exists(select 1 from pg_constraint where conname='daily_email_config_audience_check') then
  alter table public.daily_email_config add constraint daily_email_config_audience_check check(audience in ('paid','all'));
 end if;
end $$;
-- Existing RLS policy daily_config_update already limits updates to admin/super_admin.
grant update(audience) on public.daily_email_config to authenticated;

-- Everything the original eligibility rule required except the paid-plan condition.
create or replace function public.daily_email_base_eligible(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id
 where u.id=p_user and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and u.email_confirmed_at is not null and u.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 and not exists(select 1 from public.daily_email_suppressions b where b.user_id=u.id and lower(b.email)=lower(u.email))
 and not exists(select 1 from public.instructor_profiles i where i.user_id=u.id and i.account_status<>'active'));
$$;
create or replace function public.daily_email_has_paid_plan(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.subscriptions s where s.user_id=p_user and s.status='active'
 and (s.current_period_end is null or s.current_period_end>now()) and lower(trim(s.plan_name)) not in ('','free'));
$$;
-- Same signature and callers; unknown/missing audience fails closed to paid-only.
create or replace function public.daily_email_eligible(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.daily_email_base_eligible(p_user)
 and (coalesce((select audience from public.daily_email_config where id),'paid')='all' or public.daily_email_has_paid_plan(p_user));
$$;
revoke all on function public.daily_email_base_eligible(uuid),public.daily_email_has_paid_plan(uuid) from public,anon,authenticated;
grant execute on function public.daily_email_base_eligible(uuid),public.daily_email_has_paid_plan(uuid) to service_role;

-- On-demand admin preview so the audience change is an informed decision.
create or replace function public.admin_daily_email_audience_preview() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return (select jsonb_build_object('opted_in',count(*),
  'paid_eligible',count(*) filter(where public.daily_email_base_eligible(user_id) and public.daily_email_has_paid_plan(user_id)),
  'all_eligible',count(*) filter(where public.daily_email_base_eligible(user_id)))
  from public.user_email_preferences where daily_question_enabled);
end $$;
revoke all on function public.admin_daily_email_audience_preview() from public,anon;
grant execute on function public.admin_daily_email_audience_preview() to authenticated,service_role;

-- Report the current audience alongside the existing response (all other keys unchanged).
create or replace function public.admin_daily_emails(p_date date default current_date,p_status text default null,p_search text default '',p_page integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$
declare metrics jsonb; history jsonb; total_filtered bigint; health jsonb; recent jsonb;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 select jsonb_build_object('total',count(*),'scheduled',count(*) filter(where status in ('scheduled','reserved')),'sent',count(*) filter(where sent_at is not null),'pending',count(*) filter(where status in ('scheduled','reserved','sending') or (status='failed' and retryable)),'failed',count(*) filter(where status='failed'),'answered',count(*) filter(where answered_at is not null),'correct',count(*) filter(where is_correct),'incorrect',count(*) filter(where is_correct=false)) into metrics from public.daily_question_deliveries where scheduled_date=p_date;
 select count(*) into total_filtered from public.daily_question_deliveries d join public.profiles p on p.id=d.user_id join auth.users u on u.id=d.user_id
 where d.scheduled_date=p_date and (p_status is null or d.status=p_status) and (p_search='' or u.email ilike '%'||left(p_search,100)||'%' or p.full_name ilike '%'||left(p_search,100)||'%');
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into history from (
 select d.id,d.user_id,p.full_name,coalesce(d.recipient_email,u.email) email,d.question_id,d.scheduled_date,d.scheduled_for,d.timezone,d.status,d.sent_at,d.answered_at,d.is_correct,d.retry_count,d.last_error,d.retryable
 from public.daily_question_deliveries d join public.profiles p on p.id=d.user_id join auth.users u on u.id=d.user_id
 where d.scheduled_date=p_date and (p_status is null or d.status=p_status) and (p_search='' or u.email ilike '%'||left(p_search,100)||'%' or p.full_name ilike '%'||left(p_search,100)||'%')
 order by d.created_at desc,d.id limit 50 offset least(greatest(p_page,0),10000)*50) r;
 select jsonb_build_object(
  'retry_pending',count(*) filter(where status='failed' and retryable),
  'permanent_failures',count(*) filter(where status='failed' and not retryable and last_error is distinct from 'delivery_outcome_unknown' and last_error is distinct from 'invalid_recipient'),
  'invalid_recipients',count(*) filter(where status='failed' and last_error='invalid_recipient'),
  'unknown_outcome',count(*) filter(where status='failed' and last_error='delivery_outcome_unknown'),
  'last_sent_at',(select max(sent_at) from public.daily_question_deliveries),
  'opted_in_recipients',(select count(*) from public.user_email_preferences where daily_question_enabled)
 ) into health from public.daily_question_deliveries where scheduled_date=p_date;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into recent from (
 select d.id,p.full_name,d.status,d.is_correct,coalesce(d.answered_at,d.sent_at,d.failed_at,d.scheduled_for) activity_at
 from public.daily_question_deliveries d join public.profiles p on p.id=d.user_id
 where d.scheduled_date=p_date and d.status in ('sent','answered','failed')
 order by coalesce(d.answered_at,d.sent_at,d.failed_at,d.scheduled_for) desc,d.id limit 10) r;
 return jsonb_build_object('metrics',metrics,'rows',history,'enabled',(select enabled from public.daily_email_config where id),'audience',(select audience from public.daily_email_config where id),'filtered_total',total_filtered,'health',health,'recent',recent);
end $$;
commit;
