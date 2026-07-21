-- Accurate live-session attendance counts and leave-time duration tracking.

create or replace function public.leave_live_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_time timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  update public.attendance
  set left_at = leave_time,
      duration_minutes = greatest(0, floor(extract(epoch from (leave_time - joined_at)) / 60)::integer)
  where session_id = p_session_id
    and user_id = auth.uid()
    and joined_at is not null;
end;
$$;

revoke all on function public.leave_live_session(uuid) from public;
grant execute on function public.leave_live_session(uuid) to authenticated;

create or replace function public.get_live_session_attendee_counts(p_session_ids uuid[])
returns table (session_id uuid, attendee_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select cs.id, count(a.user_id)
  from public.class_schedules cs
  left join public.attendance a on a.session_id = cs.id and a.joined_at is not null
  where cs.id = any(coalesce(p_session_ids, array[]::uuid[]))
    and (
      public.has_role(array['admin', 'super_admin', 'department_admin'])
      or cs.instructor_id = auth.uid()
      or (cs.course_id is not null and public.is_course_staff(cs.course_id))
      or exists (
        select 1 from public.course_memberships cm
        where cm.course_id = cs.course_id
          and cm.user_id = auth.uid()
          and cm.status = 'enrolled'
      )
      or (
        cs.course_id is null
        and (
          public.current_subscription_level() >= 3
          or public.has_role(array['instructor'])
        )
      )
    )
  group by cs.id;
$$;

revoke all on function public.get_live_session_attendee_counts(uuid[]) from public;
grant execute on function public.get_live_session_attendee_counts(uuid[]) to authenticated;
