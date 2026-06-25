-- Add NCLEX analytics tags to questions.
-- These support weak-area reporting by Client Needs and Clinical Judgment skill.

alter table public.questions
  add column if not exists client_need text,
  add column if not exists clinical_judgment text;
