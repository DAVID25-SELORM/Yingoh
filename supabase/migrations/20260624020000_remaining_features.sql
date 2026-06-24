-- Remaining Features: Forum, Video Lessons, Notifications, Certificates, Pending Invites
-- Also: ngn_data column on questions for NGN item types

-- Add NGN data column to questions (bow_tie, matrix, ordered_response, highlight)
alter table public.questions add column if not exists ngn_data jsonb;

-- Pending invites (admin creates user invites)
create table if not exists public.pending_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role_name text not null default 'student',
  invited_by uuid references public.profiles(id) on delete set null,
  token text unique default encode(gen_random_bytes(32), 'hex'),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- Forum threads
create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  topic text not null default 'General',
  author_id uuid not null references public.profiles(id) on delete cascade,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  reply_count integer not null default 0,
  view_count integer not null default 0,
  last_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Forum replies
create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_instructor_reply boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Video lessons
create table if not exists public.video_lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  topic text not null,
  video_url text not null,
  thumbnail_url text,
  duration_mins integer,
  is_published boolean not null default false,
  is_premium boolean not null default false,
  sort_order integer not null default 0,
  view_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Video watch progress per user
create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.video_lessons(id) on delete cascade,
  progress_seconds integer not null default 0,
  completed boolean not null default false,
  last_watched_at timestamptz not null default now(),
  unique(user_id, video_id)
);

-- In-app notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info', -- info, success, warning, alert
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

-- Certificates
create table if not exists public.user_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- 'completion', 'readiness', 'attendance', 'streak'
  title text not null,
  metadata jsonb default '{}',
  issued_at timestamptz not null default now(),
  verification_code text unique default upper(encode(gen_random_bytes(6), 'hex'))
);

-- RLS
alter table public.pending_invites enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.video_lessons enable row level security;
alter table public.video_progress enable row level security;
alter table public.notifications enable row level security;
alter table public.user_certificates enable row level security;

drop policy if exists "invites_admin_all" on public.pending_invites;
drop policy if exists "threads_read" on public.forum_threads;
drop policy if exists "threads_insert" on public.forum_threads;
drop policy if exists "threads_own_update" on public.forum_threads;
drop policy if exists "threads_admin_all" on public.forum_threads;
drop policy if exists "replies_read" on public.forum_replies;
drop policy if exists "replies_insert" on public.forum_replies;
drop policy if exists "replies_own_update" on public.forum_replies;
drop policy if exists "videos_read" on public.video_lessons;
drop policy if exists "videos_admin_all" on public.video_lessons;
drop policy if exists "videoprogress_own" on public.video_progress;
drop policy if exists "notifs_own" on public.notifications;
drop policy if exists "notifs_admin_insert" on public.notifications;
drop policy if exists "certs_own" on public.user_certificates;
drop policy if exists "certs_admin_all" on public.user_certificates;

-- Pending invites: admin only
create policy "invites_admin_all" on public.pending_invites for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Forum: all authenticated can read, own write
create policy "threads_read" on public.forum_threads for select to authenticated using (true);
create policy "threads_insert" on public.forum_threads for insert to authenticated with check (auth.uid() = author_id);
create policy "threads_own_update" on public.forum_threads for update to authenticated using (auth.uid() = author_id);
create policy "threads_admin_all" on public.forum_threads for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "replies_read" on public.forum_replies for select to authenticated using (true);
create policy "replies_insert" on public.forum_replies for insert to authenticated with check (auth.uid() = author_id);
create policy "replies_own_update" on public.forum_replies for update to authenticated using (auth.uid() = author_id);

-- Video: published OR own
create policy "videos_read" on public.video_lessons for select to authenticated using (is_published = true);
create policy "videos_admin_all" on public.video_lessons for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "videoprogress_own" on public.video_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notifications: own only
create policy "notifs_own" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifs_admin_insert" on public.notifications for insert to authenticated with check (public.is_super_admin());

-- Certificates: own
create policy "certs_own" on public.user_certificates for select using (auth.uid() = user_id);
create policy "certs_admin_all" on public.user_certificates for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Grants
grant select, insert, update, delete on public.pending_invites to authenticated;
grant select, insert, update on public.forum_threads to authenticated;
grant select, insert, update on public.forum_replies to authenticated;
grant select on public.video_lessons to authenticated;
grant insert, update, delete on public.video_lessons to authenticated;
grant select, insert, update on public.video_progress to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select on public.user_certificates to authenticated;
grant insert, update, delete on public.user_certificates to authenticated;

-- RPC: admin invite user (creates profile entry; user signs up via link)
create or replace function public.admin_invite_user(
  p_email text, p_full_name text, p_role_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.pending_invites(email, full_name, role_name)
  values (lower(trim(p_email)), p_full_name, p_role_name)
  on conflict (email) do update set
    full_name = excluded.full_name,
    role_name = excluded.role_name,
    expires_at = now() + interval '7 days',
    accepted_at = null
  returning id into invite_id;
  return invite_id;
end;
$$;
grant execute on function public.admin_invite_user(text, text, text) to authenticated;

-- Trigger: when a user signs up, check pending_invites and assign role
create or replace function public.handle_pending_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.pending_invites%rowtype;
  role_id uuid;
begin
  select * into invite from public.pending_invites
  where email = lower(new.email) and accepted_at is null and expires_at > now()
  limit 1;

  if invite.id is not null then
    -- Assign role
    select id into role_id from public.roles where name = invite.role_name;
    if role_id is not null then
      insert into public.user_roles(user_id, role_id)
      values (new.id, role_id)
      on conflict do nothing;
    end if;
    -- Mark invite accepted
    update public.pending_invites set accepted_at = now() where id = invite.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_invite_check on public.profiles;
create trigger on_auth_user_invite_check
  after insert on public.profiles
  for each row execute procedure public.handle_pending_invite();

-- Seed video lessons
do $$
begin
if not exists (
  select 1 from public.video_lessons
  where title = 'NCLEX Pharmacology: High-Yield Drug Classes'
) then
insert into public.video_lessons (title, description, topic, video_url, duration_mins, is_published, is_premium, sort_order) values
('NCLEX Pharmacology: High-Yield Drug Classes', 'Cover the 20 most-tested drug classes. Focus on nursing considerations, antidotes, side effects, and NCLEX priority questions.', 'Pharmacology', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 45, true, false, 1),
('NGN Case Study Walkthrough', 'Step-by-step breakdown of a Next Generation NCLEX case study. Demonstrates clinical judgment across bow-tie, matrix, and highlight items.', 'NGN Case Studies', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 38, true, false, 2),
('CAT Strategy: How to Think Like a Nurse', 'Understand how the Computer Adaptive Test works and develop strategies for approaching hard questions with confidence.', 'Test Strategy', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 30, true, false, 3),
('Critical Lab Values You Must Know', 'Master the critical lab values most likely to appear on NCLEX. Includes sodium, potassium, glucose, CBC, ABGs, and more.', 'Medical-Surgical', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 25, true, true, 4),
('Mental Health Nursing: Therapeutic Communication', 'NCLEX-focused review of therapeutic vs. non-therapeutic communication. Includes practice questions and rationales.', 'Mental Health', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 28, true, false, 5),
('Maternal-Newborn: Priority Nursing Actions', 'High-yield maternal and newborn content. Covers labor stages, postpartum complications, and newborn assessments.', 'Maternal and Newborn', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 35, true, true, 6);
end if;
end $$;

-- Seed sample forum threads
do $$
declare
  first_profile uuid;
begin
  select id into first_profile from public.profiles limit 1;
  if first_profile is not null and not exists (
    select 1 from public.forum_threads
    where title = 'Welcome to the Yingoh Community Forum!'
  ) then
    insert into public.forum_threads (author_id, title, content, topic, is_pinned, reply_count) values
    (first_profile, 'Welcome to the Yingoh Community Forum!', 'This is your space to ask questions, share study tips, and support each other on the NCLEX journey. Be respectful, be kind, and help your fellow nurses! 🩺', 'General', true, 0),
    (first_profile, 'Struggling with pharmacology — any tips?', 'I have been going through the pharmacology flashcards but there are so many drug classes. How do you all organize and remember them? Any mnemonics that helped you?', 'Pharmacology', false, 2),
    (first_profile, 'How is the CAT different from a regular exam?', 'I know CAT adapts to your answers but I am confused about how it decides when to stop and what the passing standard is. Can someone explain?', 'Test Strategy', false, 1);
  end if;
end;
$$;
