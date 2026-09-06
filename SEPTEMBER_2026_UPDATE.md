# NurseFaculty September 2026 implementation

The September update is implemented in this release. The user reported successful application of the new migrations in Supabase. Independent live-schema and Edge Function verification was unavailable because the configured Supabase management credentials returned HTTP 403 (insufficient privileges). A GitHub push does not itself confirm Edge Function deployment. New course catalogs intentionally contain no fabricated, unreviewed clinical courses or CPD approvals.

## What is included

| Area | Implementation |
| --- | --- |
| Existing NCLEX | Existing question delivery, scoring, CAT, NGN, readiness, planner, notes, LMS and instructor components retained. Old `Study Coach` links still resolve. |
| Lifelong learning | Career-stage profile, goals, country/specialty selection, renewal cycle and email preferences. Practicing nurses, educators and leaders receive the learning hub on their Dashboard. |
| Modular catalog | Admin-managed countries, exams, specialties, programs and competency terms; generic catalog supports additional programs without adding routes. Nursing questions can be grouped by NCLEX, school, clinical or specialty context. |
| Content | Shared lesson, video/resource, case, CPD, regulatory, competency and question records. Existing courses, questions and lessons can be linked. Draft/review/publish/archive workflow, independent author/reviewer checks, references, versions and review dates. Old versions retain assessment snapshots. |
| CPD | Separate hours and points; credit authority; renewal-cycle/calendar-year views; external evidence/reflection records; server-assessed completions; CSV transcript. External activities remain explicitly self-reported. |
| Academies | Educator and Leadership program catalogs using the shared course/content/assessment foundations, with links to existing LMS courses. Content editors supply the actual curricula. |
| Clinical cases | Sequential case-stage interface, answers submitted to server grading, post-submission explanations and completion records. This is an authored educational case workflow; it does not model real-time patient physiology. |
| Tutor | Existing authenticated/quota-controlled service extended with learning context, observed NCLEX weak areas, clinical case tutoring and structured flashcard generation. Generated cards can be saved privately and practiced in Flashcards. |
| Certificates | Actual QR images, public verification page, issue/expiry/status display, completion issuance, repeat-submission protection, transcript linkage. Earned credentials remain accessible after subscription expiry. |
| Hospital competencies | Institution-scoped membership, assignment, saved criteria/version, staff evidence submission, independent assessor sign-off, feedback, certificates, reassessment dates and exportable manager reporting. Course assessments cannot certify workplace competencies. |
| Analytics | Existing NCLEX analytics retained; separate course results, CPD totals/targets, due renewals and institution-scoped competency counts/reports. |
| Reminders | In-app reminders at 30 days, 7 days and the due date, with duplicate protection. Optional pg_cron scheduling at 08:00 daily. |
| Subscriber benefits | General live sessions available to Basic and above; private course enrollment boundaries preserved. Existing daily NCLEX email worker now honors learning-profile email preferences. |
| Future-module foundations | Governed Career Hub catalog, a personal learning passport view, and a private saved CV editor with print/PDF output. No job-board or regulatory-provider integration is implied. |

## Deployment order

1. Back up the target database and test this release against staging with the existing August schema. Do not replay the historical question-seed migrations on production.
2. Apply the five **new** migrations in this order, once each:
   - `supabase/migrations/20260906100000_lifelong_learning.sql`
   - `supabase/migrations/20260906110000_hospital_competencies.sql`
   - `supabase/migrations/20260906120000_subscriber_learning_access.sql`
   - `supabase/migrations/20260906130000_learning_reminders.sql`
   - `supabase/migrations/20260906140000_personal_learning_cards.sql`
3. Deploy the changed `study-coach` and `daily-question-email` Edge Functions. Keep their existing endpoint names and secrets. The tutor still uses its existing authenticated quota RPC.
4. Check the daily-question worker's existing SMTP configuration and authenticated scheduled invocation. This release does not send test emails or create a new external email schedule. Required existing settings include SMTP credentials, `CRON_SECRET`, `APP_URL`, and Supabase service settings. The email continues to deliver the existing NCLEX Question of the Day; profile-based specialty question selection is not implemented.
5. If `pg_cron` is installed, verify the `nursefaculty-learning-reminders` job. Without it, an external scheduler can call `queue_learning_reminders()` using the service role. Never expose that role to the browser. These reminders are in-app notifications, not an additional email campaign.
6. Run the checks below, build and deploy the frontend through the existing hosting workflow. No hosting configuration was changed.
7. Use separate author and reviewer accounts to create, review and publish the first real courses, cases and competencies. Add applicable countries, specialties, credit authorities and renewal rules. Set up hospital memberships against existing institution accounts.
8. Smoke-test real staging roles: Free, Basic, Pro, institution-enrolled learner, author, reviewer, assessor and another institution's manager. Verify the QR code by scanning a real issued staging certificate.

The new learning components show an unavailable message when their migrations are absent. The existing NCLEX Dashboard falls back to its original behavior if the new profile lookup fails.

## Content and scope boundaries

- Historical NCLEX content and its existing publication rules are preserved. This release does not invent missing authors/references for legacy material or automatically move thousands of old items into the new catalog. Linked legacy content must be brought through review by the content team.
- A points entry records an explicitly supplied approval authority. It is not a claim that NurseFaculty has secured accreditation or that a course is accepted by every regulator. Targets and renewal cycles are configured by users; automatic jurisdictional rule validation is not implemented.
- Course completion is based on the authored assessment. Watched-time attestation, proctoring, interactive OSCE scoring, branching patient-state simulation and live-class CPD attendance awarding are not included.
- Tutor plans remain saved tutoring conversations; they do not silently overwrite the existing Study Planner calendar. Generated AI content is personal practice, not automatically published course content.
- Managers see their institution's competency data. This does not grant them access to staff members' private CPD records or CVs.
- UI checks ran in a DOM test environment. A connected browser was unavailable, so visual browser QA, actual PDF pagination and camera-based QR scanning remain release checks.

## Validation

Commands:

```text
npm run build
npm run validate:security
npm run validate:explanations
npm run test:lifelong
```

`scripts/test-lifelong.sql` runs integration assertions against an isolated PostgreSQL database with the application schema applied. It creates only fictional test fixtures, makes no external requests, and rolls them back. It checks independent publication, hidden answer keys, grading, stale versions, duplicate credits, certificate retention, record isolation, institution sign-off, live-class access, reminder idempotency and anonymous certificate verification. Do not run the fixture script against production.

The exact five September migrations were replayed successfully in a disposable local Supabase PostgreSQL container. Reconstructing the historical baseline required using the repository's existing replacement for the two June assignment migrations, skipping an old seed-publication gate that rejected three incomplete seeded questions, and providing the auth JWT helper normally supplied by the Supabase auth stack. No historical migration was edited to bypass these conditions.

The container image also crashed once while executing a nested dynamic permission-denial test for the reminder worker. The final test verifies that permission with PostgreSQL's ACL inspection and separately executes the worker to validate its behavior. Staging validation on the target Supabase runtime remains necessary.

## Rollback

If staging or rollout finds a problem, restore the preceding frontend and Edge Function deployments first. Leave the additive learning tables in place so records are preserved. Do not drop CPD, certificate or competency records as a rollback shortcut. Restore old live-class policies only if intentionally reversing the newly authorized subscriber benefit.
