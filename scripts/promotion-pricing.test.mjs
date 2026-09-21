import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePromotionPrice as price, validatePromotionEligibility as validate,
  normalizePromotionCode, parsePromotionCheckoutRequest } from '../supabase/functions/_shared/promotion-pricing.js';

const now = Date.parse('2026-09-19T12:00:00Z');
const fixture = () => ({ now, planId: 'plan', priceMinor: 10000, currency: 'GHS',
  promotion: { active: true, completedCount: 0, reservedCount: 0, perUserLimit: 1,
    benefit: { type: 'percentage_discount', percentageBasisPoints: 2000 } },
  user: { id: 'user', completedCount: 0, reservedCount: 0, lifetimeRedemptions: 0,
    hasSuccessfulPayment: false, hasOverlappingComplimentaryGrant: false } });
const rejects = (input, code) => assert.throws(() => validate(input), error => error.code === code);

test('percentage calculation uses integer half-up rounding', () => {
  assert.equal(validate(fixture()).finalMinor, 8000);
  assert.equal(price({ priceMinor: 101, currency: 'GHS', benefit: { type: 'percentage_discount', percentageBasisPoints: 5000 } }).finalMinor, 50);
});
test('fixed discount is capped at price; zero total never requests payment', () => {
  const result = price({ priceMinor: 100, currency: 'GHS', benefit: { type: 'fixed_discount', fixedMinor: 200, currency: 'GHS' } });
  assert.equal(result.finalMinor, 0); assert.equal(result.discountMinor, 100); assert.equal(result.requiresPayment, false);
});
test('100 percent discount requests no external payment', () => {
  const f = fixture(); f.promotion.benefit.percentageBasisPoints = 10000;
  assert.equal(validate(f).requiresPayment, false);
});
test('free-days benefit is an access grant, not a payment discount', () => {
  const f = fixture(); f.promotion.benefit = { type: 'free_access_days', freeDays: 30 };
  assert.equal(validate(f).kind, 'access_grant'); assert.equal(validate(f).requiresPayment, false);
  f.user.hasOverlappingComplimentaryGrant = true; assert.equal(validate(f).kind, 'access_grant');
});
test('currency mismatches rejected without inferred exchange rate', () => {
  const f = fixture(); f.promotion.benefit = { type: 'fixed_discount', fixedMinor: 100, currency: 'USD' };
  rejects(f, 'currency_mismatch');
});
test('invalid amounts and benefit combinations fail closed', () => {
  for (const amount of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => price({ priceMinor: amount, currency: 'GHS', benefit: { type: 'percentage_discount', percentageBasisPoints: 100 } }));
  }
  const f = fixture(); f.promotion.benefit.fixedMinor = 1; rejects(f, 'invalid_configuration');
});
test('date boundaries are start-inclusive and expiry-exclusive', () => {
  const f = fixture(); f.promotion.startsAt = new Date(now).toISOString(); assert.equal(validate(f).finalMinor, 8000);
  f.promotion.startsAt = new Date(now + 1).toISOString(); rejects(f, 'promotion_not_started');
  f.promotion.startsAt = null; f.promotion.expiresAt = new Date(now).toISOString(); rejects(f, 'promotion_expired');
});
test('inactive and wrong-plan promotions rejected', () => {
  const f = fixture(); f.promotion.active = false; rejects(f, 'inactive_promotion');
  f.promotion.active = true; f.promotion.planId = 'other'; rejects(f, 'ineligible_plan');
});
test('malformed policy booleans and non-string currencies fail closed', () => {
  const f = fixture(); f.promotion.active = 'false'; rejects(f, 'inactive_promotion');
  f.promotion.active = true; f.promotion.newUsersOnly = 'false'; rejects(f, 'invalid_configuration');
  f.promotion.newUsersOnly = false; f.currency = ['GHS']; rejects(f, 'invalid_price');
});
test('total and per-user usage include outstanding reservations', () => {
  const f = fixture(); f.promotion.maxRedemptions = 1; f.promotion.reservedCount = 1; rejects(f, 'redemption_limit');
  f.promotion.reservedCount = 0; f.user.reservedCount = 1; rejects(f, 'user_limit');
});
test('new-user eligibility uses successful payment and lifetime redemption history', () => {
  const f = fixture(); f.promotion.newUsersOnly = true; assert.equal(validate(f).finalMinor, 8000);
  f.user.hasSuccessfulPayment = true; rejects(f, 'new_users_only');
  f.user.hasSuccessfulPayment = false; f.user.lifetimeRedemptions = 1; rejects(f, 'new_users_only');
});
test('minimum purchase uses explicit matching currency', () => {
  const f = fixture(); f.promotion.minimumPurchaseMinor = 10001; f.promotion.minimumPurchaseCurrency = 'GHS'; rejects(f, 'minimum_purchase');
  f.promotion.minimumPurchaseMinor = 10000; assert.equal(validate(f).finalMinor, 8000);
});
test('unknown counts and missing authentication fail closed', () => {
  const f = fixture(); f.user = null; rejects(f, 'authentication_required');
  const g = fixture(); delete g.promotion.reservedCount; rejects(g, 'invalid_usage_state');
});
test('code normalization is case-insensitive and restricted', () => {
  assert.equal(normalizePromotionCode(' campus30 '), 'CAMPUS30');
  assert.throws(() => normalizePromotionCode('campus 30'));
});
test('checkout request rejects client prices, actors, and missing idempotency', () => {
  const body = { planId: '00000000-0000-4000-8000-000000000001', idempotencyKey: '00000000-0000-4000-8000-000000000002', promoCode: ' test20 ' };
  assert.equal(parsePromotionCheckoutRequest(body).promoCode, 'TEST20');
  for (const key of ['amount','discount','userId','currency','callbackUrl']) assert.throws(() => parsePromotionCheckoutRequest({ ...body, [key]: 'tampered' }));
  assert.throws(() => parsePromotionCheckoutRequest({ ...body, idempotencyKey: null }));
});
