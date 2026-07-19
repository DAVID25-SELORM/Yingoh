-- Expand NurseFaculty RBAC role catalogue for university-scale operations.
-- The existing user_roles table already supports multiple roles per user.

insert into public.roles (name, description)
values
  ('department_admin', 'Department-scoped operations access for users, instructors, classes, reports, and learning operations.'),
  ('exam_officer', 'Exam administration access for creating, scheduling, publishing, and reviewing exam results.'),
  ('question_bank_manager', 'Question repository ownership across draft intake, review, publishing, archiving, and quality control.'),
  ('support_officer', 'User support access for account assistance, password resets, and support triage.'),
  ('academic_registrar', 'Student records, enrollment status, graduation readiness, certificates, and academic reports.'),
  ('library_manager', 'Learning resources, document uploads, videos, drug guides, and library organization.'),
  ('analytics_manager', 'Read-only dashboard, performance analytics, pass-readiness trends, and exportable reports.'),
  ('guest_reviewer', 'Temporary external reviewer access for accreditation or content quality review.')
on conflict (name) do update
set description = excluded.description;
