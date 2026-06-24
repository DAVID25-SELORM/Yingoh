import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

// Returns { plan, status, isActive, isPro, isPremium, loading }
export function useSubscription(session) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return; }
    if (!supabase) { setLoading(false); return; }

    supabase
      .from('subscriptions')
      .select('*, payment_plans(name, price_usd, features)')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { setSub(data); setLoading(false); });
  }, [session?.user?.id]);

  const planName = (sub?.payment_plans?.name ?? 'Free').toLowerCase();
  return {
    plan: planName,
    planLabel: sub?.payment_plans?.name ?? 'Free',
    status: sub?.status ?? (session ? 'free' : 'none'),
    isActive: Boolean(sub?.status === 'active'),
    isPro: planName === 'pro' || planName === 'premium',
    isPremium: planName === 'premium',
    isFree: !sub || planName === 'free',
    features: sub?.payment_plans?.features ?? [],
    periodEnd: sub?.current_period_end ?? null,
    loading,
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
