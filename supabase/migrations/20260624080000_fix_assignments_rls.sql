-- Fix RLS policies: profiles has no role column; use user_roles + roles join

-- Drop the broken policies
drop policy if exists "assignments_write"        on public.assignments;
drop policy if exists "submissions_instructor"   on public.assignment_submissions;
drop policy if exists "audit_logs_admin_read"    on public.audit_logs;

-- Helper: returns true if the calling user has one of the given role names
create or replace function public.has_role(role_names text[])
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = any(role_names)
  );
$$;

-- Assignments: instructors/admins can write
create policy "assignments_write" on public.assignments
  for all to authenticated
  using (public.has_role(array['instructor','admin','super_admin']))
  with check (public.has_role(array['instructor','admin','super_admin']));

-- Submissions: instructors/admins can read/update all (for grading)
create policy "submissions_instructor" on public.assignment_submissions
  for all to authenticated
  using (public.has_role(array['instructor','admin','super_admin']))
  with check (public.has_role(array['instructor','admin','super_admin']));

-- Audit logs: admins can read
create policy "audit_logs_admin_read" on public.audit_logs
  for select to authenticated
  using (public.has_role(array['admin','super_admin']));
