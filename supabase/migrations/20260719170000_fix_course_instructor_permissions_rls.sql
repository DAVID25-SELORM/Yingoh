-- Fix course_instructor_permissions RLS recursion.
-- The previous owner-manage policy queried course_instructor_permissions
-- from inside a policy on the same table, which can cause PostgREST 500s.

drop policy if exists "course_instructor_permissions_staff_read" on public.course_instructor_permissions;
drop policy if exists "course_instructor_permissions_owner_manage" on public.course_instructor_permissions;
drop policy if exists "course_instructor_permissions_read_safe" on public.course_instructor_permissions;
drop policy if exists "course_instructor_permissions_admin_insert" on public.course_instructor_permissions;
drop policy if exists "course_instructor_permissions_admin_update" on public.course_instructor_permissions;
drop policy if exists "course_instructor_permissions_admin_delete" on public.course_instructor_permissions;

create policy "course_instructor_permissions_read_safe" on public.course_instructor_permissions
  for select to authenticated
  using (
    public.has_role(array['admin', 'super_admin', 'department_admin'])
    or public.is_course_staff(course_id)
  );

create policy "course_instructor_permissions_admin_insert" on public.course_instructor_permissions
  for insert to authenticated
  with check (public.has_role(array['admin', 'super_admin', 'department_admin']));

create policy "course_instructor_permissions_admin_update" on public.course_instructor_permissions
  for update to authenticated
  using (public.has_role(array['admin', 'super_admin', 'department_admin']))
  with check (public.has_role(array['admin', 'super_admin', 'department_admin']));

create policy "course_instructor_permissions_admin_delete" on public.course_instructor_permissions
  for delete to authenticated
  using (public.has_role(array['admin', 'super_admin', 'department_admin']));
