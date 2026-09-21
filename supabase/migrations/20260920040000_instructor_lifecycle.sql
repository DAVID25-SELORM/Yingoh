begin;

-- Auth owns account verification. Browser-supplied metadata is never acceptance
-- evidence, and the historical onboarding_email_sent flag is not delivery proof.
alter table public.instructor_profiles
  drop constraint if exists instructor_profiles_account_status_check;
alter table public.instructor_profiles
  alter column account_status set default 'onboarding',
  add column invited_at timestamptz,
  add column invitation_accepted_at timestamptz,
  add column onboarding_completed_at timestamptz;

create function public.instructor_profile_complete(p public.instructor_profiles)
returns boolean language sql immutable set search_path=public as $$
  select coalesce(length(trim(p.department))>0
    and length(trim(p.nursing_specialty))>0
    and length(trim(p.professional_title))>0
    and length(trim(p.institution))>0,false)
$$;
revoke all on function public.instructor_profile_complete(public.instructor_profiles) from public;

insert into public.instructor_profiles(user_id,account_status)
select ur.user_id,'onboarding' from public.user_roles ur
join public.roles r on r.id=ur.role_id where r.name='instructor'
on conflict(user_id) do nothing;

update public.instructor_profiles p set
 account_status=case
  when p.account_status='suspended' then 'suspended'
  when p.account_status in ('deactivated','invitation_expired') then 'disabled'
  when u.invited_at is not null and u.email_confirmed_at is null then 'invited'
  when u.email_confirmed_at is not null and public.instructor_profile_complete(p)
       and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) then 'active'
  else 'onboarding' end,
 invited_at=u.invited_at,
 invitation_accepted_at=case when u.invited_at is not null then u.email_confirmed_at end
from auth.users u where u.id=p.user_id;
-- Do not manufacture a historical onboarding completion date.
alter table public.instructor_profiles add constraint instructor_profiles_account_status_check
 check(account_status in ('invitation_pending','invited','onboarding','active','suspended','disabled'));

drop policy if exists instructor_profiles_admin_or_own on public.instructor_profiles;
create policy instructor_profiles_read on public.instructor_profiles for select to authenticated
 using(user_id=auth.uid() or (public.has_role(array['admin','super_admin']) and public.has_permission('users.view')));
-- RPCs whitelist professional fields. No browser can update status, permissions,
-- identity or acceptance/completion dates directly, including an administrator.
revoke insert,update,delete on public.instructor_profiles from authenticated;
grant select on public.instructor_profiles to authenticated;

create function public.ensure_instructor_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.roles where id=new.role_id and name='instructor') then
  insert into public.instructor_profiles(user_id,account_status) values(new.user_id,'onboarding')
  on conflict(user_id) do nothing;
  insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
  values(auth.uid(),'INSTRUCTOR_ROLE_ASSIGNED','instructor_profiles',new.user_id,'{}');
 end if;
 return new;
end $$;
revoke all on function public.ensure_instructor_profile() from public,anon,authenticated;
create trigger ensure_instructor_profile after insert on public.user_roles
for each row execute function public.ensure_instructor_profile();

create function public.accept_instructor_invitation() returns trigger
language plpgsql security definer set search_path=public as $$
declare changed_id uuid;
begin
 -- Auth confirmation is trusted; profile INSERT and arbitrary client callbacks
 -- are not. A cancelled/disabled or suspended record cannot be revived here.
 if new.invited_at is not null and new.email_confirmed_at is not null
    and old.email_confirmed_at is null then
  update public.instructor_profiles set account_status='onboarding',
   invitation_accepted_at=new.email_confirmed_at,updated_at=now()
  where user_id=new.id and account_status in ('invitation_pending','invited')
  returning user_id into changed_id;
  if changed_id is not null then
   update public.pending_invites set status='accepted',accepted_at=new.email_confirmed_at
    where lower(email)=lower(new.email) and role_name='instructor' and status='pending';
   insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
    values(new.id,'INSTRUCTOR_ONBOARDING_STARTED','instructor_profiles',new.id,'{"source":"auth_confirmation"}');
  end if;
 end if;
 return new;
end $$;
revoke all on function public.accept_instructor_invitation() from public,anon,authenticated;
create trigger accept_instructor_invitation after update of email_confirmed_at on auth.users
for each row execute function public.accept_instructor_invitation();

create function public.save_instructor_profile(p_fields jsonb,p_user_id uuid default auth.uid())
returns void language plpgsql security definer set search_path=public as $$
declare previous public.instructor_profiles; next_profile public.instructor_profiles;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_user_id is distinct from auth.uid() and not
  (public.has_role(array['admin','super_admin']) and public.has_permission('users.edit')) then
  raise exception 'Not authorized';
 end if;
 if jsonb_typeof(p_fields) is distinct from 'object' or exists(
  select 1 from jsonb_each(p_fields) f where f.key not in
   ('department','nursing_specialty','professional_title','institution','staff_id')
   or jsonb_typeof(f.value) not in ('string','null') or length(f.value#>>'{}')>200
 ) then raise exception 'Only supported professional fields of up to 200 characters are permitted'; end if;
 select * into previous from public.instructor_profiles where user_id=p_user_id for update;
 if not found then raise exception 'Instructor profile not found'; end if;
 if p_user_id=auth.uid() and previous.account_status not in ('onboarding','active') then
  raise exception 'Instructor setup is not available for this account';
 end if;
 next_profile:=jsonb_populate_record(previous,p_fields);
 update public.instructor_profiles set
  department=nullif(trim(next_profile.department),''),
  nursing_specialty=nullif(trim(next_profile.nursing_specialty),''),
  professional_title=nullif(trim(next_profile.professional_title),''),
  institution=nullif(trim(next_profile.institution),''),staff_id=nullif(trim(next_profile.staff_id),''),
  account_status=case when previous.account_status='active'
   and not public.instructor_profile_complete(next_profile) then 'onboarding' else previous.account_status end,
  updated_at=now() where user_id=p_user_id;
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(auth.uid(),'INSTRUCTOR_PROFILE_UPDATED','instructor_profiles',p_user_id,
  jsonb_build_object('before',jsonb_build_object('department',previous.department,'nursing_specialty',previous.nursing_specialty,
   'professional_title',previous.professional_title,'institution',previous.institution,'staff_id',previous.staff_id),
   'after',p_fields));
end $$;
revoke all on function public.save_instructor_profile(jsonb,uuid) from public,anon;
grant execute on function public.save_instructor_profile(jsonb,uuid) to authenticated;

create function public.complete_instructor_onboarding() returns void
language plpgsql security definer set search_path=public as $$
declare p public.instructor_profiles;
begin
 if auth.uid() is null or not public.has_role(array['instructor']) then raise exception 'Instructor access required'; end if;
 select * into p from public.instructor_profiles where user_id=auth.uid() for update;
 if not found or p.account_status not in ('onboarding','active') then raise exception 'Onboarding is not available'; end if;
 if not public.instructor_profile_complete(p) then raise exception 'Complete the required professional profile fields'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
   and nullif(u.encrypted_password,'') is not null) then raise exception 'Complete secure account setup first'; end if;
 if p.account_status='active' then return; end if;
 update public.instructor_profiles set account_status='active',onboarding_completed_at=now(),updated_at=now()
 where user_id=auth.uid();
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(auth.uid(),'INSTRUCTOR_ONBOARDING_COMPLETED','instructor_profiles',auth.uid(),'{}');
end $$;
revoke all on function public.complete_instructor_onboarding() from public,anon;
grant execute on function public.complete_instructor_onboarding() to authenticated;

create function public.admin_set_instructor_status(p_user_id uuid,p_status text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare previous public.instructor_profiles;
begin
 if auth.uid() is null or not(public.has_role(array['admin','super_admin']) and public.has_permission('users.suspend')) then
  raise exception 'Not authorized'; end if;
 if p_status not in ('suspended','disabled','onboarding') or p_status is null
   or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Valid status and reason required'; end if;
 if p_user_id=auth.uid() then raise exception 'Cannot change your own administrative status'; end if;
 if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
  where ur.user_id=p_user_id and r.name='super_admin') and not public.has_role(array['super_admin']) then
  raise exception 'Only a Super Admin can modify a Super Admin account'; end if;
 select * into previous from public.instructor_profiles where user_id=p_user_id for update;
 if not found then raise exception 'Instructor profile not found'; end if;
 if previous.account_status=p_status then return; end if;
 if p_status='onboarding' and previous.account_status not in ('suspended','disabled') then raise exception 'Account is not restricted'; end if;
 -- Reactivation never skips profile/account verification; the instructor must
 -- complete onboarding again. Invitation state is not acceptance evidence.
 update public.instructor_profiles set account_status=p_status,updated_at=now() where user_id=p_user_id;
 insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
 values(auth.uid(),case p_status when 'suspended' then 'INSTRUCTOR_SUSPENDED' when 'disabled' then 'INSTRUCTOR_DISABLED'
  else 'INSTRUCTOR_REACTIVATED' end,'instructor_profiles',p_user_id,
  jsonb_build_object('before',previous.account_status,'after',p_status,'reason',trim(p_reason)));
end $$;
revoke all on function public.admin_set_instructor_status(uuid,text,text) from public,anon;
grant execute on function public.admin_set_instructor_status(uuid,text,text) to authenticated;

-- Preserve legacy non-instructor role invitations, but never equate creating a
-- profile with accepting an instructor invitation. Cancelled rows cannot grant
-- any platform role. Instructor provisioning must explicitly assign its role.
create or replace function public.handle_pending_invite() returns trigger
language plpgsql security definer set search_path=public as $$
declare invite public.pending_invites; selected_role_id uuid;
begin
 select pi.* into invite from public.pending_invites pi
 where lower(pi.email)=lower(new.email) and pi.accepted_at is null
  and pi.expires_at>now() and pi.status='pending' and pi.role_name<>'instructor'
 limit 1;
 if invite.id is not null then
  select r.id into selected_role_id from public.roles r where r.name=invite.role_name;
  if selected_role_id is not null then
   insert into public.user_roles(user_id,role_id) values(new.id,selected_role_id) on conflict do nothing;
  end if;
  update public.pending_invites set accepted_at=now(),status='accepted' where id=invite.id;
 end if;
 return new;
end $$;
revoke all on function public.handle_pending_invite() from public,anon,authenticated;

commit;
