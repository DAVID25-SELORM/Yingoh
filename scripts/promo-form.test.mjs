import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROMO_DISCOUNT_TYPES, buildPromoPayload, localDayBoundary, normalizePromoCode, promoSaveMessage } from '../src/utils/promoForm.js';

const form = (extra = {}) => ({ code: 'nf-7k3m9q', name: '', description: '', discount_type: 'percentage', discount_value: 15, applies_to_plans: [], valid_from: '', expires_at: '',
  max_uses: '', max_per_user: 1, eligibility: 'all', minimum_purchase_usd: '', ...extra });

test('a generated code produces a complete, normalised payload', () => {
  const { payload, error } = buildPromoPayload(form(), { userId: 'u1' });
  assert.equal(error, undefined);
  assert.equal(payload.code, 'NF-7K3M9Q'); assert.equal(payload.name, 'NF-7K3M9Q');
  assert.deepEqual([payload.discount_type, payload.discount_value, payload.discount_pct, payload.discount_amount], ['percentage', 15, 15, 15]);
  assert.deepEqual([payload.valid_from, payload.expires_at, payload.max_uses, payload.max_per_user, payload.minimum_purchase_usd], [null, null, null, 1, null]);
  assert.deepEqual([payload.is_active, payload.used_count, payload.created_by, payload.eligibility], [true, 0, 'u1', 'all']);
  assert.equal(buildPromoPayload(form({ discount_type: 'fixed_amount', discount_value: '5' })).payload.discount_pct, 0);
});

test('only discount types the checkout can honour are offered and accepted', () => {
  assert.deepEqual(PROMO_DISCOUNT_TYPES.map(o => o.value), ['percentage', 'fixed_amount']);
  for (const type of ['free_trial', 'free_upgrade', 'anything']) assert.match(buildPromoPayload(form({ discount_type: type })).error, /Percentage or Fixed/);
});

test('a plain expiry date means the end of that local day, and a start date the beginning', () => {
  const end = new Date(localDayBoundary('2026-12-31', 'end')); const start = new Date(localDayBoundary('2026-12-31', 'start'));
  assert.deepEqual([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes(), end.getSeconds()], [2026, 11, 31, 23, 59, 59]);
  assert.deepEqual([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()], [2026, 11, 31, 0, 0]);
  const { payload } = buildPromoPayload(form({ valid_from: '2026-12-01', expires_at: '2026-12-31' }));
  assert.ok(Date.parse(payload.expires_at) - Date.parse(payload.valid_from) > 30 * 86400000, 'the last day is included');
  assert.equal(localDayBoundary('2026-02-30', 'end'), null, 'impossible dates are rejected');
  assert.equal(localDayBoundary('31/12/2026', 'end'), null); assert.equal(localDayBoundary('', 'end'), null);
});

test('bad input is refused with a message the admin can act on', () => {
  const bad = (extra, pattern) => assert.match(buildPromoPayload(form(extra)).error, pattern);
  bad({ code: 'ab' }, /3 to 64/); bad({ code: 'has space' }, /3 to 64/); bad({ code: '-leading' }, /3 to 64/); bad({ code: '' }, /3 to 64/);
  bad({ discount_value: 0 }, /greater than zero/); bad({ discount_value: '' }, /greater than zero/); bad({ discount_value: -5 }, /greater than zero/); bad({ discount_value: 'abc' }, /greater than zero/);
  bad({ discount_value: 101 }, /more than 100/); bad({ discount_type: 'fixed_amount', discount_value: 20000 }, /too large/);
  bad({ valid_from: '2026-12-31', expires_at: '2026-12-01' }, /on or after/); bad({ expires_at: '2026-02-30' }, /expiry date is not valid/); bad({ valid_from: 'nope' }, /start date is not valid/);
  bad({ max_uses: 0 }, /at least 1/); bad({ max_uses: 1.5 }, /at least 1/); bad({ max_per_user: 0 }, /at least 1/); bad({ minimum_purchase_usd: -1 }, /negative/);
  assert.equal(buildPromoPayload(form({ valid_from: '2026-12-01', expires_at: '2026-12-01' })).error, undefined, 'same-day start and end is allowed');
});

test('codes are normalised and a typed code can be overridden by a regenerated one', () => {
  assert.equal(normalizePromoCode('  welcome50 '), 'WELCOME50');
  assert.equal(buildPromoPayload(form({ code: 'old-code' }), { code: ' new-code ' }).payload.code, 'NEW-CODE');
  assert.equal(buildPromoPayload(form({ name: ' Spring Offer ', description: ' note ' })).payload.name, 'Spring Offer');
});

test('save errors are translated into safe, specific messages', () => {
  assert.match(promoSaveMessage({ code: '23505', message: 'duplicate key value violates unique constraint "promo_codes_normalized_unique"' }), /already exists/);
  assert.match(promoSaveMessage({ message: 'new row violates row-level security policy for table "promo_codes"' }), /Super Admin/);
  assert.match(promoSaveMessage({ code: '42501' }), /Super Admin/);
  const generic = promoSaveMessage({ message: 'relation "x" does not exist; secret-detail' });
  assert.match(generic, /could not be saved/); assert.ok(!/relation|secret/.test(generic));
  assert.match(promoSaveMessage(null), /could not be saved/);
});
