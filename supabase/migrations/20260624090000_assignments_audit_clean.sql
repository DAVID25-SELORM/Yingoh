-- Clean combined migration: assignments, submissions, audit_logs
-- Replaces the two broken migrations (070000 and 080000).
-- Run this one in the SQL editor — skip the previous two if they failed.

-- ─── Tables ────────────────────────────────────────────────────

create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  topic       text,
  due_date    timestamptz,
  max_score   integer default 100,
  status      text default 'open',
  created_by  text,
  created_at  timestamptz default now()
);

create table if not exists public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  user_email    text,
  content       text,
  file_url      text,
  score         integer,
  feedback      text,
  status        text default 'submitted',
  submitted_at  timestamptz default now()
);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz default now()
);

-- ─── Indexes ───────────────────────────────────────────────────

create index if not exists idx_assignments_status     on public.assignments(status);
create index if not exists idx_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_submissions_user       on public.assignment_submissions(user_id);
create index if not exists idx_audit_user             on public.audit_logs(user_id);
create index if not exists idx_audit_action           on public.audit_logs(action);
create index if not exists idx_audit_created          on public.audit_logs(created_at desc);

-- ─── RLS ───────────────────────────────────────────────────────

alter table public.assignments            enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.audit_logs             enable row level security;

-- ─── Role helper (uses the existing user_roles + roles tables) ─

create or replace function public.has_role(role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = any(role_names)
  );
$$;

-- ─── Policies ─ drop first so re-running is safe ───────────────

drop policy if exists "assignments_read"          on public.assignments;
drop policy if exists "assignments_write"         on public.assignments;
drop policy if exists "submissions_own"           on public.assignment_submissions;
drop policy if exists "submissions_insert"        on public.assignment_submissions;
drop policy if exists "submissions_instructor"    on public.assignment_submissions;
drop policy if exists "audit_logs_insert"         on public.audit_logs;
drop policy if exists "audit_logs_admin_read"     on public.audit_logs;

-- Assignments: every authenticated user can read
create policy "assignments_read" on public.assignments
  for select to authenticated using (true);

-- Assignments: only instructors / admins can create or modify
create policy "assignments_write" on public.assignments
  for all to authenticated
  using      (public.has_role(array['instructor','admin','super_admin']))
  with check (public.has_role(array['instructor','admin','super_admin']));

-- Submissions: students see their own rows
create policy "submissions_own" on public.assignment_submissions
  for select to authenticated using (user_id = auth.uid());

-- Submissions: any authenticated user can insert their own
create policy "submissions_insert" on public.assignment_submissions
  for insert to authenticated with check (user_id = auth.uid());

-- Submissions: instructors / admins can read and update all (for grading)
create policy "submissions_instructor" on public.assignment_submissions
  for all to authenticated
  using      (public.has_role(array['instructor','admin','super_admin']))
  with check (public.has_role(array['instructor','admin','super_admin']));

-- Audit logs: anyone authenticated can append
create policy "audit_logs_insert" on public.audit_logs
  for insert to authenticated with check (true);

-- Audit logs: only admins can read
create policy "audit_logs_admin_read" on public.audit_logs
  for select to authenticated
  using (public.has_role(array['admin','super_admin']));
