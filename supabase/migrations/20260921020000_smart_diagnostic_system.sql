begin;
-- NurseFaculty SMART NCLEX Roadmap diagnostic: data model, server-side scoring and authoring tools.
-- Additive only. Bands are NurseFaculty INTERNAL diagnostic thresholds, not NCLEX passing standards;
-- no pass probability is calculated anywhere. Correct answers never leave the server before submission.
-- v1 supports single-answer (mcq) and select-all (sata) items only.

create table public.diagnostic_forms(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 150),
 version integer not null default 1 check(version>=1),
 status text not null default 'draft' check(status in ('draft','published','retired')),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), published_at timestamptz,
 unique(name,version)
);
create table public.diagnostic_items(
 form_id uuid not null references public.diagnostic_forms(id) on delete cascade,
 position integer not null check(position between 1 and 150),
 question_id uuid not null references public.questions(id),
 part text not null check(part in ('A','B','C','D')),
 subcategory text not null check(subcategory in ('Management of Care','Safety and Infection Prevention and Control','Health Promotion and Maintenance','Psychosocial Integrity','Basic Care and Comfort','Pharmacological and Parenteral Therapies','Reduction of Risk Potential','Physiological Adaptation')),
 subtopic text check(subtopic is null or length(subtopic)<=120),
 cj_step text check(cj_step is null or cj_step in ('Recognize Cues','Analyze Cues','Prioritize Hypotheses','Generate Solutions','Take Action','Evaluate Outcomes')),
 difficulty text check(difficulty is null or difficulty in ('easy','medium','hard')),
 primary key(form_id,position), unique(form_id,question_id)
);
create index diagnostic_items_question on public.diagnostic_items(question_id);
create table public.diagnostic_assignments(
 form_id uuid not null references public.diagnostic_forms(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 attempts_allowed integer not null default 1 check(attempts_allowed between 1 and 10),
 assigned_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(form_id,user_id)
);
create table public.diagnostic_attempts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 form_id uuid not null references public.diagnostic_forms(id),
 attempt_no integer not null check(attempt_no>=1),
 status text not null default 'in_progress' check(status in ('in_progress','submitted')),
 started_at timestamptz not null default now(), submitted_at timestamptz,
 unique(user_id,form_id,attempt_no)
);
create unique index diagnostic_one_open_attempt on public.diagnostic_attempts(user_id,form_id) where status='in_progress';
create index diagnostic_attempts_form on public.diagnostic_attempts(form_id,submitted_at desc);
create table public.diagnostic_answers(
 attempt_id uuid not null references public.diagnostic_attempts(id) on delete cascade,
 question_id uuid not null references public.questions(id),
 answer jsonb not null, is_correct boolean not null,
 time_taken_seconds integer check(time_taken_seconds is null or time_taken_seconds between 0 and 3600),
 answered_at timestamptz not null default now(),
 primary key(attempt_id,question_id)
);
create table public.diagnostic_reports(
 attempt_id uuid primary key references public.diagnostic_attempts(id) on delete cascade,
 generated_at timestamptz not null default now(),
 total integer not null, correct integer not null, report jsonb not null
);
create table public.diagnostic_error_tags(
 attempt_id uuid not null references public.diagnostic_attempts(id) on delete cascade,
 question_id uuid not null references public.questions(id),
 error_type text not null check(error_type in ('A','B','C','D','E')),
 note text check(note is null or length(note)<=1000),
 tagged_by uuid references public.profiles(id) on delete set null,
 tagged_at timestamptz not null default now(),
 primary key(attempt_id,question_id)
);
alter table public.diagnostic_forms enable row level security;
alter table public.diagnostic_items enable row level security;
alter table public.diagnostic_assignments enable row level security;
alter table public.diagnostic_attempts enable row level security;
alter table public.diagnostic_answers enable row level security;
alter table public.diagnostic_reports enable row level security;
alter table public.diagnostic_error_tags enable row level security;
-- All access is through the security-definer functions below; no direct client table access.
revoke all on public.diagnostic_forms,public.diagnostic_items,public.diagnostic_assignments,public.diagnostic_attempts,
 public.diagnostic_answers,public.diagnostic_reports,public.diagnostic_error_tags from public,anon,authenticated;
grant all on public.diagnostic_forms,public.diagnostic_items,public.diagnostic_assignments,public.diagnostic_attempts,
 public.diagnostic_answers,public.diagnostic_reports,public.diagnostic_error_tags to service_role;

-- Published forms are immutable so a taken diagnostic can always be reproduced.
create function public.diagnostic_items_guard() returns trigger language plpgsql set search_path=public as $$
declare v_status text;
begin
 select f.status into v_status from public.diagnostic_forms f where f.id=coalesce(new.form_id,old.form_id);
 if v_status is not null and v_status<>'draft' then raise exception 'Published diagnostic forms are immutable'; end if;
 return coalesce(new,old);
end $$;
create trigger diagnostic_items_immutable before insert or update or delete on public.diagnostic_items
 for each row execute function public.diagnostic_items_guard();

create function public.diagnostic_blueprint() returns table(sub_sort integer,sub_name text,sub_target integer)
language sql immutable set search_path=public as $$
 values (1,'Management of Care',27),(2,'Safety and Infection Prevention and Control',20),(3,'Health Promotion and Maintenance',14),
 (4,'Psychosocial Integrity',14),(5,'Basic Care and Comfort',14),(6,'Pharmacological and Parenteral Therapies',24),
 (7,'Reduction of Risk Potential',18),(8,'Physiological Adaptation',19)
$$;

create function public.diagnostic_band(p_correct integer,p_total integer,p_min integer default 1) returns text
language sql immutable set search_path=public as $$
 select case when p_total<=0 then 'no_data' when p_total<p_min then 'insufficient_data'
  when p_correct::numeric/p_total>=0.8 then 'strong' when p_correct::numeric/p_total>=0.65 then 'developing'
  when p_correct::numeric/p_total>=0.5 then 'weak' else 'critical' end
$$;

create function public.diagnostic_question_ok(q public.questions) returns boolean language sql immutable set search_path=public as $$
 select q.status='published' and q.question_type in ('mcq','sata') and q.clinical_review_status in ('approved','legacy')
 and length(trim(coalesce(q.rationale,'')))>=80 and jsonb_typeof(q.choices)='array' and jsonb_typeof(q.correct_answer->'ids')='array'
 and jsonb_array_length(case when jsonb_typeof(q.choices)='array' then q.choices else '[]'::jsonb end)>=2
 and jsonb_array_length(case when jsonb_typeof(q.correct_answer->'ids')='array' then q.correct_answer->'ids' else '[]'::jsonb end)>=1
 and (q.question_type<>'mcq' or jsonb_array_length(case when jsonb_typeof(q.correct_answer->'ids')='array' then q.correct_answer->'ids' else '[]'::jsonb end)=1)
 and not exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(q.correct_answer->'ids')='array' then q.correct_answer->'ids' else '[]'::jsonb end) a(v)
  where not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q.choices)='array' then q.choices else '[]'::jsonb end) c(x) where c.x->>'id'=a.v))
 and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q.choices)='array' then q.choices else '[]'::jsonb end) c(x) where nullif(c.x->>'id','') is null or nullif(c.x->>'text','') is null)
$$;

-- Internal: builds and stores the scored report for a submitted attempt (single CTE query, no temp tables).
create function public.diagnostic_build_report(p_attempt uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_total integer; v_correct integer; v_parts jsonb; v_subs jsonb; v_topics jsonb; v_cj jsonb; v_roadmap jsonb; v_report jsonb;
begin
 with scored as (
  select di.question_id,coalesce(da.is_correct,false) ok,di.part,di.subcategory sub,coalesce(nullif(di.subtopic,''),q.topic) topic,di.cj_step cj
  from public.diagnostic_attempts t join public.diagnostic_items di on di.form_id=t.form_id
  join public.questions q on q.id=di.question_id
  left join public.diagnostic_answers da on da.attempt_id=t.id and da.question_id=di.question_id where t.id=p_attempt),
 g_part as (select s.part k,count(*)::integer n,(count(*) filter(where s.ok))::integer c from scored s group by s.part),
 g_sub as (select s.sub k,count(*)::integer n,(count(*) filter(where s.ok))::integer c from scored s group by s.sub),
 g_topic as (select s.topic k,count(*)::integer n,(count(*) filter(where s.ok))::integer c from scored s group by s.topic),
 g_cj as (select s.cj k,count(*)::integer n,(count(*) filter(where s.ok))::integer c from scored s where s.cj is not null group by s.cj),
 road as (
  select 'subcategory' lvl,g.k,public.diagnostic_band(g.c,g.n,1) band,round(100.0*g.c/g.n,1) pct,
   coalesce((select b.sub_target from public.diagnostic_blueprint() b where b.sub_name=g.k),0) weight from g_sub g
  union all
  select 'topic',g.k,public.diagnostic_band(g.c,g.n,4),round(100.0*g.c/g.n,1),g.n from g_topic g),
 ranked as (
  select row_number() over (order by case r.band when 'critical' then 1 when 'weak' then 2 else 3 end,r.weight desc,r.pct,r.k) rn,r.lvl,r.k,r.band,r.pct
  from road r where r.band in ('critical','weak','developing'))
 select (select count(*) from scored),(select count(*) filter(where ok) from scored),
  (select coalesce(jsonb_agg(jsonb_build_object('name',g.k,'total',g.n,'correct',g.c,'pct',round(100.0*g.c/g.n,1),'band',public.diagnostic_band(g.c,g.n,1)) order by g.k),'[]'::jsonb) from g_part g),
  (select coalesce(jsonb_agg(jsonb_build_object('name',g.k,'total',g.n,'correct',g.c,'pct',round(100.0*g.c/g.n,1),'band',public.diagnostic_band(g.c,g.n,1)) order by g.k),'[]'::jsonb) from g_sub g),
  (select coalesce(jsonb_agg(jsonb_build_object('name',g.k,'total',g.n,'correct',g.c,'pct',round(100.0*g.c/g.n,1),'band',public.diagnostic_band(g.c,g.n,4)) order by g.k),'[]'::jsonb) from g_topic g),
  (select coalesce(jsonb_agg(jsonb_build_object('name',g.k,'total',g.n,'correct',g.c,'pct',round(100.0*g.c/g.n,1),'band',public.diagnostic_band(g.c,g.n,4)) order by g.k),'[]'::jsonb) from g_cj g),
  (select coalesce(jsonb_agg(jsonb_build_object('rank',x.rn,'level',x.lvl,'name',x.k,'band',x.band,'pct',x.pct) order by x.rn),'[]'::jsonb) from (select * from ranked order by rn limit 20) x)
 into v_total,v_correct,v_parts,v_subs,v_topics,v_cj,v_roadmap;
 v_report:=jsonb_build_object('overall',jsonb_build_object('total',v_total,'correct',v_correct,'pct',case when v_total>0 then round(100.0*v_correct/v_total,1) end,'band',public.diagnostic_band(v_correct,v_total,1)),
  'note','NurseFaculty internal diagnostic bands. Not an NCLEX passing standard or pass prediction.',
  'parts',v_parts,'subcategories',v_subs,'topics',v_topics,'clinical_judgment',v_cj,'roadmap',v_roadmap);
 insert into public.diagnostic_reports(attempt_id,total,correct,report) values(p_attempt,v_total,v_correct,v_report)
 on conflict(attempt_id) do nothing;
 return v_report;
end $$;

-- ===== Authoring (admin / super_admin) =====
create function public.admin_diagnostic_create_form(p_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_version integer;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 150 then raise exception 'Invalid form name'; end if;
 select coalesce(max(f.version),0)+1 into v_version from public.diagnostic_forms f where f.name=btrim(p_name);
 insert into public.diagnostic_forms(name,version,created_by) values(btrim(p_name),v_version,auth.uid()) returning id into v_id;
 return v_id;
end $$;

-- Largest-remainder allocation of Part A questions across the blueprint subcategories.
create function public.diagnostic_quota(p_part_a integer) returns table(sub_sort integer,sub_name text,quota integer)
language sql immutable set search_path=public as $$
 with w as (select b.sub_sort,b.sub_name,b.sub_target::numeric*p_part_a/150 exact from public.diagnostic_blueprint() b),
 base as (select w.sub_sort,w.sub_name,floor(w.exact)::integer fl,w.exact-floor(w.exact) frac from w),
 ranked as (select base.*,row_number() over (order by base.frac desc,base.sub_name) rn,(p_part_a-(select sum(base.fl) from base))::integer leftover from base)
 select ranked.sub_sort,ranked.sub_name,ranked.fl+case when ranked.rn<=ranked.leftover then 1 else 0 end from ranked
$$;

-- Proposes Part A (core) items by blueprint share using reviewed, unused mcq/sata questions. Deterministic per seed.
create function public.admin_diagnostic_propose_items(p_form uuid,p_seed text default '',p_part_a integer default 100) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_added integer; v_short jsonb;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if p_part_a is null or p_part_a not between 1 and 150 then raise exception 'Invalid Part A size'; end if;
 perform 1 from public.diagnostic_forms f where f.id=p_form and f.status='draft' for update;
 if not found then raise exception 'Draft form not found'; end if;
 if exists(select 1 from public.diagnostic_items i where i.form_id=p_form) then raise exception 'Form already has items'; end if;
 with pool as (
  select q.id,q.client_need sub,q.topic,q.clinical_judgment cj,
   row_number() over (partition by q.client_need order by md5(q.id::text||coalesce(p_seed,''))) rk
  from public.questions q
  where q.client_need in (select b.sub_name from public.diagnostic_blueprint() b) and public.diagnostic_question_ok(q)
   and not exists(select 1 from public.diagnostic_items di where di.question_id=q.id)),
 picked as (select pool.*,dq.sub_sort from pool join public.diagnostic_quota(p_part_a) dq on dq.sub_name=pool.sub where pool.rk<=dq.quota),
 numbered as (select picked.*,row_number() over (order by picked.sub_sort,picked.rk)::integer pos from picked)
 insert into public.diagnostic_items(form_id,position,question_id,part,subcategory,subtopic,cj_step)
 select p_form,numbered.pos,numbered.id,'A',numbered.sub,left(numbered.topic,120),
  case when numbered.cj in ('Recognize Cues','Analyze Cues','Prioritize Hypotheses','Generate Solutions','Take Action','Evaluate Outcomes') then numbered.cj end from numbered;
 get diagnostics v_added=row_count;
 select coalesce(jsonb_agg(jsonb_build_object('subcategory',dq.sub_name,'wanted',dq.quota,'got',coalesce(c.n,0)) order by dq.sub_sort) filter(where coalesce(c.n,0)<dq.quota),'[]'::jsonb)
  into v_short from public.diagnostic_quota(p_part_a) dq left join (select i.subcategory,count(*) n from public.diagnostic_items i where i.form_id=p_form group by 1) c on c.subcategory=dq.sub_name;
 return jsonb_build_object('added',v_added,'shortfalls',v_short);
end $$;

create function public.admin_diagnostic_set_item(p_form uuid,p_position integer,p_question uuid,p_part text,p_subcategory text,
 p_subtopic text default null,p_cj_step text default null,p_difficulty text default null) returns void
language plpgsql security definer set search_path=public as $$
declare q public.questions;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 perform 1 from public.diagnostic_forms f where f.id=p_form and f.status='draft' for update;
 if not found then raise exception 'Draft form not found'; end if;
 select * into q from public.questions where id=p_question;
 if not found or not public.diagnostic_question_ok(q) then raise exception 'Question is not eligible for the diagnostic'; end if;
 if q.client_need in (select b.sub_name from public.diagnostic_blueprint() b) and q.client_need<>p_subcategory then raise exception 'Subcategory does not match the question'; end if;
 insert into public.diagnostic_items(form_id,position,question_id,part,subcategory,subtopic,cj_step,difficulty)
 values(p_form,p_position,p_question,p_part,p_subcategory,nullif(btrim(p_subtopic),''),nullif(p_cj_step,''),nullif(p_difficulty,''))
 on conflict(form_id,position) do update set question_id=excluded.question_id,part=excluded.part,subcategory=excluded.subcategory,
  subtopic=excluded.subtopic,cj_step=excluded.cj_step,difficulty=excluded.difficulty;
end $$;

create function public.admin_diagnostic_remove_item(p_form uuid,p_position integer) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 delete from public.diagnostic_items i where i.form_id=p_form and i.position=p_position;
end $$;

create function public.admin_diagnostic_validate_form(p_form uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_items integer; v_problems jsonb:='[]'::jsonb; v_subs jsonb; v_parts jsonb;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from public.diagnostic_forms f where f.id=p_form) then raise exception 'Form not found'; end if;
 select count(*) into v_items from public.diagnostic_items i where i.form_id=p_form;
 if v_items<>150 then v_problems:=v_problems||to_jsonb('Form must contain exactly 150 items (has '||v_items||')'); end if;
 if exists(select 1 from generate_series(1,150) g(n) where not exists(select 1 from public.diagnostic_items i where i.form_id=p_form and i.position=g.n)) then
  v_problems:=v_problems||to_jsonb('Positions 1-150 must all be filled'::text); end if;
 select coalesce(jsonb_object_agg(x.part,x.n),'{}'::jsonb) into v_parts from (select i.part,count(*) n from public.diagnostic_items i where i.form_id=p_form group by 1) x;
 if coalesce((v_parts->>'A')::integer,0)<>100 or coalesce((v_parts->>'B')::integer,0)<>30 or coalesce((v_parts->>'C')::integer,0)<>10 or coalesce((v_parts->>'D')::integer,0)<>10 then
  v_problems:=v_problems||to_jsonb('Parts must be A=100, B=30, C=10, D=10'::text); end if;
 select coalesce(jsonb_agg(jsonb_build_object('subcategory',b.sub_name,'target',b.sub_target,'have',coalesce(c.n,0)) order by b.sub_sort),'[]'::jsonb) into v_subs
  from public.diagnostic_blueprint() b left join (select i.subcategory,count(*) n from public.diagnostic_items i where i.form_id=p_form group by 1) c on c.subcategory=b.sub_name;
 if exists(select 1 from public.diagnostic_blueprint() b left join (select i.subcategory,count(*) n from public.diagnostic_items i where i.form_id=p_form group by 1) c on c.subcategory=b.sub_name where coalesce(c.n,0)<>b.sub_target) then
  v_problems:=v_problems||to_jsonb('Subcategory counts must match the blueprint'::text); end if;
 if exists(select 1 from public.diagnostic_items i join public.questions q on q.id=i.question_id where i.form_id=p_form and not public.diagnostic_question_ok(q)) then
  v_problems:=v_problems||to_jsonb('Some questions are no longer eligible'::text); end if;
 return jsonb_build_object('items',v_items,'parts',v_parts,'subcategories',v_subs,'problems',v_problems,'valid',jsonb_array_length(v_problems)=0);
end $$;

create function public.admin_diagnostic_publish_form(p_form uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_check jsonb;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 perform 1 from public.diagnostic_forms f where f.id=p_form and f.status='draft' for update;
 if not found then raise exception 'Draft form not found'; end if;
 v_check:=public.admin_diagnostic_validate_form(p_form);
 if (v_check->>'valid')::boolean is not true then raise exception 'Form is incomplete'; end if;
 update public.diagnostic_forms set status='published',published_at=now() where id=p_form;
end $$;

create function public.admin_diagnostic_assign(p_form uuid,p_users uuid[],p_attempts integer default 1) returns integer
language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if p_users is null or cardinality(p_users)=0 or cardinality(p_users)>500 or p_attempts is null or p_attempts not between 1 and 10 then raise exception 'Invalid assignment'; end if;
 if not exists(select 1 from public.diagnostic_forms f where f.id=p_form and f.status='published') then raise exception 'Published form not found'; end if;
 insert into public.diagnostic_assignments(form_id,user_id,attempts_allowed,assigned_by)
 select p_form,p.id,p_attempts,auth.uid() from public.profiles p where p.id=any(p_users)
 on conflict(form_id,user_id) do update set attempts_allowed=excluded.attempts_allowed,assigned_by=excluded.assigned_by;
 get diagnostics v_count=row_count; return v_count;
end $$;

create function public.admin_get_diagnostic_report(p_attempt uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return (select jsonb_build_object('attempt_id',t.id,'user_id',t.user_id,'attempt_no',t.attempt_no,'submitted_at',t.submitted_at,'report',r.report,
  'error_tags',coalesce((select jsonb_agg(jsonb_build_object('question_id',e.question_id,'error_type',e.error_type,'note',e.note)) from public.diagnostic_error_tags e where e.attempt_id=t.id),'[]'::jsonb))
  from public.diagnostic_attempts t join public.diagnostic_reports r on r.attempt_id=t.id where t.id=p_attempt);
end $$;

create function public.admin_diagnostic_progress(p_user uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('attempt_id',t.id,'form',f.name,'attempt_no',t.attempt_no,'submitted_at',t.submitted_at,
  'pct',case when r.total>0 then round(100.0*r.correct/r.total,1) end,'subcategories',r.report->'subcategories') order by t.submitted_at)
  from public.diagnostic_attempts t join public.diagnostic_forms f on f.id=t.form_id join public.diagnostic_reports r on r.attempt_id=t.id where t.user_id=p_user),'[]'::jsonb);
end $$;

create function public.admin_diagnostic_list_attempts(p_form uuid,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 return jsonb_build_object('total',(select count(*) from public.diagnostic_attempts t where t.form_id=p_form and t.status='submitted'),
  'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select t.id attempt_id,t.user_id,p.full_name,t.attempt_no,t.submitted_at,
   case when r.total>0 then round(100.0*r.correct/r.total,1) end pct
   from public.diagnostic_attempts t join public.profiles p on p.id=t.user_id join public.diagnostic_reports r on r.attempt_id=t.id
   where t.form_id=p_form and t.status='submitted' order by t.submitted_at desc,t.id limit 50 offset least(greatest(p_page,0),10000)*50) x),'[]'::jsonb));
end $$;

create function public.admin_diagnostic_tag_error(p_attempt uuid,p_question uuid,p_type text,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Administrator access required'; end if;
 if p_type is null or p_type not in ('A','B','C','D','E') then raise exception 'Invalid error type'; end if;
 if not exists(select 1 from public.diagnostic_attempts t join public.diagnostic_items i on i.form_id=t.form_id and i.question_id=p_question
  where t.id=p_attempt and t.status='submitted') then raise exception 'Attempt or question not found'; end if;
 if exists(select 1 from public.diagnostic_answers a where a.attempt_id=p_attempt and a.question_id=p_question and a.is_correct) then raise exception 'Only missed questions can be tagged'; end if;
 insert into public.diagnostic_error_tags(attempt_id,question_id,error_type,note,tagged_by) values(p_attempt,p_question,p_type,nullif(btrim(p_note),''),auth.uid())
 on conflict(attempt_id,question_id) do update set error_type=excluded.error_type,note=excluded.note,tagged_by=excluded.tagged_by,tagged_at=now();
end $$;

-- ===== Student flow (assigned users only) =====
create function public.start_diagnostic(p_form uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_allowed integer; v_used integer; v_open uuid; v_id uuid;
begin
 if v_actor is null then raise exception 'Not authorized'; end if;
 perform 1 from public.profiles p where p.id=v_actor for update;
 if not found then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.diagnostic_forms f where f.id=p_form and f.status='published') then raise exception 'Diagnostic not available'; end if;
 select a.attempts_allowed into v_allowed from public.diagnostic_assignments a where a.form_id=p_form and a.user_id=v_actor;
 if v_allowed is null then raise exception 'Diagnostic not assigned'; end if;
 select t.id into v_open from public.diagnostic_attempts t where t.user_id=v_actor and t.form_id=p_form and t.status='in_progress';
 if v_open is not null then return v_open; end if;
 select count(*) into v_used from public.diagnostic_attempts t where t.user_id=v_actor and t.form_id=p_form;
 if v_used>=v_allowed then raise exception 'No diagnostic attempts remaining'; end if;
 insert into public.diagnostic_attempts(user_id,form_id,attempt_no) values(v_actor,p_form,v_used+1) returning id into v_id;
 return v_id;
end $$;

-- Never returns correct answers, rationale, strategy or NGN data while the attempt is open.
create function public.get_diagnostic_attempt(p_attempt uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t public.diagnostic_attempts;
begin
 select * into t from public.diagnostic_attempts x where x.id=p_attempt and x.user_id=auth.uid();
 if not found then raise exception 'Not authorized'; end if;
 if t.status<>'in_progress' then return jsonb_build_object('attempt_id',t.id,'status',t.status,'attempt_no',t.attempt_no); end if;
 return jsonb_build_object('attempt_id',t.id,'status',t.status,'attempt_no',t.attempt_no,'answered',(select count(*) from public.diagnostic_answers a where a.attempt_id=t.id),
  'items',(select jsonb_agg(jsonb_build_object('position',i.position,'question_id',i.question_id,'part',i.part,'question_type',q.question_type,'prompt',q.prompt,
    'choices',(select jsonb_agg(jsonb_build_object('id',c.x->>'id','text',c.x->>'text') order by c.ord) from jsonb_array_elements(q.choices) with ordinality c(x,ord)),
    'selected',(select a.answer->'ids' from public.diagnostic_answers a where a.attempt_id=t.id and a.question_id=i.question_id)) order by i.position)
   from public.diagnostic_items i join public.questions q on q.id=i.question_id where i.form_id=t.form_id));
end $$;

create function public.save_diagnostic_answer(p_attempt uuid,p_question uuid,p_ids text[],p_seconds integer default null) returns void
language plpgsql security definer set search_path=public as $$
declare t public.diagnostic_attempts; q public.questions; v_chosen text[]; v_correct text[];
begin
 select * into t from public.diagnostic_attempts x where x.id=p_attempt and x.user_id=auth.uid() for update;
 if not found or t.status<>'in_progress' then raise exception 'Not authorized'; end if;
 select qq.* into q from public.questions qq join public.diagnostic_items i on i.question_id=qq.id and i.form_id=t.form_id where qq.id=p_question;
 if not found then raise exception 'Question not in this diagnostic'; end if;
 if p_ids is null or cardinality(p_ids)=0 or cardinality(p_ids)>20 or exists(select 1 from unnest(p_ids) v(id) where v.id is null or not exists(select 1 from jsonb_array_elements(q.choices) c(x) where c.x->>'id'=v.id))
 then raise exception 'Select valid answer options'; end if;
 select array_agg(distinct v.id order by v.id) into v_chosen from unnest(p_ids) v(id);
 if q.question_type='mcq' and cardinality(v_chosen)<>1 then raise exception 'Select one answer'; end if;
 select array_agg(distinct v order by v) into v_correct from jsonb_array_elements_text(q.correct_answer->'ids') e(v);
 insert into public.diagnostic_answers(attempt_id,question_id,answer,is_correct,time_taken_seconds)
 values(p_attempt,p_question,jsonb_build_object('ids',to_jsonb(v_chosen)),v_chosen=v_correct,case when p_seconds between 0 and 3600 then p_seconds end)
 on conflict(attempt_id,question_id) do update set answer=excluded.answer,is_correct=excluded.is_correct,time_taken_seconds=excluded.time_taken_seconds,answered_at=now();
end $$;

create function public.submit_diagnostic(p_attempt uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.diagnostic_attempts;
begin
 select * into t from public.diagnostic_attempts x where x.id=p_attempt and x.user_id=auth.uid() for update;
 if not found then raise exception 'Not authorized'; end if;
 if t.status='submitted' then return (select r.report from public.diagnostic_reports r where r.attempt_id=t.id); end if;
 update public.diagnostic_attempts set status='submitted',submitted_at=now() where id=t.id;
 return public.diagnostic_build_report(t.id);
end $$;

create function public.get_my_diagnostic_report(p_attempt uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 return (select r.report from public.diagnostic_reports r join public.diagnostic_attempts t on t.id=r.attempt_id where t.id=p_attempt and t.user_id=auth.uid());
end $$;

-- Answers and rationale are released only after submission, to the owner.
create function public.get_my_diagnostic_review(p_attempt uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from public.diagnostic_attempts t where t.id=p_attempt and t.user_id=auth.uid() and t.status='submitted') then raise exception 'Not authorized'; end if;
 return (select jsonb_agg(jsonb_build_object('position',i.position,'question_id',i.question_id,'prompt',q.prompt,'selected',a.answer->'ids','is_correct',coalesce(a.is_correct,false),
   'correct_answer',q.correct_answer->'ids','rationale',q.rationale) order by i.position)
  from public.diagnostic_attempts t join public.diagnostic_items i on i.form_id=t.form_id join public.questions q on q.id=i.question_id
  left join public.diagnostic_answers a on a.attempt_id=t.id and a.question_id=i.question_id where t.id=p_attempt);
end $$;

create function public.my_diagnostic_progress() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 return coalesce((select jsonb_agg(jsonb_build_object('attempt_id',t.id,'form',f.name,'attempt_no',t.attempt_no,'submitted_at',t.submitted_at,
  'pct',case when r.total>0 then round(100.0*r.correct/r.total,1) end,'subcategories',r.report->'subcategories') order by t.submitted_at)
  from public.diagnostic_attempts t join public.diagnostic_forms f on f.id=t.form_id join public.diagnostic_reports r on r.attempt_id=t.id where t.user_id=auth.uid()),'[]'::jsonb);
end $$;

-- Grants: internal helpers are not callable by clients; client functions check identity/role inside.
revoke all on function public.diagnostic_build_report(uuid),public.diagnostic_items_guard(),public.diagnostic_quota(integer) from public,anon,authenticated;
grant execute on function public.diagnostic_build_report(uuid) to service_role;
revoke all on function public.admin_diagnostic_create_form(text),public.admin_diagnostic_propose_items(uuid,text,integer),
 public.admin_diagnostic_set_item(uuid,integer,uuid,text,text,text,text,text),public.admin_diagnostic_remove_item(uuid,integer),
 public.admin_diagnostic_validate_form(uuid),public.admin_diagnostic_publish_form(uuid),public.admin_diagnostic_assign(uuid,uuid[],integer),
 public.admin_get_diagnostic_report(uuid),public.admin_diagnostic_progress(uuid),public.admin_diagnostic_list_attempts(uuid,integer),
 public.admin_diagnostic_tag_error(uuid,uuid,text,text),public.start_diagnostic(uuid),public.get_diagnostic_attempt(uuid),
 public.save_diagnostic_answer(uuid,uuid,text[],integer),public.submit_diagnostic(uuid),public.get_my_diagnostic_report(uuid),
 public.get_my_diagnostic_review(uuid),public.my_diagnostic_progress() from public,anon;
grant execute on function public.admin_diagnostic_create_form(text),public.admin_diagnostic_propose_items(uuid,text,integer),
 public.admin_diagnostic_set_item(uuid,integer,uuid,text,text,text,text,text),public.admin_diagnostic_remove_item(uuid,integer),
 public.admin_diagnostic_validate_form(uuid),public.admin_diagnostic_publish_form(uuid),public.admin_diagnostic_assign(uuid,uuid[],integer),
 public.admin_get_diagnostic_report(uuid),public.admin_diagnostic_progress(uuid),public.admin_diagnostic_list_attempts(uuid,integer),
 public.admin_diagnostic_tag_error(uuid,uuid,text,text),public.start_diagnostic(uuid),public.get_diagnostic_attempt(uuid),
 public.save_diagnostic_answer(uuid,uuid,text[],integer),public.submit_diagnostic(uuid),public.get_my_diagnostic_report(uuid),
 public.get_my_diagnostic_review(uuid),public.my_diagnostic_progress() to authenticated;
commit;
