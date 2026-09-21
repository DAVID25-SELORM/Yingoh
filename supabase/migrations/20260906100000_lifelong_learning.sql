-- Additive lifelong learning foundation. Existing NCLEX tables and grading stay intact.
begin;

create table if not exists public.learning_taxonomy (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('country','exam','specialty','program','competency')),
  code text not null, label text not null, active boolean not null default true,
  unique(kind, code)
);
insert into public.learning_taxonomy(kind,code,label) values
 ('exam','nclex-rn','NCLEX-RN'),('exam','nclex-pn','NCLEX-PN'),
 ('program','cpd','CPD Centre'),('program','educator','Nurse Educator Academy'),
 ('program','leadership','Nurse Leadership Academy'),('program','clinical','Clinical Case Simulator')
 on conflict (kind,code) do nothing;

create table if not exists public.learning_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  career_stage text not null default 'nclex' check(career_stage in ('student','nclex','practicing','educator','leader')),
  country_id uuid references public.learning_taxonomy(id),
  specialty_id uuid references public.learning_taxonomy(id),
  goals text not null default '', daily_email boolean not null default true,
  cycle_start date, cycle_end date, target_hours numeric(8,2) not null default 0 check(target_hours >= 0),
  target_points numeric(8,2) not null default 0 check(target_points >= 0),
  check (cycle_end is null or cycle_start is null or cycle_end >= cycle_start)
);

-- All formats share a versioned review envelope; existing LMS content can be linked.
create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) > 0),
  program_id uuid references public.learning_taxonomy(id),
  kind text not null default 'lesson' check(kind in ('lesson','video','case','cpd','regulatory','competency','question')),
  audience text not null default 'clinical' check(audience in ('nclex','school','clinical','specialty')),
  country_id uuid references public.learning_taxonomy(id), specialty_id uuid references public.learning_taxonomy(id),
  exam_id uuid references public.learning_taxonomy(id),
  course_id uuid references public.courses(id) on delete set null,
  legacy_question_id uuid references public.questions(id) on delete set null,
  legacy_lesson_id uuid references public.lessons(id) on delete set null,
  summary text not null default '', body text not null default '', media_url text,
  author_id uuid not null default auth.uid() references public.profiles(id),
  last_content_editor_id uuid not null default auth.uid() references public.profiles(id),
  reviewer_id uuid references public.profiles(id), references_text text not null default '',
  version integer not null default 1 check(version > 0), reviewed_on date, next_review_on date,
  status text not null default 'draft' check(status in ('draft','in_review','published','archived')),
  hours numeric(8,2) not null default 0 check(hours >= 0), points numeric(8,2) not null default 0 check(points >= 0),
  credit_authority text not null default '', validity_days integer check(validity_days > 0),
  pass_score integer not null default 80 check(pass_score between 1 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.learning_item_versions (
  item_id uuid references public.learning_items(id) on delete restrict,
  version integer not null, snapshot jsonb not null, recorded_at timestamptz not null default now(),
  primary key(item_id,version)
);
-- Answer keys are never readable by learners. Sanitized questions come from an RPC.
create table if not exists public.learning_assessments (
  item_id uuid primary key references public.learning_items(id) on delete cascade,
  questions jsonb not null default '[]'::jsonb check(jsonb_typeof(questions) = 'array')
);
create table if not exists public.learning_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  item_id uuid not null references public.learning_items(id), version integer not null,
  answers jsonb not null, score numeric not null, passed boolean not null, created_at timestamptz not null default now()
);
create table if not exists public.learning_completions (
  user_id uuid references public.profiles(id), item_id uuid references public.learning_items(id),
  version integer not null, completed_at timestamptz not null default now(), score numeric not null,
  certificate_id uuid references public.user_certificates(id), primary key(user_id,item_id,version)
);
create table if not exists public.cpd_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id),
  item_id uuid references public.learning_items(id), item_version integer,
  title text not null check(length(trim(title)) > 0), provider text not null default '',
  hours numeric(8,2) not null default 0 check(hours >= 0), points numeric(8,2) not null default 0 check(points >= 0),
  completed_on date not null check(completed_on <= current_date), expires_on date,
  source text not null default 'external' check(source in ('external','platform')),
  evidence_url text, reflection text not null default '',
  certificate_id uuid references public.user_certificates(id),
  check(expires_on is null or expires_on >= completed_on), unique(user_id,item_id,item_version)
);

create or replace function public.learning_editor() returns boolean language sql stable security definer set search_path=public as $$
 select public.has_role(array['admin','super_admin','instructor','content_reviewer']);
$$;
create or replace function public.learning_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP = 'INSERT' then new.author_id := auth.uid(); new.last_content_editor_id := auth.uid();
 elsif new.author_id is distinct from old.author_id then raise exception 'The original author cannot be changed'; end if;
 if TG_OP = 'UPDATE' then
   new.last_content_editor_id := old.last_content_editor_id;
   if (to_jsonb(new) - array['status','version','updated_at','reviewer_id','reviewed_on']) is distinct from
      (to_jsonb(old) - array['status','version','updated_at','reviewer_id','reviewed_on']) then
     new.last_content_editor_id := auth.uid();
   end if;
   insert into public.learning_item_versions(item_id,version,snapshot) values(old.id,old.version,to_jsonb(old) || jsonb_build_object('assessment',(select questions from public.learning_assessments where item_id=old.id))) on conflict do nothing;
   new.version := old.version + 1;
   if old.status = 'published' and new.status = 'published' then
     raise exception 'Move published content to draft before editing and submit it for review again';
   end if;
 end if;
 new.updated_at := now();
 if new.status = 'published' then
   if TG_OP = 'INSERT' or old.status <> 'in_review' then raise exception 'Submit the saved draft for review before publication'; end if;
   if (to_jsonb(new) - array['status','version','updated_at','reviewer_id','reviewed_on']) is distinct from
      (to_jsonb(old) - array['status','version','updated_at','reviewer_id','reviewed_on']) then
     raise exception 'Save content changes as a draft before approval';
   end if;
   if not public.has_role(array['admin','super_admin','content_reviewer']) or new.author_id = auth.uid() or new.last_content_editor_id = auth.uid() then
     raise exception 'An independent content reviewer must publish this item';
   end if;
   if length(trim(new.references_text)) = 0 or new.next_review_on is null or new.next_review_on <= current_date
      or length(trim(new.body)) = 0 then raise exception 'Content, references and a future review date are required'; end if;
   if new.points > 0 and length(trim(new.credit_authority)) = 0 then raise exception 'Record the credit approval authority before awarding points'; end if;
   if new.kind <> 'competency' and not exists(select 1 from public.learning_assessments a where a.item_id = new.id and jsonb_array_length(a.questions) > 0) then
     raise exception 'Add an assessment before publication';
   end if;
   new.reviewer_id := auth.uid(); new.reviewed_on := current_date;
 else
   new.reviewer_id := null; new.reviewed_on := null;
 end if;
 return new;
end; $$;
drop trigger if exists learning_review_gate on public.learning_items;
create trigger learning_review_gate before insert or update on public.learning_items for each row execute function public.learning_guard();

create or replace function public.learning_assessment_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare q jsonb;
begin
 if exists(select 1 from public.learning_items where id=coalesce(new.item_id,old.item_id) and status in ('published','in_review')) then
   raise exception 'Move content to draft before changing its assessment';
 end if;
 if TG_OP = 'DELETE' then return old; end if;
 if jsonb_array_length(new.questions) > 100 then raise exception 'Maximum 100 assessment questions'; end if;
 for q in select value from jsonb_array_elements(new.questions) loop
   if coalesce(length(trim(q->>'prompt')),0)=0 or jsonb_typeof(q->'choices') is distinct from 'array' then raise exception 'Each question needs a prompt and choices'; end if;
   if jsonb_array_length(q->'choices') < 2 or not coalesce((q->>'correct') ~ '^[0-9]+$',false) then raise exception 'Each question needs at least two choices and a zero-based correct index'; end if;
   if (q->>'correct')::integer >= jsonb_array_length(q->'choices') or coalesce(length(trim(q->>'rationale')),0)=0 then raise exception 'Provide a valid answer and rationale'; end if;
 end loop;
 return new;
end; $$;
drop trigger if exists learning_assessment_validation on public.learning_assessments;
create trigger learning_assessment_validation before insert or update or delete on public.learning_assessments for each row execute function public.learning_assessment_guard();

alter table public.learning_taxonomy enable row level security;
alter table public.learning_profiles enable row level security;
alter table public.learning_items enable row level security;
alter table public.learning_item_versions enable row level security;
alter table public.learning_assessments enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_completions enable row level security;
alter table public.cpd_records enable row level security;
drop policy if exists taxonomy_read on public.learning_taxonomy;
create policy taxonomy_read on public.learning_taxonomy for select to authenticated using(true);
drop policy if exists taxonomy_admin on public.learning_taxonomy;
create policy taxonomy_admin on public.learning_taxonomy for all to authenticated using(public.has_role(array['admin','super_admin'])) with check(public.has_role(array['admin','super_admin']));
drop policy if exists learning_profile_own on public.learning_profiles;
create policy learning_profile_own on public.learning_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists learning_catalog_read on public.learning_items;
create policy learning_catalog_read on public.learning_items for select to authenticated using(status='published' or public.learning_editor());
drop policy if exists learning_catalog_write on public.learning_items;
create policy learning_catalog_write on public.learning_items for all to authenticated using(public.learning_editor()) with check(public.learning_editor());
drop policy if exists learning_versions_staff on public.learning_item_versions;
create policy learning_versions_staff on public.learning_item_versions for select to authenticated using(public.learning_editor());
drop policy if exists learning_assessments_staff on public.learning_assessments;
create policy learning_assessments_staff on public.learning_assessments for all to authenticated using(public.learning_editor()) with check(public.learning_editor());
drop policy if exists learning_attempts_own on public.learning_attempts;
create policy learning_attempts_own on public.learning_attempts for select to authenticated using(user_id=auth.uid());
drop policy if exists learning_completions_own on public.learning_completions;
create policy learning_completions_own on public.learning_completions for select to authenticated using(user_id=auth.uid());
drop policy if exists cpd_read on public.cpd_records;
create policy cpd_read on public.cpd_records for select to authenticated using(user_id=auth.uid());
drop policy if exists cpd_external_insert on public.cpd_records;
create policy cpd_external_insert on public.cpd_records for insert to authenticated with check(user_id=auth.uid() and source='external' and item_id is null and certificate_id is null);
drop policy if exists cpd_external_delete on public.cpd_records;
create policy cpd_external_delete on public.cpd_records for delete to authenticated using(user_id=auth.uid() and source='external');
revoke all on public.learning_taxonomy,public.learning_profiles,public.learning_items,public.learning_assessments,public.learning_item_versions,public.learning_attempts,public.learning_completions,public.cpd_records from anon,authenticated;
grant select,insert,update,delete on public.learning_taxonomy,public.learning_profiles,public.learning_items,public.learning_assessments to authenticated;
grant select on public.learning_item_versions,public.learning_attempts,public.learning_completions to authenticated;
grant select,insert,delete on public.cpd_records to authenticated;

create or replace function public.learning_questions(p_item uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null or public.current_subscription_level()<1 then raise exception 'An active subscription is required'; end if;
 if not exists(select 1 from public.learning_items where id=p_item and status='published' and next_review_on > current_date) then raise exception 'This learning item is unavailable or awaiting review'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('prompt',q->'prompt','choices',q->'choices','stage',q->'stage') order by n),'[]'::jsonb) into result
 from public.learning_assessments a, jsonb_array_elements(a.questions) with ordinality as x(q,n) where a.item_id=p_item;
 return result;
end; $$;

create or replace function public.submit_learning_assessment(p_item uuid,p_version integer,p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.learning_items%rowtype; qs jsonb; q jsonb; total integer; correct integer:=0;
 idx integer:=0; result_score numeric; passed boolean; cert uuid; code text; feedback jsonb:='[]';
begin
 if auth.uid() is null or public.current_subscription_level()<1 then raise exception 'An active subscription is required'; end if;
 select * into item from public.learning_items where id=p_item and status='published' and next_review_on > current_date for share;
 if not found or item.version <> p_version then raise exception 'This content has changed or needs review. Reload before continuing'; end if;
 if item.kind='competency' then raise exception 'Workplace competencies require independent assessor sign-off'; end if;
 select questions into qs from public.learning_assessments where item_id=p_item;
 total := jsonb_array_length(qs);
 if total is null or total=0 or jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>total then raise exception 'Answer every assessment question'; end if;
 for q in select value from jsonb_array_elements(qs) loop
   if p_answers->idx = q->'correct' then correct:=correct+1; end if;
   feedback := feedback || jsonb_build_array(jsonb_build_object('correct',q->'correct','rationale',q->>'rationale'));
   idx:=idx+1;
 end loop;
 result_score := round(correct*100.0/total,2); passed:=result_score>=item.pass_score;
 insert into public.learning_attempts(user_id,item_id,version,answers,score,passed) values(auth.uid(),item.id,item.version,p_answers,result_score,passed);
 if passed then
   -- Unique completion is the concurrency barrier: retries cannot issue duplicate credits.
   insert into public.learning_completions(user_id,item_id,version,score) values(auth.uid(),item.id,item.version,result_score) on conflict do nothing;
   if found then
     code:='NF-'||upper(replace(gen_random_uuid()::text,'-',''));
     insert into public.user_certificates(user_id,type,category,title,course_id,course_name,credit_hours,grade,verification_code,certificate_number,issued_at,expires_at,status)
       values(auth.uid(),'professional','professional',item.title,item.course_id,item.title,item.hours,result_score::text,code,code,now(),case when item.validity_days is not null then now()+make_interval(days=>item.validity_days) end,'active') returning id into cert;
     update public.learning_completions set certificate_id=cert where user_id=auth.uid() and item_id=item.id and version=item.version;
     insert into public.cpd_records(user_id,item_id,item_version,title,provider,hours,points,completed_on,expires_on,source,certificate_id)
       values(auth.uid(),item.id,item.version,item.title,item.credit_authority,item.hours,item.points,current_date,case when item.validity_days is not null then current_date+item.validity_days end,'platform',cert);
     insert into public.transcript_records(user_id,course_id,certificate_id,course_name,grade,credit_hours,status,completed_at)
       values(auth.uid(),item.course_id,cert,item.title,result_score::text,item.hours,'completed',now());
   end if;
 end if;
 return jsonb_build_object('score',result_score,'passed',passed,'feedback',feedback);
end; $$;
revoke all on function public.learning_editor(),public.learning_guard(),public.learning_assessment_guard(),public.learning_questions(uuid),public.submit_learning_assessment(uuid,integer,jsonb) from public,anon;
grant execute on function public.learning_editor(),public.learning_questions(uuid),public.submit_learning_assessment(uuid,integer,jsonb) to authenticated;
commit;
