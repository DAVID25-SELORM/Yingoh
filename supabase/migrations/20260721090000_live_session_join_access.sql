-- Course-aware live-session discovery and a single audited join path for
-- students, instructors, and administrators.

drop policy if exists "schedules_read" on public.class_schedules;
create policy "schedules_read" on public.class_schedules
  for select to authenticated
  using (
    public.has_role(array['instructor', 'admin', 'super_admin', 'department_admin'])
    or instructor_id = auth.uid()
    or (
      course_id is not null
      and exists (
        select 1
        from public.course_memberships cm
        where cm.course_id = class_schedules.course_id
          and cm.user_id = auth.uid()
          and cm.status = 'enrolled'
      )
    )
    or (course_id is null and public.current_subscription_level() >= 3)
  );

create or replace function public.join_live_session(p_session_id uuid)
returns table (
  id uuid,
  meeting_url text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.class_schedules%rowtype;
  join_time timestamptz := now();
  allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join this session';
  end if;

  select * into target_session
  from public.class_schedules cs
  where cs.id = p_session_id;

  if not found or target_session.status in ('cancelled', 'completed') then
    raise exception 'This session is not available';
  end if;

  allowed := target_session.instructor_id = auth.uid()
    or public.has_role(array['instructor', 'admin', 'super_admin', 'department_admin'])
    or (
      target_session.course_id is not null
      and exists (
        select 1 from public.course_memberships cm
        where cm.course_id = target_session.course_id
          and cm.user_id = auth.uid()
          and cm.status = 'enrolled'
      )
    )
    or (target_session.course_id is null and public.current_subscription_level() >= 3);

  if not allowed then
    raise exception 'You are not enrolled or eligible for this session';
  end if;

  if join_time < target_session.starts_at - interval '30 minutes' then
    raise exception 'The room opens 30 minutes before the session starts';
  end if;

  if target_session.ends_at is not null and join_time > target_session.ends_at then
    raise exception 'This session has ended';
  end if;

  insert into public.attendance(session_id, user_id, joined_at)
  values (target_session.id, auth.uid(), join_time)
  on conflict (session_id, user_id) do update
    set joined_at = coalesce(public.attendance.joined_at, excluded.joined_at);

  return query select
    target_session.id,
    coalesce(target_session.meeting_url, 'https://meet.jit.si/nursefaculty-' || target_session.id::text),
    join_time;
end;
$$;

revoke all on function public.join_live_session(uuid) from public;
grant execute on function public.join_live_session(uuid) to authenticated;
