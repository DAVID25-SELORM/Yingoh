# NurseFaculty promo codes and discounts: admin guide

## What a promo code can do
| Type | Effect |
| --- | --- |
| Percentage discount | Takes a percentage off the plan price, and the learner pays the rest by Mobile Money. |
| Fixed discount | Takes a fixed GHS amount off the plan price. |
| Free access days | Grants complimentary access for a number of days, with no payment. |

All prices, limits and eligibility are decided on the server. The learner's browser cannot change a price or skip a limit.

## Create a code
1. Go to **Payments → Promo Codes → New Promo Code**.
2. The **Code** is filled in automatically (for example `NF-7K3M9Q`). Edit it, or click **Generate** for another.
3. Fill in the details:
   - **Name:** an internal label.
   - **Benefit and value:** for example a percentage.
   - **Applies to plans:** leave empty for all paid plans.
   - **Start and end dates:** the window in which the code works.
   - **Max total uses:** leave empty for unlimited.
   - **Max uses per user:** default 1.
   - **Eligibility:** all users, or new subscribers only.
   - **Minimum purchase.**
4. Save. The code is active straight away, inside its date window.

**Good practice**
- Give every campaign an end date and a total-use cap.
- Use "new subscribers only" for welcome offers.
- A code that has been redeemed cannot be edited. Duplicate it to change it.

## What the learner sees
1. Picks a plan and sees the server price.
2. Types the code and clicks **Apply promo**. They see the Original, Discount and Total amounts, or a specific reason it was refused (expired, already used, limit reached, wrong plan, below minimum, new subscribers only).
3. Ticks the Terms and Refund Policy box (required).
4. If the total is 0, clicks **Confirm complimentary access**. Otherwise enters a Mobile Money number and clicks **Request Hubtel payment**.

## Paid orders: the payment states
| State | Meaning | What to do |
| --- | --- | --- |
| Pending | The order exists but no payment was requested yet. | Nothing. It expires after 30 minutes if never started. |
| Processing | A payment request was sent to the phone, or its result is unconfirmed. | Have the learner approve on the phone, then click **Verify payment status**. **Do not ask them to pay again.** It expires after 24 hours if the provider still reports it unpaid. |
| Successful | Verified with Hubtel: reference, amount and currency all matched. | Subscription and receipt created automatically. |
| Failed or Expired | The provider said no, or it timed out. | The promo use is released. The learner can retry. |

Admins can see the payments list under **Payments → Access Policy → Payment Monitoring** (needs the `payments.view` permission). It is read-only. Do not create a second charge for a processing order.

## The three switches
Stored in `access_system_controls`. Each blocks its feature when off.
- `promo_codes_enabled`: applying codes.
- `complimentary_access_enabled`: free-access redemptions.
- `hubtel_payments_enabled`: Mobile Money checkout.

## Before turning on Hubtel payments
1. Deploy the `hubtel-checkout` and `hubtel-callback` functions.
2. Set the Edge secrets: `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_MERCHANT_ID`, `HUBTEL_API_BASE_URL`, `HUBTEL_CALLBACK_URL` and `APP_URL`.
3. Run one small sandbox payment with the control still off for everyone else. Then confirm the receipt, the subscription and the promo count.
4. Check the function logs for `hubtel_verification_unresolved`. If it appears on a real payment, do not enable payments until it is resolved.
5. Then switch on `hubtel_payments_enabled`.

## Troubleshooting
| Symptom | Likely cause |
| --- | --- |
| "Promotions are paused" | `promo_codes_enabled` is off. |
| "Promotion limit reached" | Total or per-user cap reached. Reserved but unpaid uses count toward the cap. |
| "An existing payment needs verification" | The learner has an order in pending or processing. Use **Verify payment status**. |
| Checkout says it could not be confirmed | Do not pay again. Check the payment history for the order. |
| 403 from the checkout function | The `APP_URL` secret is missing or does not match the site origin. |
