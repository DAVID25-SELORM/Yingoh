import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
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
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setLoading(true);
    setSub(null);
    setRoles([]);
    setPermissions([]);
    setAccess(null);
    if (!session?.user?.id) { setLoading(false); return; }
    if (!supabase) { setLoading(false); return; }

    let cancelled = false;
    let expiryTimer;
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('user_roles').select('roles(name)').eq('user_id', session.user.id),
      supabase.rpc('my_effective_permissions'),
      import.meta.env.VITE_ACCESS_PROMOTIONS_ENABLED === 'true'
        ? supabase.rpc('my_effective_access') : Promise.resolve({ data: null }),
    ]).then(([{ data }, { data: roleRows }, { data: permissionRows, error: permissionError }, accessResult]) => {
        if (cancelled) return;
        const periodEnd = data?.current_period_end ? new Date(data.current_period_end) : null;
        const userRoles = (roleRows ?? []).map((row) => row.roles?.name).filter(Boolean);
        setSub(!periodEnd || periodEnd > new Date() ? data : null);
        setRoles(userRoles);
        setPermissions(!permissionError && Array.isArray(permissionRows)
          ? permissionRows.map((row) => row.permission_id).filter(Boolean) : []);
        const effective = !accessResult.error && accessResult.data?.has_access === true ? accessResult.data : null;
        const effectiveEnd = effective?.expires_at ? Date.parse(effective.expires_at) : null;
        const validEffective = effective && (effectiveEnd === null || effectiveEnd > Date.now()) ? effective : null;
        setAccess(validEffective);
        const expiresAt = validEffective?.expires_at ?? data?.current_period_end;
        if (expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now()) {
          expiryTimer = setTimeout(refresh, Math.min(2147483647, Date.parse(expiresAt) - Date.now() + 50));
        }
        setLoading(false);
      }).catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; clearTimeout(expiryTimer); window.removeEventListener('focus', refresh); };
  }, [session?.user?.id, revision]);

  const rawPlanName = access?.plan_key ?? sub?.plan_name ?? 'Free';
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
    planLabel: access && access.source !== 'paid_subscription' ? `Complimentary ${planName} access` : sub?.plan_name ?? 'Free',
    accessSource: access?.source ?? (sub ? 'paid_subscription' : 'free'),
    status: access ? 'active' : sub?.status ?? (session ? 'free' : 'none'),
    isActive: Boolean(access || sub?.status === 'active'),
    isBasic: planMeets(planName, 'basic'),
    isPro: planMeets(planName, 'pro'),
    isPremium: planMeets(planName, 'master'),
    isMaster: planMeets(planName, 'master'),
    isFaculty: planMeets(planName, 'faculty'),
    isFree: planName === 'free',
    features: entitlements,
    entitlements,
    roles,
    permissions,
    hasAdminAccess,
    questionLimit,
    periodEnd: access?.expires_at ?? sub?.current_period_end ?? null,
    loading,
    canAccess: (requiredPlan) => planMeets(planName, requiredPlan),
    can: (permission) => permissions.includes(permission),
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
