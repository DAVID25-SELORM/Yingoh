create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  lesson_type text not null default 'video',
  content_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  question_type text not null,
  prompt text not null,
  choices jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null default '{}'::jsonb,
  rationale text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer jsonb not null default '{}'::jsonb,
  is_correct boolean,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_name text not null,
  status text not null default 'active',
  provider text,
  provider_reference text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  meeting_url text,
  recording_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.roles (name, description)
values
  ('student', 'Learner access for lessons, questions, attempts, results, and certificates.'),
  ('instructor', 'Teaching access for classes, lessons, question review, grading, and attendance.'),
  ('admin', 'Operational access for users, courses, subscriptions, reports, and support.'),
  ('finance', 'Payment, receipt, refund, and reconciliation access.'),
  ('content_reviewer', 'Question, rationale, and learning-resource review access.')
on conflict (name) do update set description = excluded.description;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Yingoh learner'),
    new.email
  )
  on conflict (id) do update
    set
      full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.live_sessions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated" on public.roles
  for select to authenticated using (true);

drop policy if exists "courses_read_authenticated" on public.courses;
create policy "courses_read_authenticated" on public.courses
  for select to authenticated using (status = 'published');

drop policy if exists "lessons_read_authenticated" on public.lessons;
create policy "lessons_read_authenticated" on public.lessons
  for select to authenticated using (
    exists (
      select 1 from public.courses
      where courses.id = lessons.course_id
      and courses.status = 'published'
    )
  );

drop policy if exists "questions_read_authenticated" on public.questions;
create policy "questions_read_authenticated" on public.questions
  for select to authenticated using (status = 'published');

drop policy if exists "attempts_select_own" on public.attempts;
create policy "attempts_select_own" on public.attempts
  for select using (auth.uid() = user_id);

drop policy if exists "attempts_insert_own" on public.attempts;
create policy "attempts_insert_own" on public.attempts
  for insert with check (auth.uid() = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "live_sessions_read_authenticated" on public.live_sessions;
create policy "live_sessions_read_authenticated" on public.live_sessions
  for select to authenticated using (true);
