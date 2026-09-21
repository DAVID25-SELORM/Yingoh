begin;
-- Reuse existing event sources; never duplicate financial/grant audit records.
create function public.admin_access_activity(p_user uuid default null,p_actor uuid default null,p_promo uuid default null,
 p_action text default null,p_from timestamptz default null,p_to timestamptz default null,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_access_staff();
 if p_page is null or p_page not between 0 and 20000 then raise exception 'Invalid page'; end if;
 with events as (
  select e.id,e.actor_id,e.target_user_id,e.action,e.created_at,e.reason,
   e.new_values-'request_payload'-'request_key' as details,g.promo_code_id as promo_id
  from public.access_grant_events e join public.access_grants g on g.id=e.access_grant_id
  union all
  select a.id,a.admin_id,
   case when a.target_table='promo_redemptions' then r.user_id when a.target_table='access_payment_orders' then o.user_id else null end,
   a.action,a.created_at,coalesce(a.details->>'reason',a.action),
   -- Only selected safe summaries are returned, never batch identities or
   -- provider request payloads, phone numbers or raw internal provider bodies.
   jsonb_build_object('target_id',a.target_id,'target_table',a.target_table,'summary',a.details->'summary',
    'amount_minor',a.details->'amount_minor','state',a.details->'state'),
   case when a.target_table='promo_codes' then a.target_id else r.promo_id end
  from public.admin_audit_logs a
  left join public.promo_redemptions r on a.target_table='promo_redemptions' and r.id=a.target_id
  left join public.access_payment_orders o on a.target_table='access_payment_orders' and o.id=a.target_id
  where a.action in ('BULK_ACCESS_GRANTED','PROMO_CREATED','PROMO_UPDATED','PROMO_PAUSED','PROMO_RESUMED','PROMO_ENDED',
   'PROMO_REDEEMED','CHECKOUT_CREATED','PAYMENT_CONFIRMED','PAYMENT_FAILED')
  and (a.action='BULK_ACCESS_GRANTED' or
   (a.action like 'PROMO_%' and public.has_permission('promo.view_redemptions')) or
   (a.action in ('CHECKOUT_CREATED','PAYMENT_CONFIRMED','PAYMENT_FAILED') and public.has_permission('payments.view')))
 ), matching as materialized (
  select e.*,p.full_name as student_name,a.full_name as actor_name from events e
  left join public.profiles p on p.id=e.target_user_id left join public.profiles a on a.id=e.actor_id
  where (p_user is null or e.target_user_id=p_user) and (p_actor is null or e.actor_id=p_actor)
   and (p_promo is null or e.promo_id=p_promo) and (p_action is null or e.action=p_action)
   and (p_from is null or e.created_at>=p_from) and (p_to is null or e.created_at<p_to)
 ), page_rows as (select * from matching order by created_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('total',(select count(*) from matching),
  'rows',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb)) into result;
 return result;
end $$;
insert into public.permissions(id,group_key,label) values('payments.view','payments','View payment reports') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
 select id,'payments.view' from public.roles where name in ('admin','super_admin') on conflict do nothing;

create function public.admin_access_dashboard() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 result:=public.admin_access_overview();
 if public.has_permission('promo.view') then
  result:=result||jsonb_build_object('active_promos',(select count(*) from public.promo_codes where benefit_type is not null
   and is_active and valid_from<=now() and expires_at>now()));
 end if;
 if public.has_permission('promo.view_redemptions') then
  result:=result||jsonb_build_object('monthly_redemptions',(select count(*) from public.promo_redemptions where outcome='completed'
   and redeemed_at>=date_trunc('month',now())),'discount_minor',(select coalesce(sum(discount_ghs_minor),0) from public.promo_redemptions where outcome='completed'));
 end if;
 return result;
end $$;

create function public.admin_access_payments(p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_promo_staff('payments.view');
 if p_page is null or p_page not between 0 and 20000 then raise exception 'Invalid page'; end if;
 with page_rows as (select o.id,o.user_id,p.full_name,p.email,o.state,o.amount_minor,o.currency,o.provider_reference,
  o.quote->>'plan_name' as plan_name,o.created_at,o.updated_at,o.create_attempted_at
  from public.access_payment_orders o join public.profiles p on p.id=o.user_id order by o.created_at desc,o.id limit 25 offset p_page*25)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),
  'total',(select count(*) from public.access_payment_orders)) into result;
 return result;
end $$;
revoke all on function public.admin_access_activity(uuid,uuid,uuid,text,timestamptz,timestamptz,integer),
 public.admin_access_dashboard(),public.admin_access_payments(integer) from public,anon;
grant execute on function public.admin_access_activity(uuid,uuid,uuid,text,timestamptz,timestamptz,integer),
 public.admin_access_dashboard(),public.admin_access_payments(integer) to authenticated;
commit;
