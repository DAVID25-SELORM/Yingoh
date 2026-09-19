# Daily NCLEX Question Email System — implementation and deployment report

Implemented locally on 18 September 2026. **Not yet certified production-ready:** hosted configuration, real SMTP acceptance, full migration-chain replay, and multi-connection PostgreSQL concurrency/load checks remain unverified. No hosted database was modified and no real email was sent.

Production-readiness follow-up: see `DAILY_EMAIL_PRODUCTION_READINESS.md` for verified target access, deployment evidence, and launch gates. SMTP now requires port 465 with implicit TLS: hosted Supabase blocks port 587. An authenticated paused invocation exits before SMTP configuration/connection or reservation, and a single-recipient diagnostic is available.

## Existing architecture and product policy

The application is a React 19/Vite SPA deployed with Vercel routing, Supabase Auth/PostgreSQL, and Deno Edge Functions. Login, signup, verification, and password recovery remain in the existing Supabase Auth service. The existing daily-email function uses denomailer 1.6.0 over SMTP; there was no queue abstraction or repository-defined daily-email cron. A separate optional pg_cron job sends in-app learning-renewal notifications; it is unchanged.

The existing daily campaign is explicitly a paid entitlement: active non-free subscription, with no expiry or a future expiry. This implementation preserves that policy rather than emailing every free account. Daily selection remains within published free/starter MCQ/SATA questions, which are available to the lowest paid tier. Instructor profiles with non-active account status are excluded. Auth-deleted, banned, unverified, invalid-address, and suppressed accounts are excluded. Verified `auth.users.email` is authoritative rather than the user-editable profile email. Requiring confirmation for this separate notification deliberately avoids sending to unverified contact addresses; verification/reset emails themselves are unchanged.

## Files created

- `supabase/migrations/20260918100000_daily_email_system.sql`: versioned schema, backfills, authorization, scheduler/worker RPCs, answer RPCs, reporting.
- `supabase/functions/daily-question-email/worker.js`: bounded worker, SMTP failure classification, escaped HTML and plain-text templates.
- `supabase/functions/daily-question-email/deno.json` and `deno.lock`: pinned Edge Function dependencies and reproducible Deno checks.
- `supabase/config.toml`: function-specific JWT gateway setting; application-level cron-secret authentication remains mandatory.
- `supabase/setup-daily-email-cron.sql`: one centralized five-minute job using Vault and pg_net.
- `src/components/DailyEmailSettings.jsx`: account notification preferences.
- `src/components/DailyEmailAdmin.jsx`: global switch, metrics, failures, filtered/paginated history.
- `scripts/daily-email.test.mjs`: executable PostgreSQL/PGlite and worker tests.
- `scripts/daily-email-ui.test.jsx`: settings, assigned-answer, and admin UI tests.
- `DAILY_EMAIL_IMPLEMENTATION.md`: this report/runbook.

## Files modified

- `supabase/functions/daily-question-email/index.ts`: replaces the old unbounded shared-question sender with the authenticated ledger worker, retaining SMTP.
- `src/components/QuestionOfTheDayView.jsx`: adds owner-checked delivery loading/grading while retaining the existing shared-question screen.
- `src/main.jsx`: assignment-link routing, Account preferences, role-restricted Daily Emails navigation.
- `src/components/LifelongLearning.jsx`: links to Account notification settings instead of duplicating controls; avoids saving stale email preferences with learning goals.
- `package.json`, `package-lock.json`: test/check scripts and development-only PGlite/Deno tools.

Existing unrelated `.claude/` files were left untouched. The IDE's personal-learning-cards migration was not changed.

## Database changes

Four new tables:

| Table | Purpose |
| --- | --- |
| `user_email_preferences` | One row per profile; enabled, local time, validated IANA zone, indexed `next_due_at`, timestamps |
| `daily_question_deliveries` | Immutable assignment identity, unique `(user_id, scheduled_date)`, question, zone, schedule, state, lease token, attempts, retries, results, answer history, actual recipient |
| `daily_email_config` | Singleton global switch, initially **disabled** |
| `daily_email_suppressions` | Server-only invalid-recipient suppression, scoped to the rejected email address |

No existing question/authentication/subscription columns were removed. Existing opt-outs are backfilled from `learning_profiles.daily_email`; other users default to enabled, 07:00, Africa/Accra. No existing per-user timezone convention was found. A profile insert trigger creates new-user defaults without depending on browser timezone detection. The Account page lets users explicitly confirm/change their timezone. Legacy preference triggers synchronize both ways without undoing an opt-out when a learning profile is first created.

Known legacy sent-question and answer history is imported into the ledger. Legacy send rows without a corresponding daily question cannot reconstruct question history; they still prevent another assignment for that date. The old `list_daily_question_recipients()` RPC now returns no recipients to protect against an old worker deployment.

Partial indexes cover enabled due preferences, pending retries, stale sends, per-user question history, and date/status reporting. RLS is enabled on all new tables. Users have select and column-limited update rights only on their own preferences. Delivery reads/grading require owner-checked RPCs. No client can assign a question, alter correctness, mark a send complete, read suppression records, or invoke worker functions. Reporting and the master switch require admin/super-admin roles in the database as well as the UI.

## Scheduling and question selection

`reserve_daily_emails` locks bounded due preference rows with `FOR UPDATE SKIP LOCKED`, computes the local date/time with PostgreSQL IANA rules, and creates today's assignment with `ON CONFLICT DO NOTHING`. The unique user/local-date constraint is the final assignment guard. It advances the due timestamp using the next local calendar date, not a fixed 24-hour UTC interval; DST changes therefore follow the saved timezone.

An outage never backfills every missed date. Before sending, workers also require the assignment date still to be today in its saved zone. Changing a preference cannot create a second assignment with the same local date. A changed timezone can change what local date is current; the invariant is per local calendar date, not one email in every rolling 24-hour window.

Eligible published questions must pass MCQ/SATA, minimum-plan, review-status, choices, answer-key, and rationale checks. Selection prefers questions absent from this user's entire assignment history, including failed sends. After exhaustion it chooses the least recently assigned question. A retry always uses the same delivery row/question. A `no_question` run metric reports empty eligible pools; investigate publication/quality gates if it is nonzero.

## Worker, state transitions, duplicate protection, and retries

One invocation reserves at most 100 due preferences, then runs four worker lanes claiming at most 100 jobs total. It stops starting work after 35 seconds; SMTP attempts have a 15-second timeout. Delivery capacity is bounded by SMTP latency and provider limits. Load-test the expected 07:00 cohort: 100 completions every five minutes is an upper bound of 1,200/hour at the default cadence, not a guarantee that thousands all arrive within five minutes. For larger cohorts, tune a single centralized job's cadence and tested batch/concurrency limits to provider quotas.

Transitions are only exposed through service RPCs:

- `scheduled -> reserved`: atomic claim and fresh lease token.
- `reserved -> sending`: token validation and a fresh global/eligibility/opt-out/question check.
- `sending -> sent`: SMTP accepted and ledger acknowledgement succeeds.
- `sending -> failed`: sanitized failure category and retry decision.
- `failed -> reserved`: only explicit retryable outcomes, below the limit, after backoff, still today.
- `sent -> answered`: first server-graded answer; answers received before SMTP finishes retain delivery state until acknowledgement.

Expired reserved leases are reclaimable after five minutes because no send was authorized. A worker that already entered sending is **not** automatically resent: after ten minutes it becomes failed with `delivery_outcome_unknown`. Delayed completion can still record success using the original lease. Sent rows are never claimed again. A database failure after SMTP acceptance stops processing rather than sending again.

`retry_count` counts total SMTP attempts, capped at three (initial attempt plus two retries). Explicit 4xx SMTP rejections and known preconnection failures retry with 5- then 20-minute backoff. Explicit 5xx rejections stop. Enhanced invalid-address rejections (`5.1.1`/`5.1.3`) suppress future daily sends to that rejected address; a different verified address is not suppressed. Unknown/network timeout outcomes are held for investigation.

**SMTP limitation:** a unique ledger row does not provide exactly-once transport. This implementation prioritizes avoiding duplicate messages over blindly retrying ambiguous outcomes. It cannot guarantee that every eligible user actually receives one message every day. Strict recoverable exactly-once acceptance requires an email provider API with a documented idempotency/reconciliation contract. The deterministic RFC Message-ID helps correlate provider logs but is not a deduplication guarantee. denomailer returns no provider message ID, so `provider_message_id` remains null rather than inventing one.

Structured logs contain run start/end, due/reserved/conflict/no-question counts, sent/failed/retryable counts, delivery IDs, and sanitized outcome categories. No recipient addresses, SMTP raw errors, secrets, or message bodies are logged by application code. SMTP debug output is disabled.

## Email, answering, settings, and admin experience

Emails contain NurseFaculty branding, greeting, topic, full stem/options, encouragement, an Answer Question button, and an authenticated Account preference link. All database text is HTML-escaped. The plain-text alternative contains the same learning content. Correct answers, rationales, review metadata, and credentials are absent.

Links use the existing SPA with `?dailyDelivery=<uuid>#/Question%20of%20the%20Day`. The UUID is an identifier, not authorization. Anonymous visitors see existing login; the query remains in the URL through password sign-in and the initialized view opens their assignment afterward. Only the authenticated owner can load or answer it. Answers must reference valid choices, MCQ requires exactly one choice, correctness comes from PostgreSQL, and a row lock preserves the first final answer. Explanations appear only after submission. Previously assigned published questions remain accessible to their owner after subscription expiry; new sends still require current eligibility.

Account settings provide enabled state, delivery time, IANA timezone, labels, saved/error feedback, and mobile-sized controls. Learning Hub links there. Disabling this notification does not disable password reset or verification emails.

Admin -> Daily Emails offers a global pause/resume, local-date metrics, status/name/email filters, recent failure diagnostics, and 50-row history pages. Metrics distinguish assigned, pending, SMTP-accepted, failed, answered, correct, and incorrect. Rates use assignments/answers with zero-denominator handling. No delivered/opened/clicked/bounced metrics are fabricated. Pausing leaves individual preferences unchanged; already-authorized in-flight sends can finish.

## Exact local validation results

| Command | Result |
| --- | --- |
| `npm run test:daily-email` | 28 database/worker/HTTP/config tests + 7 UI tests passed; 0 failed |
| `npm run test:lifelong` | Existing utility assertions and 6 UI tests passed |
| `npm run validate:security` | 18/18 passed |
| `npm run validate:explanations` | 11/11 passed |
| `npm run check:daily-email` | Deno TypeScript + checkJs check passed |
| `npm run lint:daily-email` | Deno lint passed, 6 files checked including the diagnostic |
| `npm run build` | Passed; Vite warns about the existing large application bundle (~1.21 MB minified) |
| `git diff --check` | Passed; only Windows LF/CRLF advisory messages |
| Dependency install audit | 0 vulnerabilities reported |

Tests exercise the actual new migration against an embedded PostgreSQL engine with representative existing-schema/Auth fixtures. They cover backfill/defaults, RLS, due/disabled/ineligible accounts, DST conversions, local midnight, assignment uniqueness, repeated concurrent invocations, overlapping sends, stale leases, retries, crash ambiguity, suppression, owner-only access, server grading, immutable first answers, pause/resume, no backlog, template escaping, opt-out synchronization, and UI controls.

PGlite serializes database requests within a single engine. Overlapping JavaScript worker tests therefore **do not establish real multi-connection lock behavior or production throughput**. Docker/PostgreSQL server was unavailable. The complete historical migration chain was not replayed; fixtures validate this migration's contracts, not every historical migration. A real browser login roundtrip and real SMTP inbox delivery were not exercised. The repository has no existing whole-app lint or TypeScript-check script; new Edge Function checks and the frontend build are the checks reported here.

## Deployment/configuration runbook

1. Pause/remove any existing external daily-email cron before rollout and allow its in-flight run to finish. Do not change the separate learning-reminder job.
2. Rehearse all migrations on a staging copy and on a fresh local Supabase database. Apply `20260918100000_daily_email_system.sql` after existing migrations. It starts paused and imports historical opt-outs/sends. Verify backfill counts and no duplicate `(user_id, scheduled_date)` rows.
3. Set server-only Edge Function secrets: `CRON_SECRET` (high-entropy random value), `SMTP_HOST`, `SMTP_PORT` (465 implicit TLS only), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (one mailbox), and `APP_URL` (production HTTPS origin). Optional `SMTP_FROM_NAME` defaults to NurseFaculty; optional `SMTP_REPLY_TO` accepts one mailbox. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never add service/SMTP secrets to `VITE_*` variables. Confirm the sender/domain is authorized and provider SPF/DKIM configuration is valid. Do not use port 587 on hosted Supabase.
4. Deploy the `daily-question-email` Edge Function with its local import map/config and lockfile; `supabase/config.toml` disables gateway JWT verification only for this function. The handler still requires POST plus the matching `x-cron-secret` before database access. Check missing/wrong secret returns 401 and non-POST returns 405. With the master switch off, an authorized invocation must send nothing.
5. Deploy the frontend together with this database/function release. Check Account preferences, cross-user denial, admin role denial, and emailed UUID login/answer flow with staging accounts. Do not enable sends while an old frontend that cannot open assignment links is active.
6. Enable Supabase `pg_cron`, `pg_net`, and Vault in the target environment. Create Vault secrets named `daily_email_project_url` (Supabase project URL) and `daily_email_cron_secret` (same value as `CRON_SECRET`). Run `supabase/setup-daily-email-cron.sql` once. The named job runs every five minutes; calling `cron.schedule` with the same name updates that job. Inspect cron and pg_net response history for failures. Secrets are retrieved from Vault, not hard-coded into cron SQL.
7. Load-test a realistic same-minute cohort in staging. Run two real database connections/workers concurrently, kill a reserved worker, kill one after SMTP handoff, and delay provider acknowledgements. Assert one assignment per user/local date, exclusive claims, no resend after acceptance, and appropriate unknown-outcome holds.
8. Keep the master switch paused throughout this deployment phase. After all readiness gates pass, obtain the user's separate final launch instruction before enabling through Admin -> Daily Emails. Monitor pending counts/age, sanitized failures, cron responses, and SMTP provider limits. Resume sends only for the current local day after an outage.

The scheduler recipe follows [Supabase's official scheduling guidance](https://supabase.com/docs/guides/functions/schedule-functions): pg_cron invokes an Edge Function through pg_net using Vault-held credentials. SMTP behavior was checked against [denomailer 1.6.0 source](https://deno.land/x/denomailer@1.6.0/client/basic/client.ts).

No provider webhook is required or configured because the existing SMTP integration exposes no webhook/event contract. If adding a provider webhook later, authenticate it, deduplicate events, and match provider IDs; do not infer delivered/opened status from SMTP acceptance.

## Operational recovery and remaining gates

- `delivery_outcome_unknown`: investigate the deterministic Message-ID in provider logs. Never reset these rows automatically. A trusted operator may record a known accepted outcome with the original lease through `finish_daily_email`; only retry after authoritative evidence of non-acceptance. Historical jobs are not sent.
- Invalid-recipient suppression: after confirming address correction, the server-only suppression row can be removed by an authorized operator; changing to a different verified Auth email naturally bypasses the old-address suppression. User preference flags remain unchanged.
- Rollback: pause the master switch and stop the central cron. Keep the ledger/history and backward-compatible old Question of the Day screen. Do not reactivate the old campaign concurrently.
- Outstanding launch gates: real SMTP configuration and sender validation, staging/full-chain migration replay, real multi-connection concurrency tests, browser auth-return verification, and throughput/load measurements.
- Strict guaranteed exactly-once transport is an unresolved provider capability, not something a SQL uniqueness constraint can supply. The implementation intentionally exposes this limitation instead of claiming production readiness.
