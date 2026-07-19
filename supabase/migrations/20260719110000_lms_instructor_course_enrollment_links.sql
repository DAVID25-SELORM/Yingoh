-- LMS foundation: separate admin instructor invitations from instructor-owned
-- course enrollment links.

alter table public.pending_invites
  add column if not exists invite_type text not null default 'platform_role'
    check (invite_type in ('platform_role', 'course_enrollment')),
  add column if not exists department text,
  add column if not exists institution text,
  add column if not exists professional_title text,
  add column if not exists staff_id text,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'cancelled', 'suspended', 'deactivated'));

create table if not exists public.instructor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  department text,
  nursing_specialty text,
  professional_title text,
  institution text,
  staff_id text,
  account_status text not null default 'active'
    check (account_status in ('invitation_pending', 'active', 'suspended', 'deactivated', 'invitation_expired')),
  onboarding_email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses
  add column if not exists course_code text unique,
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists category text,
  add column if not exists academic_level text,
  add column if not exists institution text,
  add column if not exists department text,
  add column if not exists starts_at date,
  add column if not exists ends_at date,
  add column if not exists enrollment_method text not null default 'approval_required'
    check (enrollment_method in ('open', 'approval_required', 'restricted')),
  add column if not exists max_students integer,
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'institution', 'public')),
  add column if not exists archived_at timestamptz;

create table if not exists public.course_memberships (
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null default 'student'
    check (membership_role in ('course_owner', 'co_instructor', 'teaching_assistant', 'student', 'observer')),
  status text not null default 'enrolled'
    check (status in ('invited', 'pending_approval', 'enrolled', 'removed', 'completed', 'rejected')),
  student_id text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table if not exists public.course_enrollment_links (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  enrollment_method text not null default 'approval_required'
    check (enrollment_method in ('open', 'approval_required', 'restricted')),
  expires_at timestamptz,
  max_students integer,
  require_approval boolean not null default true,
  allowed_email_domains text[],
  allowed_student_ids text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instructor_profiles enable row level security;
alter table public.course_memberships enable row level security;
alter table public.course_enrollment_links enable row level security;

create or replace function public.is_course_staff(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['admin', 'super_admin'])
    or exists (
      select 1
      from public.course_memberships cm
      where cm.course_id = target_course_id
        and cm.user_id = auth.uid()
        and cm.status = 'enrolled'
        and cm.membership_role in ('course_owner', 'co_instructor', 'teaching_assistant')
    );
$$;

grant execute on function public.is_course_staff(uuid) to authenticated;

drop policy if exists "instructor_profiles_admin_or_own" on public.instructor_profiles;
create policy "instructor_profiles_admin_or_own" on public.instructor_profiles
  for all to authenticated
  using (auth.uid() = user_id or public.has_role(array['admin', 'super_admin']))
  with check (auth.uid() = user_id or public.has_role(array['admin', 'super_admin']));

drop policy if exists "courses_read_authenticated" on public.courses;
drop policy if exists "courses_lms_read" on public.courses;
create policy "courses_lms_read" on public.courses
  for select to authenticated
  using (
    visibility = 'public'
    or public.has_role(array['admin', 'super_admin'])
    or owner_id = auth.uid()
    or exists (
      select 1 from public.course_memberships cm
      where cm.course_id = courses.id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "courses_lms_staff_write" on public.courses;
create policy "courses_lms_staff_write" on public.courses
  for all to authenticated
  using (public.has_role(array['admin', 'super_admin']) or owner_id = auth.uid() or public.is_course_staff(id))
  with check (public.has_role(array['admin', 'super_admin', 'instructor']) or owner_id = auth.uid());

drop policy if exists "course_memberships_own_or_staff" on public.course_memberships;
create policy "course_memberships_own_or_staff" on public.course_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_course_staff(course_id) or public.has_role(array['admin', 'super_admin']));

drop policy if exists "course_memberships_staff_write" on public.course_memberships;
create policy "course_memberships_staff_write" on public.course_memberships
  for all to authenticated
  using (public.is_course_staff(course_id) or public.has_role(array['admin', 'super_admin']))
  with check (public.is_course_staff(course_id) or public.has_role(array['admin', 'super_admin']));

drop policy if exists "enrollment_links_public_read" on public.course_enrollment_links;
create policy "enrollment_links_public_read" on public.course_enrollment_links
  for select to anon, authenticated using (is_active = true);

drop policy if exists "enrollment_links_staff_write" on public.course_enrollment_links;
create policy "enrollment_links_staff_write" on public.course_enrollment_links
  for all to authenticated
  using (public.is_course_staff(course_id) or public.has_role(array['admin', 'super_admin']))
  with check (public.is_course_staff(course_id) or public.has_role(array['admin', 'super_admin')));

grant select, insert, update, delete on public.instructor_profiles to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.course_memberships to authenticated;
grant select, insert, update, delete on public.course_enrollment_links to anon, authenticated;

create or replace function public.create_course_with_owner(
  p_title text,
  p_course_code text,
  p_description text,
  p_category text,
  p_academic_level text,
  p_starts_at date,
  p_ends_at date,
  p_enrollment_method text,
  p_max_students integer,
  p_visibility text
)
returns public.courses
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  new_course public.courses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_role(array['instructor', 'admin', 'super_admin', 'department_admin']) then
    raise exception 'Only instructors or admins can create courses';
  end if;

  insert into public.courses(
    title, course_code, description, category, academic_level, starts_at, ends_at,
    enrollment_method, max_students, visibility, status, owner_id
  )
  values (
    p_title, nullif(upper(trim(p_course_code)), ''), p_description, p_category, p_academic_level,
    p_starts_at, p_ends_at, coalesce(p_enrollment_method, 'approval_required'),
    p_max_students, coalesce(p_visibility, 'private'), 'draft', auth.uid()
  )
  returning * into new_course;

  insert into public.course_memberships(course_id, user_id, membership_role, status, approved_by, approved_at)
  values (new_course.id, auth.uid(), 'course_owner', 'enrolled', auth.uid(), now())
  on conflict (course_id, user_id) do update
    set membership_role = 'course_owner',
        status = 'enrolled',
        updated_at = now();

  return new_course;
end;
$$;

grant execute on function public.create_course_with_owner(text, text, text, text, text, date, date, text, integer, text) to authenticated;

create or replace function public.generate_course_enrollment_link(
  p_course_id uuid,
  p_expires_at timestamptz default null,
  p_max_students integer default null,
  p_enrollment_method text default null,
  p_require_approval boolean default true
)
returns public.course_enrollment_links
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  new_link public.course_enrollment_links%rowtype;
  generated_code text;
begin
  if not public.is_course_staff(p_course_id) then
    raise exception 'Not authorized for this course';
  end if;

  generated_code := 'NUR-' || to_char(now(), 'YYYY') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  update public.course_enrollment_links
  set is_active = false, updated_at = now()
  where course_id = p_course_id and is_active = true;

  insert into public.course_enrollment_links(
    course_id, code, created_by, expires_at, max_students, enrollment_method, require_approval
  )
  values (
    p_course_id, generated_code, auth.uid(), p_expires_at, p_max_students,
    coalesce(p_enrollment_method, 'approval_required'), coalesce(p_require_approval, true)
  )
  returning * into new_link;

  return new_link;
end;
$$;

grant execute on function public.generate_course_enrollment_link(uuid, timestamptz, integer, text, boolean) to authenticated;

create or replace function public.get_course_by_enrollment_code(p_code text)
returns table(
  link_id uuid,
  code text,
  course_id uuid,
  title text,
  course_code text,
  description text,
  category text,
  academic_level text,
  starts_at date,
  ends_at date,
  enrollment_method text,
  require_approval boolean,
  max_students integer,
  expires_at timestamptz,
  is_active boolean,
  instructor_name text,
  institution text,
  department text,
  enrollment_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cel.id,
    cel.code,
    c.id,
    c.title,
    c.course_code,
    c.description,
    c.category,
    c.academic_level,
    c.starts_at,
    c.ends_at,
    cel.enrollment_method,
    cel.require_approval,
    coalesce(cel.max_students, c.max_students),
    cel.expires_at,
    cel.is_active,
    p.full_name,
    coalesce(ip.institution, c.institution),
    coalesce(ip.department, c.department),
    cm.status
  from public.course_enrollment_links cel
  join public.courses c on c.id = cel.course_id
  left join public.profiles p on p.id = c.owner_id
  left join public.instructor_profiles ip on ip.user_id = c.owner_id
  left join public.course_memberships cm on cm.course_id = c.id and cm.user_id = auth.uid()
  where upper(cel.code) = upper(p_code)
    and cel.is_active = true
  limit 1;
$$;

grant execute on function public.get_course_by_enrollment_code(text) to anon, authenticated;

create or replace function public.join_course_by_enrollment_code(
  p_code text,
  p_student_id text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  link public.course_enrollment_links%rowtype;
  current_count integer;
  target_status text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select * into link
  from public.course_enrollment_links
  where upper(code) = upper(p_code)
    and is_active = true
  limit 1;

  if link.id is null then raise exception 'Enrollment link not found or disabled'; end if;
  if link.expires_at is not null and link.expires_at < now() then raise exception 'Enrollment link has expired'; end if;

  select count(*) into current_count
  from public.course_memberships
  where course_id = link.course_id and status in ('enrolled', 'pending_approval');

  if link.max_students is not null and current_count >= link.max_students then
    raise exception 'This course is full';
  end if;

  target_status := case
    when link.enrollment_method = 'open' and not link.require_approval then 'enrolled'
    else 'pending_approval'
  end;

  insert into public.course_memberships(course_id, user_id, membership_role, status, student_id)
  values (link.course_id, auth.uid(), 'student', target_status, p_student_id)
  on conflict (course_id, user_id) do update
    set status = case
      when public.course_memberships.status = 'enrolled' then 'enrolled'
      else excluded.status
    end,
    student_id = coalesce(excluded.student_id, public.course_memberships.student_id),
    updated_at = now();

  return target_status;
end;
$$;

grant execute on function public.join_course_by_enrollment_code(text, text) to authenticated;
