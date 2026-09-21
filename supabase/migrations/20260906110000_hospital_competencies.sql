begin;
create table if not exists public.competency_memberships (
 institution_id uuid references public.institution_accounts(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,
 role text not null default 'staff' check(role in ('staff','assessor','manager')),
 display_name text not null, primary key(institution_id,user_id)
);
create or replace function public.competency_staff(p_institution uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.has_role(array['admin','super_admin']) or exists(select 1 from public.competency_memberships where institution_id=p_institution and user_id=auth.uid() and role in ('assessor','manager'));
$$;
create table if not exists public.competency_assignments (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institution_accounts(id),
 user_id uuid not null references public.profiles(id), item_id uuid not null references public.learning_items(id),
 item_version integer not null, criteria_snapshot text not null, title text not null,
 assigned_by uuid not null default auth.uid() references public.profiles(id), due_on date not null,
 status text not null default 'assigned' check(status in ('assigned','submitted','competent','needs_development')),
 evidence text not null default '', feedback text not null default '', assessed_by uuid references public.profiles(id),
 assessed_at timestamptz, expires_on date, certificate_id uuid references public.user_certificates(id),
 created_at timestamptz not null default now(), foreign key(institution_id,user_id) references public.competency_memberships(institution_id,user_id)
);
alter table public.competency_memberships enable row level security;
alter table public.competency_assignments enable row level security;
drop policy if exists competency_members_read on public.competency_memberships;
create policy competency_members_read on public.competency_memberships for select to authenticated using(user_id=auth.uid() or public.competency_staff(institution_id));
drop policy if exists competency_members_admin on public.competency_memberships;
create policy competency_members_admin on public.competency_memberships for all to authenticated using(public.has_role(array['admin','super_admin'])) with check(public.has_role(array['admin','super_admin']));
drop policy if exists competency_assignments_read on public.competency_assignments;
create policy competency_assignments_read on public.competency_assignments for select to authenticated using(user_id=auth.uid() or public.competency_staff(institution_id));
revoke all on public.competency_memberships,public.competency_assignments from anon,authenticated;
grant select,insert,update,delete on public.competency_memberships to authenticated;
grant select on public.competency_assignments to authenticated;

create or replace function public.assign_competency(p_institution uuid,p_user uuid,p_item uuid,p_due date) returns uuid language plpgsql security definer set search_path=public as $$
declare item public.learning_items%rowtype; assignment uuid;
begin
 if auth.uid() is null or not public.competency_staff(p_institution) then raise exception 'Institution assessor access required'; end if;
 if p_due < current_date then raise exception 'Choose today or a future due date'; end if;
 select * into item from public.learning_items where id=p_item and kind='competency' and status='published' and next_review_on > current_date;
 if not found then raise exception 'Choose a current reviewed competency'; end if;
 insert into public.competency_assignments(institution_id,user_id,item_id,item_version,criteria_snapshot,title,due_on)
 values(p_institution,p_user,p_item,item.version,item.body,item.title,p_due) returning id into assignment;
 return assignment;
end; $$;
create or replace function public.submit_competency_evidence(p_assignment uuid,p_evidence text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or length(trim(p_evidence))<10 or length(p_evidence)>12000 then raise exception 'Provide evidence between 10 and 12,000 characters'; end if;
 update public.competency_assignments set evidence=p_evidence,status='submitted'
 where id=p_assignment and user_id=auth.uid() and status in ('assigned','needs_development','submitted');
 if not found then raise exception 'This assignment cannot accept evidence'; end if;
end; $$;
create or replace function public.assess_competency(p_assignment uuid,p_pass boolean,p_feedback text,p_expiry date) returns void language plpgsql security definer set search_path=public as $$
declare a public.competency_assignments%rowtype; cert uuid; code text; institution text;
begin
 select * into a from public.competency_assignments where id=p_assignment for update;
 if not found or auth.uid() is null or not public.competency_staff(a.institution_id) or a.user_id=auth.uid() then raise exception 'An independent institution assessor is required'; end if;
 if a.status <> 'submitted' or length(trim(p_feedback))<10 then raise exception 'Assess submitted evidence and record feedback'; end if;
 if p_pass and (p_expiry is null or p_expiry<=current_date) then raise exception 'Set a future reassessment date'; end if;
 if p_pass then
   -- Brand from the institution account; the assessment remains separate from course completion.
   select name into institution from public.institution_accounts where id=a.institution_id;
   code:='NF-COMP-'||upper(replace(gen_random_uuid()::text,'-',''));
   insert into public.user_certificates(user_id,type,category,title,course_name,institution_name,verification_code,certificate_number,expires_at,status)
   values(a.user_id,'professional','professional',a.title,a.title,coalesce(institution,'NurseFaculty'),code,code,p_expiry::timestamptz,'active') returning id into cert;
 end if;
 update public.competency_assignments set status=case when p_pass then 'competent' else 'needs_development' end,
 feedback=p_feedback,assessed_by=auth.uid(),assessed_at=now(),expires_on=case when p_pass then p_expiry end,certificate_id=cert where id=a.id;
end; $$;
create or replace function public.add_competency_member(p_institution uuid,p_email text,p_role text) returns void language plpgsql security definer set search_path=public as $$
declare u public.profiles%rowtype;
begin
 if not public.has_role(array['admin','super_admin']) then raise exception 'Platform administrator access required'; end if;
 select * into u from public.profiles where lower(email)=lower(trim(p_email));
 if not found then raise exception 'No registered user matches this email'; end if;
 insert into public.competency_memberships(institution_id,user_id,role,display_name) values(p_institution,u.id,p_role,u.full_name)
 on conflict(institution_id,user_id) do update set role=excluded.role,display_name=excluded.display_name;
end; $$;
revoke all on function public.competency_staff(uuid),public.assign_competency(uuid,uuid,uuid,date),public.submit_competency_evidence(uuid,text),public.assess_competency(uuid,boolean,text,date),public.add_competency_member(uuid,text,text) from public,anon;
grant execute on function public.competency_staff(uuid),public.assign_competency(uuid,uuid,uuid,date),public.submit_competency_evidence(uuid,text),public.assess_competency(uuid,boolean,text,date),public.add_competency_member(uuid,text,text) to authenticated;
commit;
