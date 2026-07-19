-- Let platform admins manage ordinary users while keeping Super Admin protected.

drop function if exists public.admin_assign_role(uuid, text);
drop function if exists public.admin_remove_role(uuid, text);
drop function if exists public.admin_invite_user(text, text, text);
drop function if exists public.admin_get_all_users();

create or replace function public.admin_get_all_users()
returns table(
  id uuid,
  full_name text,
  email text,
  phone text,
  country text,
  created_at timestamptz,
  roles text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.country,
    p.created_at,
    coalesce(array_agg(r.name) filter (where r.name is not null), '{}') as roles
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id
  group by p.id, p.full_name, p.email, p.phone, p.country, p.created_at
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_invite_user(
  p_email text,
  p_full_name text,
  p_role_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_id uuid;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Not authorized';
  end if;

  if lower(trim(p_role_name)) = 'super_admin' and not public.is_super_admin() then
    raise exception 'Only a Super Admin can invite another Super Admin';
  end if;

  insert into public.pending_invites(email, full_name, role_name)
  values (lower(trim(p_email)), p_full_name, lower(trim(p_role_name)))
  on conflict (email) do update set
    full_name = excluded.full_name,
    role_name = excluded.role_name,
    expires_at = now() + interval '7 days',
    accepted_at = null
  returning id into invite_id;

  return invite_id;
end;
$$;

create or replace function public.admin_assign_role(target_user_id uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role_id uuid;
  actor_is_super_admin boolean := public.is_super_admin();
  target_is_super_admin boolean;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Not authorized';
  end if;

  if lower(trim(role_name)) = 'super_admin' and not actor_is_super_admin then
    raise exception 'Only a Super Admin can assign the Super Admin role';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id
      and r.name = 'super_admin'
  ) into target_is_super_admin;

  if target_is_super_admin and not actor_is_super_admin then
    raise exception 'Only a Super Admin can modify a Super Admin account';
  end if;

  select id into selected_role_id from public.roles where name = lower(trim(role_name));
  if selected_role_id is null then
    raise exception 'Role not found: %', role_name;
  end if;

  insert into public.user_roles(user_id, role_id)
  values (target_user_id, selected_role_id)
  on conflict (user_id, role_id) do nothing;
end;
$$;

create or replace function public.admin_remove_role(target_user_id uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role_id uuid;
  actor_is_super_admin boolean := public.is_super_admin();
  target_is_super_admin boolean;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Not authorized';
  end if;

  if lower(trim(role_name)) = 'super_admin' and not actor_is_super_admin then
    raise exception 'Only a Super Admin can remove the Super Admin role';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id
      and r.name = 'super_admin'
  ) into target_is_super_admin;

  if target_is_super_admin and not actor_is_super_admin then
    raise exception 'Only a Super Admin can modify a Super Admin account';
  end if;

  select id into selected_role_id from public.roles where name = lower(trim(role_name));
  if selected_role_id is null then
    return;
  end if;

  delete from public.user_roles
  where user_roles.user_id = target_user_id
    and user_roles.role_id = selected_role_id;
end;
$$;

drop policy if exists "invites_admin_all" on public.pending_invites;
create policy "invites_admin_all"
on public.pending_invites
for all
to authenticated
using (
  public.is_super_admin()
  or (
    public.has_role(array['admin'])
    and coalesce(role_name, '') <> 'super_admin'
  )
)
with check (
  public.is_super_admin()
  or (
    public.has_role(array['admin'])
    and coalesce(role_name, '') <> 'super_admin'
  )
);

grant execute on function public.admin_get_all_users() to authenticated;
grant execute on function public.admin_invite_user(text, text, text) to authenticated;
grant execute on function public.admin_assign_role(uuid, text) to authenticated;
grant execute on function public.admin_remove_role(uuid, text) to authenticated;
