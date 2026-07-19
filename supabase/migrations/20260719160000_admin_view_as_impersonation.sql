-- Admin View As / portal preview audit foundation.
-- This records support impersonation sessions without storing passwords or
-- granting permanent permissions to the admin.

create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  target_role text not null,
  reason text not null default 'Support troubleshooting',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text not null default 'active'
    check (status in ('active', 'ended', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_impersonation_sessions_admin on public.impersonation_sessions(admin_user_id, started_at desc);
create index if not exists idx_impersonation_sessions_target on public.impersonation_sessions(target_user_id, started_at desc);
create index if not exists idx_impersonation_sessions_status on public.impersonation_sessions(status);

alter table public.impersonation_sessions enable row level security;

drop policy if exists "impersonation_sessions_admin_read" on public.impersonation_sessions;
drop policy if exists "impersonation_sessions_super_admin_write" on public.impersonation_sessions;

create policy "impersonation_sessions_admin_read" on public.impersonation_sessions
  for select to authenticated using (public.has_role(array['admin', 'super_admin', 'support_officer']));

create policy "impersonation_sessions_super_admin_write" on public.impersonation_sessions
  for all to authenticated using (public.has_role(array['super_admin', 'support_officer']))
  with check (public.has_role(array['super_admin', 'support_officer']));

grant select, insert, update on public.impersonation_sessions to authenticated;

create or replace function public.admin_start_impersonation_session(
  target_user_id uuid,
  target_role text,
  reason text default 'Support troubleshooting'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  session_id uuid;
  target_roles text[];
begin
  if not public.has_role(array['super_admin', 'support_officer']) then
    raise exception 'Not authorized to view as users';
  end if;

  select coalesce(array_agg(r.name), array[]::text[])
  into target_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = target_user_id;

  if 'super_admin' = any(target_roles) then
    raise exception 'Super admin accounts cannot be impersonated';
  end if;

  if target_role in ('admin', 'finance', 'content_reviewer', 'question_bank_manager')
     and not public.has_role(array['super_admin']) then
    raise exception 'Only super admins can view as staff or admin roles';
  end if;

  insert into public.impersonation_sessions (
    admin_user_id,
    target_user_id,
    target_role,
    reason,
    metadata
  )
  values (
    auth.uid(),
    target_user_id,
    target_role,
    coalesce(nullif(trim(reason), ''), 'Support troubleshooting'),
    jsonb_build_object('target_roles', target_roles)
  )
  returning id into session_id;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    'support.view_as.start',
    'profiles',
    target_user_id,
    jsonb_build_object(
      'impersonation_session_id', session_id,
      'target_role', target_role,
      'reason', coalesce(nullif(trim(reason), ''), 'Support troubleshooting')
    )
  );

  return session_id;
end;
$$;

grant execute on function public.admin_start_impersonation_session(uuid, text, text) to authenticated;

create or replace function public.admin_end_impersonation_session(
  impersonation_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_record public.impersonation_sessions%rowtype;
begin
  select *
  into row_record
  from public.impersonation_sessions
  where id = impersonation_session_id
    and status = 'active'
  limit 1;

  if row_record.id is null then
    return;
  end if;

  if row_record.admin_user_id <> auth.uid() and not public.has_role(array['super_admin']) then
    raise exception 'Not authorized to end this view-as session';
  end if;

  update public.impersonation_sessions
  set
    ended_at = now(),
    duration_seconds = greatest(extract(epoch from (now() - started_at))::integer, 0),
    status = 'ended'
  where id = impersonation_session_id;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    'support.view_as.end',
    'profiles',
    row_record.target_user_id,
    jsonb_build_object(
      'impersonation_session_id', impersonation_session_id,
      'target_role', row_record.target_role,
      'duration_seconds', greatest(extract(epoch from (now() - row_record.started_at))::integer, 0)
    )
  );
end;
$$;

grant execute on function public.admin_end_impersonation_session(uuid) to authenticated;
