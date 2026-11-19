// What a promo code can actually do right now. Mirrors the server rules in validate_promo_code
// (inactive, not yet started, expired, redemption limit reached), so the admin table never calls an
// expired or used-up code "Active". The server remains the authority when a code is applied.
export function promoStatus(promo, now = Date.now()) {
  if (!promo?.is_active) return { key: 'inactive', label: 'Inactive', badge: 'failed' };
  const starts = promo.valid_from ? Date.parse(promo.valid_from) : null;
  if (Number.isFinite(starts) && starts > now) return { key: 'scheduled', label: 'Scheduled', badge: 'scheduled' };
  const ends = promo.expires_at ? Date.parse(promo.expires_at) : null;
  if (Number.isFinite(ends) && ends < now) return { key: 'expired', label: 'Expired', badge: 'failed' };
  const limit = Number(promo.max_uses);
  if (promo.max_uses != null && Number.isFinite(limit) && limit > 0 && Number(promo.used_count ?? 0) >= limit) {
    return { key: 'used_up', label: 'Used up', badge: 'pending' };
  }
  return { key: 'active', label: 'Active', badge: 'paid' };
}

export const isPromoUsable = (promo, now) => promoStatus(promo, now).key === 'active';
