-- Add NCLEX test-taking strategy notes to questions.
-- Used by Question Manager, Practice Mode, and Question Bank review.

alter table public.questions
  add column if not exists strategy text;
