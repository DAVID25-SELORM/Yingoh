import { useEffect, useState } from 'react';
import { isConfiguredSuperAdmin, supabase } from '../services/supabase';
import { questionLimitFor } from '../data/subscriptionPlans';

const PLAN_LEVELS = { none: 0, free: 0, basic: 1, pro: 2, premium: 3 };
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export function normalizePlanName(value) {
  const name = String(value ?? 'free').trim().toLowerCase();
  if (name.includes('premium')) return 'premium';
  if (name.includes('pro')) return 'pro';
  if (name.includes('basic') || name.includes('starter')) return 'basic';
  return 'free';
}

export function planMeets(plan, requiredPlan = 'pro') {
  return (PLAN_LEVELS[normalizePlanName(plan)] ?? 0) >= (PLAN_LEVELS[normalizePlanName(requiredPlan)] ?? 0);
}

// Returns { plan, status, isActive, isPro, isPremium, loading }
export function useSubscription(session) {
  const [sub, setSub] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSub(null);
    setRoles([]);
    if (!session?.user?.id) { setLoading(false); return; }
    if (isConfiguredSuperAdmin(session.user.email)) {
      setSub({ plan_name: 'Premium', status: 'active' });
      setRoles(['super_admin']);
      setLoading(false);
      return;
    }
    if (!supabase) { setLoading(false); return; }

    Promise.all([
      supabase
        .from('subscriptions')
        .select('*, payment_plans(name, price_usd, features, question_limit)')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('user_roles').select('roles(name)').eq('user_id', session.user.id),
    ]).then(([{ data }, { data: roleRows }]) => {
        const periodEnd = data?.current_period_end ? new Date(data.current_period_end) : null;
        setSub(!periodEnd || periodEnd > new Date() ? data : null);
        setRoles((roleRows ?? []).map((row) => row.roles?.name).filter(Boolean));
        setLoading(false);
      });
  }, [session?.user?.id]);

  const rawPlanName = sub?.payment_plans?.name ?? sub?.plan_name ?? 'Free';
  const planName = normalizePlanName(rawPlanName);
  const hasAdminAccess = roles.some((role) => ADMIN_ROLES.has(role));
  const configuredLimit = sub?.payment_plans?.question_limit;
  const questionLimit = hasAdminAccess
    ? Infinity
    : configuredLimit == null
      ? questionLimitFor(planName)
      : Number(configuredLimit);
  return {
    plan: planName,
    planLabel: sub?.payment_plans?.name ?? sub?.plan_name ?? 'Free',
    status: sub?.status ?? (session ? 'free' : 'none'),
    isActive: Boolean(sub?.status === 'active'),
    isBasic: planMeets(planName, 'basic'),
    isPro: planMeets(planName, 'pro'),
    isPremium: planName === 'premium',
    isFree: !sub || planName === 'free',
    features: sub?.payment_plans?.features ?? [],
    roles,
    hasAdminAccess,
    questionLimit,
    periodEnd: sub?.current_period_end ?? null,
    loading,
    canAccess: (requiredPlan) => planMeets(planName, requiredPlan),
  };
}

// Create Stripe checkout session via Edge Function
export async function createCheckoutSession(planId, session) {
  if (!supabase || !session) return { error: new Error('Not authenticated') };
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token;
  if (!token) return { error: new Error('No auth token') };

  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`;
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ planId, successUrl: window.location.origin, cancelUrl: window.location.origin }),
  });
  const json = await res.json();
  if (!res.ok) return { error: new Error(json.error ?? 'Checkout failed') };
  return { url: json.url };
}
