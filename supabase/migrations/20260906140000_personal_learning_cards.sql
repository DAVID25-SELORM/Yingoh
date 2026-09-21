begin;
alter table public.learning_profiles add column if not exists cv jsonb not null default '{}'::jsonb check(jsonb_typeof(cv)='object');
insert into public.learning_taxonomy(kind,code,label) values('program','career','International Nurse Career Hub')
on conflict (kind,code) do nothing;
create table if not exists public.personal_learning_cards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 front text not null check(length(trim(front)) between 1 and 2000), back text not null check(length(trim(back)) between 1 and 8000),
 created_at timestamptz not null default now(), unique(user_id,front)
);
alter table public.personal_learning_cards enable row level security;
drop policy if exists personal_cards_own on public.personal_learning_cards;
create policy personal_cards_own on public.personal_learning_cards for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.personal_learning_cards to authenticated;
commit;
