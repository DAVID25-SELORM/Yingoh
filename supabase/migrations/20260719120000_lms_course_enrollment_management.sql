-- Instructor enrollment management: approve, reject, remove, and complete
-- course memberships from an instructor/admin course roster.

create or replace function public.update_course_membership_status(
  p_course_id uuid,
  p_user_id uuid,
  p_status text
)
returns public.course_memberships
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  updated_membership public.course_memberships%rowtype;
begin
  if p_status not in ('invited', 'pending_approval', 'enrolled', 'removed', 'completed', 'rejected') then
    raise exception 'Invalid course membership status: %', p_status;
  end if;

  if not public.is_course_staff(p_course_id) then
    raise exception 'Not authorized for this course';
  end if;

  update public.course_memberships
  set status = p_status,
      approved_by = case when p_status = 'enrolled' then auth.uid() else approved_by end,
      approved_at = case when p_status = 'enrolled' then now() else approved_at end,
      updated_at = now()
  where course_id = p_course_id
    and user_id = p_user_id
    and membership_role = 'student'
  returning * into updated_membership;

  if updated_membership.course_id is null then
    raise exception 'Student enrollment not found';
  end if;

  return updated_membership;
end;
$$;

grant execute on function public.update_course_membership_status(uuid, uuid, text) to authenticated;

create or replace function public.get_course_roster(p_course_id uuid)
returns table(
  course_id uuid,
  user_id uuid,
  membership_role text,
  status text,
  student_id text,
  joined_at timestamptz,
  updated_at timestamptz,
  full_name text,
  email text,
  country text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_course_staff(p_course_id) then
    raise exception 'Not authorized for this course';
  end if;

  return query
  select
    cm.course_id,
    cm.user_id,
    cm.membership_role,
    cm.status,
    cm.student_id,
    cm.joined_at,
    cm.updated_at,
    p.full_name,
    p.email,
    p.country
  from public.course_memberships cm
  join public.profiles p on p.id = cm.user_id
  where cm.course_id = p_course_id
  order by
    case cm.status
      when 'pending_approval' then 1
      when 'invited' then 2
      when 'enrolled' then 3
      when 'completed' then 4
      when 'removed' then 5
      when 'rejected' then 6
      else 9
    end,
    cm.joined_at desc;
end;
$$;

grant execute on function public.get_course_roster(uuid) to authenticated;

create or replace function public.set_course_enrollment_link_active(
  p_link_id uuid,
  p_is_active boolean
)
returns public.course_enrollment_links
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target_course uuid;
  updated_link public.course_enrollment_links%rowtype;
begin
  select course_id into target_course
  from public.course_enrollment_links
  where id = p_link_id;

  if target_course is null then
    raise exception 'Enrollment link not found';
  end if;

  if not public.is_course_staff(target_course) then
    raise exception 'Not authorized for this course';
  end if;

  update public.course_enrollment_links
  set is_active = p_is_active,
      updated_at = now()
  where id = p_link_id
  returning * into updated_link;

  return updated_link;
end;
$$;

grant execute on function public.set_course_enrollment_link_active(uuid, boolean) to authenticated;
