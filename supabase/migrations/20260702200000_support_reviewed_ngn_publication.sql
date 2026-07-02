-- Extend the clinical quality gate to validate NGN and ordered-response answers.
create or replace function public.enforce_question_clinical_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_scoring_key boolean;
begin
  has_scoring_key := case
    when new.question_type in ('mcq', 'sata')
      then jsonb_array_length(coalesce(new.correct_answer -> 'ids', '[]'::jsonb)) > 0
    when new.question_type = 'ordered_response'
      then jsonb_array_length(coalesce(new.correct_answer -> 'order', '[]'::jsonb)) > 0
    when new.question_type in ('matrix', 'bow_tie', 'highlight')
      then new.ngn_data is not null and new.ngn_data <> '{}'::jsonb
    else false
  end;

  if new.status = 'published'
     and coalesce(new.clinical_review_status, 'pending') <> 'legacy'
     and (
       new.clinical_review_status <> 'approved'
       or nullif(trim(new.reference_url), '') is null
       or nullif(trim(new.rationale), '') is null
       or not has_scoring_key
     )
  then
    raise exception 'Question requires approved clinical review, a reference, rationale, and valid scoring key before publication';
  end if;
  return new;
end;
$$;

-- Normalize early held batches from broad legacy categories to 2026 subcategories.
update public.questions
set client_need = case
  when client_need = 'Physiological Integrity'
       and topic in ('Pharmacology', 'Mental Health')
    then 'Pharmacological and Parenteral Therapies'
  when client_need = 'Physiological Integrity'
    then 'Physiological Adaptation'
  when client_need = 'Safe and Effective Care Environment'
       and topic = 'Emergency and Critical Care'
    then 'Safety and Infection Prevention and Control'
  when client_need = 'Safe and Effective Care Environment'
    then 'Reduction of Risk Potential'
  else client_need
end
where source_batch = 'expansion-batch-02'
  and client_need in ('Physiological Integrity', 'Safe and Effective Care Environment');
