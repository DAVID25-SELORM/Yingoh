# Daily NCLEX Email — production readiness audit

**PRODUCTION READINESS: NOT READY**

## Recipient confirmation and Git deployment handoff

The user confirmed the single diagnostic arrived in spam. Controlled SMTP delivery is therefore PASS for receipt, with inbox placement unresolved; SPF/DKIM/DMARC results remain unverified. This supersedes the earlier pending-receipt gate. The user authorized committing and pushing daily-email changes to the Git-linked Vercel production branch. A Git push is not proof of a successful hosted deployment or completion of the remaining hosted tests. Global sending must remain PAUSED. No automatic enablement is authorized by this deployment handoff.

## Latest completion pass — scheduled pause verified and SMTP accepted

Production timer execution is now verified: ten successful pg_cron runs were observed, with recent HTTP responses returning 200, paused=true, sent=0. Global configuration remained false and the campaign ledger remained empty.

Implemented and rehearsed migration `20260919160000_daily_email_diagnostic.sql`, then applied only that migration and recorded its version. Deployed separate `daily-email-diagnostic` Edge Function. It authenticates with the existing server-only credential, hardcodes the sole user-approved recipient, requires a paused master switch for a persistent one-shot claim, and never retries. Diagnostic claim defaults to an unknown outcome so interrupted invocations cannot resend. No request can change the recipient. No SMTP values were displayed or logged; Auth SMTP was unchanged.

Hosted diagnostic request 17 returned HTTP 200, attempted=1, outcome=smtp_accepted; its persistent ledger confirms completion. One SMTP message was accepted for `cryxtalcfc@gmail.com`. Actual inbox/spam placement and message authentication headers still require recipient confirmation. Repeated authenticated request 18 returned HTTP 409, attempted=0; the one-shot guard prevented another message. Final checks: one diagnostic record, zero campaign deliveries, enabled=false. The diagnostic must not be reset to trigger retries.

Two new diagnostic handler tests passed (authentication/fixed recipient/concurrent claims/ambiguous no-retry and configuration-failure behavior). Deno typecheck passed. The production frontend build passed with the existing large-chunk warning. Earlier 35 feature tests remain the previously recorded local evidence, not hosted send-path proof.

Vercel CLI explicitly returned login_required. No frontend deployment occurred. An isolated hosted staging project/test environment has not been supplied; production must not be enabled even temporarily to run send-path tests.

| Requested gate | Latest result |
| --- | --- |
| Migration deployed | PASS |
| Worker deployed | PASS |
| SMTP configuration detected | PASS |
| Controlled SMTP delivery | FAIL — SMTP acceptance PASS, recipient receipt/header verification pending |
| Cron configured | PASS |
| Cron authentication | PASS |
| Paused-mode scheduler test | PASS — timer-triggered and manual invocations |
| Hosted scheduler concurrency | FAIL — enabled reservation race untested |
| Hosted worker concurrency | FAIL — send/lease race untested; diagnostic one-shot guard verified |
| Retry behavior | FAIL — hosted campaign test outstanding |
| Ambiguous timeout protection | FAIL — hosted campaign fault-injection outstanding |
| Timezone behavior | FAIL — hosted send-path test outstanding |
| Secure answer flow | FAIL — hosted frontend end-to-end test outstanding |
| Admin history/monitoring | FAIL — hosted frontend end-to-end test outstanding |
| Global system status | PAUSED |

Exact remaining blockers: (1) recipient confirmation and safe summary of SPF/DKIM/DMARC results for the diagnostic, without exposing credentials; (2) authenticated Vercel deployment access and frontend deployment/verification; (3) a designated isolated hosted staging environment, or explicit agreement on a separately reviewed staging harness, to complete enabled-path concurrency, retries, ambiguous timeout, timezone, secure-answer and admin-history tests without enabling production or involving ordinary users. No new paid staging project was created. These gates cannot be replaced by local fixture passes or marked complete merely because SMTP accepted one message.

**PRODUCTION READINESS: NOT READY**

## Latest deployment — production migration and worker deployed PAUSED

This section supersedes prior NOT DEPLOYED observations. Production target remains `mcbfqgyosdklnzbagobp`.

### Restore and rehearsal evidence

- Created dedicated Docker container `nclex-daily-email-rehearsal-20260919`, with networking disabled and no published ports. Existing containers were not changed.
- Standard schema export lacked managed Auth functions; separate managed restore exposed cross-schema trigger dependencies. Exported `combined-schema.sql` for public/auth/storage to the existing private backup directory, then restored it into clean local database `rehearsal_combined` as the local Supabase admin.
- Restored data in a single transaction with triggers suppressed **only in the network-isolated local restore session**. Fresh duplicate foreign-key constraints were added and validated for all public/auth/storage foreign keys, including the circular relationships; verification completed successfully and its DDL transaction was rolled back. Production constraints were never disabled.
- Applied the exact daily-email migration successfully to the restored database. Verified eight profiles/eight preferences, master switch false, zero paused reservations, and null paused claim. Backup remains a database-schema/data recovery artifact, not a complete platform/storage-object backup or shared point-in-time snapshot.

### Production actions and evidence

- Applied only `20260918100000_daily_email_system.sql` through linked SQL execution. Verified `enabled=false`, eight preferences, zero reservations, null claim. Recorded only version `20260918100000` as applied; no historical migration repair or blanket db push.
- Deployed `daily-question-email` through server-side bundling. The initial Docker bundling attempt was cancelled before deployment to avoid another runtime download.
- Installed pg_cron/pg_net and executed the guarded scheduler recipe. Job `nursefaculty-daily-email` is active on `*/5 * * * *`; active cron is NOT enabled campaign sending.
- Verified the Vault project URL matches the exact target using a server-side boolean result only. No credential values were returned.
- Three simultaneous authenticated pg_net submissions (request IDs 1/2/3) returned HTTP 200, `paused=true`, `sent=0`, no timeouts. Ledger count remains zero.
- Anonymous and deliberately invalid-credential requests (IDs 4/5) both returned HTTP 401. Thus the matching Vault/Edge credential is functionally verified without disclosure.
- At the last check, the first wall-clock cron execution had not yet occurred (`cron_successful_runs=0`). Manual submissions verified its authenticated HTTP path, but a timer-triggered execution remains to be observed.
- No SMTP test was attempted; no ordinary users received emails. Auth SMTP was unchanged. Global switch stayed false throughout.

| Requested gate | Result |
| --- | --- |
| Migration deployed | PASS |
| Worker deployed | PASS |
| SMTP configuration detected | PASS — required names previously verified; credential usability untested |
| Controlled SMTP delivery | FAIL — not attempted |
| Cron configured | PASS |
| Cron authentication | PASS — correct credential 200, missing/wrong 401 |
| Paused-mode scheduler test | PASS — three authenticated HTTP invocations; timer execution outstanding |
| Hosted scheduler concurrency | FAIL — paused overlap only, no enabled reservation race test |
| Hosted worker concurrency | FAIL — paused overlap only, no sending/lease race test |
| Retry behavior | FAIL — hosted test outstanding |
| Ambiguous timeout protection | FAIL — hosted test outstanding |
| Timezone behavior | FAIL — hosted test outstanding |
| Secure answer flow | FAIL — hosted end-to-end test outstanding |
| Admin history/monitoring | FAIL — hosted end-to-end test outstanding |
| Global system status | PAUSED |

Remaining work: observe a timer-triggered cron result; implement an isolated, authenticated, one-shot SMTP diagnostic for only the approved recipient without changing the global switch; establish an isolated hosted test environment or narrowly scoped pilot harness for reservation/worker races, retry/timeout, timezone and owned-answer/admin tests; deploy and verify the frontend. The current production worker has no allowlisted pilot bypass and must not be globally enabled to satisfy tests. Local rehearsal container contains sensitive restored data; it is retained network-isolated for continued validation. Production readiness remains NOT READY.

## Latest verification — CLI restored and backup exports created

Confirmed CLI access to linked production project `mcbfqgyosdklnzbagobp`. Started the installed Docker Desktop engine successfully. The first schema-dump attempt failed temporary-role authentication after the image download; retry with the cached image succeeded. Schema and data exports both exited 0 and are stored outside the repository at `C:\Users\selorm\AppData\Local\NCLEX-private-backups\20260919-pre-daily-email`:

- `schema.sql`: 263487 bytes; SHA256 `4F0B7ADB1C3266CD344CE7E6DD3CC31329AEEC657D68A4E59613071715207292`.
- `data.sql`: 12249463 bytes; SHA256 `3FF7BFA7CC5F81DC3299075DCF1B70AD81989A7F53AF726567149F3702F01DD1`.

Data export explicitly includes public/auth/storage schemas, not Vault. Backup contents were not printed. Protect these local files as sensitive. These are database exports, not a complete platform backup: storage object bytes, Edge secrets, and Vault secret values were not exported. Separate schema/data dumps are not a shared point-in-time snapshot. Restore verification remains outstanding; pg_dump warned of circular foreign keys between `courses` and `certificate_rules`, which the isolated restore rehearsal must handle safely. Do not disable production constraints to solve a restore issue.

All 35 local daily-email tests passed again (28 database/worker contracts and 7 UI tests). Hosted tests remain outstanding.

`supabase migration list --linked` records only the first five migrations remotely while many later schema objects were previously observed. Do not perform a blanket db push or mark historical migrations applied without inspection. Rehearse and apply only the intended daily-email migration using a targeted deployment path. No production migration, worker deployment, scheduler creation, or email send was performed in this follow-up. Global system remains NOT DEPLOYED, never enabled. Next steps are isolated restore/migration rehearsal, targeted paused deployment, and the remaining hosted gates.

## Latest verification — Vault names confirmed; backup blocker

After "Vault saved", a read-only query of `vault.secrets` selecting only names and counts verified exactly one `daily_email_cron_secret` and one `daily_email_project_url`. No encrypted or decrypted secret column was selected. This confirms presence only, not matching credential values or authenticated invocation. The same query confirmed `public.daily_email_config` is absent and neither `pg_cron` nor `pg_net` is installed.

The target project's Database > Backups screen explicitly reports "Free Plan does not include project backups." No recoverable external backup has been established in this workflow. Before production migration, obtain a current external database backup through an authorized database/CLI session (or identify an existing current recoverable backup); do not purchase an upgrade automatically. The CLI target-access mismatch previously recorded remains unresolved. No schema changes, deployment, cron creation, or email sends occurred. Global system remains NOT DEPLOYED, never enabled. All hosted execution gates remain outstanding; SMTP/Edge/Vault name-presence checks are satisfied.

## Latest verification — scheduler Edge secret present

Following the user's "cron saved" confirmation, refreshed the target project's Secrets page. Saved names now include `CRON_SECRET` and all four required SMTP names. No values were accessed. This supersedes the missing-CRON_SECRET observation below. Presence is not proof of matching Vault credentials or successful cron authentication. The scheduler recipe requires Vault `daily_email_cron_secret` (same private value as Edge CRON_SECRET) and `daily_email_project_url` (the target project's HTTPS API base URL). Those Vault prerequisites have not yet been reverified. No deployment, scheduler creation, or send was performed in this check; global sending was not enabled. Production readiness remains NOT READY.

## Latest verification — SMTP names now present

After the user's replacement/configuration confirmation, refreshed the correct project's Chrome Secrets page and verified only saved names. All four required names are now present: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. **SMTP configuration detected: PASS (presence only)**. This supersedes earlier missing-SMTP observations below; credential validity and delivery remain untested. No values were opened, retrieved, or logged. Port 465 remains the code default. Auth SMTP was unchanged.

`CRON_SECRET` is still absent from the saved name inventory. Secure matching Edge/Vault scheduler credentials remain a blocker. No deployment or email send was performed during this verification; all other hosted gates remain incomplete. Global sending was not enabled.

## 19 September 2026 — follow-up after reported SMTP secret entry

Refreshed the target project's Edge Function Secrets page in the authorized Chrome session. The loaded name-only inventory still lists only `OPENAI_API_KEY` and `OPENAI_MODEL` as custom secrets. `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `CRON_SECRET` are absent. This contradicts the reported successful entry; verify the project and save completion at `https://supabase.com/dashboard/project/mcbfqgyosdklnzbagobp/functions/secrets`. No secret values were retrieved, displayed, or logged. Port 465 is already the worker's default; a separate SMTP_PORT secret is not required. Auth SMTP was not modified.

Deployment and hosted testing were not performed in this follow-up. No emails were sent. The sole approved diagnostic recipient remains `cryxtalcfc@gmail.com`; ordinary users must never be test recipients.

| Requested gate | Result |
| --- | --- |
| Migration deployed | FAIL — not deployed |
| Worker deployed | FAIL — not deployed |
| SMTP configuration detected | FAIL — four required names absent after refresh |
| Controlled SMTP delivery | FAIL — not attempted |
| Cron configured | FAIL — not configured |
| Cron authentication | FAIL — not verified; CRON_SECRET absent |
| Paused-mode scheduler test | FAIL — not run hosted |
| Hosted scheduler concurrency | FAIL — not run |
| Hosted worker concurrency | FAIL — not run |
| Retry behavior | FAIL — hosted test outstanding |
| Ambiguous timeout protection | FAIL — hosted test outstanding |
| Timezone behavior | FAIL — hosted test outstanding |
| Secure answer flow | FAIL — hosted test outstanding |
| Admin history/monitoring | FAIL — hosted test outstanding |
| Global system status | NOT DEPLOYED; never enabled. Local migration defaults PAUSED |

FAIL here means the production gate is not satisfied, not that an unperformed test produced a failing execution. Local test successes do not substitute for hosted verification.

Remaining blockers: (1) save the four SMTP secrets in the exact target project; (2) securely configure matching Edge `CRON_SECRET` and Vault `daily_email_cron_secret`, plus Vault `daily_email_project_url`, without sharing values in chat; (3) complete migration rehearsal and establish a recoverable backup; (4) deploy the paused migration, worker, scheduler, and frontend; (5) provide an isolated hosted test path that cannot send to ordinary users or require enabling the global switch, then complete the controlled SMTP and all hosted gates above. CLI access remains mismatched/unavailable as described below; Chrome access is available. No claim of a remotely PAUSED singleton is made because the table has not been deployed.

**PRODUCTION READINESS: NOT READY**

## 19 September 2026 — Chrome verification update

The user-authorized Chrome session successfully accessed both exact production projects. Browser access resolves the earlier dashboard-access blocker; CLI credentials remain a separate issue. This section supersedes the older unknown-state observations below.

- Supabase: project `mcbfqgyosdklnzbagobp` (Yingoh), organization Gabion Selorm, Free plan, Healthy, Frankfurt. No production branch or scheduled backup was listed on its overview.
- Vercel: project `yingoh`, domain `nursefaculty.org`, Ready production deployment from `main` commit `3c0b9c4f73111474f715792dc1c2f28eae4e2c8a`, dated September 6. The feature is not in that release.
- Edge Functions: six deployed functions; `daily-question-email` is absent.
- Edge Function custom secrets: only `OPENAI_API_KEY` and `OPENAI_MODEL` were listed. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CRON_SECRET`, and `APP_URL` are missing. Default Supabase server secrets are provided by the platform. No secret value was revealed.
- Read-only SQL confirmed all eight prerequisite tables, `has_role`, and checked newer question/profile/Auth columns exist. There are eight profiles and zero legacy daily-email sent records.
- All four new tables (`user_email_preferences`, `daily_question_deliveries`, `daily_email_config`, `daily_email_suppressions`) are absent. Therefore the new system is **NOT DEPLOYED**, rather than remotely PAUSED or ENABLED; the pause row does not yet exist.
- `pg_cron` and `pg_net` are absent. Vault exists, but neither `daily_email_project_url` nor `daily_email_cron_secret` is present. No database-based cron can run this feature in the observed configuration.
- Authentication's separate SMTP screen visibly has custom SMTP enabled and points to Gmail SMTP. It warns that this is a personal rather than transactional provider. The visible sender-address and username controls are empty; the saved password is explicitly non-retrievable. This does not establish a usable daily-worker configuration. Auth settings were not changed.

Only SELECT metadata/count queries were executed. The SQL editor created an audit-query draft as normal UI behavior; no application data/schema, functions, scheduler, secrets, DNS, or deployment was changed. No test email was sent and global sending was not enabled.

Remaining immediate blocker: enter the approved sender's SMTP configuration securely in Edge Function Secrets (not chat), with hosted-compatible implicit TLS. The existing Auth password cannot be copied out for reuse. Confirm that sender account/provider permits the learning-email workload. Deployment still requires migration rehearsal, a recoverable database backup, and the controlled tests described below. Do not enable production sending while those gates remain open.

Audit date: 18 September 2026. No production deployment, database migration, cron modification, DNS change, account creation, or SMTP send was performed. The approved single recipient was supplied by the user; ordinary users were not used for tests. The diagnostic exited with `attempted: 0` because SMTP configuration was unavailable.

## 1. Verified repository state

- Branch: `main`.
- Current commit: `3c0b9c4f73111474f715792dc1c2f28eae4e2c8a`.
- Worktree contains uncommitted implementation changes. No merge/conflict markers or whitespace errors were found by the checks performed. It is suitable for continued local review, but there is no committed release snapshot yet.
- Modified tracked files: `package.json`, `package-lock.json`, `src/main.jsx`, `src/components/LifelongLearning.jsx`, `src/components/QuestionOfTheDayView.jsx`, `supabase/functions/daily-question-email/index.ts`.
- Untracked feature files: both daily-email reports; `scripts/daily-email.test.mjs`, `scripts/daily-email-ui.test.jsx`, `scripts/diagnose-daily-email.ts`; `src/components/DailyEmailSettings.jsx`, `src/components/DailyEmailAdmin.jsx`; `supabase/config.toml`, `supabase/setup-daily-email-cron.sql`; worker `config.js`, `handler.js`, `smtp.ts`, `worker.js`, `deno.json`, `deno.lock`; `supabase/migrations/20260918100000_daily_email_system.sql`.
- Unrelated untracked `.claude/` is preserved.
- One new database migration: `20260918100000_daily_email_system.sql`. No additional migration was introduced during this audit.

The code, migration, UI, tests, and prior implementation report were inspected. Assertions below distinguish local evidence from remote observations.

## 2. Production architecture and access evidence

| Area | Observation |
| --- | --- |
| Application | `https://nursefaculty.org` returned HTTP 200 with Vercel server/deployment headers |
| Frontend runtime | React/Vite static SPA, confirmed in repository |
| Live database target | Public deployed JavaScript references Supabase project `mcbfqgyosdklnzbagobp`, matching the repository link |
| Cached project metadata | Historical name Yingoh; cached PostgreSQL version 17.6.1.127; current hosted version not independently verified |
| Live frontend feature | Fetched production JavaScript did not contain `get_daily_delivery` or `admin_daily_emails`; the new frontend integration is not present in the inspected bundle |
| Live worker | Unauthenticated POST to the target `daily-question-email` function returned 404, not the expected worker 401. This is not evidence of verified scheduler authentication |
| Supabase access | A cached CLI login can list other projects, but the target project is absent. Target-scoped secret/function listing is unavailable |
| Vercel access | CLI reports `login_required`; current session cannot perform deployment |
| PostgreSQL/Docker | No `psql` command; Docker CLI exists but its daemon is unavailable |
| Scheduler | Local recipe is one five-minute pg_cron/pg_net job; hosted extension/job/Vault state is inaccessible |
| Email provider | Existing code uses SMTP through denomailer. Actual provider, sending mailbox/domain, quotas, reputation and sender verification are unknown |
| Secrets management | Expected Supabase Edge secrets and Vault for cron; hosted values/names could not be enumerated for this project |

The cached CLI account must be authenticated to an account/organization with access to the **actual target project**. Do not deploy to a different accessible Supabase project merely because it appears in the CLI list.

[Supabase's current limits](https://supabase.com/docs/guides/functions/limits) document 256 MB memory, 2 seconds CPU per request, 150-second request idle timeout, and 150/400-second worker wall-clock limits for free/paid tiers. The target plan is unknown. Hosted port 25/587 egress is blocked; this audit corrected the worker to require port 465 implicit TLS. Workers may overlap: the runtime must not be treated as a single-instance scheduler.

## 3. Configuration inventory — names only

Local status is not a claim about hosted settings.

| Name | Local process/project configuration | Target hosted state |
| --- | --- | --- |
| `SMTP_HOST` | Missing | Unknown: access unavailable |
| `SMTP_PORT` | Missing; code has a safe hosted default | Unknown |
| `SMTP_USER` | Missing | Unknown |
| `SMTP_PASS` | Missing | Unknown |
| `SMTP_FROM` | Missing | Unknown |
| `SMTP_FROM_NAME` | Optional; code default | Unknown |
| `SMTP_REPLY_TO` | Optional | Unknown |
| `CRON_SECRET` | Missing | Unknown |
| `APP_URL` | Missing; code default | Unknown |
| `SUPABASE_URL` | Missing as a server variable; frontend URL exists | Normally supplied by Supabase; not inspected |
| `SUPABASE_SERVICE_ROLE_KEY` | Missing | Normally supplied by Supabase; not inspected |
| `SUPABASE_ACCESS_TOKEN` | Missing in process; cached CLI login lacks target access | Not an Edge secret requirement |
| `SUPABASE_DB_PASSWORD` / `DATABASE_URL` | Missing | Direct SQL testing unavailable |
| `VERCEL_TOKEN` | Missing; saved login requires renewal | Deployment unavailable |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Present in local frontend configuration | Live bundle uses the expected project |

Server secrets must remain outside `VITE_*`, source control and chat. Supabase's [secret-management documentation](https://supabase.com/docs/guides/functions/secrets) distinguishes runtime-supplied service settings from custom secrets.

## 4. Migration safety

Local review and executable fixture tests confirm:

- The migration is transactional and creates the global singleton with `enabled=false`. It does not call SMTP, pg_net, or cron, and cannot initiate an email.
- Existing profiles and auth/subscription/question rows are not rewritten. New preference rows default to enabled/07:00/Africa-Accra while preserving stored opt-outs.
- Known historical sent/answered daily questions are imported. An added fixture now tests an actual legacy sent-and-answered row, not just an empty source table.
- New-user defaults and bidirectional legacy preference synchronization are tested, including legacy profile creation after an opt-out.
- `UNIQUE(user_id, scheduled_date)`, foreign keys, retry bounds, status constraints, partial queue indexes and date/history indexes exist.
- RLS is enabled. Preference updates are owner/column restricted; delivery and worker operations are protected through RPC grants; admin reporting and global updates require admin/super-admin roles.
- Old `list_daily_question_recipients()` becomes empty, preventing a subsequently invoked legacy worker from running the old campaign. It cannot cancel an old worker already in flight: retire the old schedule and drain in-flight runs before applying.
- Reapplication is managed by versioned migration history; the migration is not an arbitrary repeatable SQL script. Applying over manually created conflicting objects will fail transactionally and needs reconciliation, not forced partial execution.

Forward safety against the real hosted schema, data volume, lock duration and complete historical migration chain is **not proven**. The local tests use representative prerequisites in PGlite. No production migration was applied.

## 5. Changes made in this phase

1. Corrected the hosted SMTP transport to implicit TLS on port 465 and rejected blocked port 587. Retained the existing provider integration; no new provider was introduced.
2. Centralized transport in `smtp.ts`; added sender mailbox/name validation and optional Reply-To. SMTP debug logging stays disabled.
3. Extracted a testable HTTP handler. It authenticates POST requests before accessing the database, reads the global flag, returns a zero-work paused result before SMTP setup, and fails closed when pause state cannot be read.
4. Added `diagnose:daily-email`, requiring `--to <explicit-mailbox> --send-one`. It has no database client, user-list query, retries, CC or BCC input. It sends a plain-text/HTML diagnostic only to the single supplied address, once.
5. Added cron-setup guards: global flag must be paused, cron/network extensions must exist, and both required Vault secrets must be present without duplicates.
6. Added separate ambiguous/permanent-failure run counters and a prominent admin message explaining that ambiguous sends require manual review and cannot auto-retry.
7. Added transport configuration, diagnostic recipient, HTTP auth, paused/no-work, unknown-pause-state, legacy-history backfill, and manual-review UI coverage.

The approved diagnostic was invoked, but missing SMTP configuration stopped it with `attempted: 0`. SMTP authentication, provider acceptance, From alignment and inbox placement were not tested.

## 6. Scheduler and concurrency controls

Invocation is server-side POST `/functions/v1/daily-question-email` with `x-cron-secret`. Gateway JWT verification is disabled for this function only; the secret check is mandatory in the handler. Missing/wrong-secret POSTs and non-POST requests are rejected before database access in executable handler tests.

The intended named job is `nursefaculty-daily-email`, every five minutes, using pg_net and Vault secret names `daily_email_project_url` and `daily_email_cron_secret`. No job was created remotely. The paused production smoke test could not run because the target worker/access/configuration is unavailable; the equivalent local handler test passed.

Reservations lock due preference rows using `FOR UPDATE SKIP LOCKED`, with bounded limits and `ON CONFLICT DO NOTHING`. Worker claims lock deliveries and issue lease tokens; send authorization requires the matching token/state plus fresh eligibility, preference, date, publication and global checks. Sent deliveries cannot be reclaimed. The database constraint guarantees one assignment per user/local date, not exactly-once SMTP transport.

At most 100 due preferences and 100 claimed jobs per invocation, four lanes, a 35-second start-work budget, and a 15-second SMTP timeout. A database/provider stall can still reach the platform timeout; the sending ledger state protects against automatic resend after ambiguity. Throughput must be tested against provider quotas; default cadence cannot promise thousands of deliveries within five minutes.

Temporary explicit rejections retry the same assignment/question, with at most three total attempts and 5/20-minute backoff. Ambiguous network outcomes and stale sending leases are held, never automatically retried. Reserved leases expire safely; late acknowledgements can reconcile the original token. No protection was weakened for testing.

PGlite serializes DB requests. The overlapping-worker tests passed locally but **do not replace real multi-connection hosted tests**. No hosted reservation, worker, retry, timeout or restart test was performed.

## 7. Pilot and deliverability

One explicit recipient is authorized. Dedicated account IDs and a staging/test environment remain unverified. No ordinary production account was enrolled, created or modified.

The current global pause blocks every campaign worker, including would-be test accounts. A real campaign pilot must use an isolated staging project with dedicated accounts, or a separately reviewed server-side allowlist path. Do not toggle the ordinary production switch on to make a pilot run. The diagnostic can operate independently because it only sends to an explicit mailbox and cannot enumerate users.

Pending pilot checks: Accra and another IANA timezone at different local times, UTC/local timestamp comparison, login return to assignment, correct/incorrect answers, pre-answer secrecy, admin history, opt-out, non-repetition, retries and mobile mailbox rendering. Local SQL/UI tests cover the application contracts, not delivered email or a live browser-auth journey.

Public DNS-over-HTTPS observations for **the application domain** found no TXT/SPF record at `nursefaculty.org`, no TXT/DMARC record at `_dmarc.nursefaculty.org`, and no MX answers at the apex. These observations do not identify the actual outgoing domain; `SMTP_FROM` is unknown. MX is not by itself a prerequisite for outbound mail.

If this application domain is intended as the From domain, configure the existing provider's authorized SPF TXT record, provider-issued DKIM selector/key record, and a deliberate aligned DMARC policy before testing. Exact DNS values cannot be derived without the actual provider/sender configuration. No DKIM selector was guessed and no DNS record was changed. Recipient-side Authentication-Results, DKIM signatures, spam placement and link/rendering checks require an actual received test message and its headers.

## 8. Monitoring audit

Local code provides structured run start/end/paused/failed events, due/reserved/conflict/no-question counters, processed/sent/failed/retryable/ambiguous/permanent-failure counters, and per-delivery sanitized outcome logs. Database/admin history records attempts, failed/answered/sent timestamps, correctness, recipient and safe diagnostic categories. Unknown outcomes are explicitly labeled for manual review.

No application log includes passwords, service keys, cron secrets, SMTP credentials, raw SMTP errors, email body or answer keys. Diagnostic output omits recipient and secret values. Delivery/open/click/bounce webhooks are unsupported by the current SMTP abstraction; invalid-address SMTP rejections are suppressed, but asynchronous bounce telemetry is not fabricated.

Hosted log retention, alerts, cron/pg_net monitoring, provider dashboards, provider rate/daily limits, and bounce/suppression policies remain unverified. No statement that monitoring is operational in production is warranted.

## 9. Validation results

| Check | Result |
| --- | --- |
| Daily email database/worker/handler/config tests | 28 passed, 0 failed |
| Daily email UI tests | 7 passed, 0 failed |
| Existing lifelong utility/UI checks | Passed; 6 UI tests |
| Existing security contracts | 18/18 passed |
| Existing explanation checks | 11/11 passed |
| Edge Function + diagnostic typecheck | PASS |
| Deno lint | PASS; 6 files checked |
| Frontend production build | PASS; existing large-bundle warning remains |
| Whitespace check | PASS; Windows line-ending advisories only |
| Explicit-recipient SMTP diagnostic | FAIL / blocked before connection; 0 sends attempted |

## 10. Launch decision and blockers

**PRODUCTION READINESS: NOT READY**

**Critical**

- Correct Supabase target-project access and Vercel authentication are unavailable. No deployment, secret audit, migration application, hosted pause verification or scheduler smoke test can be performed.
- SMTP authentication/sender/provider configuration is unavailable, so the approved test message cannot be sent or verified.
- Production global state is inaccessible. It must never be labeled remotely paused merely because the migration default is false.

**High**

- Full migration-chain/staging upgrade validation and actual multi-connection concurrency/restart tests remain pending.
- Controlled pilot, secure browser login/answer flow and real deliverability checks remain pending.
- Sender-domain verification, SPF/DKIM/DMARC alignment, provider quotas and bounce policy are unknown.
- There is no isolated staged campaign pilot currently configured; the production master switch must remain untouched.

**Medium**

- Production alerting/log retention, operator reconciliation of unknown sends, and realistic throughput measurements remain pending.
- Changes are uncommitted; prepare a reviewed release snapshot and rollout/rollback record before controlled deployment.
- SMTP cannot guarantee exactly-once delivery after an ambiguous acknowledgement; preserve manual review and explicitly accept this documented operational limitation before launch.

**Low**

- Existing frontend bundle-size warning and mobile mailbox rendering verification.

| Required final status | Outcome |
| --- | --- |
| Production deployment performed | NO |
| Migrations applied to production | NO |
| SMTP verified | FAIL — blocked/unverified |
| Scheduler verified | FAIL — hosted invocation unavailable; local pause/auth checks pass |
| Hosted concurrency | FAIL — not executed |
| Controlled test email | FAIL — no send attempted |
| Secure answer flow | FAIL as a hosted gate; local owner/grade/secrecy tests pass |
| Timezone validation | PASS locally; hosted timestamp/pilot verification pending |
| Retry validation | PASS locally; hosted provider-failure test pending |
| Ambiguous timeout handling | PASS locally; hosted crash/timeout validation pending |
| Admin monitoring | PASS locally; hosted operation pending |
| Global system status | PAUSED in the migration/local tests; actual hosted state UNKNOWN; no enablement performed |

FAIL in this table means a required hosted gate is unsatisfied, not that a failed live send or duplicate was observed.

## Resume requirements

Complete `npx supabase login` with target-project access and `npx vercel login`, then verify the target again. Provide SMTP configuration securely through the deployment environment; do not paste it into chat. Confirm provider quotas/sender domain and a staging project/dedicated pilot accounts. The single-recipient diagnostic can then be run with the approved address using `npm run diagnose:daily-email -- --to <approved-recipient> --send-one`.

After authentication, resume with read-only production schema/secret-name/cron audits, migration rehearsal, controlled deployment while paused, and the remaining hosted/pilot gates. **Do not enable globally as part of this phase.**
