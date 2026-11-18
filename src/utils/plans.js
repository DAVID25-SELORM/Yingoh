// Subscription plans come from public.payment_plans, which historically could contain the same plan more than once.
// Every plan list shows each plan once. The keeper rule matches the database migration
// (20260923010000_deduplicate_payment_plans.sql): active before inactive, then lowest sort_order, then oldest, then id.
const planKey = plan => `${String(plan?.audience ?? 'student').toLowerCase()}|${String(plan?.name ?? '').trim().toLowerCase()}`;

function time(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

// Negative when `a` should be kept over `b`.
function compareKeeper(a, b) {
  const active = Number(Boolean(b.is_active ?? true)) - Number(Boolean(a.is_active ?? true));
  if (active) return active;
  const order = Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
  if (order) return order;
  const created = time(a.created_at) - time(b.created_at);
  if (created) return created < 0 ? -1 : 1;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

export function dedupePlans(plans) {
  const keepers = new Map();
  for (const plan of Array.isArray(plans) ? plans : []) {
    if (!plan) continue;
    const key = planKey(plan);
    const current = keepers.get(key);
    if (!current || compareKeeper(plan, current) < 0) keepers.set(key, plan);
  }
  // Keep the order the query asked for (sort_order), using each keeper's own position.
  return [...keepers.values()].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}
