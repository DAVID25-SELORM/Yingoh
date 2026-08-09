-- Production hardening following the August 2026 end-to-end audit.
-- This migration intentionally corrects applied policies/functions in place.

-- Legal policy versions and immutable user acceptance evidence.
create table if not exists public.legal_policy_versions (
  policy_type text not null check (policy_type in ('terms', 'refund', 'privacy', 'cookie')),
  version text not null,
  effective_at timestamptz not null,
  is_active boolean not null default false,
  document_path text not null,
  created_at timestamptz not null default now(),
  primary key (policy_type, version)
);

create unique index if not exists legal_policy_one_active_per_type
  on public.legal_policy_versions(policy_type) where is_active;

insert into public.legal_policy_versions(policy_type, version, effective_at, is_active, document_path)
values
  ('terms', '2026-08-08', '2026-08-08T00:00:00Z', true, '/legal/terms'),
  ('refund', '2026-08-08', '2026-08-08T00:00:00Z', true, '/legal/refund')
on conflict (policy_type, version) do update set
  effective_at = excluded.effective_at,
  is_active = excluded.is_active,
  document_path = excluded.document_path;

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  terms_version text not null,
  refund_policy_version text not null,
  accepted_at timestamptz not null default now(),
  acceptance_context text not null check (acceptance_context in ('signup', 'checkout', 'course_join')),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, terms_version, refund_policy_version, acceptance_context)
);

alter table public.legal_policy_versions enable row level security;
alter table public.user_legal_acceptances enable row level security;
drop policy if exists "legal_policy_versions_public_read" on public.legal_policy_versions;
create policy "legal_policy_versions_public_read" on public.legal_policy_versions
  for select to anon, authenticated using (is_active);
drop policy if exists "legal_acceptances_own_read" on public.user_legal_acceptances;
create policy "legal_acceptances_own_read" on public.user_legal_acceptances
  for select to authenticated using (user_id = auth.uid() or public.has_role(array['admin','super_admin']));

create or replace function public.record_legal_acceptance(
  p_terms_version text,
  p_refund_policy_version text,
  p_context text,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.user_legal_acceptances
language plpgsql volatile security definer set search_path = public
as $$
declare result public.user_legal_acceptances;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_context not in ('signup', 'checkout', 'course_join') then raise exception 'Invalid acceptance context'; end if;
  if not exists (select 1 from public.legal_policy_versions where policy_type='terms' and version=p_terms_version and is_active) then
    raise exception 'Terms version is not active';
  end if;
  if not exists (select 1 from public.legal_policy_versions where policy_type='refund' and version=p_refund_policy_version and is_active) then
    raise exception 'Refund policy version is not active';
  end if;
  insert into public.user_legal_acceptances(user_id, terms_version, refund_policy_version, acceptance_context, user_agent, metadata)
  values(auth.uid(), p_terms_version, p_refund_policy_version, p_context, left(p_user_agent, 1000), coalesce(p_metadata, '{}'::jsonb))
  on conflict(user_id, terms_version, refund_policy_version, acceptance_context) do update
    set accepted_at=now(), user_agent=excluded.user_agent, metadata=excluded.metadata
  returning * into result;
  return result;
end;
$$;
revoke all on function public.record_legal_acceptance(text,text,text,text,jsonb) from public, anon;
grant execute on function public.record_legal_acceptance(text,text,text,text,jsonb) to authenticated;

-- Email-confirmation projects may not return a session immediately after signup,
-- so persist signup consent from signed auth metadata when the profile is created.
create or replace function public.capture_signup_legal_acceptance()
returns trigger language plpgsql security definer set search_path = public
as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id=new.id;
  if coalesce((meta->>'legal_accepted')::boolean, false)
     and nullif(meta->>'terms_version','') is not null
     and nullif(meta->>'refund_policy_version','') is not null then
    insert into public.user_legal_acceptances(
      user_id, terms_version, refund_policy_version, accepted_at, acceptance_context, metadata
    ) values(
      new.id, meta->>'terms_version', meta->>'refund_policy_version',
      coalesce((meta->>'legal_accepted_at')::timestamptz, now()), 'signup',
      jsonb_build_object('source','auth_signup_metadata')
    ) on conflict(user_id,terms_version,refund_policy_version,acceptance_context) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists capture_signup_legal_acceptance on public.profiles;
create trigger capture_signup_legal_acceptance after insert on public.profiles
  for each row execute function public.capture_signup_legal_acceptance();

-- Refund requests: customers may request; only finance staff may decide/process.
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.billing_transactions(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  amount_paid numeric(12,2) not null check (amount_paid >= 0),
  requested_amount numeric(12,2) not null check (requested_amount > 0 and requested_amount <= amount_paid),
  reason text not null check (length(trim(reason)) between 10 and 2000),
  evidence_urls text[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','refund_processing','refunded')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  decision_reason text,
  decided_at timestamptz,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists refund_requests_one_open_per_transaction
  on public.refund_requests(transaction_id)
  where status in ('submitted','under_review','approved','refund_processing');
alter table public.refund_requests enable row level security;
create policy "refund_requests_own_read" on public.refund_requests for select to authenticated
  using (requester_id=auth.uid() or public.has_role(array['finance','admin','super_admin']));
create policy "refund_requests_own_insert" on public.refund_requests for insert to authenticated
  with check (requester_id=auth.uid() and status='submitted' and reviewed_by is null and decided_at is null
    and exists(select 1 from public.billing_transactions t where t.id=transaction_id and t.user_id=auth.uid() and t.status='paid' and requested_amount <= t.amount));
create policy "refund_requests_finance_update" on public.refund_requests for update to authenticated
  using (public.has_role(array['finance','admin','super_admin']))
  with check (public.has_role(array['finance','admin','super_admin']));
grant select, insert, update on public.refund_requests to authenticated;

-- Audit records must identify the authenticated actor. Service-role writes bypass RLS.
delete from public.role_permissions rp
using public.roles r
where rp.role_id=r.id and r.name='student' and rp.permission_id='resources.upload';

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert_actor_only" on public.audit_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    and (user_email is null or lower(user_email) = lower(coalesce(auth.jwt()->>'email','')))
  );

-- Do not expose enrollment restriction arrays through anonymous table reads.
drop policy if exists "enrollment_links_public_read" on public.course_enrollment_links;
create policy "enrollment_links_staff_read" on public.course_enrollment_links for select to authenticated
  using (public.is_course_staff(course_id) or public.has_role(array['admin','super_admin']));
revoke select on public.course_enrollment_links from anon;

create or replace function public.join_course_by_enrollment_code(p_code text, p_student_id text default null)
returns text language plpgsql volatile security definer set search_path = public
as $$
declare
  link public.course_enrollment_links%rowtype;
  current_count integer;
  target_status text;
  user_email text;
  email_domain text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into link from public.course_enrollment_links
    where upper(code)=upper(trim(p_code)) and is_active=true for update;
  if link.id is null then raise exception 'Enrollment link not found or disabled'; end if;
  if link.expires_at is not null and link.expires_at < now() then raise exception 'Enrollment link has expired'; end if;

  user_email := lower(coalesce(auth.jwt()->>'email',''));
  email_domain := split_part(user_email, '@', 2);
  if cardinality(link.allowed_email_domains) > 0
     and not (email_domain = any(select lower(trim(value)) from unnest(link.allowed_email_domains) value)) then
    raise exception 'Your email domain is not eligible for this course';
  end if;
  if cardinality(link.allowed_student_ids) > 0
     and (nullif(trim(p_student_id),'') is null or not (trim(p_student_id) = any(link.allowed_student_ids))) then
    raise exception 'A valid authorized student ID is required';
  end if;

  select count(*) into current_count from public.course_memberships
    where course_id=link.course_id and status in ('enrolled','pending_approval');
  if coalesce(link.max_students, 0) > 0 and current_count >= link.max_students then raise exception 'This course is full'; end if;
  target_status := case when link.enrollment_method='open' and not link.require_approval then 'enrolled' else 'pending_approval' end;
  insert into public.course_memberships(course_id,user_id,membership_role,status,student_id)
  values(link.course_id,auth.uid(),'student',target_status,nullif(trim(p_student_id),''))
  on conflict(course_id,user_id) do update set
    status=case when course_memberships.status='enrolled' then 'enrolled' else excluded.status end,
    student_id=coalesce(excluded.student_id,course_memberships.student_id), updated_at=now();
  return target_status;
end;
$$;

-- Course-scoped assignment and grading policies.
drop policy if exists "assignments_write" on public.assignments;
create policy "assignments_course_staff_write" on public.assignments for all to authenticated
  using (public.has_role(array['admin','super_admin']) or (course_id is not null and public.is_course_staff(course_id)))
  with check (public.has_role(array['admin','super_admin']) or (course_id is not null and public.is_course_staff(course_id)));
drop policy if exists "assignments_read" on public.assignments;
create policy "assignments_course_read" on public.assignments for select to authenticated using (
  public.has_role(array['admin','super_admin']) or public.is_course_staff(course_id)
  or (public.current_subscription_level() >= 3 and exists(
    select 1 from public.course_memberships cm where cm.course_id=assignments.course_id and cm.user_id=auth.uid() and cm.status='enrolled'
  ))
);
drop policy if exists "submissions_instructor" on public.assignment_submissions;
create policy "submissions_course_staff" on public.assignment_submissions for all to authenticated
  using (public.has_role(array['admin','super_admin']) or exists(
    select 1 from public.assignments a where a.id=assignment_submissions.assignment_id and public.is_course_staff(a.course_id)
  ))
  with check (public.has_role(array['admin','super_admin']) or exists(
    select 1 from public.assignments a where a.id=assignment_submissions.assignment_id and public.is_course_staff(a.course_id)
  ));
drop policy if exists "submissions_insert" on public.assignment_submissions;
create policy "submissions_enrolled_insert" on public.assignment_submissions for insert to authenticated with check (
  user_id=auth.uid() and public.current_subscription_level() >= 3 and exists(
    select 1 from public.assignments a join public.course_memberships cm on cm.course_id=a.course_id
    where a.id=assignment_id and cm.user_id=auth.uid() and cm.status='enrolled' and cm.membership_role='student'
  )
);

-- Daily question content is sanitized until the authenticated learner has answered.
create or replace function public.get_daily_question_content()
returns table(
  daily_question_id uuid, question_id uuid, question_date date, topic text, question_type text,
  prompt text, choices jsonb, strategy text, reference_url text, existing_attempt jsonb,
  correct_answer jsonb, rationale text
)
language sql volatile security definer set search_path = public
as $$
  with dq as (select (public.get_or_create_daily_question()).*)
  select dq.id, q.id, dq.date, q.topic, q.question_type, q.prompt, q.choices,
    case when a.id is not null then q.strategy else null end,
    case when a.id is not null then q.reference_url else null end,
    case when a.id is not null then to_jsonb(a) else null end,
    case when a.id is not null then q.correct_answer else null end,
    case when a.id is not null then q.rationale else null end
  from dq join public.questions q on q.id=dq.question_id
  left join public.daily_question_attempts a on a.daily_question_id=dq.id and a.user_id=auth.uid();
$$;
revoke all on function public.get_daily_question_content() from public, anon;
grant execute on function public.get_daily_question_content() to authenticated;

create or replace function public.submit_daily_question_answer_secure(p_daily_question_id uuid, p_selected_ids text[])
returns table(attempt jsonb, correct_answer jsonb, rationale text, strategy text, reference_url text)
language plpgsql volatile security definer set search_path = public
as $$
declare saved public.daily_question_attempts; q public.questions%rowtype;
begin
  saved := public.submit_daily_question_answer(p_daily_question_id,p_selected_ids);
  select * into q from public.questions where id=saved.question_id;
  return query select to_jsonb(saved), q.correct_answer, q.rationale, q.strategy, q.reference_url;
end;
$$;
revoke all on function public.submit_daily_question_answer_secure(uuid,text[]) from public, anon;
grant execute on function public.submit_daily_question_answer_secure(uuid,text[]) to authenticated;

-- Learner question content is delivered by question-service without scoring keys.
-- Staff retain their separate management/review read policies.
drop policy if exists "questions_read_authenticated" on public.questions;

create or replace function public.complete_exam_session_secure(p_session_id uuid, p_time_used_seconds integer)
returns public.exam_sessions
language plpgsql volatile security definer set search_path = public
as $$
declare result public.exam_sessions; answer_count integer; correct_count integer;
begin
  select count(*), count(*) filter(where is_correct) into answer_count, correct_count
  from public.exam_session_answers a join public.exam_sessions e on e.id=a.session_id
  where e.id=p_session_id and e.user_id=auth.uid() and e.status='active';
  if not exists(select 1 from public.exam_sessions where id=p_session_id and user_id=auth.uid() and status='active') then
    raise exception 'Active exam session not found';
  end if;
  update public.exam_sessions set
    status='completed', correct_count=complete_exam_session_secure.correct_count,
    total_questions=greatest(answer_count,1),
    score_pct=round((correct_count::numeric / greatest(answer_count,1))*100,2),
    time_used_seconds=greatest(coalesce(p_time_used_seconds,0),0), completed_at=now()
  where id=p_session_id returning * into result;
  return result;
end;
$$;
revoke all on function public.complete_exam_session_secure(uuid,integer) from public, anon;
grant execute on function public.complete_exam_session_secure(uuid,integer) to authenticated;
drop policy if exists "exam_sessions_update_own" on public.exam_sessions;

-- Unscoped live sessions are reserved for administrators.
drop policy if exists "schedules_staff_write" on public.class_schedules;
create policy "schedules_staff_write" on public.class_schedules for all to authenticated
  using (public.has_role(array['admin','super_admin','department_admin']) or
    (auth.uid()=instructor_id and course_id is not null and public.has_role(array['instructor']) and public.is_course_staff(course_id)))
  with check (public.has_role(array['admin','super_admin','department_admin']) or
    (auth.uid()=instructor_id and course_id is not null and public.has_role(array['instructor']) and public.is_course_staff(course_id)));

grant select on public.legal_policy_versions to anon, authenticated;
grant select on public.user_legal_acceptances to authenticated;
