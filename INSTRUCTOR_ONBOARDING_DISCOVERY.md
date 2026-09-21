# Instructor onboarding discovery and implementation plan

Local review: 2026-09-20. Repository HEAD: efa6151 (descendant of 95eb8a7).
Existing uncommitted Access & Promotions changes are preserved. No production
database, Auth configuration, feature flag, email setting, or deployment changed.

## Current architecture and findings

| Concern | Existing implementation | Finding |
| --- | --- | --- |
| Add / Invite and admin Users | src/components/UserManagement.jsx | Generic form includes instructor fields, ignored status selector and misleading email/first-classroom checkbox. |
| Authentication | supabase/functions/admin-users/index.ts | Auth invite really calls inviteUserByEmail. Direct creation takes an administrator-selected password. |
| Account/profile | auth.users and public.profiles | Separate identities; profiles contains name, email and optional phone. |
| Platform roles | roles, user_roles, admin_assign_role | Admin/super-admin server checks; only super-admin can modify super-admin accounts. Assigning instructor does not ensure a professional profile. |
| Professional profile | instructor_profiles | Department, specialty, professional title, institution, staff ID; later position/term/institution ID and permissions JSON. Own-record ALL policy permits protected-column changes. |
| Lifecycle | instructor_profiles.account_status | Legacy pending/active/suspended/deactivated/expired states; backend derives pending or active and ignores UI selection. No complete onboarding lifecycle. |
| Invitation ledger | pending_invites | Legacy role-invite table, email uniqueness, token, expiry, accepted_at and status. UI reads all columns and hard-deletes on revoke. |
| Acceptance | handle_pending_invite trigger on profiles INSERT | Profile creation is incorrectly treated as invite acceptance; status is not checked. Not proof of Auth acceptance. |
| Provisioning | admin-users after external Auth operation | Profile, role, instructor profile, invitation and audit writes are sequential and most errors are ignored. No request ledger or reconciliation. |
| Course assignment | course_memberships | Owner/co-instructor/TA/student/observer with enrollment status; platform role remains separate. |
| Course permission flags | course_instructor_permissions | Edit/grade/analytics/publish/certificate/assign/archive flags; self-referencing policy needs recursion review. |
| Course RLS | is_course_staff and LMS/workspace policies | All three teaching roles counted as staff; broad ALL policies do not distinguish destructive management from teaching. Suspension is not consulted. |
| Platform permissions | permissions, role_permissions, user_permission_overrides | Effective permission RPC resolves denies/allows; override mutation is super-admin only. Instructor defaults exclude finance, role management and publishing. |
| Question ownership | questions and question policies | Granular instructor create/edit permissions exist but current write policy is admin-only. Ownership-scoped writes and publication protection need explicit implementation. |
| Instructor page | src/components/InstructorTools.jsx | Teaching workspace, not administrator instructor management; course-less state and all mutations need lifecycle/scoping review. |
| First login | src/main.jsx | Auth session listener handles recovery; role portal lands at Instructors. No profile-completion routing. Preserve recovery and preview behavior. |
| Notifications | public.notifications; Supabase Auth mail | Generic in-app notices exist. Daily-question SMTP is purpose-specific, not a generic onboarding queue. Do not create a parallel mail system. |
| Email truthfulness | admin-users onboarding_email_sent | Invite records true after Auth success; direct-create checkbox also writes true without sending mail. Provider acceptance is not delivery confirmation. |
| Audit | audit_logs and admin_audit_logs | Existing sources can be reused. Current admin-users audit errors are unchecked; role/profile/course lifecycle changes need transactional events. |

## Implementation plan (before code changes)

1. Add a forward-only lifecycle migration, conservative historical backfill,
   protected profile writes, authenticated profile-completion/status RPCs, and
   acceptance derived from trusted Auth state. Unknown historical dates stay null.
2. Add actor-authorized, idempotent provisioning with a durable operation record.
   External Auth and SQL cannot share a transaction: fail closed, preserve enough
   information for reconciliation, and never blindly resend after ambiguous timeouts.
3. Replace instructor-specific generic form controls with a five-step wizard.
   Keep other role workflows intact. Reuse Auth email and existing notifications;
   remove claims of email delivery or classroom redirection unsupported by code.
4. Add prefilled setup/checklist and deterministic instructor landing, plus admin
   list/detail/invitation management. No course is required for activation.
5. Enforce active lifecycle, question ownership/publication and course role scope
   at SQL/RLS and service layers. Preserve historical content and unrelated roles.
6. Add DB/RLS, retry, Auth-adapter and UI regression tests; replay fresh/upgrade
   migrations; run scoped lint/typecheck and production build; inspect four widths.
7. Reconcile remaining Access & Promotions requirements without duplicating its
   implemented grants, promotions, payment provider or existing subscription prices.

## Release boundary

Neither instructor onboarding nor Access & Promotions is approved for deployment
by this work. Invitation provider acceptance cannot establish inbox delivery.
Hosted Auth acceptance/resend behavior and real Hubtel merchant acceptance require
separate controlled verification. A passing build is not production readiness.
