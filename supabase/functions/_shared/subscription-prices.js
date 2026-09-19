// Server-owned catalog for the new Hubtel flow. Matches the existing Paystack
// amounts and configured 11.34 GHS/USD conversion; this is NOT a live FX quote.
// Existing providers are deliberately unchanged.
const plans = Object.freeze({
  thirty_day: Object.freeze({ name: '30-Day Pass', usdMinor: 1900, durationDays: 30 }),
  ninety_day: Object.freeze({ name: '90-Day Success Plan', usdMinor: 4900, durationDays: 90 }),
  master_180: Object.freeze({ name: '180-Day Master Plan', usdMinor: 7900, durationDays: 180 }),
  faculty_365: Object.freeze({ name: '365-Day Faculty Pass', usdMinor: 12900, durationDays: 365 }),
});

export const SUBSCRIPTION_PRICE_VERSION = 'existing-plans-ghs-11.34-v1';

/** @param {unknown} usdMinor */
export function existingUsdToGhsMinor(usdMinor) {
  if (typeof usdMinor !== 'number' || !Number.isSafeInteger(usdMinor) || usdMinor < 0) {
    throw new Error('invalid_usd_amount');
  }
  // USD cents × 11.34 = GHS pesewas. Integer half-up rounding.
  const pesewas = (BigInt(usdMinor) * 1134n + 50n) / 100n;
  if (pesewas > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('amount_overflow');
  return Number(pesewas);
}

// The DB plan UUID must be mapped to one of these keys by trusted server code.
// A browser price, display exchange rate, or arbitrary product name is not input.
/** @param {unknown} planKey */
export function getSubscriptionPrice(planKey) {
  if (typeof planKey !== 'string' || !Object.hasOwn(plans, planKey)) throw new Error('unknown_plan');
  const plan = plans[/** @type {keyof typeof plans} */ (planKey)];
  return Object.freeze({
    planKey, name: plan.name, durationDays: plan.durationDays,
    originalUsdMinor: plan.usdMinor, currency: 'GHS',
    amountMinor: existingUsdToGhsMinor(plan.usdMinor),
    priceVersion: SUBSCRIPTION_PRICE_VERSION,
  });
}
