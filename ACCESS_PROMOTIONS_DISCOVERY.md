# Access & Promotions — discovery and implementation plan

Latest local follow-up from `efa6151`: see `ACCESS_PROMOTIONS_IMPLEMENTATION_STATUS.md` for current grants, promotions, Hubtel implementation, test evidence and migration blockers. The sections below describe the historical foundation state, not the current local implementation. Pushing and deployment remain prohibited.

Status: foundation plus gated entitlement integration implemented; full feature incomplete. User authorized source pushes on 19 September 2026. No production database writes, migration deployment, backfill, payment, or email send performed. Pushing main can trigger the existing Vercel build. No Hubtel endpoint is included; grant UI entitlement rollout remains off by default.

## Existing architecture

| Area | Repository evidence |
| --- | --- |
| Accounts | `auth.users` -> `public.profiles.id`; `roles` and `user_roles`; instructor metadata in `instructor_profiles` |
| Subscriptions | `subscriptions`: user_id, plan_name, status, provider/reference, current_period_end; not consistently linked to payment_plans by UUID |
| Products | `payment_plans` UUIDs with name, price_usd, duration_days, active flag. Frontend has symbolic keys free/thirty_day/ninety_day/master_180/faculty_365. Stripe maps symbolic keys to configured price IDs; Paystack uses separate fixed server price maps and a fixed USD-to-GHS rate |
| Current plans | Explorer, 30-Day Pass, 90-Day Success, 180-Day Master, 365-Day Faculty; internal entitlement keys free/basic/pro/master/faculty |
| Frontend access | `useSubscription` reads latest active subscription then checks expiry; `SubscriptionGate` and components consume its plan/entitlements/canAccess outputs |
| Server access | `current_subscription_plan_key` / `current_subscription_level`; `current_question_access_level` (question-service); `has_daily_question_access`; daily-email eligibility independently checks subscriptions; lifelong learning calls subscription-level functions; Study Coach uses database quota enforcement |
| Payment records | `invoices`, `billing_transactions`, billing settings/payment methods, institution accounts/license seats. Stripe webhook updates subscriptions and records invoices |
| Existing promotions | `promo_codes`, `promo_redemptions`, `validate_promo_code`, and PaymentsView promo forms already exist. Must evolve these rather than recreate incompatible tables |
| Roles | Granular permissions via permissions/role_permissions/user_permission_overrides, `has_permission` and effective-permission RPCs. Admin, super_admin and finance currently have broad billing/promo access |
| Audit | Both `audit_logs` and `admin_audit_logs` exist; use server-authored append-only events for this feature, with actor derived from auth.uid() |
| Notifications | `notifications` table and NotificationsBell support in-app delivery. No general-purpose email queue was found; daily-question delivery ledger/worker is purpose-specific, not a reusable arbitrary email queue |
| Scheduler | Five-minute daily-email pg_cron/pg_net recipe, Vault-authenticated worker, master switch. Production sending was explicitly enabled in the preceding task; do not change it or enqueue sends during implementation |
| RLS | Owner-scoped subscriptions/invoices/notifications, entitlement-gated content policies; existing promo redemption policy permits finance/admin/super_admin writes and deletes. New feature requires narrower server mutations and preservation of used history |
| Admin users | UserManagement supports invite/create and role management; suitable for a student Grant Access entry point |
| Billing UI | PaymentsView includes subscription selection, invoices, promos, transactions and manual activation; SubscriptionGate also starts Stripe checkout |
| Reusable UI | Existing sidebar and guarded view routing, primary/ghost/icon buttons, admin cards, responsive lists, dialogs, status feedback, Lucide icons, redesigned admin CSS |

## Risks to address, not hide

1. Current promo validation accepts caller-provided amount and user ID, updates applied_count during validation, and checks a cached used_count without transactional reservation locking.
2. Paystack inserts an applied redemption before initialization/payment success and counts applied rows against per-user limits. No completion/verification webhook exists in this repository.
3. Paystack enforces a minimum 100 pesewas charge even when a discount reduces the amount to zero.
4. Stripe uses recurring subscription checkout and currently receives no promotion. Discount duration must be defined before changing billing behavior.
5. Plans/prices/currencies have multiple representations. Fixed-discount denomination and rounding must be explicit; browser exchange-rate displays cannot authorize a payment amount.
6. Existing promo foreign-key cascade/deletion permissions conflict with immutable used history. Any migration must preserve existing rows and detect normalized-code collisions before a unique normalized index is introduced.
7. Latest-paid selection and highest-question-tier selection are not identical today. Preserve paid precedence without silently replacing the existing paid plan-selection policy.
8. A shared effective-access resolver must avoid recursion through entitlement functions and must not expose internal grant notes. Permission checks must not fall back to permissive client claims on RPC errors.

## Proposed implementation sequence

1. Establish compatibility fixtures for existing plans, promo rows, subscriptions, RLS and provider flows. Inventory every subscription-reading SQL function before migration authoring.
2. Add access_grants, immutable feature audit and idempotency/batch records. Extend existing promos/redemptions with validated benefit fields, grant links and checkout reservation states. Detect incompatible legacy rows; no silent deletion or fabricated redemption/payment backfill.
3. Add an internal timestamp-based resolver: valid paid subscription first, otherwise valid non-revoked grant, otherwise existing free baseline. Route current entitlement functions and frontend hook through safe adapters. Never mutate paid subscriptions on grant expiration/revocation.
4. Implement permission-checked transactional grant/extend/revoke/bulk RPCs. Admin cap: 30 days with cumulative-extension guardrails; sensitive promo management and bulk actions reserved for super-admin permissions. Derive actors server-side. Extensions create linked grants; overlapping free promo grants are rejected rather than silently stacked.
5. Upgrade promo validation to server-priced preview and atomic redemption/reservation. Lock promo and user scope; require idempotency keys; limits include live reservations but only settled successful payments become completed redemptions. Zero-total checkout creates auditable access, never a fake external payment.
6. Integrate authenticated Stripe/Paystack checkout and verified completion, retry, cancellation and reservation expiry behavior. Do not release a reservation while a provider payment could still settle without reconciliation.
7. Add Overview/Free Access/Promo Codes/History UI; student profile grant entry; bulk preview and explicit confirmation; safe student access summary; integrate existing checkout promo entry.
8. Use in-app notifications initially. Any email expansion must reuse the SMTP module with existing sending controls, preferences and deduplication; do not pretend the current question ledger is a generic queue. Access expiry remains timestamp-safe without cron.
9. Run all existing tests plus the requested grant/promo/payment/security/bulk suite. Use separate PostgreSQL connections for real concurrency tests, not PGlite serial execution. Rehearse migrations and test responsive views at 1440/1024/768/390. Report local versus hosted evidence separately.

## Billing direction

User selected Hubtel and explicitly instructed reuse of existing subscription amounts. Work proceeds on the basis of adding Hubtel while preserving existing Stripe/Paystack flows. No live Hubtel credentials or verified merchant checkout contract are available to this implementation. No network payment adapter or checkout button has been added. Do not treat pure pricing tests as Hubtel integration evidence. Pricing is now specified and tested; verified payment settlement is still required.

### Approved existing pricing

The new server-only `subscription-prices.js` catalog matches the existing Paystack USD amounts and its configured 11.34 GHS/USD conversion. This is the application's existing fixed conversion, not a current market-rate claim. Integer arithmetic produces the same undiscounted pesewa totals. Versioned immutable quotes reject unknown plans and browser-provided monetary amounts are not accepted as catalog input. Tests detect drift against the existing Paystack source. The catalog is not yet wired to a live Hubtel endpoint.

| Plan | Existing USD | GHS checkout amount |
| --- | ---: | ---: |
| 30-Day Pass | 19 | 215.46 |
| 90-Day Success Plan | 49 | 555.66 |
| 180-Day Master Plan | 79 | 895.86 |
| 365-Day Faculty Pass | 129 | 1,462.86 |

No additional price confirmation is needed. Hubtel merchant configuration and verified settlement implementation remain outstanding. Existing providers and browser exchange displays are unchanged. New promotion calculations must use the server-owned amount and explicit discount currency; currency conversion of fixed discounts must never be inferred.

The following questions apply only if existing providers are subsequently included in the new discount flow; those providers remain unchanged:

- Recurring Stripe discounts: first paid invoice only, or every renewal? Recommended default is first invoice only, retaining existing renewal pricing.
- Fixed discount currency: allow USD for Stripe and GHS for Paystack, rejecting currency mismatch (recommended), or define a centrally maintained exchange-rate conversion policy?

New-user rule proposed: no successful paid invoice/transaction or verified paid subscription history and no prior completed promo redemption; not account age. Failed/expired checkout reservations do not establish a completed redemption.

## Local foundation (19 September 2026)

- Migration `20260919200000_access_grant_foundation.sql`: access_grants, access_grant_events, granular permissions, authenticated grant/extend/revoke RPCs, own-account summary and effective-access projection. Not deployed.
- Recipient row locking serializes grant creation and extensions. Actor/request-key uniqueness plus canonical request comparison handles identical retries and rejects changed payloads. Timestamp comparisons use epoch values for timezone-independent idempotency.
- Extensions create new linked grants; overlap is rejected. Revocation is retained and audited, never deletes. Revoking a parent does not revoke separately granted extension rows; each grant is explicitly managed.
- Ordinary admins have a conservative cumulative lifetime 30-day recipient cap, including revoked grants; super admins are exempt from duration limits, not permissions. This intentionally prevents repeated grants/revokes from resetting authority. A configurable cap and bulk-specific permissions remain outstanding.
- Students cannot read raw grant/audit rows or write either table. Own summaries exclude notes, actors and request payloads. Staff reads require both admin role and view permission. Mutations require the corresponding granular permission. Public/anonymous RPC execution is revoked.
- The effective-access projection gives valid paid subscriptions precedence, then a non-revoked, currently valid grant, then free. Expiry is timestamp-based and scheduled grants do not activate early. The follow-up adapter migration and gated frontend now route interactive access through this projection; neither migration nor the rollout flag has been enabled in production. Do not deploy this as a complete access system.
- Pure pricing policy supports percentage basis points, fixed minor-unit discounts and free days; rejects client-supplied prices/identity, mismatched currencies, invalid windows, limits and overlapping free grants. It is NOT a redemption authorizer; atomic reservation/settlement is unimplemented.
- Notifications, admin UI, full student redemption UI, bulk workflow, promo schema compatibility migration, reservation coordinator and Hubtel verification remain outstanding.

## Validation evidence at the foundation commit (historical)

- `npm run test:access-promotions`: 29 passing Node test entries, including the database suite parent (28 leaf tests); no failures. Uses isolated PGlite fixtures, not hosted RLS evidence. Includes three catalog/conversion/zero-payment pricing tests.
- `npm run test:access-ui`: 5 hook tests passed, covering complimentary labels, paid fallback, fail-closed permissions, disabled rollout and expired grants/logout.
- `npm run test:access-concurrency`: 5 passing Node test entries, including the suite parent (4 leaf tests). Uses independent PostgreSQL 17 sessions in a disposable network-isolated Docker container with only synthetic records. Covers duplicate grant retries, overlap rejection, the cumulative admin duration cap under concurrent requests, and atomic rollback on audit failure. Container removed after the test. Does NOT cover promo reservations, provider callbacks, or bulk jobs, which are not implemented.
- Both server pricing modules' strict Deno JavaScript typecheck and lint: passed.
- Existing daily-email/diagnostic/permissions Node tests: 31 passed.
- Existing security contract checks: 18/18; explanation checks: 11/11; lifelong utility check passed.
- Production build passed, with the existing large bundle warning (about 1.21 MB uncompressed).
- Existing UI regressions: 4 files, 19 tests passed (question manager, super admin, lifelong, daily email). No new UI or responsive claims at this stage.
- Hosted/provider tests, promo/bulk concurrency tests, migration rehearsal against the complete schema and the remainder of the requested acceptance suite are outstanding.

## Remaining work at the foundation commit (historical)

1. Rehearse the entitlement adapter migration and enable the gated frontend only after the remaining feature is validated. Explicitly review the daily-email cohort separately; this update does not expand live sending.
2. Implement the admin/student UI, notifications, paginated reporting, profile shortcut and confirmed bulk workflow.
3. Extend legacy promo schema safely and implement transactional redemption, reservations, settlement, reconciliation and zero-payment access grants.
4. Confirm Hubtel merchant checkout/verification contract and server-side configuration; implement and test the provider adapter using the approved existing prices, without trusting browser/callback assertions alone.
5. Complete full-schema migration rehearsal, RLS acceptance coverage, promo/bulk concurrency, responsive review and hosted/provider tests.

Items 1–3 are unfinished implementation, not merchant-account blockers. A source push does not make this feature complete or ready to enable. Do not deploy the foundation migration as though it delivers the full feature.

## Entitlement integration follow-up

- Added `20260919210000_access_entitlement_adapters.sql`. The existing subscription-plan entry point now resolves grants, so dependent planner, learning, video, flashcard and quota consumers use the same access decision after migration. Question access preserves its existing highest-paid-tier behavior and only falls back to grants. The on-site daily question check accepts grants without changing paid eligibility.
- Live daily-email eligibility is intentionally unchanged: no expansion of the production sending cohort during this work.
- `useSubscription` can consume the own-account effective-access RPC when `VITE_ACCESS_PROMOTIONS_ENABLED=true`. The flag defaults off. This is a rollout switch, not an authorization boundary; the database remains authoritative.
- Frontend fixes: filter expired subscriptions before selecting the latest record, reject stale account fetch completions, refresh on focus/expiry, and respect empty or failed permission responses instead of restoring static role permissions. Valid paid records remain a fallback if the new grant RPC is unavailable; grants never use that fallback.
- Student billing distinguishes complimentary access from a paid subscription/invoice and displays no automatic renewal for grants.
- Added five hook tests and a paid-basic-vs-master-grant database regression. Full admin UI, bulk, promotions lifecycle and Hubtel adapter still remain; this update must not be described as completing those features.

PRODUCTION READINESS: NOT READY. This is an undeployed foundation and gated entitlement integration, not the completed Access & Promotions feature.
