-- Replace the legacy "write own" policy, which only compared user IDs and
-- therefore allowed any authenticated account to create an instructor session.

drop policy if exists "schedules_own_write" on public.class_schedules;
drop policy if exists "schedules_staff_write" on public.class_schedules;

create policy "schedules_staff_write" on public.class_schedules
  for all to authenticated
  using (
    public.has_role(array['admin', 'super_admin', 'department_admin'])
    or (
      auth.uid() = instructor_id
      and public.has_role(array['instructor'])
      and (course_id is null or public.is_course_staff(course_id))
    )
  )
  with check (
    public.has_role(array['admin', 'super_admin', 'department_admin'])
    or (
      auth.uid() = instructor_id
      and public.has_role(array['instructor'])
      and (course_id is null or public.is_course_staff(course_id))
    )
  );
