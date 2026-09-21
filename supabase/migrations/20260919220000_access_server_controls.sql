begin;

-- Independent controls: a frontend flag is never an authorization boundary.
-- No authenticated client may enable these controls. Rollout is an explicit
-- server-side operational action after migration rehearsal and approval.
create table public.access_system_controls (
 id boolean primary key default true check(id),
 complimentary_access_enabled boolean not null default false,
 promo_codes_enabled boolean not null default false,
 hubtel_payments_enabled boolean not null default false
);
insert into public.access_system_controls(id) values(true);
alter table public.access_system_controls enable row level security;
revoke all on public.access_system_controls from public,anon,authenticated;
grant select on public.access_system_controls to authenticated;
create policy access_controls_read on public.access_system_controls for select to authenticated using(true);

create function public.access_feature_enabled(p_feature text) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select case p_feature
  when 'complimentary_access' then c.complimentary_access_enabled
  when 'promo_codes' then c.promo_codes_enabled
  when 'hubtel_payments' then c.hubtel_payments_enabled
  else false end from public.access_system_controls c where c.id),false);
$$;
revoke all on function public.access_feature_enabled(text) from public,anon;
grant execute on function public.access_feature_enabled(text) to authenticated;

create function public.guard_access_grant_creation() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if not public.access_feature_enabled('complimentary_access') then raise exception 'Complimentary access is disabled'; end if;
 return new;
end $$;
revoke all on function public.guard_access_grant_creation() from public,anon,authenticated;
create trigger access_grants_rollout_guard before insert on public.access_grants
for each row execute function public.guard_access_grant_creation();

-- Replaces the foundation projection, preserving paid access even when the
-- complimentary-access control is off. Scheduled/expired/revoked grants never
-- become valid merely because the control is enabled.
create or replace function public.my_effective_access() returns jsonb language plpgsql stable
security definer set search_path=public as $$
declare paid public.subscriptions; complimentary public.access_grants; paid_key text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into paid from public.subscriptions s where s.user_id=auth.uid() and s.status='active'
  and (s.current_period_end is null or s.current_period_end>now())
  and public.access_plan_key(s.plan_name)<>'free'
  order by s.created_at desc,s.id limit 1;
 paid_key:=public.access_plan_key(paid.plan_name);
 if paid_key<>'free' then
  return jsonb_build_object('has_access',true,'source','paid_subscription','plan_key',paid_key,
   'plan_id',null,'starts_at',paid.created_at,'expires_at',paid.current_period_end);
 end if;
 if public.access_feature_enabled('complimentary_access') then
  select * into complimentary from public.access_grants g where g.user_id=auth.uid()
   and g.revoked_at is null and g.status in ('active','scheduled') and g.starts_at<=now() and g.expires_at>now()
   order by g.expires_at desc,g.id limit 1;
  if found then
   return jsonb_build_object('has_access',true,'source',complimentary.grant_type,'plan_key',complimentary.plan_key,
    'plan_id',complimentary.plan_id,'starts_at',complimentary.starts_at,'expires_at',complimentary.expires_at);
  end if;
 end if;
 return jsonb_build_object('has_access',false,'source','free','plan_key','free','plan_id',null,'starts_at',null,'expires_at',null);
end $$;
revoke all on function public.my_effective_access() from public,anon;
grant execute on function public.my_effective_access() to authenticated;
commit;
