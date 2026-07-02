-- Final package guardrails. Abort the transaction if the complete bank is not
-- present or if any generated item bypassed the independent clinical review gate.
do $$
declare
  question_total bigint;
  generated_not_gated bigint;
  duplicate_prompts bigint;
begin
  select count(*) into question_total from public.questions;

  select count(*) into generated_not_gated
  from public.questions
  where source_batch like 'expansion-batch-%'
    and (
      status <> 'draft'
      or clinical_review_status <> 'pending'
      or coalesce(trim(quality_notes), '') = ''
    );

  select count(*) into duplicate_prompts
  from (
    select lower(regexp_replace(trim(prompt), '\s+', ' ', 'g'))
    from public.questions
    group by lower(regexp_replace(trim(prompt), '\s+', ' ', 'g'))
    having count(*) > 1
  ) duplicates;

  if question_total < 6501 then
    raise exception 'Question-bank package is incomplete: % questions found; at least 6501 required.', question_total;
  end if;

  if generated_not_gated > 0 then
    raise exception 'Clinical review gate failed for % generated questions.', generated_not_gated;
  end if;

  if duplicate_prompts > 0 then
    raise exception 'Duplicate normalized prompts detected in % groups.', duplicate_prompts;
  end if;
end
$$;

drop function if exists public.seed_structured_concept(
  text, text, text, text, text, text, text, text, text, text, text, text
);
