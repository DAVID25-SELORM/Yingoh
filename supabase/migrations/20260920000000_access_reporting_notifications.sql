begin;
create index access_grants_created_idx on public.access_grants(created_at desc,id);
create table public.access_notice_receipts (
 event_key text primary key, user_id uuid not null references public.profiles(id),
 send_notice boolean not null, notification_id uuid, created_at timestamptz not null default now()
);
alter table public.access_notice_receipts enable row level security;
revoke all on public.access_notice_receipts from public,anon,authenticated;

create function public.emit_access_notice(p_user uuid,p_key text,p_title text,p_message text,p_send boolean)
returns void language plpgsql security definer set search_path=public as $$
declare existing public.access_notice_receipts; claimed text; notification uuid:=gen_random_uuid();
begin
 if p_send is null then raise exception 'Notification choice required'; end if;
 insert into public.access_notice_receipts(event_key,user_id,send_notice,notification_id)
 values(p_key,p_user,p_send,case when p_send then notification else null end)
 on conflict do nothing returning event_key into claimed;
 if claimed is null then
  select * into existing from public.access_notice_receipts where event_key=p_key;
  if existing.user_id<>p_user or existing.send_notice<>p_send then raise exception 'Notification request conflict'; end if;
  return;
 end if;
 if p_send then
  insert into public.notifications(id,user_id,title,message,type,link)
   values(notification,p_user,p_title,p_message,'info','/#/Billing');
 end if;
end $$;
revoke all on function public.emit_access_notice(uuid,text,text,text,boolean) from public,anon,authenticated;

create function public.admin_issue_access(p_user_id uuid,p_plan_id uuid,p_starts_at timestamptz,p_expires_at timestamptz,
 p_reason text,p_internal_note text,p_request_key uuid,p_notify boolean,p_parent_grant_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare grant_id uuid; event text:=case when p_parent_grant_id is null then 'ACCESS_GRANTED' else 'ACCESS_EXTENDED' end;
begin
 grant_id:=public.admin_grant_access(p_user_id,p_plan_id,p_starts_at,p_expires_at,p_reason,p_internal_note,p_request_key,p_parent_grant_id);
 perform public.emit_access_notice(p_user_id,'grant:'||grant_id::text||':'||event,
  case when p_parent_grant_id is null then 'Complimentary access granted' else 'Complimentary access extended' end,
  'Your access starts '||p_starts_at::text||' and ends '||p_expires_at::text||'.',p_notify);
 return grant_id;
end $$;
create function public.admin_revoke_access_with_notice(p_grant_id uuid,p_reason text,p_notify boolean)
returns void language plpgsql security definer set search_path=public as $$
declare recipient uuid;
begin
 perform public.admin_revoke_access(p_grant_id,p_reason);
 select user_id into recipient from public.access_grants where id=p_grant_id;
 perform public.emit_access_notice(recipient,'grant:'||p_grant_id::text||':ACCESS_REVOKED',
  'Complimentary access revoked','A complimentary access grant was revoked. Any valid paid subscription remains unchanged.',p_notify);
end $$;
revoke all on function public.admin_issue_access(uuid,uuid,timestamptz,timestamptz,text,text,uuid,boolean,uuid),
 public.admin_revoke_access_with_notice(uuid,text,boolean) from public,anon;
grant execute on function public.admin_issue_access(uuid,uuid,timestamptz,timestamptz,text,text,uuid,boolean,uuid),
 public.admin_revoke_access_with_notice(uuid,text,boolean) to authenticated;

create function public.assert_access_staff() returns void language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.has_role(array['admin','super_admin']) or not public.has_permission('access_grant.view')
 then raise exception 'Not authorized'; end if;
end $$;
revoke all on function public.assert_access_staff() from public,anon,authenticated;

create function public.admin_access_users(p_query text) returns table(id uuid,full_name text,email text)
language plpgsql stable security definer set search_path=public as $$
begin
 perform public.assert_access_staff();
 if p_query is null or length(trim(p_query))<2 or length(p_query)>254 then return; end if;
 return query select p.id,p.full_name,p.email from public.profiles p
 where p.email ilike '%'||trim(p_query)||'%' or p.full_name ilike '%'||trim(p_query)||'%'
 order by p.full_name,p.id limit 20;
end $$;

create function public.admin_access_grants(p_user uuid default null,p_status text default null,p_plan uuid default null,
 p_from timestamptz default null,p_to timestamptz default null,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_access_staff();
 if p_page is null or p_page not between 0 and 20000 or
  (p_status is not null and p_status not in ('active','scheduled','expired','revoked','expiring')) then raise exception 'Invalid filter'; end if;
 with filtered as materialized (
  select g.*,p.full_name as student_name,p.email as student_email,pp.name as plan_name,
   case when g.revoked_at is not null then 'revoked' when g.expires_at<=now() or g.status='expired' then 'expired'
    when g.starts_at>now() then 'scheduled' else 'active' end as effective_status
  from public.access_grants g join public.profiles p on p.id=g.user_id join public.payment_plans pp on pp.id=g.plan_id
  where (p_user is null or g.user_id=p_user) and (p_plan is null or g.plan_id=p_plan)
   and (p_from is null or g.created_at>=p_from) and (p_to is null or g.created_at<p_to)
 ), matching as materialized (select * from filtered where p_status is null or effective_status=p_status or
  (p_status='expiring' and effective_status='active' and expires_at<=now()+interval '7 days')),
 page as (select * from matching order by created_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('total',(select count(*) from matching),'rows',coalesce((select jsonb_agg(to_jsonb(page)-'request_payload'-'request_key') from page),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.admin_access_history(p_grant uuid default null,p_user uuid default null,p_actor uuid default null,
 p_action text default null,p_from timestamptz default null,p_to timestamptz default null,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_access_staff();
 if p_page is null or p_page not between 0 and 20000 then raise exception 'Invalid page'; end if;
 with matching as materialized (
  select e.id,e.access_grant_id,e.actor_id,e.target_user_id,e.action,e.reason,e.created_at,
   e.old_values-'request_payload'-'request_key' as old_values,e.new_values-'request_payload'-'request_key' as new_values,
   p.full_name as student_name,a.full_name as actor_name
  from public.access_grant_events e join public.profiles p on p.id=e.target_user_id join public.profiles a on a.id=e.actor_id
  where (p_grant is null or e.access_grant_id=p_grant) and (p_user is null or e.target_user_id=p_user)
   and (p_actor is null or e.actor_id=p_actor) and (p_action is null or e.action=p_action)
   and (p_from is null or e.created_at>=p_from) and (p_to is null or e.created_at<p_to)
 ), page as (select * from matching order by created_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('total',(select count(*) from matching),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.admin_access_overview() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_access_staff();
 select jsonb_build_object('active',count(*) filter(where revoked_at is null and status in ('active','scheduled') and starts_at<=now() and expires_at>now()),
  'expiring',count(*) filter(where revoked_at is null and status in ('active','scheduled') and starts_at<=now() and expires_at>now() and expires_at<=now()+interval '7 days'),
  'scheduled',count(*) filter(where revoked_at is null and status in ('active','scheduled') and starts_at>now()),
  'enabled',public.access_feature_enabled('complimentary_access')) into result from public.access_grants;
 return result;
end $$;
revoke all on function public.admin_access_users(text),public.admin_access_grants(uuid,text,uuid,timestamptz,timestamptz,integer),
 public.admin_access_history(uuid,uuid,uuid,text,timestamptz,timestamptz,integer),public.admin_access_overview() from public,anon;
grant execute on function public.admin_access_users(text),public.admin_access_grants(uuid,text,uuid,timestamptz,timestamptz,integer),
 public.admin_access_history(uuid,uuid,uuid,text,timestamptz,timestamptz,integer),public.admin_access_overview() to authenticated;

-- In-app scheduling only, reusing notifications. No SMTP transport or cron is
-- enabled here. Security depends on timestamps, never this presentation job.
create function public.process_access_reminders(p_limit integer default 100) returns integer
language plpgsql security definer set search_path=public as $$
declare item record; processed integer:=0;
begin
 if not public.access_feature_enabled('complimentary_access') then return 0; end if;
 if p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid batch size'; end if;
 for item in
  select g.*,case when g.expires_at<=now() then 'ACCESS_EXPIRED' when g.expires_at<=now()+interval '1 day' then 'ACCESS_EXPIRING_1'
    when g.expires_at<=now()+interval '3 days' then 'ACCESS_EXPIRING_3' else 'ACCESS_EXPIRING_7' end as event
  from public.access_grants g where g.revoked_at is null and g.status in ('active','scheduled') and g.starts_at<=now()
   and g.expires_at>now()-interval '1 day' and g.expires_at<=now()+interval '7 days'
   and exists(select 1 from public.access_notice_receipts n where n.user_id=g.user_id and n.send_notice
    and n.event_key in ('grant:'||g.id::text||':ACCESS_GRANTED','grant:'||g.id::text||':ACCESS_EXTENDED'))
   and not exists(select 1 from public.access_notice_receipts n where n.event_key='grant:'||g.id::text||':'||
    case when g.expires_at<=now() then 'ACCESS_EXPIRED' when g.expires_at<=now()+interval '1 day' then 'ACCESS_EXPIRING_1'
    when g.expires_at<=now()+interval '3 days' then 'ACCESS_EXPIRING_3' else 'ACCESS_EXPIRING_7' end)
   order by g.expires_at,g.id limit p_limit
 loop
  perform public.emit_access_notice(item.user_id,'grant:'||item.id::text||':'||item.event,
   case when item.event='ACCESS_EXPIRED' then 'Complimentary access ended' else 'Complimentary access expiring' end,
   'This complimentary grant ends at '||item.expires_at::text||'. Any valid paid subscription remains unchanged.',true);
  processed:=processed+1;
 end loop;
 return processed;
end $$;
revoke all on function public.process_access_reminders(integer) from public,anon,authenticated;
grant execute on function public.process_access_reminders(integer) to service_role;
commit;
