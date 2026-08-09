-- Structured, reviewable teaching content for questions.
-- Legacy rationale/strategy/reference_url columns remain intact for fallback.

alter table public.questions
  add column if not exists correct_answer_explanation text,
  add column if not exists option_explanations jsonb not null default '{}'::jsonb,
  add column if not exists immediate_response text,
  add column if not exists reference_urls jsonb not null default '[]'::jsonb;

comment on column public.questions.correct_answer_explanation is
  'Clinically reviewed explanation of why the stored correct answer is correct.';
comment on column public.questions.option_explanations is
  'Object keyed by option ID. Each value contains is_correct boolean and explanation text.';
comment on column public.questions.immediate_response is
  'Ordered clinical or nursing actions to take when the item calls for an immediate response.';
comment on column public.questions.reference_urls is
  'Array of structured clinical references with title, organization, HTTPS URL, and accessed_at date.';
comment on column public.questions.strategy is
  'Legacy-compatible test-taking strategy; retained as the canonical strategy field.';
comment on column public.questions.reviewed_by is
  'Profile ID of the accountable clinical/content reviewer.';
comment on column public.questions.reviewed_at is
  'Timestamp of the latest accountable clinical/content review.';
comment on column public.questions.clinical_review_status is
  'Content review state. legacy rows remain backward compatible; pending/changes_requested/approved use the clinical workflow.';

alter table public.questions
  drop constraint if exists questions_option_explanations_object_check,
  add constraint questions_option_explanations_object_check
    check (jsonb_typeof(option_explanations) = 'object') not valid,
  drop constraint if exists questions_reference_urls_array_check,
  add constraint questions_reference_urls_array_check
    check (jsonb_typeof(reference_urls) = 'array') not valid;

alter table public.questions validate constraint questions_option_explanations_object_check;
alter table public.questions validate constraint questions_reference_urls_array_check;

create or replace function public.question_references_are_valid(p_references jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare item jsonb;
begin
  if p_references is null or jsonb_typeof(p_references) <> 'array' then return false; end if;
  for item in
    select reference_item
    from jsonb_array_elements(p_references) as references_list(reference_item)
  loop
    if jsonb_typeof(item) <> 'object'
       or nullif(trim(item->>'title'), '') is null
       or nullif(trim(item->>'organization'), '') is null
       or coalesce(item->>'url', '') !~ '^https://[^[:space:]]+$'
       or coalesce(item->>'accessed_at', '') !~ '^\d{4}-\d{2}-\d{2}$'
    then return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.question_structured_explanation_errors(q public.questions)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  errors text[] := array[]::text[];
  choice jsonb;
  choice_id text;
  explanation jsonb;
  correct_ids text[];
  correct_count integer;
  ref jsonb;
begin
  if nullif(trim(q.prompt), '') is null then errors := array_append(errors, 'Prompt is required'); end if;

  select coalesce(array_agg(lower(value)), array[]::text[])
  into correct_ids
  from jsonb_array_elements_text(coalesce(q.correct_answer->'ids', '[]'::jsonb)) value;
  correct_count := cardinality(correct_ids);

  if q.question_type in ('mcq', 'sata') then
    if jsonb_typeof(q.choices) <> 'array' or jsonb_array_length(q.choices) < 2 then
      errors := array_append(errors, 'At least two answer options are required');
    end if;
    if q.question_type = 'mcq' and correct_count <> 1 then
      errors := array_append(errors, 'MCQ requires exactly one correct option');
    elsif q.question_type = 'sata' and correct_count < 1 then
      errors := array_append(errors, 'SATA requires at least one correct option');
    end if;
  end if;

  if nullif(trim(q.correct_answer_explanation), '') is null then
    errors := array_append(errors, 'Correct-answer explanation is required');
  end if;

  if jsonb_typeof(q.option_explanations) <> 'object' then
    errors := array_append(errors, 'Option explanations must be an object');
  elsif q.question_type in ('mcq', 'sata') then
    for choice in select value from jsonb_array_elements(q.choices) loop
      choice_id := lower(coalesce(choice->>'id', ''));
      explanation := q.option_explanations->choice_id;
      if choice_id = '' or explanation is null
         or jsonb_typeof(explanation) <> 'object'
         or nullif(trim(explanation->>'explanation'), '') is null
      then
        errors := array_append(errors, 'Missing explanation for option ' || upper(choice_id));
      elsif (case lower(coalesce(explanation->>'is_correct', ''))
               when 'true' then true
               when 'false' then false
               else null
             end) is distinct from (choice_id = any(correct_ids)) then
        errors := array_append(errors, 'Correctness mismatch for option ' || upper(choice_id));
      end if;
    end loop;
  end if;

  if jsonb_array_length(q.reference_urls) < 1 then
    errors := array_append(errors, 'At least one clinical reference is required');
  elsif not public.question_references_are_valid(q.reference_urls) then
    errors := array_append(errors, 'References require title, organization, HTTPS URL, and accessed_at date');
  else
    for ref in select value from jsonb_array_elements(q.reference_urls) loop
      begin
        if (ref->>'accessed_at')::date > current_date then
          errors := array_append(errors, 'Reference access date cannot be in the future');
        end if;
      exception when others then
        errors := array_append(errors, 'Reference access date is invalid');
      end;
    end loop;
  end if;

  if q.reviewed_by is null then errors := array_append(errors, 'Reviewer is required'); end if;
  if q.reviewed_at is null then errors := array_append(errors, 'Clinical review date is required');
  elsif q.reviewed_at > now() then errors := array_append(errors, 'Clinical review date cannot be in the future');
  end if;

  return errors;
exception when others then
  return array_append(errors, 'Structured explanation contains invalid data');
end;
$$;

revoke all on function public.question_structured_explanation_errors(public.questions) from public, anon, authenticated;

-- Convert only the reviewed malignant-hyperthermia example. Do not alter the
-- prompt, choices, scoring key, or legacy rationale.
do $$
declare
  target public.questions%rowtype;
  affected_rows integer;
  review_note constant text := 'Structured explanation conversion completed from the clinically reviewed MHAUS/EMHG rationale on 2026-08-09.';
begin
  select * into target
  from public.questions
  where lower(trim(prompt)) = lower(trim(
    'During reassessment of a client with malignant hyperthermia, which finding should the nurse escalate without delay?'
  ));

  if not found then raise exception 'Malignant-hyperthermia conversion target was not found'; end if;
  if (select count(*) from public.questions where lower(trim(prompt)) = lower(trim(target.prompt))) <> 1 then
    raise exception 'Malignant-hyperthermia conversion target is not unique';
  end if;
  if target.correct_answer <> '{"ids":["c"]}'::jsonb
     or not exists (
       select 1 from jsonb_array_elements(target.choices) choice
       where lower(choice->>'id') = 'c'
         and choice->>'text' = 'Generalized rigidity with rapidly rising end-tidal carbon dioxide'
     )
  then
    raise exception 'Malignant-hyperthermia answer key does not match the reviewed content';
  end if;

  -- A completed conversion is a no-op on rerun. This also avoids firing the
  -- stronger publication trigger installed later in this migration.
  if position(review_note in coalesce(target.quality_notes, '')) > 0
     and nullif(trim(target.correct_answer_explanation), '') is not null
     and nullif(trim(target.immediate_response), '') is not null
     and target.option_explanations ?& array['a', 'b', 'c', 'd']
     and jsonb_array_length(target.reference_urls) = 2
     and target.reference_urls @> jsonb_build_array(
       jsonb_build_object('url', 'https://www.mhaus.org/healthcare-professionals/managing-a-crisis/'),
       jsonb_build_object('url', 'https://www.emhg.org/recommendations-1')
     )
  then
    return;
  end if;

  update public.questions
  set
    correct_answer_explanation = $content$
Generalized rigidity shows uncontrolled skeletal-muscle contraction. A rapidly rising end-tidal carbon dioxide level shows sharply increased metabolism and carbon-dioxide production, often despite adequate ventilation. Together they are important early evidence that malignant hyperthermia is worsening; marked hyperthermia may occur later, so treatment must begin on clinical suspicion.
$content$,
    option_explanations = jsonb_build_object(
      'a', jsonb_build_object('is_correct', false, 'explanation', 'Reducing a triggering volatile anaesthetic is not sufficient. The triggering agent and succinylcholine must be stopped immediately because continued exposure can intensify the crisis. If anaesthesia must continue, use a non-triggering technique according to the emergency plan.'),
      'b', jsonb_build_object('is_correct', false, 'explanation', 'Malignant hyperthermia is not an ordinary hypothalamic fever. Antipyretics do not correct uncontrolled calcium release and skeletal-muscle metabolism. Dantrolene, removal of triggers, oxygenation, ventilation, cooling when indicated, and complication management are required.'),
      'c', jsonb_build_object('is_correct', true, 'explanation', 'Generalized rigidity reflects uncontrolled muscle contraction, while rapidly rising ETCO2 reflects excessive metabolic carbon-dioxide production. This linked deterioration requires immediate escalation and treatment.'),
      'd', jsonb_build_object('is_correct', false, 'explanation', 'Malignant hyperthermia is treated on clinical suspicion. Waiting for genetic or contracture testing can permit rapid deterioration; confirmatory testing occurs only after the emergency is controlled.')
    ),
    immediate_response = $content$
1. Declare an emergency and call for assistance.
2. Stop all triggering volatile anaesthetic agents and succinylcholine.
3. Hyperventilate with 100% oxygen at high flow.
4. Obtain the malignant-hyperthermia cart and administer IV dantrolene immediately according to the emergency protocol.
5. Monitor ETCO2, ECG, oxygen saturation, core temperature, and urine output.
6. Obtain blood gases, potassium, creatine kinase, glucose, renal-function, urine-myoglobin, and coagulation studies as indicated.
7. Treat hyperthermia, acidosis, hyperkalaemia, dysrhythmias, and myoglobinuria according to the crisis protocol.
$content$,
    reference_urls = jsonb_build_array(
      jsonb_build_object('title', 'Managing a Crisis', 'organization', 'Malignant Hyperthermia Association of the United States', 'url', 'https://www.mhaus.org/healthcare-professionals/managing-a-crisis/', 'accessed_at', '2026-08-09'),
      jsonb_build_object('title', 'Recognising and managing a malignant hyperthermia crisis', 'organization', 'European Malignant Hyperthermia Group', 'url', 'https://www.emhg.org/recommendations-1', 'accessed_at', '2026-08-09')
    ),
    quality_notes = case
      when position(review_note in coalesce(quality_notes, '')) > 0 then quality_notes
      else concat_ws(E'\n', nullif(trim(coalesce(quality_notes, '')), ''), review_note)
    end,
    updated_at = now()
  where id = target.id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'Expected one controlled conversion, updated %', affected_rows; end if;
end;
$$;

create or replace function public.enforce_question_clinical_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  errors text[];
  has_scoring_key boolean;
begin
  has_scoring_key := case
    when new.question_type in ('mcq', 'sata') then jsonb_array_length(coalesce(new.correct_answer->'ids', '[]'::jsonb)) > 0
    when new.question_type = 'ordered_response' then jsonb_array_length(coalesce(new.correct_answer->'order', '[]'::jsonb)) > 0
    when new.question_type in ('matrix', 'bow_tie', 'highlight') then new.ngn_data is not null and new.ngn_data <> '{}'::jsonb
    else false
  end;

  if new.status = 'published' and coalesce(new.clinical_review_status, 'pending') <> 'legacy' then
    if new.clinical_review_status <> 'approved' or not has_scoring_key then
      raise exception 'Question requires approved clinical review and a valid scoring key before publication';
    end if;
    errors := public.question_structured_explanation_errors(new);
    if cardinality(errors) > 0 then
      raise exception 'Structured explanation approval failed: %', array_to_string(errors, '; ');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists questions_clinical_review_gate on public.questions;
create trigger questions_clinical_review_gate
before insert or update of status, clinical_review_status, correct_answer, choices,
  correct_answer_explanation, option_explanations, immediate_response,
  reference_urls, reviewed_by, reviewed_at
on public.questions
for each row execute function public.enforce_question_clinical_review();

create index if not exists questions_structured_review_idx
  on public.questions (clinical_review_status, reviewed_at)
  where clinical_review_status <> 'legacy';

-- Staff-only audit. It reports; it never modifies clinical content.
create or replace function public.admin_question_explanation_audit(
  p_issue text default 'all',
  p_stale_days integer default 365,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid, topic text, prompt text, status text, clinical_review_status text,
  reviewed_at timestamptz, issues text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with audited as (
    select q.id, q.topic, q.prompt, q.status, q.clinical_review_status, q.reviewed_at,
      array_remove(array[
        case when nullif(trim(q.correct_answer_explanation), '') is null
                  and nullif(trim(q.rationale), '') is not null then 'legacy_only' end,
        case when q.question_type in ('mcq','sata') and exists (
          select 1 from jsonb_array_elements(q.choices) c
          where nullif(trim(q.option_explanations->lower(c->>'id')->>'explanation'), '') is null
        ) then 'missing_option_explanations' end,
        case when jsonb_array_length(q.reference_urls) = 0 then 'missing_references' end,
        case when jsonb_array_length(q.reference_urls) > 0
                  and not public.question_references_are_valid(q.reference_urls) then 'invalid_references' end,
        case when q.question_type in ('mcq','sata') and exists (
          select 1 from jsonb_array_elements(q.choices) c
          where q.option_explanations ? lower(c->>'id')
            and (case lower(coalesce(q.option_explanations->lower(c->>'id')->>'is_correct', ''))
                   when 'true' then true
                   when 'false' then false
                   else null
                 end) is distinct from ((q.correct_answer->'ids') ? lower(c->>'id'))
        ) then 'answer_mismatch' end,
        case when q.clinical_review_status <> 'approved' or q.reviewed_by is null or q.reviewed_at is null
             then 'requires_review' end,
        case when q.reviewed_at is not null and q.reviewed_at < now() - make_interval(days => greatest(p_stale_days, 1))
             then 'stale_review' end
      ], null) as issues
    from public.questions q
  )
  select a.* from audited a
  where public.has_role(array['content_reviewer','question_bank_manager','admin','super_admin'])
    and cardinality(a.issues) > 0
    and (coalesce(p_issue, 'all') = 'all' or coalesce(p_issue, 'all') = any(a.issues))
  order by a.reviewed_at nulls first, a.prompt
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.admin_question_explanation_audit(text, integer, integer, integer) from public, anon;
grant execute on function public.admin_question_explanation_audit(text, integer, integer, integer) to authenticated;

create or replace function public.admin_question_explanation_audit_summary(p_stale_days integer default 365)
returns table (
  total_questions bigint,
  legacy_only bigint,
  structured_complete bigint,
  missing_option_explanations bigint,
  missing_references bigint,
  invalid_references bigint,
  answer_mismatches bigint,
  requiring_review bigint,
  stale_reviews bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where nullif(trim(q.correct_answer_explanation), '') is null and nullif(trim(q.rationale), '') is not null)::bigint,
    count(*) filter (where nullif(trim(q.correct_answer_explanation), '') is not null
      and jsonb_array_length(q.reference_urls) > 0
      and public.question_references_are_valid(q.reference_urls)
      and q.clinical_review_status = 'approved'
      and q.reviewed_by is not null
      and q.reviewed_at is not null
      and q.reviewed_at <= now()
      and not exists (
        select 1 from jsonb_array_elements(q.choices) c
        where q.question_type in ('mcq','sata')
          and (
            nullif(trim(q.option_explanations->lower(c->>'id')->>'explanation'), '') is null
            or (case lower(coalesce(q.option_explanations->lower(c->>'id')->>'is_correct', ''))
                  when 'true' then true
                  when 'false' then false
                  else null
                end) is distinct from ((q.correct_answer->'ids') ? lower(c->>'id'))
          )
      ))::bigint,
    count(*) filter (where q.question_type in ('mcq','sata') and exists (
      select 1 from jsonb_array_elements(q.choices) c
      where nullif(trim(q.option_explanations->lower(c->>'id')->>'explanation'), '') is null
    ))::bigint,
    count(*) filter (where jsonb_array_length(q.reference_urls) = 0)::bigint,
    count(*) filter (where jsonb_array_length(q.reference_urls) > 0 and not public.question_references_are_valid(q.reference_urls))::bigint,
    count(*) filter (where q.question_type in ('mcq','sata') and exists (
      select 1 from jsonb_array_elements(q.choices) c
      where q.option_explanations ? lower(c->>'id')
        and (case lower(coalesce(q.option_explanations->lower(c->>'id')->>'is_correct', ''))
               when 'true' then true
               when 'false' then false
               else null
             end) is distinct from ((q.correct_answer->'ids') ? lower(c->>'id'))
    ))::bigint,
    count(*) filter (where q.clinical_review_status <> 'approved' or q.reviewed_by is null or q.reviewed_at is null)::bigint,
    count(*) filter (where q.reviewed_at is not null and q.reviewed_at < now() - make_interval(days => greatest(p_stale_days, 1)))::bigint
  from public.questions q
  where public.has_role(array['content_reviewer','question_bank_manager','admin','super_admin']);
$$;

revoke all on function public.admin_question_explanation_audit_summary(integer) from public, anon;
grant execute on function public.admin_question_explanation_audit_summary(integer) to authenticated;

-- Approval remains behind the existing staff RPC, but now uses the structured
-- references already saved by the authoring/review interface.
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
  existing_question public.questions;
  primary_reference text;
begin
  if not public.has_role(array['content_reviewer', 'admin', 'super_admin']) then
    raise exception 'Not authorized to review questions';
  end if;
  if decision not in ('approved', 'changes_requested') then
    raise exception 'Decision must be approved or changes_requested';
  end if;

  select * into existing_question from public.questions where id = target_question_id;
  if existing_question.id is null then raise exception 'Question not found'; end if;

  if decision = 'approved' then
    if jsonb_array_length(existing_question.reference_urls) < 1
       or not public.question_references_are_valid(existing_question.reference_urls)
    then
      raise exception 'At least one complete structured HTTPS clinical reference is required for approval';
    end if;
    primary_reference := existing_question.reference_urls->0->>'url';
  else
    primary_reference := coalesce(nullif(trim(clinical_reference), ''), existing_question.reference_url);
  end if;

  update public.questions
  set
    clinical_review_status = decision,
    reference_url = primary_reference,
    quality_notes = coalesce(nullif(trim(reviewer_notes), ''), quality_notes),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    status = case when decision = 'approved' then 'published' else 'draft' end
  where id = target_question_id
  returning * into reviewed_question;

  return reviewed_question;
end;
$$;

revoke all on function public.review_question(uuid, text, text, text) from public, anon;
grant execute on function public.review_question(uuid, text, text, text) to authenticated;

-- Daily-question content follows the same reveal-after-submission boundary.
drop function if exists public.get_daily_question_content();
create function public.get_daily_question_content()
returns table(
  daily_question_id uuid, question_id uuid, question_date date, topic text, question_type text,
  prompt text, choices jsonb, strategy text, reference_url text, existing_attempt jsonb,
  correct_answer jsonb, rationale text, correct_answer_explanation text,
  option_explanations jsonb, immediate_response text, reference_urls jsonb,
  reviewed_at timestamptz
)
language sql volatile security definer set search_path = public
as $$
  with dq as (select (public.get_or_create_daily_question()).*)
  select dq.id, q.id, dq.date, q.topic, q.question_type, q.prompt, q.choices,
    case when a.id is not null then q.strategy else null end,
    case when a.id is not null then q.reference_url else null end,
    case when a.id is not null then to_jsonb(a) else null end,
    case when a.id is not null then q.correct_answer else null end,
    case when a.id is not null then q.rationale else null end,
    case when a.id is not null then q.correct_answer_explanation else null end,
    case when a.id is not null then q.option_explanations else null end,
    case when a.id is not null then q.immediate_response else null end,
    case when a.id is not null then q.reference_urls else null end,
    case when a.id is not null then q.reviewed_at else null end
  from dq join public.questions q on q.id=dq.question_id
  left join public.daily_question_attempts a on a.daily_question_id=dq.id and a.user_id=auth.uid();
$$;
revoke all on function public.get_daily_question_content() from public, anon;
grant execute on function public.get_daily_question_content() to authenticated;

drop function if exists public.submit_daily_question_answer_secure(uuid, text[]);
create function public.submit_daily_question_answer_secure(p_daily_question_id uuid, p_selected_ids text[])
returns table(
  attempt jsonb, correct_answer jsonb, rationale text, strategy text, reference_url text,
  correct_answer_explanation text, option_explanations jsonb, immediate_response text,
  reference_urls jsonb, reviewed_at timestamptz
)
language plpgsql volatile security definer set search_path = public
as $$
declare saved public.daily_question_attempts; q public.questions%rowtype;
begin
  saved := public.submit_daily_question_answer(p_daily_question_id,p_selected_ids);
  select * into q from public.questions where id=saved.question_id;
  return query select to_jsonb(saved), q.correct_answer, q.rationale, q.strategy, q.reference_url,
    q.correct_answer_explanation, q.option_explanations, q.immediate_response,
    q.reference_urls, q.reviewed_at;
end;
$$;
revoke all on function public.submit_daily_question_answer_secure(uuid,text[]) from public, anon;
grant execute on function public.submit_daily_question_answer_secure(uuid,text[]) to authenticated;
