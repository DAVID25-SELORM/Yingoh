-- Granular RBAC permission model for NurseFaculty.
-- Roles remain the primary assignment model; per-user overrides are optional
-- and should be used sparingly for least-privilege exceptions.

create table if not exists public.permissions (
  id text primary key,
  group_key text not null,
  label text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id text not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id text not null references public.permissions(id) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  assigned_by uuid references public.profiles(id) on delete set null,
  reason text,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;

drop policy if exists "permissions_read_authenticated" on public.permissions;
create policy "permissions_read_authenticated" on public.permissions
  for select to authenticated using (true);

drop policy if exists "role_permissions_read_authenticated" on public.role_permissions;
create policy "role_permissions_read_authenticated" on public.role_permissions
  for select to authenticated using (true);

drop policy if exists "user_permission_overrides_own_or_admin_read" on public.user_permission_overrides;
create policy "user_permission_overrides_own_or_admin_read" on public.user_permission_overrides
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(array['admin', 'super_admin']));

drop policy if exists "user_permission_overrides_super_admin_all" on public.user_permission_overrides;
create policy "user_permission_overrides_super_admin_all" on public.user_permission_overrides
  for all to authenticated
  using (public.has_role(array['super_admin']))
  with check (public.has_role(array['super_admin']));

grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;
grant select, insert, update, delete on public.user_permission_overrides to authenticated;

insert into public.permissions (id, group_key, label, sort_order)
values
  ('users.view', 'users', 'View users', 10),
  ('users.create', 'users', 'Create/invite users', 20),
  ('users.edit', 'users', 'Edit users', 30),
  ('users.suspend', 'users', 'Suspend/activate users', 40),
  ('users.reset_password', 'users', 'Reset passwords', 50),
  ('users.delete', 'users', 'Delete users', 60),
  ('roles.assign', 'users', 'Assign roles', 70),
  ('questions.view', 'questions', 'View questions', 110),
  ('questions.create', 'questions', 'Create questions', 120),
  ('questions.edit', 'questions', 'Edit questions', 130),
  ('questions.delete', 'questions', 'Delete questions', 140),
  ('questions.review', 'questions', 'Review questions', 150),
  ('questions.approve', 'questions', 'Approve/reject questions', 160),
  ('questions.publish', 'questions', 'Publish questions', 170),
  ('questions.lock', 'questions', 'Lock approved questions', 180),
  ('questions.archive', 'questions', 'Archive questions', 190),
  ('exams.practice', 'exams', 'Take practice exams', 210),
  ('exams.create', 'exams', 'Create exams', 220),
  ('exams.edit', 'exams', 'Edit exams', 230),
  ('exams.schedule', 'exams', 'Schedule exams', 240),
  ('exams.publish', 'exams', 'Publish exams', 250),
  ('exams.grade', 'exams', 'Grade manually marked exams', 260),
  ('exams.results', 'exams', 'View results', 270),
  ('courses.view', 'courses', 'View courses', 310),
  ('courses.create', 'courses', 'Create courses', 320),
  ('courses.edit', 'courses', 'Edit courses', 330),
  ('courses.publish', 'courses', 'Publish courses', 340),
  ('courses.archive', 'courses', 'Archive courses', 350),
  ('resources.upload', 'courses', 'Upload learning resources', 360),
  ('resources.manage', 'courses', 'Manage resource library', 370),
  ('payments.view', 'finance', 'View payments', 410),
  ('payments.refund', 'finance', 'Process refunds', 420),
  ('subscriptions.manage', 'finance', 'Manage subscriptions', 430),
  ('invoices.issue', 'finance', 'Issue invoices', 440),
  ('revenue.view', 'finance', 'View revenue', 450),
  ('finance.export', 'finance', 'Export financial reports', 460),
  ('analytics.own', 'analytics', 'Own analytics', 510),
  ('analytics.department', 'analytics', 'Department analytics', 520),
  ('analytics.global', 'analytics', 'Global analytics', 530),
  ('reports.view', 'analytics', 'View reports', 540),
  ('reports.export', 'analytics', 'Export reports', 550),
  ('settings.view', 'system', 'View settings', 610),
  ('settings.edit', 'system', 'Edit settings', 620),
  ('integrations.manage', 'system', 'Manage integrations', 630),
  ('roles.manage', 'system', 'Manage roles/permissions', 640),
  ('audit.view', 'system', 'View audit logs', 650),
  ('audit.configure', 'system', 'Configure audit logs', 660),
  ('security.manage', 'system', 'Manage security', 670),
  ('branding.manage', 'system', 'Manage branding', 680),
  ('feature_flags.manage', 'system', 'Manage feature flags', 690)
on conflict (id) do update
set group_key = excluded.group_key,
    label = excluded.label,
    sort_order = excluded.sort_order;

delete from public.role_permissions rp
using public.roles r
where r.id = rp.role_id
  and r.name in (
    'student', 'instructor', 'content_reviewer', 'finance', 'admin', 'super_admin',
    'department_admin', 'exam_officer', 'question_bank_manager', 'support_officer',
    'academic_registrar', 'library_manager', 'analytics_manager', 'guest_reviewer'
  );

with role_perm(role_name, permission_id) as (
  values
    ('student','courses.view'), ('student','exams.practice'), ('student','exams.results'), ('student','questions.view'), ('student','analytics.own'), ('student','resources.upload'),
    ('instructor','users.view'), ('instructor','questions.view'), ('instructor','questions.create'), ('instructor','questions.edit'), ('instructor','exams.create'), ('instructor','exams.edit'), ('instructor','exams.schedule'), ('instructor','exams.grade'), ('instructor','exams.results'), ('instructor','courses.view'), ('instructor','courses.create'), ('instructor','courses.edit'), ('instructor','resources.upload'), ('instructor','analytics.own'), ('instructor','analytics.department'),
    ('content_reviewer','questions.view'), ('content_reviewer','questions.review'), ('content_reviewer','questions.approve'), ('content_reviewer','questions.lock'), ('content_reviewer','questions.publish'), ('content_reviewer','questions.archive'), ('content_reviewer','reports.view'),
    ('finance','payments.view'), ('finance','payments.refund'), ('finance','subscriptions.manage'), ('finance','invoices.issue'), ('finance','revenue.view'), ('finance','finance.export'), ('finance','reports.view'), ('finance','reports.export'),
    ('admin','users.view'), ('admin','users.create'), ('admin','users.edit'), ('admin','users.suspend'), ('admin','users.reset_password'), ('admin','roles.assign'), ('admin','questions.view'), ('admin','questions.create'), ('admin','questions.edit'), ('admin','questions.publish'), ('admin','exams.create'), ('admin','exams.edit'), ('admin','exams.schedule'), ('admin','courses.view'), ('admin','courses.create'), ('admin','courses.edit'), ('admin','courses.publish'), ('admin','payments.view'), ('admin','subscriptions.manage'), ('admin','analytics.global'), ('admin','reports.view'), ('admin','reports.export'), ('admin','settings.view'),
    ('department_admin','users.view'), ('department_admin','users.create'), ('department_admin','users.edit'), ('department_admin','users.suspend'), ('department_admin','courses.view'), ('department_admin','courses.edit'), ('department_admin','exams.schedule'), ('department_admin','analytics.department'), ('department_admin','reports.view'),
    ('exam_officer','questions.view'), ('exam_officer','exams.create'), ('exam_officer','exams.edit'), ('exam_officer','exams.schedule'), ('exam_officer','exams.publish'), ('exam_officer','exams.results'), ('exam_officer','reports.view'),
    ('question_bank_manager','questions.view'), ('question_bank_manager','questions.create'), ('question_bank_manager','questions.edit'), ('question_bank_manager','questions.review'), ('question_bank_manager','questions.approve'), ('question_bank_manager','questions.publish'), ('question_bank_manager','questions.lock'), ('question_bank_manager','questions.archive'), ('question_bank_manager','reports.view'),
    ('support_officer','users.view'), ('support_officer','users.edit'), ('support_officer','users.reset_password'), ('support_officer','reports.view'),
    ('academic_registrar','users.view'), ('academic_registrar','users.edit'), ('academic_registrar','courses.view'), ('academic_registrar','exams.results'), ('academic_registrar','analytics.department'), ('academic_registrar','reports.view'), ('academic_registrar','reports.export'),
    ('library_manager','courses.view'), ('library_manager','resources.upload'), ('library_manager','resources.manage'), ('library_manager','courses.edit'), ('library_manager','reports.view'),
    ('analytics_manager','analytics.department'), ('analytics_manager','analytics.global'), ('analytics_manager','reports.view'), ('analytics_manager','reports.export'),
    ('guest_reviewer','questions.view'), ('guest_reviewer','questions.review'), ('guest_reviewer','reports.view')
)
insert into public.role_permissions(role_id, permission_id)
select r.id, rp.permission_id
from role_perm rp
join public.roles r on r.name = rp.role_name
join public.permissions p on p.id = rp.permission_id
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'super_admin'
on conflict (role_id, permission_id) do nothing;

create or replace function public.admin_get_effective_permissions(target_user_id uuid)
returns table(permission_id text, label text, group_key text, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> target_user_id and not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Not authorized';
  end if;

  return query
  with role_grants as (
    select distinct p.id as permission_id, p.label, p.group_key, 'role'::text as source
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = target_user_id
  ),
  explicit_denies as (
    select permission_id
    from public.user_permission_overrides
    where user_id = target_user_id and effect = 'deny'
  ),
  explicit_allows as (
    select p.id as permission_id, p.label, p.group_key, 'override'::text as source
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = target_user_id and upo.effect = 'allow'
  )
  select permission_id, label, group_key, source
  from role_grants
  where permission_id not in (select permission_id from explicit_denies)
  union
  select permission_id, label, group_key, source
  from explicit_allows
  order by group_key, permission_id;
end;
$$;

grant execute on function public.admin_get_effective_permissions(uuid) to authenticated;

create or replace function public.my_effective_permissions()
returns table(permission_id text, label text, group_key text, source text)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.admin_get_effective_permissions(auth.uid());
$$;

grant execute on function public.my_effective_permissions() to authenticated;

create or replace function public.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.my_effective_permissions() ep
    where ep.permission_id = permission
  );
$$;

grant execute on function public.has_permission(text) to authenticated;

create or replace function public.admin_set_user_permission_override(
  target_user_id uuid,
  permission text,
  effect text,
  reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['super_admin']) then
    raise exception 'Not authorized';
  end if;

  if effect not in ('allow', 'deny') then
    raise exception 'Invalid permission override effect: %', effect;
  end if;

  insert into public.user_permission_overrides(user_id, permission_id, effect, assigned_by, reason, updated_at)
  values (target_user_id, permission, effect, auth.uid(), reason, now())
  on conflict (user_id, permission_id) do update
    set effect = excluded.effect,
        assigned_by = excluded.assigned_by,
        reason = excluded.reason,
        updated_at = now();
end;
$$;

grant execute on function public.admin_set_user_permission_override(uuid, text, text, text) to authenticated;

create or replace function public.admin_clear_user_permission_override(
  target_user_id uuid,
  permission text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['super_admin']) then
    raise exception 'Not authorized';
  end if;

  delete from public.user_permission_overrides
  where user_id = target_user_id
    and permission_id = permission;
end;
$$;

grant execute on function public.admin_clear_user_permission_override(uuid, text) to authenticated;
