# Access & Promotions implementation status

Current commit: efa6151. All work below is local and uncommitted.
No push, deployment, live payment, production flag change or email send occurred.
Existing subscription amounts and the daily-email sending cohort are unchanged.

## Current / remaining matrix

| Area | Implemented locally | Remaining verification |
| --- | --- | --- |
| Grants | Create/schedule/extend/revoke, paid-first access, profile shortcut, reports/history and forms | Hosted RLS and complete-schema rehearsal |
| Bulk | CSV/paste/selected users, preview, confirmation, atomic idempotent execution | Hosted workflow and visual review |
| Promos | Existing-table extension, normalized codes, granular RPCs, wizard, lifecycle, redemption reports | Full-schema and hosted compatibility |
| Redemption | Transactional total/per-user limits, appended free periods, rollback, zero-cost confirmation | Hosted end-to-end tests |
| Hubtel | Server Mobile Money adapter, config validation, create/verify/callback, orders, reservations, settlement, receipts | Merchant configuration and controlled provider transaction |
| Notifications | Existing in-app transport, deduplication, optional notices, 7/3/1-day/expiry reminders | Hosted scheduling; no generic SMTP queue exists |
| Reporting | Combined audit sources, actor/student/promo/date/action filters, overview and payment monitor | Visual/manual review |
| Migrations | Six new migrations; all 102 files replay; reconstructed-baseline upgrade passes | Actual hosted-schema upgrade unverified |

## Files changed

- Configuration: .env.example, package.json, supabase/config.toml.
- Existing app integration: src/main.jsx, src/components/UserManagement.jsx,
  src/components/PaymentsView.jsx.
- New app components: AccessPromotions.jsx, PromotionManager.jsx,
  PromotionCheckout.jsx, AccessPaymentMonitor.jsx and access-promotions.css.
- Service: src/services/accessPromotions.js.
- Provider: supabase/functions/_shared/hubtel-provider.ts; hubtel-checkout and
  hubtel-callback index.ts/deno.json pairs.
- Existing policy helper: supabase/functions/_shared/promotion-pricing.js.
- Six migrations from 20260919220000 through 20260920030000.
- Approved historical replay repairs: 20260619233000 (extension schema),
  20260624070000 (role helper/policies), 20260702320000 (exact seed matching
  for existing NGN repairs), 20260719110000 (qualified crypto function).
- Inactive scheduler recipe: supabase/setup-access-reminders.sql.
- Tests: access-grants.test.mjs, promotion-pricing.test.mjs,
  access-admin-ui.test.jsx, promotion-ui.test.jsx, promotion-database.test.mjs,
  promotion-concurrency.test.mjs, access-payments.test.mjs,
  hubtel-provider.test.ts, access-full-migration-rehearsal.test.mjs and
  fixtures/promotion-database.mjs, all under scripts.
- Documentation: this report, ACCESS_PROMOTIONS_DISCOVERY.md and
  ACCESS_PROMOTIONS_STAGING_RUNBOOK.md.

## Validation

| Latest executed suite | Passed | Failed | Runner-skipped |
| --- | ---: | ---: | ---: |
| Access/promo/payment/pricing Node suites | 54 | 0 | 0 |
| Existing daily-email/diagnostic/permissions Node suites | 31 | 0 | 0 |
| PostgreSQL grant/promo/payment/bulk concurrency | 12 | 0 | 0 |
| Seven UI test files | 36 | 0 | 0 |
| Hubtel provider mocked transport | 6 | 0 | 0 |
| Complete historical migration rehearsal | 3 | 0 | 0 |
| Total latest runner entries | 142 | 0 | 0 |

Node counts include suite-parent entries. Earlier migration runs failed; after
approved local historical repairs the latest run passed both scenarios and their
parent. This is a reconstructed baseline, not a snapshot of production.

The fresh database contains 7,194 seeded questions, no missing NGN structures,
pgcrypto in extensions, and all three new controls false. The upgrade preserves
its baseline question count. Isolated disposable containers were removed after
testing. No hosted data was read or changed. This follow-up also reran security
contracts (18/18), explanation checks (11/11), JavaScript syntax and diff checks.
Other suite results above are retained from the preceding implementation run.

Security contracts: 18/18. Structured explanation checks: 11/11.
Lifelong utility check passed. Scoped lint/typecheck passed for five
pricing/provider/worker files. No repository-wide frontend lint/typecheck script
exists; these are not global claims.

Production build passed with the existing large-chunk warning (~1.25 MB).
git diff --check passed; LF/CRLF warnings are informational.
No dependencies were added or package-lock changes made. A Deno auto-resolution
attempt was replaced with isolated configuration; npm ci restored pinned packages.

Not run / not established: actual hosted-schema upgrade, deployed Edge Function
end-to-end tests, merchant verification, callback registration, visual viewport
review at 1440/1024/768/390. These are not runner-skipped tests.
The full requested acceptance matrix has not passed.

## Exact blockers

1. Actual-schema upgrade rehearsal and hosted RLS/Edge end-to-end checks remain
   unverified. Synthetic fixtures do not replace them.
2. Browser visual/responsive review remains unperformed.
3. External: merchant credentials, account endpoint eligibility, callback
   registration, designated controlled payment and live verification. The provider
   adapter and mock tests are implemented despite missing live credentials.

## Requested 28-field report

| # | Item | Status |
| --- | --- | --- |
| 1 | Current commit | efa6151 |
| 2 | Files changed | Listed above; local/uncommitted |
| 3 | Migrations | Six new migrations; four approved local historical repairs |
| 4 | Access grants | Implemented and locally tested |
| 5 | Bulk grants | Implemented; duplicate-request PostgreSQL race passed |
| 6 | Promos | Backend and wizard/lifecycle/reporting implemented |
| 7 | Promo concurrency | Recipient/promo locks; final-slot/per-user races passed |
| 8 | Admin UI | Implemented; visual review pending |
| 9 | Checkout | Server-priced payable and zero-cost flows implemented |
| 10 | Hubtel provider | Mobile Money create/verify adapter and mocks implemented |
| 11 | Callback | Independent provider verification and idempotent settlement |
| 12 | Zero-cost checkout | Atomic access outcome; no provider/fake payment |
| 13 | Billing | Paid/Discounted receipts; Fully Discounted/Promo Access confirmations |
| 14 | RLS | Targeted tests pass; complete hosted schema unverified |
| 15 | Audit | Grants, bulk, promo lifecycle/redemption, checkout/payment |
| 16 | Notifications | In-app deduplication/reminders; no new SMTP transport |
| 17 | Flags | Three server controls and frontend flag default off |
| 18 | Tests added | Database, mocks, UI, concurrency, full-history rehearsal |
| 19 | Passed | 142 latest runner entries; prior runs retained as described |
| 20 | Failed | 0 in latest runs; earlier migration failures repaired |
| 21 | Skipped | 0 runner-skipped; unperformed checks listed separately |
| 22 | Lint | Scoped five-file server lint passed |
| 23 | Typecheck | Scoped pricing/provider/worker typecheck passed |
| 24 | Build | Passed; bundle warning |
| 25 | Software blockers | Actual hosted-schema/end-to-end/visual validation |
| 26 | External blockers | Merchant setup, callback registration, controlled verification |
| 27 | Deployment | No migrations/workers deployed |
| 28 | Production enablement | No production controls changed |

IMPLEMENTATION INCOMPLETE
