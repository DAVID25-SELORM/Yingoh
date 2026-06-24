-- Admin Features: Announcements, Payment Plans, Invoices, Promo Codes,
-- Class Schedules, Attendance, Audit Logs, Admin RPC functions

-- Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  audience text not null default 'all', -- all, students, instructors, admins
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payment plans
create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_usd numeric not null default 0,
  duration_days integer not null default 30,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Invoices / payment records
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.payment_plans(id) on delete set null,
  amount_usd numeric not null,
  currency text not null default 'USD',
  status text not null default 'pending', -- pending, paid, refunded, failed
  payment_method text, -- stripe, mobile_money, paypal
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Promo codes
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_pct integer not null default 0 check (discount_pct between 0 and 100),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Class schedules (instructor sessions)
create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  description text,
  topic text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_url text,
  recording_url text,
  max_attendees integer,
  status text not null default 'scheduled', -- scheduled, live, completed, cancelled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Attendance for scheduled classes
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_schedules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  duration_minutes integer,
  created_at timestamptz not null default now(),
  unique(session_id, user_id)
);

-- Admin audit logs
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.announcements enable row level security;
alter table public.payment_plans enable row level security;
alter table public.invoices enable row level security;
alter table public.promo_codes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Server-side admin guard used by RLS and RPC functions.
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

drop policy if exists "announcements_read" on public.announcements;
drop policy if exists "announcements_admin_all" on public.announcements;
drop policy if exists "plans_read" on public.payment_plans;
drop policy if exists "plans_admin_all" on public.payment_plans;
drop policy if exists "invoices_own" on public.invoices;
drop policy if exists "invoices_admin_all" on public.invoices;
drop policy if exists "promos_admin_all" on public.promo_codes;
drop policy if exists "schedules_read" on public.class_schedules;
drop policy if exists "schedules_own_write" on public.class_schedules;
drop policy if exists "schedules_admin_all" on public.class_schedules;
drop policy if exists "attendance_own" on public.attendance;
drop policy if exists "attendance_insert_own" on public.attendance;
drop policy if exists "attendance_admin_all" on public.attendance;
drop policy if exists "audit_admin_all" on public.admin_audit_logs;

-- Announcement: anyone can read active ones
create policy "announcements_read" on public.announcements
  for select to authenticated using (is_active = true);
create policy "announcements_admin_all" on public.announcements
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Payment plans: anyone authenticated can read active
create policy "plans_read" on public.payment_plans
  for select to authenticated using (is_active = true);
create policy "plans_admin_all" on public.payment_plans
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Invoices: own + admin
create policy "invoices_own" on public.invoices
  for select using (auth.uid() = user_id);
create policy "invoices_admin_all" on public.invoices
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Promo codes: admin only
create policy "promos_admin_all" on public.promo_codes
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Class schedules: read all authenticated, write own
create policy "schedules_read" on public.class_schedules
  for select to authenticated using (true);
create policy "schedules_own_write" on public.class_schedules
  for all to authenticated using (auth.uid() = instructor_id) with check (auth.uid() = instructor_id);
create policy "schedules_admin_all" on public.class_schedules
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Attendance: own or instructor
create policy "attendance_own" on public.attendance
  for select using (auth.uid() = user_id);
create policy "attendance_insert_own" on public.attendance
  for insert with check (auth.uid() = user_id);
create policy "attendance_admin_all" on public.attendance
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Audit logs: admin only
create policy "audit_admin_all" on public.admin_audit_logs
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Also allow admin CRUD on questions (for question manager)
drop policy if exists "questions_admin_write" on public.questions;
create policy "questions_admin_write" on public.questions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Grants
grant select on public.announcements to authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant select on public.payment_plans to authenticated;
grant insert, update, delete on public.payment_plans to authenticated;
grant select on public.invoices to authenticated;
grant insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.promo_codes to authenticated;
grant select on public.class_schedules to authenticated;
grant insert, update, delete on public.class_schedules to authenticated;
grant select, insert, update on public.attendance to authenticated;
grant select, insert on public.admin_audit_logs to authenticated;
grant insert, update, delete on public.questions to authenticated;

-- RPC: admin get all users
create or replace function public.admin_get_all_users()
returns table(
  id uuid, full_name text, email text, phone text, country text,
  created_at timestamptz, roles text[]
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
    p.id, p.full_name, p.email, p.phone, p.country, p.created_at,
    coalesce(array_agg(r.name) filter (where r.name is not null), '{}') as roles
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id
  group by p.id, p.full_name, p.email, p.phone, p.country, p.created_at
  order by p.created_at desc;
end;
$$;
grant execute on function public.admin_get_all_users() to authenticated;

-- RPC: admin stats
create or replace function public.admin_get_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  select json_build_object(
    'total_users', (select count(*) from public.profiles),
    'total_questions', (select count(*) from public.questions),
    'published_questions', (select count(*) from public.questions where status = 'published'),
    'draft_questions', (select count(*) from public.questions where status = 'draft'),
    'total_attempts', (select count(*) from public.attempts),
    'total_sessions', (select count(*) from public.exam_sessions where status = 'completed'),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'total_invoices', (select count(*) from public.invoices),
    'paid_invoices', (select count(*) from public.invoices where status = 'paid'),
    'total_revenue', (select coalesce(sum(amount_usd), 0) from public.invoices where status = 'paid'),
    'upcoming_classes', (select count(*) from public.class_schedules where starts_at > now() and status = 'scheduled'),
    'total_notes', (select count(*) from public.notebooks),
    'total_bookmarks', (select count(*) from public.question_bookmarks)
  ) into result;
  return result;
end;
$$;
grant execute on function public.admin_get_stats() to authenticated;

-- RPC: assign role to user
create or replace function public.admin_assign_role(target_user_id uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  select id into selected_role_id from public.roles where name = role_name;
  if selected_role_id is null then raise exception 'Role not found: %', role_name; end if;
  insert into public.user_roles(user_id, role_id)
  values (target_user_id, selected_role_id)
  on conflict (user_id, role_id) do nothing;
end;
$$;
grant execute on function public.admin_assign_role(uuid, text) to authenticated;

-- RPC: remove role from user
create or replace function public.admin_remove_role(target_user_id uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  select id into selected_role_id from public.roles where name = role_name;
  if selected_role_id is null then return; end if;
  delete from public.user_roles
  where user_roles.user_id = target_user_id
    and user_roles.role_id = selected_role_id;
end;
$$;
grant execute on function public.admin_remove_role(uuid, text) to authenticated;

-- Seed payment plans
insert into public.payment_plans (name, price_usd, duration_days, features, sort_order) values
(
  'Free',
  0,
  36500,
  '["Access to 20 sample questions","Basic dashboard","Limited flashcards"]',
  1
),
(
  'Basic',
  19.99,
  30,
  '["Full question bank (500+ questions)","Practice & timed exam modes","Flashcard decks","Study planner","Digital notebook","Email support"]',
  2
),
(
  'Pro',
  39.99,
  30,
  '["Everything in Basic","CAT simulator","Self-assessment exams","Advanced analytics","Pass probability tracking","Live coaching sessions","Priority support"]',
  3
),
(
  'Premium',
  59.99,
  30,
  '["Everything in Pro","Unlimited live coaching","1-on-1 instructor sessions","USRN career track","Resume builder","Job board access","CPD certificates","WhatsApp support"]',
  4
);

-- Seed sample announcements
insert into public.announcements (title, content, audience) values
(
  'Welcome to Yingoh NCLEX Platform!',
  'We are excited to have you on board. Start your NCLEX journey today with our adaptive question bank, live coaching, and spaced-repetition flashcards. Set your exam date in the Study Planner to get a personalized daily schedule.',
  'all'
),
(
  'New NGN Case Studies Added',
  '25 new Next Generation NCLEX (NGN) case study questions have been added to the question bank, covering bow tie, matrix, and highlight-text item types. These align with the latest NCSBN Clinical Judgment Measurement Model.',
  'students'
),
(
  'Instructor Webinar — Pharmacology Focus',
  'Join us this Saturday at 6PM for a live instructor-led pharmacology review session. Topics: High-alert medications, IV compatibility, and NCLEX pharmacology question strategies. Recording will be available.',
  'all'
);

-- Seed sample promo codes
insert into public.promo_codes (code, discount_pct, max_uses, expires_at) values
('NCLEX25', 25, 100, now() + interval '90 days'),
('NEWSTUDENT', 50, 200, now() + interval '30 days'),
('YINGOH10', 10, null, null);

-- Seed sample class schedules (demo)
-- These use a placeholder instructor_id; they will be updated when real instructors exist
-- Using a subquery that may return null if no profiles exist yet — safe with COALESCE
do $$
declare
  first_profile uuid;
begin
  select id into first_profile from public.profiles limit 1;
  if first_profile is not null then
    insert into public.class_schedules (instructor_id, title, description, topic, starts_at, ends_at, meeting_url, status)
    values
    (
      first_profile,
      'NGN Case Study Review',
      'Instructor-led review of Next Generation NCLEX case studies. Includes bow tie, matrix, and highlight-text item types.',
      'NGN Case Studies',
      now() + interval '2 days',
      now() + interval '2 days 2 hours',
      'https://meet.yingoh.com/ngn-review',
      'scheduled'
    ),
    (
      first_profile,
      'CAT Strategy Lab',
      'Learn how the Computer Adaptive Test works and how to approach it strategically. Practice with adaptive difficulty questions.',
      'Test Strategy',
      now() + interval '4 days',
      now() + interval '4 days 90 minutes',
      'https://meet.yingoh.com/cat-lab',
      'scheduled'
    ),
    (
      first_profile,
      'Pharmacology High-Yield Review',
      'Cover the 20 most-tested drug classes for NCLEX. Focus on nursing considerations, antidotes, and priority assessments.',
      'Pharmacology',
      now() + interval '7 days',
      now() + interval '7 days 2 hours',
      'https://meet.yingoh.com/pharm-review',
      'scheduled'
    );
  end if;
end;
$$;
