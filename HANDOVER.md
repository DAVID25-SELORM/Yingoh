# NurseFaculty: handover notes (25 November 2026)

## 1. State of the code
- `main` is pushed. The live site (nursefaculty.org) was checked on 25 Nov and serves the latest code (the promo-form fix `c60a5fc`, single-listed plans, the diagnostic screens).
- **Production database, Edge Functions and secrets could not be checked on 25 Nov.** The Supabase CLI login was rejected. Anything below marked "last checked" may have changed since.

## 2. Regression result (25 November 2026, local)
All 23 suites passed.

| Area | Result |
| --- | --- |
| Production build | pass |
| Daily email: database / screens, plus deno check and lint | 34 / 25 pass |
| Access and promotions, plus deno check and lint | 54 pass |
| Access screens | 19 pass |
| Access concurrency (Docker) | 12 pass |
| Full migration rehearsal, fresh and upgrade (Docker) | 4 pass |
| Promo codes end to end (Docker) | 1 pass (many checks inside) |
| Promo logic and plan de-duplication | 17 pass |
| Diagnostic: database / screens / question content | 8 / 11 / 10 pass |
| Roles (database and Edge Function) | 5 + 3 pass |
| Instructor, Hubtel, lifelong learning, effective permissions | 13, 7, 6, 1 pass |
| Other screen tests not in an npm script | 7 pass |
| Security, explanation and question-bank validators | pass |

**If the Docker suites fail with "timed out after 90000ms":** check the machine first. On the first run they failed only because the computer was at 100% CPU with under 1 GB of free memory and many other containers running (a fresh database took 84 seconds to start). They passed unchanged once it was idle. Run them on their own.

`npm run diagnose:daily-email` was **not** run: it sends a real email.

## 3. To finish in production
Run these as someone with access to the **Yingoh** Supabase project. Take them in order and stop if any step errors.

| # | Step | How | State |
| --- | --- | --- | --- |
| 1 | See which migrations are missing | `npx supabase migration list --linked` | All up to `20260923000000` were applied and checked on 23 Sep. |
| 2 | Merge duplicate plans | SQL editor: run `supabase/checks/payment-plans-duplicates.sql`, then `supabase/migrations/20260923010000_deduplicate_payment_plans.sql`, then the checks again. Query 1 should return nothing. | **Not confirmed.** The screens already show each plan once. |
| 3 | Load the 50 draft diagnostic questions | SQL editor: `diagnostic-content/parts-b-d.import.sql` (safe to run twice) | **Not confirmed.** They arrive as hidden drafts. |
| 4 | Record any file run in the SQL editor | `npx supabase migration repair --status applied <version> --linked` (migrations only) | Needed after step 2 so the history stays correct. |

Do **not** use `supabase db push` unless step 1 shows exactly the files you expect.

## 4. Payments: not working yet
Applying a promo code works (tested). **Completing a payment does not**, as far as could be checked:
- Card checkout is switched off in the code (`CARD_GATEWAY_ENABLED = false` in `PaymentsView.jsx`).
- Mobile Money uses `create-paystack-order`, which stops without `PAYSTACK_SECRET_KEY`. That secret was not present when last checked (21 Sep).
- The newer GHS / Hubtel checkout is not live (last checked 22 Sep): `hubtel-checkout` and `hubtel-callback` not deployed, no `HUBTEL_*` secrets, `hubtel_payments_enabled` off, and the Access & Promotions screens hidden (`VITE_ACCESS_PROMOTIONS_ENABLED` not `true`).

**Choose one.**
- **Paystack:** set `PAYSTACK_SECRET_KEY` (test key first) in Edge Function secrets, then make one test payment. Check `USD_TO_GHS` in the function; it is a fixed indicative rate.
- **Hubtel:** deploy both functions (`npx supabase functions deploy hubtel-checkout` and `... hubtel-callback`), set `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_MERCHANT_ID`, `HUBTEL_API_BASE_URL`, `HUBTEL_CALLBACK_URL` (`APP_URL` was set on 22 Sep), run one sandbox payment, then enable. See `PROMO_CODES_ADMIN_GUIDE.md`.
  - Before enabling: a paid result is accepted only if Hubtel returns `disputed=false` and `totalAmountRefunded=0`. This has not been checked against a real Hubtel response. Look for `hubtel_verification_unresolved` in the function logs.

## 5. Promo codes
- Create them in **Payments → Promo Codes** (Super Admin only). Codes are generated automatically; only Percentage and Fixed USD types work. An expiry date includes that whole day.
- These codes work with the older USD checkout. Codes made in the newer Access & Promotions screen work only in the newer checkout.
- **Check the sample codes.** `YINGOH10`, `NCLEX25` and `NEWSTUDENT` came with the starter data. On 19 Nov `YINGOH10` was active, with no expiry and no usage cap. Switch off any you don't want.
- The "Applied" column counts every time a code is checked, not completed purchases.

## 6. Daily emails
- Last checked 21 Sep: sending enabled, mail settings stored, audience **Paid subscribers only** with no paid subscriptions, so nobody was being emailed.
- To include free users: **Daily Emails → Overview → Recipient audience → All users**. This sends real emails to real people at their next delivery time. Send a test to yourself first.

## 7. SMART NCLEX diagnostic
1. A licensed nurse educator reviews `diagnostic-content/PARTS_B_D_REVIEW_SHEET.md` (every keyed answer and wrong option). The 50 items are drafts written with AI assistance and are **not clinically approved**.
2. Load the drafts (section 3), then approve each in **Content Review** with a real reference.
3. **Diagnostic Admin:** create a form, **Propose Part A (100)**, add the 50 for Parts B–D, check the list shows 150, publish, assign students.
4. The screens were tested with sample data only, not yet by a signed-in user in production.
5. Not built: instructors seeing only their own students; matrix and highlight question types; keeping diagnostic questions out of practice.

## 8. Security: do these first
- **Revoke every credential that was shared in chat** and make new ones: the Supabase access token (25 Nov) and the Gmail app password (about 21 Sep). If that app password is the one stored as `SMTP_PASS`, put the new one in Edge Function secrets or daily email will stop.
- There was **one** Super Admin (23 Sep). Add a second, with multi-factor sign-in on both.
- Only a Super Admin can now create or change Admin accounts.
- Still open: moving older permission checks from role names to permissions, audit-log read access, and tightening table privileges on the older role tables.

## 9. Useful commands
```
npm run build
npm run test:daily-email
npm run test:access-promotions
npm run test:access-ui
npm run test:access-concurrency      # Docker
npm run test:access-migrations       # Docker
npm run test:promo-legacy            # Docker
npm run test:promo-ui-logic
npm run test:diagnostic
npm run test:diagnostic-content
npm run test:roles
```
Guides: `PROMO_CODES_ADMIN_GUIDE.md`, `DAILY_EMAIL_PRODUCTION_READINESS.md`, `ACCESS_PROMOTIONS_STAGING_RUNBOOK.md`.
