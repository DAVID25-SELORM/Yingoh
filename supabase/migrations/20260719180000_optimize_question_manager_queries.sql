-- Speed up the admin question manager list and counts.
-- The UI reads lightweight pages ordered by created_at, optionally filtered by status/topic.

create index if not exists idx_questions_created_at_desc
  on public.questions (created_at desc);

create index if not exists idx_questions_status_created_at_desc
  on public.questions (status, created_at desc);

create index if not exists idx_questions_topic_created_at_desc
  on public.questions (topic, created_at desc);

create index if not exists idx_questions_status_topic_created_at_desc
  on public.questions (status, topic, created_at desc);

create or replace function public.admin_question_manager_counts()
returns table (
  total bigint,
  published bigint,
  draft bigint
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint as total,
    count(*) filter (where status = 'published')::bigint as published,
    count(*) filter (where status = 'draft')::bigint as draft
  from public.questions
  where public.has_role(array['admin', 'super_admin', 'content_reviewer', 'question_bank_manager']);
$$;

grant execute on function public.admin_question_manager_counts() to authenticated;

analyze public.questions;
