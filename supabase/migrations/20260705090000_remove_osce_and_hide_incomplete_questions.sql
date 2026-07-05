-- Remove OSCE wording from live subscription packages and keep incomplete items out of student practice.

update public.payment_plans
set features = (
  select coalesce(jsonb_agg(feature), '[]'::jsonb)
  from jsonb_array_elements_text(features) as feature
  where lower(feature) not like '%osce%'
)
where features::text ilike '%osce%';

update public.payment_plans
set features = case
  when not exists (
    select 1
    from jsonb_array_elements_text(features) as feature
    where lower(feature) = 'clinical skills review'
  )
  then features || to_jsonb('Clinical skills review'::text)
  else features
end
where lower(name) = '180-day master plan';

update public.questions
set status = 'draft'
where status = 'published'
  and (
    (
      question_type in ('mcq', 'sata', 'ordered_response')
      and jsonb_array_length(coalesce(choices, '[]'::jsonb)) < 2
    )
    or (
      question_type = 'mcq'
      and jsonb_array_length(coalesce(correct_answer->'ids', '[]'::jsonb)) <> 1
    )
    or (
      question_type = 'sata'
      and jsonb_array_length(coalesce(correct_answer->'ids', '[]'::jsonb)) < 1
    )
    or (
      question_type = 'ordered_response'
      and jsonb_array_length(coalesce(correct_answer->'order', '[]'::jsonb)) < 2
    )
    or (
      question_type = 'matrix'
      and (
        jsonb_array_length(coalesce(ngn_data->'rows', '[]'::jsonb)) < 1
        or jsonb_array_length(coalesce(ngn_data->'columns', '[]'::jsonb)) < 2
        or coalesce(jsonb_typeof(ngn_data->'correct'), '') <> 'object'
      )
    )
    or (
      question_type = 'bow_tie'
      and (
        jsonb_array_length(coalesce(ngn_data->'left_choices', '[]'::jsonb)) < 1
        or jsonb_array_length(coalesce(ngn_data->'right_choices', '[]'::jsonb)) < 1
        or jsonb_array_length(coalesce(ngn_data->'correct_left', '[]'::jsonb)) < 1
        or jsonb_array_length(coalesce(ngn_data->'correct_right', '[]'::jsonb)) < 1
      )
    )
    or (
      question_type = 'highlight'
      and (
        coalesce(ngn_data->>'passage', '') = ''
        or jsonb_array_length(coalesce(ngn_data->'highlights', '[]'::jsonb)) < 1
      )
    )
  );

