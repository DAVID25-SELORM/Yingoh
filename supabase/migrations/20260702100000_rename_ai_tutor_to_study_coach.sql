-- Align database naming with the Study Coach product name while preserving data.
alter table public.ai_tutor_conversations
  rename to study_coach_conversations;

alter table public.study_coach_conversations
  alter column title set default 'Study Coach Conversation';

drop policy if exists "ai_tutor_own" on public.study_coach_conversations;
drop policy if exists "study_coach_own" on public.study_coach_conversations;

create policy "study_coach_own" on public.study_coach_conversations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.study_coach_conversations to authenticated;
