-- AI Tutor persistence, saved items, and user progress rollups

create table if not exists public.ai_tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'tutor',
  title text not null default 'AI Tutor Conversation',
  messages jsonb not null default '[]'::jsonb,
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  title text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, item_type, item_id)
);

create table if not exists public.user_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  completed_questions integer not null default 0,
  daily_goal_completed integer not null default 0,
  daily_goal_target integer not null default 25,
  current_streak integer not null default 0,
  last_activity_date date,
  weak_areas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ai_tutor_conversations enable row level security;
alter table public.saved_items enable row level security;
alter table public.user_progress enable row level security;

drop policy if exists "ai_tutor_own" on public.ai_tutor_conversations;
drop policy if exists "saved_items_own" on public.saved_items;
drop policy if exists "user_progress_own" on public.user_progress;

create policy "ai_tutor_own" on public.ai_tutor_conversations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_items_own" on public.saved_items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_progress_own" on public.user_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.ai_tutor_conversations to authenticated;
grant select, insert, update, delete on public.saved_items to authenticated;
grant select, insert, update on public.user_progress to authenticated;
