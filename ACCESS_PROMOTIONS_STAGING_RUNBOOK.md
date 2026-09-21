# Controlled Access & Promotions staging

No hosted actions below have been performed. Do not push, deploy, enable
production or initialize live payments without explicit authorization.
Existing daily-email controls and Auth SMTP are unrelated; do not change them.

## Migration gate

Full chronological replay now passes all 102 migrations after approved local
repairs: role-table authorization, exact seed matching for three existing NGN
repairs, extension schema placement and a qualified crypto call. The reconstructed
baseline upgrade also passes. These do not prove equivalence to the live schema.
Do not replay already-applied historical migrations against production or silently
mark migrations applied. Review a sanitized actual-schema upgrade separately.

Apply all six new migrations together, in order:
20260919220000, 20260919230000, 20260920000000, 20260920010000,
20260920020000, 20260920030000.
Keep controls paused throughout. The bulk routine's notice helper is introduced
in the immediately following migration.

The normalized-code index fails safely on trim/uppercase collisions. Review
colliding legacy data; never delete historical redemptions to force installation.
Rehearse a sanitized actual-schema upgrade before any deployment.

## Configuration and contract

Server-only Edge secrets:
HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET, HUBTEL_MERCHANT_ID,
HUBTEL_API_BASE_URL, HUBTEL_CALLBACK_URL, APP_URL.
Supabase supplies its URL, anon key and service-role key.
Never use VITE_ names for merchant/service credentials or expose values in logs.
Callback URL must be HTTPS without query/hash. APP_URL is the exact frontend origin.

The provider supports server-side Mobile Money prompts (MTN/Telecel/AT), not
card-data collection, refunds or payouts. No browser Basic-auth SDK is used.
Official contract: Hubtel Android SDK commit
5c909a912151c64476d3b45ec3fa65dc7a6c71ff:

- [API service](https://github.com/hubtel/hubtel-mobile-android-merchant-checkout-sdk/blob/5c909a912151c64476d3b45ec3fa65dc7a6c71ff/checkout-sdk/src/main/java/com/hubtel/merchant/checkout/sdk/platform/data/source/api/UnifiedCheckoutApiService.kt)
- [Prompt request](https://github.com/hubtel/hubtel-mobile-android-merchant-checkout-sdk/blob/5c909a912151c64476d3b45ec3fa65dc7a6c71ff/checkout-sdk/src/main/java/com/hubtel/merchant/checkout/sdk/platform/data/source/api/model/request/MobileMoneyCheckoutReq.kt)
- [Status response](https://github.com/hubtel/hubtel-mobile-android-merchant-checkout-sdk/blob/5c909a912151c64476d3b45ec3fa65dc7a6c71ff/checkout-sdk/src/main/java/com/hubtel/merchant/checkout/sdk/platform/data/source/api/model/response/TransactionStatusInfo.kt)

Confirm merchant eligibility for these endpoints and channels with Hubtel.
Do not guess sandbox URLs. Mock tests need neither credentials nor network.

## Controls and checks

Frontend VITE_ACCESS_PROMOTIONS_ENABLED defaults false. Database controls
complimentary_access_enabled, promo_codes_enabled, hubtel_payments_enabled default
false and cannot be changed by application users. New promos start paused.
Do not enable anything automatically. Existing processing payments can still be
verified after new checkout is paused; paid access is not removed.

Local commands: npm run test:access-promotions, test:access-concurrency,
test:access-ui, test:hubtel, test:access-migrations, lint:access-promotions,
check:access-promotions and build.

Approved staging must cover:

1. Student/admin/super-admin/finance and explicit denied permissions.
2. Paused controls and preserved paid precedence.
3. Grant lifecycle, bulk preview/retry, promo lifecycle, final-slot/per-user races.
4. Free/100%-discount/fixed-above-price bypass of Hubtel.
5. Positive payment, refusal, callback replay and lost initialization response.
6. Matching reference, gross GHS amount, no dispute/refund before settlement.
7. Exactly one subscription/redemption/receipt/audit/notification.
8. Browser return/forged callback cannot grant access.
9. 1440/1024/768/390 layouts, keyboard/focus and accessible labels.

## Ambiguous payments

Initialization is claimed once before the provider call. Lost responses/timeouts
never authorize another charge. Processing reservations remain held until verified
terminal status. Student Verify payment status retries provider reads; admin
Payment Monitoring is read-only.

Callback bodies are wake-up signals only. The worker independently authenticates
to Hubtel and verifies status, currency, gross amount and client/provider reference.
Unknown/unpaid remain processing. Failed/expired release reservations with no paid
access. Conflicting terminal responses require manual reconciliation, not an
automatic financial overwrite.

Only never-claimed orders can expire after 30 minutes via
expire_unstarted_access_payments. Processing orders are excluded.

## Notifications and billing

Existing public.notifications is the in-app transport. There is no general email
queue; daily-question SMTP is not repurposed. Do not claim email receipts were sent.
Deduplication tombstones survive deleted notifications. Reminders use the nearest
7/3/1-day bucket, then expiry; access security uses timestamps, not cron.
setup-access-reminders.sql prepares reminder and unstarted-order cleanup jobs
inactive. It was not executed; activation requires approval.

Prices remain $19/$49/$79/$129 with existing 11.34 conversion:
GHS 215.46/555.66/895.86/1462.86. Exact plan names, USD prices and durations must
match the catalog or checkout fails closed.
Free periods append after current complimentary expiry. Paid access remains
separate and takes precedence. Zero-cost outcomes are confirmations, never Paid.
Paid receipts show plan/original/code/discount/amount/method/reference.
Financial FKs retain history; review account-deletion retention before rollout.
