-- Assignments & Submissions tables
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  topic         text,
  due_date      timestamptz,
  max_score     integer default 100,
  status        text default 'open',       -- open | closed
  created_by    text,                       -- instructor email or user_id
  created_at    timestamptz default now()
);

create table if not exists public.assignment_submissions (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid references public.assignments(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  user_email      text,
  content         text,
  file_url        text,
  score           integer,
  feedback        text,
  status          text default 'submitted',  -- submitted | graded
  submitted_at    timestamptz default now()
);

-- Audit logs table
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  action      text not null,       -- e.g. 'login', 'question_answer', 'plan_subscribed', 'password_reset'
  entity_type text,                -- e.g. 'question', 'subscription', 'user'
  entity_id   text,
  metadata    jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz default now()
);

-- Indexes
create index if not exists idx_assignments_status     on public.assignments(status);
create index if not exists idx_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_submissions_user       on public.assignment_submissions(user_id);
create index if not exists idx_audit_user             on public.audit_logs(user_id);
create index if not exists idx_audit_action           on public.audit_logs(action);
create index if not exists idx_audit_created          on public.audit_logs(created_at desc);

-- RLS
alter table public.assignments           enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.audit_logs            enable row level security;

-- Assignments: all authenticated users can read; instructors/admins can insert/update
create policy "assignments_read" on public.assignments
  for select to authenticated using (true);

create policy "assignments_write" on public.assignments
  for all to authenticated using (
    auth.jwt() ->> 'email' in (
      select email from public.profiles where role in ('instructor', 'admin', 'super_admin')
    )
  );

-- Submissions: students see own; instructors see all
create policy "submissions_own" on public.assignment_submissions
  for select to authenticated using (user_id = auth.uid());

create policy "submissions_insert" on public.assignment_submissions
  for insert to authenticated with check (user_id = auth.uid());

create policy "submissions_instructor" on public.assignment_submissions
  for all to authenticated using (
    auth.jwt() ->> 'email' in (
      select email from public.profiles where role in ('instructor', 'admin', 'super_admin')
    )
  );

-- Audit logs: only admins can read; all authenticated can insert
create policy "audit_logs_insert" on public.audit_logs
  for insert to authenticated with check (true);

create policy "audit_logs_admin_read" on public.audit_logs
  for select to authenticated using (
    auth.jwt() ->> 'email' in (
      select email from public.profiles where role in ('admin', 'super_admin')
    )
  );
