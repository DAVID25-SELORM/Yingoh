import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPromoUsable, promoStatus } from '../src/utils/promoStatus.js';

const now = Date.parse('2026-11-19T02:00:00Z');
const promo = (extra = {}) => ({ is_active: true, expires_at: null, valid_from: null, max_uses: null, used_count: 0, ...extra });

test('codes that have expired are not shown as active (the 9/22 and 7/24 cases)', () => {
  assert.equal(promoStatus(promo({ expires_at: '2026-09-22T00:00:00Z' }), now).label, 'Expired');
  assert.equal(promoStatus(promo({ expires_at: '2026-07-24T00:00:00Z' }), now).label, 'Expired');
  assert.equal(promoStatus(promo({ expires_at: '2026-12-01T00:00:00Z' }), now).label, 'Active');
  assert.equal(promoStatus(promo(), now).label, 'Active'); // never expires
});

test('switched-off, scheduled and used-up codes are labelled correctly, with inactive taking priority', () => {
  assert.equal(promoStatus(promo({ is_active: false, expires_at: '2026-09-22T00:00:00Z' }), now).label, 'Inactive');
  assert.equal(promoStatus(promo({ valid_from: '2026-12-01T00:00:00Z' }), now).label, 'Scheduled');
  assert.equal(promoStatus(promo({ max_uses: 100, used_count: 100 }), now).label, 'Used up');
  assert.equal(promoStatus(promo({ max_uses: 100, used_count: 99 }), now).label, 'Active');
  assert.equal(promoStatus(promo({ max_uses: 0, used_count: 0 }), now).label, 'Active', 'a zero cap is treated as no cap, like the table does');
});

test('only genuinely usable codes are counted as active, and bad input is tolerated', () => {
  const rows = [promo(), promo({ expires_at: '2026-09-22T00:00:00Z' }), promo({ expires_at: '2026-07-24T00:00:00Z' }), promo({ max_uses: 5, used_count: 5 }), promo({ is_active: false })];
  assert.equal(rows.filter(p => isPromoUsable(p, now)).length, 1);
  assert.equal(promoStatus(null, now).label, 'Inactive');
  assert.equal(promoStatus(promo({ expires_at: 'not-a-date' }), now).label, 'Active');
});
