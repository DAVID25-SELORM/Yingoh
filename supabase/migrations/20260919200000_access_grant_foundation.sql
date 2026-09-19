begin;

-- Foundation only: no production backfill, subscription writes or email sends.
insert into public.permissions(id,group_key,label) values
 ('access_grant.view','access','View complimentary access'),
 ('access_grant.create','access','Grant complimentary access'),
 ('access_grant.extend','access','Extend complimentary access'),
 ('access_grant.revoke','access','Revoke complimentary access')
on conflict(id) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.name in ('admin','super_admin') and p.id in
 ('access_grant.view','access_grant.create','access_grant.extend','access_grant.revoke')
on conflict do nothing;

create table public.access_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 plan_id uuid not null references public.payment_plans(id),
 plan_key text not null check(plan_key in ('basic','pro','master','faculty')),
 grant_type text not null check(grant_type in
  ('admin_free_access','promo_code','scholarship','trial','manual_extension','compensation')),
 starts_at timestamptz not null, expires_at timestamptz not null,
 status text not null default 'active' check(status in ('scheduled','active','expired','revoked')),
 reason text not null check(length(trim(reason)) between 1 and 1000),
 internal_note text check(length(internal_note)<=4000),
 promo_code_id uuid references public.promo_codes(id),
 parent_grant_id uuid references public.access_grants(id),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 revoked_by uuid references public.profiles(id), revoked_at timestamptz, revocation_reason text,
 request_key uuid not null, request_payload jsonb not null,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
 check(expires_at>starts_at),
 check((status='revoked')=(revoked_at is not null)),
 check((revoked_at is null and revoked_by is null and revocation_reason is null) or
  (revoked_at is not null and revoked_by is not null and length(trim(revocation_reason)) between 1 and 1000)),
 unique(created_by,request_key)
);
create index access_grants_user_window on public.access_grants(user_id,starts_at,expires_at) where revoked_at is null;
create index access_grants_expiry on public.access_grants(expires_at,status);
create index access_grants_promo on public.access_grants(promo_code_id);
create index access_grants_parent on public.access_grants(parent_grant_id);

create table public.access_grant_events (
 id uuid primary key default gen_random_uuid(),
 access_grant_id uuid not null references public.access_grants(id),
 actor_id uuid not null references public.profiles(id),
 target_user_id uuid not null references public.profiles(id),
 action text not null check(action in ('ACCESS_GRANTED','ACCESS_EXTENDED','ACCESS_REVOKED')),
 old_values jsonb, new_values jsonb not null,
 reason text not null, created_at timestamptz not null default now()
);
create index access_grant_events_history on public.access_grant_events(created_at desc,id);
create index access_grant_events_user on public.access_grant_events(target_user_id,created_at desc);
alter table public.access_grants enable row level security;
alter table public.access_grant_events enable row level security;
revoke all on public.access_grants,public.access_grant_events from public,anon,authenticated;
grant select on public.access_grants,public.access_grant_events to authenticated;
create policy access_grants_staff_read on public.access_grants for select to authenticated using
 (public.has_role(array['admin','super_admin']) and public.has_permission('access_grant.view'));
create policy access_events_staff_read on public.access_grant_events for select to authenticated using
 (public.has_role(array['admin','super_admin']) and public.has_permission('access_grant.view'));

-- Shared interpretation of the existing product naming convention.
create function public.access_plan_key(p_name text) returns text language sql immutable
set search_path=public as $$ select case
 when lower(p_name) similar to '%(365|faculty)%' then 'faculty'
 when lower(p_name) similar to '%(180|master|premium)%' then 'master'
 when lower(p_name) similar to '%(90|success|pro)%' then 'pro'
 when lower(p_name) similar to '%(30-day|30 day|starter|basic)%' then 'basic'
 else 'free' end $$;
revoke all on function public.access_plan_key(text) from public,anon,authenticated;

create function public.admin_grant_access(
 p_user_id uuid,p_plan_id uuid,p_starts_at timestamptz,p_expires_at timestamptz,
 p_reason text,p_internal_note text,p_request_key uuid,p_parent_grant_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=auth.uid(); existing public.access_grants; parent public.access_grants;
 result public.access_grants; product_key text; payload jsonb; total_days interval;
 required_permission text:=case when p_parent_grant_id is null then 'access_grant.create' else 'access_grant.extend' end;
begin
 if actor is null or not public.has_role(array['admin','super_admin']) or
  not public.has_permission(required_permission) then raise exception 'Not authorized'; end if;
 if p_request_key is null or p_starts_at is null or p_expires_at is null or
  not isfinite(p_starts_at) or not isfinite(p_expires_at) or p_expires_at<=p_starts_at or
  p_reason is null or length(trim(p_reason)) not between 1 and 1000 or
  length(p_internal_note)>4000 then raise exception 'Invalid grant'; end if;
 -- Serializes all grants/extensions for this recipient, including bulk callers.
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Unknown recipient'; end if;
 payload:=jsonb_build_object('user',p_user_id,'plan',p_plan_id,'starts',extract(epoch from p_starts_at),'expires',extract(epoch from p_expires_at),
  'reason',p_reason,'note',p_internal_note,'parent',p_parent_grant_id);
 select * into existing from public.access_grants where created_by=actor and request_key=p_request_key;
 if found then
  if existing.request_payload<>payload then raise exception 'Idempotency conflict'; end if;
  return existing.id;
 end if;
 if p_expires_at<=now() then raise exception 'Grant must expire in the future'; end if;
 select public.access_plan_key(name) into product_key from public.payment_plans where id=p_plan_id and is_active;
 if product_key is null or product_key='free' then raise exception 'Invalid access plan'; end if;
 if p_parent_grant_id is not null then
  select * into parent from public.access_grants where id=p_parent_grant_id and user_id=p_user_id for update;
  if not found or parent.revoked_at is not null or parent.plan_id<>p_plan_id or
   p_starts_at<greatest(parent.expires_at,now()) then raise exception 'Invalid extension'; end if;
 end if;
 if exists(select 1 from public.access_grants g where g.user_id=p_user_id and g.revoked_at is null
  and g.status in ('active','scheduled') and g.starts_at<p_expires_at and g.expires_at>p_starts_at)
 then raise exception 'Overlapping complimentary access'; end if;
 -- Conservative lifetime cap prevents repeated short grants bypassing the admin limit.
 -- Count revoked grants too; revocation must not reset promotional authority.
 if not public.has_role(array['super_admin']) then
  select coalesce(sum(g.expires_at-g.starts_at),interval '0') into total_days
   from public.access_grants g where g.user_id=p_user_id;
  if total_days+(p_expires_at-p_starts_at)>interval '30 days' then raise exception 'Admin duration limit exceeded'; end if;
 end if;
 insert into public.access_grants(user_id,plan_id,plan_key,grant_type,starts_at,expires_at,reason,internal_note,
  created_by,request_key,request_payload,parent_grant_id)
 values(p_user_id,p_plan_id,product_key,case when p_parent_grant_id is null then 'admin_free_access' else 'manual_extension' end,
  p_starts_at,p_expires_at,trim(p_reason),p_internal_note,actor,p_request_key,payload,p_parent_grant_id) returning * into result;
 insert into public.access_grant_events(access_grant_id,actor_id,target_user_id,action,old_values,new_values,reason)
 values(result.id,actor,p_user_id,case when p_parent_grant_id is null then 'ACCESS_GRANTED' else 'ACCESS_EXTENDED' end,
  case when p_parent_grant_id is null then null else to_jsonb(parent) end,to_jsonb(result),trim(p_reason));
 return result.id;
end $$;

create function public.admin_revoke_access(p_grant_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare old_grant public.access_grants; new_grant public.access_grants; actor uuid:=auth.uid();
begin
 if actor is null or not public.has_role(array['admin','super_admin']) or
  not public.has_permission('access_grant.revoke') then raise exception 'Not authorized'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Reason required'; end if;
 select * into old_grant from public.access_grants where id=p_grant_id for update;
 if not found then raise exception 'Unknown grant'; end if;
 if old_grant.revoked_at is not null then return; end if;
 update public.access_grants set status='revoked',revoked_by=actor,revoked_at=now(),revocation_reason=trim(p_reason)
 where id=p_grant_id returning * into new_grant;
 insert into public.access_grant_events(access_grant_id,actor_id,target_user_id,action,old_values,new_values,reason)
 values(p_grant_id,actor,old_grant.user_id,'ACCESS_REVOKED',to_jsonb(old_grant),to_jsonb(new_grant),trim(p_reason));
end $$;
revoke all on function public.admin_grant_access(uuid,uuid,timestamptz,timestamptz,text,text,uuid,uuid) from public,anon;
revoke all on function public.admin_revoke_access(uuid,text) from public,anon;
grant execute on function public.admin_grant_access(uuid,uuid,timestamptz,timestamptz,text,text,uuid,uuid) to authenticated;
grant execute on function public.admin_revoke_access(uuid,text) to authenticated;

-- Safe own-account projection: never return internal notes, actors or audit payloads.
-- Kept separate from live entitlement adapters until their compatibility tests exist.
create function public.my_access_grant_summary()
returns table(id uuid,plan_id uuid,plan_key text,grant_type text,starts_at timestamptz,expires_at timestamptz,status text)
language sql stable security definer set search_path=public as $$
 select g.id,g.plan_id,g.plan_key,g.grant_type,g.starts_at,g.expires_at,
 case when g.revoked_at is not null then 'revoked' when g.expires_at<=now() then 'expired'
 when g.status='expired' then 'expired' when g.starts_at>now() then 'scheduled' else 'active' end
 from public.access_grants g where g.user_id=auth.uid()
 order by g.created_at desc,g.id limit 100
$$;
revoke all on function public.my_access_grant_summary() from public,anon;
grant execute on function public.my_access_grant_summary() to authenticated;

-- One own-account resolver for the upcoming entitlement adapters. No arbitrary
-- user-id argument; staff bypass remains a separate existing access decision.
create function public.my_effective_access() returns jsonb language plpgsql stable
security definer set search_path=public as $$
declare paid public.subscriptions; complimentary public.access_grants; paid_key text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 -- Match the existing plan resolver's latest-valid subscription ordering.
 select * into paid from public.subscriptions s where s.user_id=auth.uid() and s.status='active'
  and (s.current_period_end is null or s.current_period_end>now()) order by s.created_at desc limit 1;
 paid_key:=public.access_plan_key(paid.plan_name);
 if paid_key<>'free' then
  return jsonb_build_object('has_access',true,'source','paid_subscription','plan_key',paid_key,
   'plan_id',null,'starts_at',paid.created_at,'expires_at',paid.current_period_end);
 end if;
 select * into complimentary from public.access_grants g where g.user_id=auth.uid()
  and g.revoked_at is null and g.status in ('active','scheduled') and g.starts_at<=now() and g.expires_at>now()
  order by g.expires_at desc,g.id limit 1;
 if found then
  return jsonb_build_object('has_access',true,'source',complimentary.grant_type,'plan_key',complimentary.plan_key,
   'plan_id',complimentary.plan_id,'starts_at',complimentary.starts_at,'expires_at',complimentary.expires_at);
 end if;
 return jsonb_build_object('has_access',false,'source','free','plan_key','free','plan_id',null,'starts_at',null,'expires_at',null);
end $$;
revoke all on function public.my_effective_access() from public,anon;
grant execute on function public.my_effective_access() to authenticated;
commit;
