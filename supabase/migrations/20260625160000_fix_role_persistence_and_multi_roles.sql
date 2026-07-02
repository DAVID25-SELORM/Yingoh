-- Make role assignment durable and explicitly multi-role.
-- The user_roles table already supports multiple roles through its composite
-- primary key; this migration tightens policies and admin RPC behavior.

insert into public.roles (name, description)
values
  ('student', 'Learner access for lessons, questions, attempts, results, and certificates.'),
  ('instructor', 'Teaching access for classes, lessons, question review, grading, and attendance.'),
  ('admin', 'Operational access for users, courses, subscriptions, reports, and support.'),
  ('super_admin', 'Full platform owner access across users, roles, content, payments, and operations.'),
  ('finance', 'Payment, receipt, refund, and reconciliation access.'),
  ('content_reviewer', 'Question, rationale, and learning-resource review access.')
on conflict (name) do update set description = excluded.description;

alter table public.user_roles enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'super_admin'
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_roles_super_admin_all" on public.user_roles;
create policy "user_roles_super_admin_all" on public.user_roles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select, insert, delete on public.user_roles to authenticated;
grant select on public.roles to authenticated;

insert into public.user_roles (user_id, role_id)
select p.id, r.id
from public.profiles p
cross join public.roles r
where lower(p.email) = 'cryxtalcfc@gmail.com'
  and r.name = 'super_admin'
on conflict (user_id, role_id) do nothing;

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
  if not public.is_super_admin() then
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
    coalesce(
      array_agg(r.name order by r.name) filter (where r.name is not null),
      array[]::text[]
    ) as roles
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id
  group by p.id, p.full_name, p.email, p.phone, p.country, p.created_at
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_get_all_users() to authenticated;

drop function if exists public.admin_assign_role(uuid, text);

create or replace function public.admin_assign_role(target_user_id uuid, role_name text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role_id uuid;
  assigned_roles text[];
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  select id into selected_role_id
  from public.roles
  where name = role_name;

  if selected_role_id is null then
    raise exception 'Role not found: %', role_name;
  end if;

  insert into public.user_roles(user_id, role_id)
  values (target_user_id, selected_role_id)
  on conflict (user_id, role_id) do nothing;

  select coalesce(array_agg(r.name order by r.name), array[]::text[])
  into assigned_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = target_user_id;

  return assigned_roles;
end;
$$;

grant execute on function public.admin_assign_role(uuid, text) to authenticated;

drop function if exists public.admin_remove_role(uuid, text);

create or replace function public.admin_remove_role(target_user_id uuid, role_name text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role_id uuid;
  assigned_roles text[];
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  select id into selected_role_id
  from public.roles
  where name = role_name;

  if selected_role_id is not null then
    delete from public.user_roles
    where user_roles.user_id = target_user_id
      and user_roles.role_id = selected_role_id;
  end if;

  select coalesce(array_agg(r.name order by r.name), array[]::text[])
  into assigned_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = target_user_id;

  return assigned_roles;
end;
$$;

grant execute on function public.admin_remove_role(uuid, text) to authenticated;
