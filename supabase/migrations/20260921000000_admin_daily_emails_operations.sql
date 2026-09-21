begin;
-- Additive extension of admin_daily_emails for the Email Operations Dashboard.
-- Same signature, same admin-only authorization, same metrics/rows/enabled keys.
-- Adds: filtered_total (real pagination count), health counters and recent activity.
create index if not exists daily_delivery_sent_at on public.daily_question_deliveries(sent_at desc) where sent_at is not null;

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
 return jsonb_build_object('metrics',metrics,'rows',history,'enabled',(select enabled from public.daily_email_config where id),'filtered_total',total_filtered,'health',health,'recent',recent);
end $$;
commit;
