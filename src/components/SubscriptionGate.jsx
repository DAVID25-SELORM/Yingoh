import React, { useState } from 'react';
import { Lock, Sparkles, Star } from 'lucide-react';
import { useSubscription, createCheckoutSession } from '../hooks/useSubscription';

const PLAN_DETAILS = {
  basic: { label: 'Basic', price: '$19.99/mo', color: '#2b8a7d', features: ['500+ questions', 'All exam modes', 'Flashcard decks', 'Study planner', 'Notebook', 'Email support'] },
  pro:   { label: 'Pro', price: '$39.99/mo', color: '#e3a72f', features: ['Everything in Basic', 'CAT simulator', 'Advanced analytics', 'Pass probability tracking', 'Live coaching sessions'] },
  premium: { label: 'Premium', price: '$59.99/mo', color: '#c17f44', features: ['Everything in Pro', 'Unlimited live coaching', '1-on-1 sessions', 'USRN career track', 'WhatsApp support'] },
};

// Wraps any child — shows upgrade prompt if user doesn't have required plan
export function SubscriptionGate({ session, requiredPlan = 'pro', children, featureName = 'this feature', onUpgrade }) {
  const { plan, loading, canAccess } = useSubscription(session);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <div style={{ padding: 24, color: '#607478', textAlign: 'center' }}>Loading…</div>;

  const hasAccess = canAccess(requiredPlan);

  if (hasAccess) return children;

  const detail = PLAN_DETAILS[requiredPlan] ?? PLAN_DETAILS.pro;

  async function upgrade() {
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    if (!session) { setError('Sign in first to subscribe.'); return; }
    setCheckingOut(true);
    const { url, error: err } = await createCheckoutSession(requiredPlan, session);
    if (err || !url) {
      setError(err?.message ?? 'Could not start checkout. Check Stripe configuration.');
      setCheckingOut(false);
      return;
    }
    window.location.href = url;
  }

  return (
    <section className="content-band" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ maxWidth: 420, textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: detail.color + '22', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
          <Lock size={28} color={detail.color} />
        </div>
        <h2 style={{ margin: '0 0 8px' }}>Upgrade to {detail.label}</h2>
        <p style={{ color: '#607478', margin: '0 0 24px', lineHeight: 1.6 }}>
          Access to <strong>{featureName}</strong> requires a <strong>{detail.label}</strong> subscription.
          Your current plan: <strong style={{ textTransform: 'capitalize' }}>{plan}</strong>.
        </p>
        <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'grid', gap: 8, textAlign: 'left' }}>
          {detail.features.map((f) => (
            <li key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.88rem', color: '#42585e' }}>
              <Star size={13} color={detail.color} style={{ flexShrink: 0 }} /> {f}
            </li>
          ))}
        </ul>
        {error && <div style={{ padding: '8px 14px', background: '#fce8e6', borderRadius: 8, color: '#8a2c21', fontSize: '0.84rem', marginBottom: 14 }}>{error}</div>}
        <button className="primary-btn" style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: '1rem', background: detail.color }} onClick={upgrade} disabled={checkingOut}>
          <Sparkles size={16} /> {checkingOut ? 'Redirecting to checkout…' : `Upgrade to ${detail.label} — ${detail.price}`}
        </button>
        {!session && <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: '#8a999c' }}>You must be signed in to subscribe.</p>}
      </div>
    </section>
  );
}

// Inline badge for premium content
export function PremiumBadge({ plan = 'Pro' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: '#fff6df', color: '#875f08', fontSize: '0.72rem', fontWeight: 800 }}>
      <Star size={10} /> {plan.toUpperCase()}
    </span>
  );
}

// Small upgrade CTA for inline use
export function UpgradeCTA({ session, requiredPlan = 'pro', style, onUpgrade }) {
  const detail = PLAN_DETAILS[requiredPlan] ?? PLAN_DETAILS.pro;
  const [checkingOut, setCheckingOut] = useState(false);

  async function upgrade() {
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    if (!session) return;
    setCheckingOut(true);
    const { url } = await createCheckoutSession(requiredPlan, session);
    if (url) window.location.href = url;
    else setCheckingOut(false);
  }

  return (
    <div style={{ padding: '12px 16px', background: '#fff9e9', borderRadius: 10, border: '1.5px solid #f2d6a0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', ...style }}>
      <Lock size={16} color="#875f08" />
      <span style={{ flex: 1, fontSize: '0.86rem', color: '#4a3020' }}>
        This content requires <strong>{detail.label}</strong> ({detail.price}).
      </span>
      <button onClick={upgrade} disabled={checkingOut || !session} className="primary-btn" style={{ background: detail.color, fontSize: '0.84rem', padding: '6px 14px', whiteSpace: 'nowrap' }}>
        {checkingOut ? 'Loading…' : 'Upgrade'}
      </button>
    </div>
  );
}
