// Pure server-side policy core. Inputs must come from trusted database reads.
// This is NOT a redemption authorizer: usage counts require a locked transaction.
/**
 * @typedef {{type: string, percentageBasisPoints?: number, fixedMinor?: number,
 * freeDays?: number, currency?: string}} Benefit
 * @typedef {{active: boolean, startsAt?: string | null, expiresAt?: string | null,
 * planId?: string | null, completedCount: number, reservedCount: number,
 * maxRedemptions?: number | null, perUserLimit: number, newUsersOnly?: boolean,
 * minimumPurchaseMinor?: number | null, minimumPurchaseCurrency?: string,
 * benefit: Benefit}} Promotion
 * @typedef {{id: string, completedCount: number, reservedCount: number,
 * hasSuccessfulPayment?: boolean, lifetimeRedemptions?: number,
 * hasOverlappingComplimentaryGrant?: boolean}} PromotionUser
 */
export class PromotionRejected extends Error {
  /** @param {string} code */
  constructor(code) {
    super(code);
    this.name = 'PromotionRejected';
    this.code = code;
  }
}

/** @param {string} code @returns {never} */
function reject(code) { throw new PromotionRejected(code); }
/** @param {unknown} value @param {number} minimum @returns {value is number} */
function integer(value, minimum = 0) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
/** @param {string} value */
function timestamp(value) {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) reject('invalid_configuration');
  return result;
}

/** @param {unknown} value */
export function normalizePromotionCode(value) {
  if (typeof value !== 'string') reject('invalid_code');
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(code)) reject('invalid_code');
  return code;
}

// Price is an integer in the currency's minor units, never a client total.
// Percentage is stored in basis points (2000 = 20%). Rounding is half-up.
/** @param {{priceMinor: number, currency: string, benefit: Benefit}} input */
export function calculatePromotionPrice({ priceMinor, currency, benefit }) {
  if (!integer(priceMinor) || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) reject('invalid_price');
  if (!benefit || typeof benefit !== 'object') reject('invalid_configuration');
  let discount = 0n;
  const amount = BigInt(priceMinor);
  if (benefit.type === 'percentage_discount') {
    if (!integer(benefit.percentageBasisPoints, 1) || benefit.percentageBasisPoints > 10000 ||
      benefit.fixedMinor != null || benefit.freeDays != null) reject('invalid_configuration');
    discount = (amount * BigInt(benefit.percentageBasisPoints) + 5000n) / 10000n;
  } else if (benefit.type === 'fixed_discount') {
    if (!integer(benefit.fixedMinor, 1) || benefit.percentageBasisPoints != null ||
      benefit.freeDays != null) reject('invalid_configuration');
    if (benefit.currency !== currency) reject('currency_mismatch');
    discount = BigInt(benefit.fixedMinor);
  } else if (benefit.type === 'free_access_days') {
    if (!integer(benefit.freeDays, 1) || benefit.fixedMinor != null ||
      benefit.percentageBasisPoints != null) reject('invalid_configuration');
    return { kind: 'access_grant', freeDays: benefit.freeDays, currency,
      originalMinor: priceMinor, discountMinor: 0, finalMinor: 0, requiresPayment: false };
  } else reject('unsupported_benefit');
  if (discount > amount) discount = amount;
  const finalMinor = Number(amount - discount);
  return { kind: 'discount', currency, originalMinor: priceMinor,
    discountMinor: Number(discount), finalMinor, requiresPayment: finalMinor > 0 };
}

// Completed redemptions + outstanding reservations are checked under a DB lock
// by the future redemption/checkout coordinator, not by a browser preview.
/** @param {{promotion: Promotion, user: PromotionUser, planId: string,
 * priceMinor: number, currency: string, now: number}} input */
export function validatePromotionEligibility({ promotion, user, planId, priceMinor, currency, now }) {
  if (!Number.isFinite(now)) reject('invalid_clock');
  if (!user?.id) reject('authentication_required');
  if (promotion?.active !== true) reject('inactive_promotion');
  if (promotion.newUsersOnly != null && typeof promotion.newUsersOnly !== 'boolean') reject('invalid_configuration');
  if (promotion.startsAt != null && now < timestamp(promotion.startsAt)) reject('promotion_not_started');
  if (promotion.expiresAt != null && now >= timestamp(promotion.expiresAt)) reject('promotion_expired');
  if (promotion.startsAt != null && promotion.expiresAt != null &&
    timestamp(promotion.startsAt) >= timestamp(promotion.expiresAt)) reject('invalid_configuration');
  if (promotion.planId != null && promotion.planId !== planId) reject('ineligible_plan');
  for (const count of [promotion.completedCount, promotion.reservedCount, user.completedCount, user.reservedCount]) {
    if (!integer(count)) reject('invalid_usage_state');
  }
  if (promotion.maxRedemptions != null) {
    if (!integer(promotion.maxRedemptions, 1)) reject('invalid_configuration');
    if (BigInt(promotion.completedCount) + BigInt(promotion.reservedCount) >= BigInt(promotion.maxRedemptions)) reject('redemption_limit');
  }
  if (!integer(promotion.perUserLimit, 1)) reject('invalid_configuration');
  if (BigInt(user.completedCount) + BigInt(user.reservedCount) >= BigInt(promotion.perUserLimit)) reject('user_limit');
  if (promotion.newUsersOnly) {
    if (typeof user.hasSuccessfulPayment !== 'boolean' || !integer(user.lifetimeRedemptions)) reject('invalid_usage_state');
    if (user.hasSuccessfulPayment || user.lifetimeRedemptions > 0) reject('new_users_only');
  }
  if (promotion.minimumPurchaseMinor != null) {
    if (!integer(promotion.minimumPurchaseMinor)) reject('invalid_configuration');
    if (promotion.minimumPurchaseCurrency !== currency) reject('currency_mismatch');
    if (priceMinor < promotion.minimumPurchaseMinor) reject('minimum_purchase');
  }
  // The transactional coordinator appends free periods after the latest
  // non-revoked expiry under the same recipient lock as administrative grants.
  return calculatePromotionPrice({ priceMinor, currency, benefit: promotion.benefit });
}

// Reject pricing/identity tampering rather than silently accepting ignored fields.
/** @param {unknown} body */
export function parsePromotionCheckoutRequest(body) {
  const allowed = new Set(['planId', 'promoCode', 'idempotencyKey']);
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).some(key => !allowed.has(key))) reject('invalid_request');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const input = /** @type {Record<string, unknown>} */ (body);
  if (typeof input.planId !== 'string' || !uuid.test(input.planId) ||
    typeof input.idempotencyKey !== 'string' || !uuid.test(input.idempotencyKey)) reject('invalid_request');
  return { planId: input.planId, idempotencyKey: input.idempotencyKey,
    promoCode: input.promoCode == null ? null : normalizePromotionCode(input.promoCode) };
}
