import { useEffect, useState } from 'react';
import { isConfiguredSuperAdmin, supabase } from '../services/supabase';
import { entitlementsFor, PLAN_LEVELS, questionLimitFor } from '../data/subscriptionPlans';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export function normalizePlanName(value) {
  const name = String(value ?? 'free').trim().toLowerCase();
  if (name.includes('365') || name.includes('faculty')) return 'faculty';
  if (name.includes('180') || name.includes('master') || name.includes('premium')) return 'master';
  if (name.includes('90') || name.includes('success') || name.includes('pro')) return 'pro';
  if (name.includes('30') || name.includes('basic') || name.includes('starter')) return 'basic';
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
        .select('*')
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

  const rawPlanName = sub?.plan_name ?? 'Free';
  const planName = normalizePlanName(rawPlanName);
  const hasAdminAccess = roles.some((role) => ADMIN_ROLES.has(role));
  const configuredLimit = null;
  const questionLimit = hasAdminAccess
    ? Infinity
    : configuredLimit == null
      ? questionLimitFor(planName)
      : Number(configuredLimit);
  const entitlements = entitlementsFor(planName, hasAdminAccess);
  return {
    plan: planName,
    planLabel: sub?.plan_name ?? 'Free',
    status: sub?.status ?? (session ? 'free' : 'none'),
    isActive: Boolean(sub?.status === 'active'),
    isBasic: planMeets(planName, 'basic'),
    isPro: planMeets(planName, 'pro'),
    isPremium: planMeets(planName, 'master'),
    isMaster: planMeets(planName, 'master'),
    isFaculty: planMeets(planName, 'faculty'),
    isFree: !sub || planName === 'free',
    features: entitlements,
    entitlements,
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
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      planId,
      successUrl: `${window.location.origin}/#/Billing?checkout=success`,
      cancelUrl: `${window.location.origin}/#/Billing?checkout=cancelled`,
    },
  });
  if (error) return { error: new Error(error.message || 'Checkout is temporarily unavailable.') };
  if (!data?.url) return { error: new Error(data?.error || 'Checkout did not return a payment link.') };
  return { url: data.url };
}
