import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existingUsdToGhsMinor, getSubscriptionPrice } from '../supabase/functions/_shared/subscription-prices.js';
import { calculatePromotionPrice } from '../supabase/functions/_shared/promotion-pricing.js';

test('server-owned GHS prices match every existing Paystack plan and rate', async () => {
  const source = await readFile(new URL('../supabase/functions/create-paystack-order/index.ts', import.meta.url), 'utf8');
  const rate = Number(source.match(/const USD_TO_GHS = ([\d.]+)/)?.[1]);
  assert.equal(rate, 11.34, 'Review the new provider catalog if the existing rate changes');
  const amounts = source.match(/const PLAN_AMOUNTS_USD:[\s\S]*?= \{([\s\S]*?)\};/)?.[1];
  assert.ok(amounts);
  const entries = [...amounts.matchAll(/(\w+):\s*(\d+),/g)];
  assert.equal(entries.length, 4);
  for (const [, key, usd] of entries) {
    const quote = getSubscriptionPrice(key);
    assert.equal(quote.originalUsdMinor, Number(usd) * 100);
    assert.equal(quote.amountMinor, Math.round(Number(usd) * rate * 100));
    assert.equal(quote.currency, 'GHS');
  }
  assert.deepEqual(entries.map(([, key]) => getSubscriptionPrice(key).amountMinor), [21546, 55566, 89586, 146286]);
});
test('unknown plans, prototype names and invalid monetary amounts fail closed', () => {
  for (const key of ['free', 'constructor', '__proto__', null, {}, 'master_180 ']) assert.throws(() => getSubscriptionPrice(key), /unknown_plan/);
  for (const amount of [-1, 1.1, NaN, Infinity, '1900', Number.MAX_SAFE_INTEGER]) assert.throws(() => existingUsdToGhsMinor(amount));
  assert.equal(existingUsdToGhsMinor(0), 0);
  assert.equal(existingUsdToGhsMinor(1), 11);
  assert.equal(existingUsdToGhsMinor(50), 567);
});
test('quotes are immutable and use integer promotion pricing without a minimum charge', () => {
  const quote = getSubscriptionPrice('thirty_day');
  assert.throws(() => { quote.amountMinor = 1; }, TypeError);
  const result = calculatePromotionPrice({ priceMinor: quote.amountMinor, currency: quote.currency,
    benefit: { type: 'percentage_discount', percentageBasisPoints: 10000 } });
  assert.equal(result.finalMinor, 0);
  assert.equal(result.requiresPayment, false);
  assert.equal(getSubscriptionPrice('thirty_day').amountMinor, 21546);
});
