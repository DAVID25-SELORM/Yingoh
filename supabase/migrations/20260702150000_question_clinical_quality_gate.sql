-- Clinical quality gate for safely scaling Yingoh beyond competitor bank sizes.
alter table public.questions
  add column if not exists source_batch text,
  add column if not exists reference_url text,
  add column if not exists clinical_review_status text not null default 'legacy',
  add column if not exists quality_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.questions
  drop constraint if exists questions_clinical_review_status_check;
alter table public.questions
  add constraint questions_clinical_review_status_check
  check (clinical_review_status in ('legacy', 'pending', 'changes_requested', 'approved'));

alter table public.questions
  alter column clinical_review_status set default 'pending';

-- Identify the structured 500-milestone batch whether it ran before or after this migration.
update public.questions
set
  source_batch = 'milestone-500-structured',
  clinical_review_status = 'pending',
  status = 'draft',
  quality_notes = coalesce(quality_notes, 'Requires independent clinical review and source verification before publication.')
where source_batch is null
  and (
    rationale like '%The other options delay effective care or introduce avoidable risk.%'
    or rationale like '%The other statements could delay treatment, worsen the condition, or conflict with the plan of care.%'
    or rationale like '%The other options are unsafe responses rather than findings to normalize.%'
  );

create index if not exists questions_review_queue_idx
  on public.questions (clinical_review_status, status, source_batch);

create or replace function public.enforce_question_clinical_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published'
     and coalesce(new.clinical_review_status, 'pending') <> 'legacy'
     and (
       new.clinical_review_status <> 'approved'
       or nullif(trim(new.reference_url), '') is null
       or nullif(trim(new.rationale), '') is null
       or jsonb_array_length(coalesce(new.correct_answer -> 'ids', '[]'::jsonb)) = 0
     )
  then
    raise exception 'Question requires approved clinical review, a reference, rationale, and correct answer before publication';
  end if;
  return new;
end;
$$;

drop trigger if exists questions_clinical_review_gate on public.questions;
create trigger questions_clinical_review_gate
before insert or update of status, clinical_review_status, reference_url, rationale, correct_answer
on public.questions
for each row execute function public.enforce_question_clinical_review();

create or replace function public.review_question(
  target_question_id uuid,
  decision text,
  clinical_reference text,
  reviewer_notes text default null
)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewed_question public.questions;
begin
  if not public.has_role(array['content_reviewer', 'admin', 'super_admin']) then
    raise exception 'Not authorized to review questions';
  end if;

  if decision not in ('approved', 'changes_requested') then
    raise exception 'Decision must be approved or changes_requested';
  end if;

  if decision = 'approved' and nullif(trim(clinical_reference), '') is null then
    raise exception 'An authoritative clinical reference is required for approval';
  end if;

  update public.questions
  set
    clinical_review_status = decision,
    reference_url = nullif(trim(clinical_reference), ''),
    quality_notes = nullif(trim(reviewer_notes), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    status = case when decision = 'approved' then 'published' else 'draft' end
  where id = target_question_id
  returning * into reviewed_question;

  if reviewed_question.id is null then
    raise exception 'Question not found';
  end if;

  return reviewed_question;
end;
$$;

revoke all on function public.review_question(uuid, text, text, text) from public, anon;
grant execute on function public.review_question(uuid, text, text, text) to authenticated;
