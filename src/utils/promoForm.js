// Validation and payload building for the (legacy, USD) promo-code form in Payments.
// Only discount types that the checkout can actually honour are offered: a percentage or a fixed USD amount.
// ("Free trial" and "Free upgrade" returned a zero discount and nothing granted access, so they looked applied but did nothing.)
export const PROMO_DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed_amount', label: 'Fixed USD amount' },
];

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// A plain date from the form means the whole local day: starts at 00:00, ends at 23:59:59.
// (Saving the bare date made codes stop at the START of their last day.)
export function localDayBoundary(value, boundary) {
  const match = DATE_ONLY.exec(String(value ?? '').trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = boundary === 'end' ? new Date(y, m - 1, d, 23, 59, 59, 0) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) || date.getMonth() !== m - 1 ? null : date.toISOString();
}

export function normalizePromoCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

// Returns { payload } when the form is valid, otherwise { error } with a message an admin can act on.
export function buildPromoPayload(form, { userId = null, code } = {}) {
  const finalCode = normalizePromoCode(code ?? form.code);
  if (!CODE_PATTERN.test(finalCode)) return { error: 'Use 3 to 64 letters, numbers, hyphens or underscores for the code.' };
  const type = form.discount_type;
  if (!PROMO_DISCOUNT_TYPES.some(option => option.value === type)) return { error: 'Choose Percentage or Fixed USD amount.' };
  const value = Number(form.discount_value);
  if (!Number.isFinite(value) || value <= 0) return { error: 'Enter a discount greater than zero.' };
  if (type === 'percentage' && value > 100) return { error: 'A percentage discount cannot be more than 100.' };
  if (type === 'fixed_amount' && value > 10000) return { error: 'The fixed discount is too large.' };

  const hasStart = Boolean(String(form.valid_from ?? '').trim());
  const hasEnd = Boolean(String(form.expires_at ?? '').trim());
  const validFrom = hasStart ? localDayBoundary(form.valid_from, 'start') : null;
  const expiresAt = hasEnd ? localDayBoundary(form.expires_at, 'end') : null;
  if (hasStart && !validFrom) return { error: 'The start date is not valid.' };
  if (hasEnd && !expiresAt) return { error: 'The expiry date is not valid.' };
  if (validFrom && expiresAt && Date.parse(expiresAt) < Date.parse(validFrom)) return { error: 'The expiry date must be on or after the start date.' };

  const maxUses = String(form.max_uses ?? '').trim() === '' ? null : Number(form.max_uses);
  if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) return { error: 'Maximum uses must be a whole number of at least 1.' };
  const perUser = String(form.max_per_user ?? '').trim() === '' ? 1 : Number(form.max_per_user);
  if (!Number.isInteger(perUser) || perUser < 1) return { error: 'Uses per person must be a whole number of at least 1.' };
  const minimum = String(form.minimum_purchase_usd ?? '').trim() === '' ? null : Number(form.minimum_purchase_usd);
  if (minimum != null && (!Number.isFinite(minimum) || minimum < 0)) return { error: 'The minimum purchase cannot be negative.' };

  return {
    payload: {
      code: finalCode,
      name: String(form.name ?? '').trim() || finalCode,
      description: String(form.description ?? '').trim() || null,
      discount_type: type,
      discount_value: value,
      discount_amount: value,
      discount_pct: type === 'percentage' ? value : 0,
      applies_to_plans: Array.isArray(form.applies_to_plans) ? form.applies_to_plans : [],
      valid_from: validFrom,
      max_uses: maxUses,
      max_per_user: perUser,
      eligibility: form.eligibility || 'all',
      minimum_purchase_usd: minimum,
      expires_at: expiresAt,
      is_active: true,
      used_count: 0,
      created_by: userId,
    },
  };
}

// Turns a database error into something an admin can act on, without leaking internals.
export function promoSaveMessage(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (text.includes('23505') || text.includes('duplicate') || text.includes('unique')) return 'A promo code with this name already exists. Choose another code or click Generate.';
  if (text.includes('42501') || text.includes('row-level security') || text.includes('permission denied')) return 'Only a Super Admin can create or change these promo codes.';
  return 'The promo code could not be saved. Please try again.';
}
