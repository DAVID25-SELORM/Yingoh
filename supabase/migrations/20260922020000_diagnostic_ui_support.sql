begin;
-- Read/list/search functions used by the diagnostic screens. Additive; same access model as the
-- diagnostic system migration: no direct table access, admin-only authoring views, owner-only learner views.

-- Error taxonomy per the NurseFaculty methodology: A Knowledge Gap, B Misread, C Clinical Judgment,
-- D Prioritization, E Calculation, F Test-Taking Reasoning, G Careless Error (first migration allowed A-E only).
alter table public.diagnostic_error_tags drop constraint if exists diagnostic_error_tags_error_type_check;
alter table public.diagnostic_error_tags add constraint diagnostic_error_tags_error_type_check check(error_type in ('A','B','C','D','E','F','G'));
create or replace function public.admin_diagnostic_tag_error(p_attempt uuid,p_question uuid,p_type text,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if p_type is null or p_type not in ('A','B','C','D','E','F','G') then raise exception 'Invalid error type'; end if;
 if not exists(select 1 from public.diagnostic_attempts t join public.diagnostic_items i on i.form_id=t.form_id and i.question_id=p_question
  where t.id=p_attempt and t.status='submitted') then raise exception 'Attempt or question not found'; end if;
 if exists(select 1 from public.diagnostic_answers a where a.attempt_id=p_attempt and a.question_id=p_question and a.is_correct) then raise exception 'Only missed questions can be tagged'; end if;
 insert into public.diagnostic_error_tags(attempt_id,question_id,error_type,note,tagged_by) values(p_attempt,p_question,p_type,nullif(btrim(p_note),''),auth.uid())
 on conflict(attempt_id,question_id) do update set error_type=excluded.error_type,note=excluded.note,tagged_by=excluded.tagged_by,tagged_at=now();
end $$;

-- Learner: the diagnostics assigned to me, with attempt counters and any open/last submitted attempt.
create function public.my_diagnostic_assignments() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Not authorized'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('form_id',f.id,'name',f.name,'attempts_allowed',a.attempts_allowed,
   'attempts_used',(select count(*) from public.diagnostic_attempts t where t.user_id=a.user_id and t.form_id=f.id),
   'open_attempt_id',(select t.id from public.diagnostic_attempts t where t.user_id=a.user_id and t.form_id=f.id and t.status='in_progress'),
   'last_attempt_id',(select t.id from public.diagnostic_attempts t where t.user_id=a.user_id and t.form_id=f.id and t.status='submitted' order by t.attempt_no desc limit 1)) order by f.name)
  from public.diagnostic_assignments a join public.diagnostic_forms f on f.id=a.form_id where a.user_id=auth.uid() and f.status='published'),'[]'::jsonb);
end $$;

create function public.admin_diagnostic_list_forms() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'version',f.version,'status',f.status,'created_at',f.created_at,'published_at',f.published_at,
   'items',(select count(*) from public.diagnostic_items i where i.form_id=f.id),
   'assigned',(select count(*) from public.diagnostic_assignments a where a.form_id=f.id),
   'submitted',(select count(*) from public.diagnostic_attempts t where t.form_id=f.id and t.status='submitted')) order by f.created_at desc)
  from public.diagnostic_forms f),'[]'::jsonb);
end $$;

create function public.admin_diagnostic_get_form(p_form uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return (select jsonb_build_object('id',f.id,'name',f.name,'version',f.version,'status',f.status,
   'items',coalesce((select jsonb_agg(jsonb_build_object('position',i.position,'question_id',i.question_id,'part',i.part,'subcategory',i.subcategory,'subtopic',i.subtopic,
     'cj_step',i.cj_step,'difficulty',i.difficulty,'prompt',left(q.prompt,200)) order by i.position)
     from public.diagnostic_items i join public.questions q on q.id=i.question_id where i.form_id=f.id),'[]'::jsonb))
  from public.diagnostic_forms f where f.id=p_form);
end $$;

-- Eligible, not-yet-used questions matching a text/subcategory filter (bounded).
create function public.admin_diagnostic_search_questions(p_query text default '',p_subcategory text default null,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_q text:=replace(replace(replace(left(coalesce(p_query,''),100),'\','\\'),'%','\%'),'_','\_');
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (
  select q.id,q.topic,q.client_need,q.clinical_judgment cj_step,q.question_type,left(q.prompt,200) prompt
  from public.questions q
  where public.diagnostic_question_ok(q) and q.client_need in (select b.sub_name from public.diagnostic_blueprint() b)
   and (p_subcategory is null or q.client_need=p_subcategory)
   and (v_q='' or q.prompt ilike '%'||v_q||'%' or q.topic ilike '%'||v_q||'%')
   and not exists(select 1 from public.diagnostic_items di where di.question_id=q.id)
  order by md5(q.id::text) limit least(greatest(coalesce(p_limit,20),1),30)) x),'[]'::jsonb);
end $$;

create function public.admin_diagnostic_find_users(p_query text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_q text:=replace(replace(replace(left(coalesce(p_query,''),100),'\','\\'),'%','\%'),'_','\_');
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if length(btrim(v_q))<2 then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select p.id,p.full_name,p.email from public.profiles p
  where p.full_name ilike '%'||v_q||'%' or p.email ilike '%'||v_q||'%' order by p.full_name limit 20) x),'[]'::jsonb);
end $$;

create function public.admin_diagnostic_assignments(p_form uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'full_name',p.full_name,'email',p.email,'attempts_allowed',a.attempts_allowed,
   'attempts_used',(select count(*) from public.diagnostic_attempts t where t.user_id=a.user_id and t.form_id=a.form_id)) order by p.full_name)
  from public.diagnostic_assignments a join public.profiles p on p.id=a.user_id where a.form_id=p_form),'[]'::jsonb);
end $$;

-- Admin view of a submitted attempt's questions (for error tagging). Rationale and answers are staff-only here.
create function public.admin_get_diagnostic_review(p_attempt uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from public.diagnostic_attempts t where t.id=p_attempt and t.status='submitted') then raise exception 'Attempt not found'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('position',i.position,'question_id',i.question_id,'part',i.part,'subcategory',i.subcategory,'subtopic',i.subtopic,
   'prompt',left(q.prompt,300),'selected',a.answer->'ids','correct_answer',q.correct_answer->'ids','is_correct',coalesce(a.is_correct,false),
   'answered',a.question_id is not null,'seconds',a.time_taken_seconds,'error_type',e.error_type,'error_note',e.note) order by i.position),'[]'::jsonb)
  from public.diagnostic_attempts t join public.diagnostic_items i on i.form_id=t.form_id join public.questions q on q.id=i.question_id
  left join public.diagnostic_answers a on a.attempt_id=t.id and a.question_id=i.question_id
  left join public.diagnostic_error_tags e on e.attempt_id=t.id and e.question_id=i.question_id where t.id=p_attempt);
end $$;

revoke all on function public.my_diagnostic_assignments(),public.admin_diagnostic_list_forms(),public.admin_diagnostic_get_form(uuid),
 public.admin_diagnostic_search_questions(text,text,integer),public.admin_diagnostic_find_users(text),public.admin_diagnostic_assignments(uuid),
 public.admin_get_diagnostic_review(uuid) from public,anon;
grant execute on function public.my_diagnostic_assignments(),public.admin_diagnostic_list_forms(),public.admin_diagnostic_get_form(uuid),
 public.admin_diagnostic_search_questions(text,text,integer),public.admin_diagnostic_find_users(text),public.admin_diagnostic_assignments(uuid),
 public.admin_get_diagnostic_review(uuid) to authenticated;
commit;
