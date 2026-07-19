-- NurseFaculty Instructor Portal workspace foundation.
-- Supports instructor dashboard, resources, collaboration, live-session metadata,
-- course analytics snapshots, announcements, and student message queues.

alter table public.instructor_profiles
  add column if not exists institution_id uuid references public.institution_accounts(id) on delete set null,
  add column if not exists department text,
  add column if not exists position_title text,
  add column if not exists academic_year text,
  add column if not exists semester text,
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.courses
  add column if not exists modules_count integer not null default 0,
  add column if not exists assignments_count integer not null default 0,
  add column if not exists completion_rate numeric(5,2) not null default 0,
  add column if not exists average_score numeric(5,2) not null default 0,
  add column if not exists certificates_issued integer not null default 0,
  add column if not exists archived_at timestamptz,
  add column if not exists certificate_rule_id uuid references public.certificate_rules(id) on delete set null;

alter table public.class_schedules
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  add column if not exists meeting_provider text not null default 'nursefaculty_live'
    check (meeting_provider in ('nursefaculty_live', 'zoom', 'google_meet', 'microsoft_teams', 'external')),
  add column if not exists meeting_url text,
  add column if not exists recording_url text,
  add column if not exists materials jsonb not null default '[]'::jsonb,
  add column if not exists attendance_report jsonb not null default '{}'::jsonb,
  add column if not exists chat_transcript_url text,
  add column if not exists poll_results jsonb not null default '{}'::jsonb;

alter table public.assignments
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  add column if not exists assignment_type text not null default 'case_study'
    check (assignment_type in ('quiz', 'essay', 'case_study', 'file_upload', 'group_assignment', 'clinical_reflection')),
  add column if not exists allow_file_upload boolean not null default false,
  add column if not exists rubric jsonb not null default '{}'::jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists needs_grading_count integer not null default 0,
  add column if not exists submission_count integer not null default 0;

create table if not exists public.instructor_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid references public.institution_accounts(id) on delete set null,
  title text not null,
  resource_type text not null default 'document'
    check (resource_type in ('video', 'pdf', 'slides', 'image', 'question_bank', 'lesson_template', 'external_link', 'document')),
  topic text,
  description text,
  file_url text,
  external_url text,
  reusable boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  resource_id uuid not null references public.instructor_resources(id) on delete cascade,
  sort_order integer not null default 0,
  visibility text not null default 'students'
    check (visibility in ('students', 'instructors', 'private')),
  created_at timestamptz not null default now(),
  unique(course_id, resource_id)
);

create table if not exists public.course_announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'students'
    check (audience in ('students', 'instructors', 'all')),
  is_pinned boolean not null default false,
  published_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instructor_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text,
  body text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.course_instructor_permissions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  instructor_role text not null default 'lecturer'
    check (instructor_role in ('lecturer', 'course_owner', 'department_head', 'teaching_assistant')),
  can_edit boolean not null default true,
  can_grade boolean not null default true,
  can_view_analytics boolean not null default true,
  can_publish boolean not null default false,
  can_issue_certificates boolean not null default false,
  can_assign_instructors boolean not null default false,
  can_archive boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, instructor_id)
);

create table if not exists public.course_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  snapshot_date date not null default current_date,
  enrolled_students integer not null default 0,
  pending_approvals integer not null default 0,
  completion_rate numeric(5,2) not null default 0,
  average_score numeric(5,2) not null default 0,
  attendance_rate numeric(5,2) not null default 0,
  study_time_minutes integer not null default 0,
  certificates_issued integer not null default 0,
  most_missed_questions jsonb not null default '[]'::jsonb,
  topic_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(course_id, snapshot_date)
);

create index if not exists idx_instructor_resources_owner on public.instructor_resources(owner_id, created_at desc);
create index if not exists idx_course_resources_course on public.course_resources(course_id, sort_order);
create index if not exists idx_course_announcements_course on public.course_announcements(course_id, published_at desc);
create index if not exists idx_instructor_messages_recipient on public.instructor_messages(recipient_id, is_read, created_at desc);
create index if not exists idx_course_analytics_snapshots_course on public.course_analytics_snapshots(course_id, snapshot_date desc);

alter table public.instructor_resources enable row level security;
alter table public.course_resources enable row level security;
alter table public.course_announcements enable row level security;
alter table public.instructor_messages enable row level security;
alter table public.course_instructor_permissions enable row level security;
alter table public.course_analytics_snapshots enable row level security;

drop policy if exists "instructor_resources_owner_or_staff" on public.instructor_resources;
drop policy if exists "course_resources_staff_manage_students_read" on public.course_resources;
drop policy if exists "course_announcements_course_read" on public.course_announcements;
drop policy if exists "course_announcements_staff_manage" on public.course_announcements;
drop policy if exists "instructor_messages_participants" on public.instructor_messages;
drop policy if exists "course_instructor_permissions_staff_read" on public.course_instructor_permissions;
drop policy if exists "course_instructor_permissions_owner_manage" on public.course_instructor_permissions;
drop policy if exists "course_analytics_staff_read" on public.course_analytics_snapshots;

create policy "instructor_resources_owner_or_staff" on public.instructor_resources
  for all to authenticated using (
    owner_id = auth.uid()
    or public.has_role(array['admin', 'super_admin', 'department_admin'])
  )
  with check (
    owner_id = auth.uid()
    or public.has_role(array['admin', 'super_admin', 'department_admin'])
  );

create policy "course_resources_staff_manage_students_read" on public.course_resources
  for all to authenticated using (
    public.is_course_staff(course_id)
    or exists (
      select 1 from public.course_memberships cm
      where cm.course_id = course_resources.course_id
        and cm.user_id = auth.uid()
        and cm.status = 'enrolled'
    )
  )
  with check (public.is_course_staff(course_id));

create policy "course_announcements_course_read" on public.course_announcements
  for select to authenticated using (
    public.is_course_staff(course_id)
    or exists (
      select 1 from public.course_memberships cm
      where cm.course_id = course_announcements.course_id
        and cm.user_id = auth.uid()
        and cm.status = 'enrolled'
    )
  );
create policy "course_announcements_staff_manage" on public.course_announcements
  for all to authenticated using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

create policy "instructor_messages_participants" on public.instructor_messages
  for all to authenticated using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.has_role(array['admin', 'super_admin'])
  )
  with check (
    sender_id = auth.uid()
    or public.has_role(array['admin', 'super_admin'])
  );

create policy "course_instructor_permissions_staff_read" on public.course_instructor_permissions
  for select to authenticated using (public.is_course_staff(course_id) or public.has_role(array['admin', 'super_admin']));
create policy "course_instructor_permissions_owner_manage" on public.course_instructor_permissions
  for all to authenticated using (
    public.has_role(array['admin', 'super_admin'])
    or exists (
      select 1 from public.course_instructor_permissions cip
      where cip.course_id = course_instructor_permissions.course_id
        and cip.instructor_id = auth.uid()
        and cip.can_assign_instructors = true
    )
  )
  with check (
    public.has_role(array['admin', 'super_admin'])
    or exists (
      select 1 from public.course_instructor_permissions cip
      where cip.course_id = course_instructor_permissions.course_id
        and cip.instructor_id = auth.uid()
        and cip.can_assign_instructors = true
    )
  );

create policy "course_analytics_staff_read" on public.course_analytics_snapshots
  for select to authenticated using (public.is_course_staff(course_id) or public.has_role(array['admin', 'super_admin', 'department_admin']));

grant select, insert, update, delete on public.instructor_resources to authenticated;
grant select, insert, update, delete on public.course_resources to authenticated;
grant select, insert, update, delete on public.course_announcements to authenticated;
grant select, insert, update, delete on public.instructor_messages to authenticated;
grant select, insert, update, delete on public.course_instructor_permissions to authenticated;
grant select, insert, update, delete on public.course_analytics_snapshots to authenticated;

create or replace function public.get_instructor_dashboard_summary(target_instructor_id uuid default auth.uid())
returns table (
  courses bigint,
  active_students bigint,
  pending_approvals bigint,
  upcoming_live_sessions bigint,
  average_completion_rate numeric,
  certificates_issued bigint,
  unread_student_messages bigint,
  assignments_pending bigint
)
language sql
security definer
set search_path = public
as $$
  with instructor_courses as (
    select distinct cm.course_id
    from public.course_memberships cm
    where cm.user_id = target_instructor_id
      and cm.membership_role in ('course_owner', 'co_instructor', 'teaching_assistant')
      and cm.status = 'enrolled'
  )
  select
    (select count(*) from instructor_courses) as courses,
    (select count(*) from public.course_memberships cm join instructor_courses ic on ic.course_id = cm.course_id where cm.membership_role = 'student' and cm.status = 'enrolled') as active_students,
    (select count(*) from public.course_memberships cm join instructor_courses ic on ic.course_id = cm.course_id where cm.status = 'pending_approval') as pending_approvals,
    (select count(*) from public.class_schedules cs join instructor_courses ic on ic.course_id = cs.course_id where cs.status = 'scheduled' and cs.starts_at > now()) as upcoming_live_sessions,
    (select coalesce(round(avg(c.completion_rate), 2), 0) from public.courses c join instructor_courses ic on ic.course_id = c.id) as average_completion_rate,
    (select coalesce(sum(c.certificates_issued), 0) from public.courses c join instructor_courses ic on ic.course_id = c.id) as certificates_issued,
    (select count(*) from public.instructor_messages im where im.recipient_id = target_instructor_id and im.is_read = false) as unread_student_messages,
    (select coalesce(sum(a.needs_grading_count), 0) from public.assignments a join instructor_courses ic on ic.course_id = a.course_id) as assignments_pending;
$$;

grant execute on function public.get_instructor_dashboard_summary(uuid) to authenticated;
