import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, DollarSign, Tag, FileText, PlusCircle, Search, ShieldCheck, Sparkles, ToggleLeft, ToggleRight, Users, X, Smartphone } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useSubscription, createCheckoutSession, normalizePlanName } from '../hooks/useSubscription';
import { SUBSCRIPTION_PLANS } from '../data/subscriptionPlans';

const DEMO_PLANS = SUBSCRIPTION_PLANS;

const DEMO_INVOICES = [
  { id: 'inv1', user_email: 'nurse@example.com', plan_name: 'Pro', amount_usd: 39.99, status: 'paid', payment_method: 'stripe', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'inv2', user_email: 'student2@test.com', plan_name: 'Basic', amount_usd: 19.99, status: 'paid', payment_method: 'mobile_money', created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'inv3', user_email: 'rn2025@health.com', plan_name: 'Premium', amount_usd: 59.99, status: 'pending', payment_method: 'paypal', created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'inv4', user_email: 'nclex.prep@gmail.com', plan_name: 'Basic', amount_usd: 14.99, status: 'paid', payment_method: 'stripe', created_at: new Date(Date.now() - 86400000 * 8).toISOString() },
];

const DEMO_SUBSCRIBERS = [
  { id: 's1', email: 'nurse.johnson@gmail.com', full_name: 'Sarah Johnson', plan_name: 'Pro', status: 'active', amount_usd: 39.99, started_at: new Date(Date.now() - 86400000 * 14).toISOString(), current_period_end: new Date(Date.now() + 86400000 * 16).toISOString(), payment_method: 'stripe' },
  { id: 's2', email: 'rn2025@health.com', full_name: 'Michael Osei', plan_name: 'Premium', status: 'active', amount_usd: 59.99, started_at: new Date(Date.now() - 86400000 * 7).toISOString(), current_period_end: new Date(Date.now() + 86400000 * 23).toISOString(), payment_method: 'stripe' },
  { id: 's3', email: 'student2@test.com', full_name: 'Abena Mensah', plan_name: 'Basic', status: 'active', amount_usd: 19.99, started_at: new Date(Date.now() - 86400000 * 21).toISOString(), current_period_end: new Date(Date.now() + 86400000 * 9).toISOString(), payment_method: 'mobile_money' },
  { id: 's4', email: 'nclex.prep@gmail.com', full_name: 'Grace Tetteh', plan_name: 'Basic', status: 'active', amount_usd: 19.99, started_at: new Date(Date.now() - 86400000 * 30).toISOString(), current_period_end: new Date(Date.now() + 86400000 * 1).toISOString(), payment_method: 'stripe' },
  { id: 's5', email: 'kwame.rn@outlook.com', full_name: 'Kwame Asante', plan_name: 'Pro', status: 'cancelled', amount_usd: 39.99, started_at: new Date(Date.now() - 86400000 * 45).toISOString(), current_period_end: new Date(Date.now() - 86400000 * 15).toISOString(), payment_method: 'stripe' },
  { id: 's6', email: 'akosuah@nurses.com', full_name: 'Akosuah Boateng', plan_name: 'Premium', status: 'active', amount_usd: 59.99, started_at: new Date(Date.now() - 86400000 * 3).toISOString(), current_period_end: new Date(Date.now() + 86400000 * 27).toISOString(), payment_method: 'mobile_money' },
  { id: 's7', email: 'linda.nclex@gmail.com', full_name: 'Linda Acheampong', plan_name: 'Basic', status: 'past_due', amount_usd: 19.99, started_at: new Date(Date.now() - 86400000 * 33).toISOString(), current_period_end: new Date(Date.now() - 86400000 * 3).toISOString(), payment_method: 'stripe' },
];

const DEMO_PROMOS = [
  { id: 'p1', code: 'NCLEX25', discount_pct: 25, max_uses: 100, used_count: 34, expires_at: new Date(Date.now() + 86400000 * 60).toISOString(), is_active: true },
  { id: 'p2', code: 'NEWSTUDENT', discount_pct: 50, max_uses: 200, used_count: 87, expires_at: new Date(Date.now() + 86400000 * 15).toISOString(), is_active: true },
  { id: 'p3', code: 'NURSE10', discount_pct: 10, max_uses: null, used_count: 12, expires_at: null, is_active: true },
];

const PLAN_COLORS = {
  'Explorer Pass': '#2b8a7d',
  '30-Day Pass': '#2563eb',
  '90-Day Success Plan': '#e3a72f',
  '180-Day Master Plan': '#dc6b2f',
  '365-Day Faculty Pass': '#7c3aed',
};
const USD_TO_GHS_RATE = 11.34;
const CARD_GATEWAY_ENABLED = false;

function formatGhs(usdAmount) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(Number(usdAmount || 0) * USD_TO_GHS_RATE);
}

function planKey(name) {
  const value = String(name ?? '').toLowerCase();
  if (value.includes('365')) return 'faculty_365';
  if (value.includes('180')) return 'master_180';
  if (value.includes('90')) return 'ninety_day';
  if (value.includes('30')) return 'thirty_day';
  if (value.includes('explorer') || value === 'free') return 'free';
  return value === 'starter' || value === 'basic' ? 'thirty_day' : value;
}

export default function PaymentsView({ session, canManage = false }) {
  const { plan: currentPlan, planLabel: currentPlanLabel, loading: subLoading } = useSubscription(session);
  const [checkingOut, setCheckingOut] = useState('');
  const [tab, setTab] = useState('plans');
  const [customerNotice, setCustomerNotice] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);

  async function handleCheckout(plan) {
    setCustomerNotice(null);
    setSelectedQuote(plan);
    if (!session) {
      setCustomerNotice({ type: 'info', message: 'Sign in when you are ready to continue with payment.' });
      return;
    }
    if (!CARD_GATEWAY_ENABLED) return;
    const planName = plan.name;
    setCheckingOut(planName);
    const { url, error } = await createCheckoutSession(planKey(planName), session);
    if (error || !url) {
      setCustomerNotice({
        type: 'error',
        message: canManage
          ? (error?.message ?? 'Checkout is unavailable. Verify the payment-provider configuration.')
          : 'Secure card checkout is being configured. Please use Mobile Money or contact NurseFaculty support.',
      });
      setCheckingOut('');
      return;
    }
    window.location.href = url;
  }
  const [plans, setPlans] = useState(DEMO_PLANS);
  const [bankCount, setBankCount] = useState(270);
  const [invoices, setInvoices] = useState(supabase ? [] : DEMO_INVOICES);
  const [promos, setPromos] = useState(supabase ? [] : DEMO_PROMOS);
  const [subscribers, setSubscribers] = useState(supabase ? [] : DEMO_SUBSCRIBERS);
  const [subSearch, setSubSearch] = useState('');
  const [subPlanFilter, setSubPlanFilter] = useState('all');
  const [subStatusFilter, setSubStatusFilter] = useState('all');
  const [newPromo, setNewPromo] = useState({ code: '', discount_pct: 10, max_uses: '', expires_at: '' });
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [mmPlan, setMmPlan] = useState('thirty_day');
  const [mmPhone, setMmPhone] = useState('');
  const [mmChannel, setMmChannel] = useState('mtn');
  const [mmLoading, setMmLoading] = useState(false);
  const [activatingInvoice, setActivatingInvoice] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.rpc('published_question_count')
      .then(({ data }) => { if (Number.isFinite(Number(data))) setBankCount(Number(data)); });
    supabase.from('payment_plans').select('*').order('sort_order').then(({ data }) => { if (data?.length) setPlans(data); });
    if (!canManage) return;
    supabase
      .from('invoices')
      .select('*, profiles(email, full_name), payment_plans(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setInvoices(data.map((inv) => ({
            ...inv,
            user_email: inv.profiles?.email ?? inv.user_id,
            user_name: inv.profiles?.full_name ?? '',
            plan_name: inv.payment_plans?.name ?? inv.plan_name,
          })));
        }
      });
    supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data?.length) setPromos(data); });
    supabase
      .from('subscriptions')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setSubscribers(data.map((s) => ({
            id: s.id,
            email: s.profiles?.email ?? s.user_id,
            full_name: s.profiles?.full_name ?? '—',
            plan_name: s.plan_name ?? '—',
            status: s.status,
            amount_usd: plans.find((plan) => normalizePlanName(plan.name) === normalizePlanName(s.plan_name))?.price_usd ?? 0,
            started_at: s.created_at,
            current_period_end: s.current_period_end,
            payment_method: s.payment_method ?? 'stripe',
          })));
        }
      });
  }, [canManage]);

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount_usd), 0);
  const pendingRevenue = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + Number(i.amount_usd), 0);

  async function togglePromo(id, current) {
    if (supabase) await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id);
    setPromos((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !current } : p));
  }

  async function savePromo() {
    const payload = {
      code: newPromo.code.toUpperCase().trim(),
      discount_pct: Number(newPromo.discount_pct),
      max_uses: newPromo.max_uses ? Number(newPromo.max_uses) : null,
      expires_at: newPromo.expires_at || null,
      is_active: true,
      used_count: 0,
    };
    if (!payload.code || !payload.discount_pct) return;
    if (supabase) {
      const { data } = await supabase.from('promo_codes').insert(payload).select().single();
      if (data) setPromos((prev) => [data, ...prev]);
    } else {
      setPromos((prev) => [{ ...payload, id: `p${Date.now()}` }, ...prev]);
    }
    setNewPromo({ code: '', discount_pct: 10, max_uses: '', expires_at: '' });
    setShowPromoForm(false);
  }

  async function handleMobileMoney() {
    setCustomerNotice(null);
    if (!session) {
      setCustomerNotice({ type: 'info', message: 'Sign in before starting a payment.' });
      return;
    }
    if (!mmPhone.trim()) {
      setCustomerNotice({ type: 'error', message: 'Enter the Mobile Money number that will authorize this payment.' });
      return;
    }
    setMmLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('create-paystack-order', {
        body: { planId: mmPlan, channel: mmChannel, phone: mmPhone, callbackUrl: window.location.origin },
      });
      if (error) throw new Error(error.message || 'Mobile Money is temporarily unavailable.');
      if (result?.url) {
        window.location.href = result.url;
      } else {
        setCustomerNotice({
          type: 'error',
          message: canManage
            ? (result?.error ?? 'Mobile Money is unavailable. Verify the payment-provider configuration.')
            : 'Mobile Money is being configured. Please contact NurseFaculty support for enrollment assistance.',
        });
      }
    } catch (err) {
      setCustomerNotice({ type: 'error', message: err.message || 'Payment could not be started.' });
    } finally {
      setMmLoading(false);
    }
  }

  async function activateManualInvoice(inv) {
    if (!supabase || !inv.user_id || !inv.plan_name) return;
    setActivatingInvoice(inv.id);
    setPaymentMessage('');
    setPaymentError('');
    const { error } = await supabase.rpc('admin_activate_manual_subscription', {
      target_user_id: inv.user_id,
      target_plan_name: inv.plan_name,
      target_invoice_id: inv.id,
    });
    if (error) {
      setPaymentError(error.message);
      setActivatingInvoice('');
      return;
    }
    setInvoices((prev) => prev.map((item) => (
      item.id === inv.id
        ? { ...item, status: 'paid', payment_method: item.payment_method ?? 'manual', paid_at: new Date().toISOString() }
        : item
    )));
    setPaymentMessage(`${inv.user_email ?? 'Student'} now has active ${inv.plan_name} access.`);
    setActivatingInvoice('');
  }

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>{canManage ? 'Payments & Subscriptions' : 'Choose your NurseFaculty plan'}</h2>
      </div>

      {customerNotice && (
        <div role="status" style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
          marginBottom: 16, borderRadius: 10,
          border: `1px solid ${customerNotice.type === 'error' ? '#f2b9ae' : '#b7ded8'}`,
          background: customerNotice.type === 'error' ? '#fff1ed' : '#eaf7f5',
          color: customerNotice.type === 'error' ? '#8a2c21' : '#135f55',
          fontSize: '0.88rem',
        }}>
          {customerNotice.type === 'error' ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
          <span style={{ flex: 1 }}>{customerNotice.message}</span>
          <button className="icon-btn" onClick={() => setCustomerNotice(null)} aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}

      {/* Revenue stats */}
      {canManage && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: '#29b7a3' },
          { label: 'Pending', value: `$${pendingRevenue.toFixed(2)}`, icon: DollarSign, color: '#e3a72f' },
          { label: 'Active Subscribers', value: subscribers.filter((s) => s.status === 'active').length, icon: Users, color: '#2b8a7d' },
          { label: 'Paid Invoices', value: invoices.filter((i) => i.status === 'paid').length, icon: FileText, color: '#6750a4' },
          { label: 'Active Promos', value: promos.filter((p) => p.is_active).length, icon: Tag, color: '#c17f44' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}`, textAlign: 'center' }}>
            <s.icon size={20} color={s.color} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.82rem', color: '#607478' }}>{s.label}</div>
          </div>
        ))}
      </div>}

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {(canManage
          ? [['plans', 'Plans'], ['subscribers', 'Subscribers'], ['mobile-money', 'Mobile Money'], ['access-policy', 'Access Policy'], ['invoices', 'Invoices'], ['promos', 'Promo Codes']]
          : [['plans', 'Subscription plans'], ['mobile-money', 'Mobile Money']]
        ).map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Plans tab */}
      {tab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {plans.map((plan) => {
            const color = PLAN_COLORS[plan.name] ?? '#607478';
            const features = Array.isArray(plan.features) ? plan.features : (typeof plan.features === 'string' ? JSON.parse(plan.features) : []);
            const normalizedCurrentLabel = String(currentPlanLabel ?? '').trim().toLowerCase();
            const isLegacyPlanLabel = ['free', 'starter', 'basic', 'pro', 'premium'].includes(normalizedCurrentLabel);
            const isCurrentPlan = normalizedCurrentLabel === String(plan.name).toLowerCase()
              || (isLegacyPlanLabel && currentPlan === normalizePlanName(plan.name));
            const questionAccess = plan.question_limit == null
              ? `All ${bankCount.toLocaleString()} available questions`
              : `Up to ${Math.min(Number(plan.question_limit), bankCount).toLocaleString()} of ${bankCount.toLocaleString()} available questions`;
            return (
              <div key={plan.id} className="payment-plan-card" style={{ borderTop: `4px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color }}>{plan.name}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#17212f', lineHeight: 1.1 }}>
                      {plan.price_usd === 0 ? 'Free' : `$${Number(plan.price_usd).toFixed(2)}`}
                      {plan.price_usd > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#607478' }}> / {plan.duration_days} days</span>}
                    </div>
                    {!subLoading && isCurrentPlan && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', background: '#e2f5f2', color: '#135f55', borderRadius: 12 }}>Current Plan</span>
                    )}
                    <div style={{ marginTop: 7, fontSize: '0.76rem', fontWeight: 700, color }}>{questionAccess}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 700, background: plan.is_active ? '#e2f5f2' : '#f2e2e1', color: plan.is_active ? '#135f55' : '#8a2c21' }}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
                {plan.price_usd > 0 && !isCurrentPlan && (
                  <button
                    className="primary-btn"
                    style={{ width: '100%', justifyContent: 'center', background: color, marginBottom: 8 }}
                    onClick={() => handleCheckout(plan)}
                    disabled={checkingOut === plan.name}
                  >
                    <Sparkles size={14} /> {checkingOut === plan.name ? 'Starting secure checkout…' : `Choose ${plan.name} — $${Number(plan.price_usd).toFixed(2)}`}
                  </button>
                )}
                  {features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', gap: 7, fontSize: '0.83rem', color: '#42585e' }}>
                      <CheckCircle2 size={13} color={color} style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {selectedQuote && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedQuote(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, padding: 16,
            display: 'grid', placeItems: 'center',
            background: 'rgba(8, 27, 35, 0.58)', backdropFilter: 'blur(4px)',
          }}
        >
          <section
            className="qm-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-quote-title"
            onMouseDown={(event) => event.stopPropagation()}
            style={{ width: 'min(520px, calc(100vw - 32px))', padding: 0, overflow: 'hidden' }}
          >
            <div className="qm-editor-header" style={{ padding: '18px 20px', borderBottom: '1px solid #e1ebe9' }}>
              <div>
                <span style={{ display: 'block', color: '#2b8a7d', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>NurseFaculty subscription</span>
                <strong id="subscription-quote-title" style={{ fontSize: '1.1rem' }}>{selectedQuote.name} plan quote</strong>
              </div>
              <button className="icon-btn" onClick={() => setSelectedQuote(null)} aria-label="Close quote"><X size={18} /></button>
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ padding: '18px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #e9f6f4, #f8fbfa)', border: '1px solid #cfe5e1' }}>
                <span style={{ display: 'block', color: '#607478', fontSize: '0.8rem', marginBottom: 4 }}>Estimated pass amount in Ghana cedis</span>
                <strong style={{ display: 'block', color: '#102027', fontSize: '2rem', lineHeight: 1.1 }}>{formatGhs(selectedQuote.price_usd)}</strong>
                <span style={{ display: 'block', color: '#607478', fontSize: '0.78rem', marginTop: 7 }}>
                  ${Number(selectedQuote.price_usd).toFixed(2)} USD × {USD_TO_GHS_RATE.toFixed(2)} GHS
                </span>
              </div>
              <p style={{ color: '#52666b', fontSize: '0.84rem', lineHeight: 1.55, margin: '14px 0' }}>
                This is an indicative cedi conversion. The final provider amount may vary slightly with the payment-day exchange rate.
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                <button
                  className="primary-btn"
                  style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
                  onClick={() => {
                    setMmPlan(planKey(selectedQuote.name));
                    setSelectedQuote(null);
                    setTab('mobile-money');
                  }}
                >
                  <Smartphone size={16} /> Continue with Mobile Money
                </button>
                <button className="ghost-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedQuote(null)}>
                  Review other plans
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Subscribers tab */}
      {canManage && tab === 'subscribers' && (() => {
        const PLAN_COLORS_SUB = { Free: '#8a999c', Basic: '#2b8a7d', Pro: '#e3a72f', Premium: '#c17f44' };
        const STATUS_STYLE = {
          active: { bg: '#e2f5f2', color: '#135f55', label: 'Active' },
          cancelled: { bg: '#f2e2e1', color: '#8a2c21', label: 'Cancelled' },
          past_due: { bg: '#fff5df', color: '#875f08', label: 'Past Due' },
          trialing: { bg: '#eef0ff', color: '#4338ca', label: 'Trial' },
        };
        const visibleSubs = subscribers.filter((s) => {
          const q = subSearch.toLowerCase();
          const matchSearch = !q || s.email?.toLowerCase().includes(q) || s.full_name?.toLowerCase().includes(q);
          const matchPlan = subPlanFilter === 'all' || s.plan_name?.toLowerCase() === subPlanFilter;
          const matchStatus = subStatusFilter === 'all' || s.status === subStatusFilter;
          return matchSearch && matchPlan && matchStatus;
        });
        const activeCount = subscribers.filter((s) => s.status === 'active').length;
        const mrr = subscribers.filter((s) => s.status === 'active').reduce((sum, s) => sum + Number(s.amount_usd ?? 0), 0);

        return (
          <div>
            {/* Sub stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
              {[
                { label: 'Active', value: activeCount, color: '#29b7a3' },
                { label: 'MRR', value: `$${mrr.toFixed(2)}`, color: '#2b8a7d' },
                { label: 'Cancelled', value: subscribers.filter((s) => s.status === 'cancelled').length, color: '#8a2c21' },
                { label: 'Past Due', value: subscribers.filter((s) => s.status === 'past_due').length, color: '#e3a72f' },
              ].map((s) => (
                <div key={s.label} className="qm-stat" style={{ borderColor: s.color }}>
                  <strong style={{ color: s.color }}>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8a999c' }} />
                <input value={subSearch} onChange={(e) => setSubSearch(e.target.value)} placeholder="Search by name or email…"
                  style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px 0 32px', boxSizing: 'border-box', fontSize: '0.86rem' }} />
              </div>
              <select value={subPlanFilter} onChange={(e) => setSubPlanFilter(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px', fontSize: '0.86rem' }}>
                <option value="all">All Plans</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="premium">Premium</option>
              </select>
              <select value={subStatusFilter} onChange={(e) => setSubStatusFilter(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px', fontSize: '0.86rem' }}>
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="past_due">Past Due</option>
                <option value="trialing">Trialing</option>
              </select>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Started</th>
                    <th>Renews / Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSubs.map((s) => {
                    const st = STATUS_STYLE[s.status] ?? { bg: '#f0f0f0', color: '#607478', label: s.status };
                    const planColor = PLAN_COLORS_SUB[s.plan_name] ?? '#607478';
                    const periodEnd = s.current_period_end ? new Date(s.current_period_end) : null;
                    const isExpiringSoon = periodEnd && periodEnd > new Date() && (periodEnd - new Date()) < 86400000 * 5;
                    return (
                      <tr key={s.id}>
                        <td><strong style={{ fontSize: '0.88rem' }}>{s.full_name || '—'}</strong></td>
                        <td style={{ fontSize: '0.83rem', color: '#607478' }}>{s.email}</td>
                        <td>
                          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.74rem', fontWeight: 800, background: `${planColor}18`, color: planColor }}>
                            {s.plan_name}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#135f55' }}>${Number(s.amount_usd ?? 0).toFixed(2)}/mo</td>
                        <td>
                          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.74rem', fontWeight: 700, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#607478', textTransform: 'capitalize' }}>{s.payment_method?.replace('_', ' ') ?? '—'}</td>
                        <td style={{ fontSize: '0.82rem', color: '#607478' }}>
                          {s.started_at ? new Date(s.started_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: isExpiringSoon ? '#875f08' : '#607478', fontWeight: isExpiringSoon ? 700 : 400 }}>
                          {periodEnd ? periodEnd.toLocaleDateString() : '—'}
                          {isExpiringSoon && <span style={{ marginLeft: 6, fontSize: '0.74rem', color: '#875f08' }}>⚠ Soon</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleSubs.length && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#8a999c' }}>No subscribers match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Mobile Money tab */}
      {tab === 'mobile-money' && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ padding: '12px 16px', background: '#e9f1ef', borderRadius: 10, fontSize: '0.85rem', color: '#135f55', marginBottom: 18, lineHeight: 1.6 }}>
            <Smartphone size={14} style={{ display: 'inline', marginRight: 6 }} />
            Complete enrollment here using MTN Mobile Money, Telecel Cash, or AirtelTigo Money. Authorization is handled securely by Paystack.
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>Select Plan</label>
              <select value={mmPlan} onChange={(e) => setMmPlan(e.target.value)} style={{ width: '100%', height: 42, borderRadius: 10, border: '1.5px solid #dbe6e4', padding: '0 14px', fontSize: '0.9rem' }}>
                {plans.filter((plan) => Number(plan.price_usd) > 0).map((plan) => (
                  <option key={plan.id} value={planKey(plan.name)}>
                    {plan.name} — {formatGhs(plan.price_usd)} / {plan.duration_days} days
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>Mobile Network</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['mtn', 'MTN', '#ffcc00'], ['vodafone', 'Vodafone', '#e60000'], ['tigo', 'AirtelTigo', '#ff6600']].map(([val, label, color]) => (
                  <button key={val} onClick={() => setMmChannel(val)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `2px solid ${mmChannel === val ? color : '#dbe6e4'}`, background: mmChannel === val ? `${color}18` : '#fff', fontWeight: 700, fontSize: '0.88rem', color: mmChannel === val ? color : '#607478', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>Mobile Money Number</label>
              <input value={mmPhone} onChange={(e) => setMmPhone(e.target.value)} placeholder="e.g. 0244123456" style={{ width: '100%', height: 42, borderRadius: 10, border: '1.5px solid #dbe6e4', padding: '0 14px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <button className="primary-btn" onClick={handleMobileMoney} disabled={mmLoading || !mmPhone.trim()} style={{ width: '100%', justifyContent: 'center', fontSize: '0.95rem', height: 46 }}>
              <Smartphone size={16} /> {mmLoading ? 'Redirecting to Paystack…' : 'Pay with Mobile Money'}
            </button>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#8a999c', textAlign: 'center' }}>Secured by Paystack · GHS pricing · Exchange rate applied at checkout</p>
          </div>
        </div>
      )}

      {/* Access policy tab */}
      {canManage && tab === 'access-policy' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="qm-editor">
            <div className="qm-editor-header">
              <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#2b8a7d" /> Enrollment and Access Policy
              </strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {[
                ['Student self-signup', 'Learners create an account, confirm their email, and receive student access only.'],
                ['Paid course unlock', 'Stripe or Paystack webhooks activate paid subscriptions automatically after successful payment.'],
                ['Manual/offline payment', 'Finance or admin reviews pending invoices, confirms payment, then activates the subscription.'],
                ['Staff access', 'Instructors, finance, content reviewers, admins, and super admins are invited or assigned by an admin.'],
              ].map(([title, body]) => (
                <div key={title} className="stat-card" style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, color: '#17212f', marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.5, color: '#42585e' }}>{body}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '12px 14px', border: '1px solid #f1d59b', background: '#fff8e8', borderRadius: 8, color: '#72520a', fontSize: '0.86rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Best flow: public students pay and unlock automatically; staff and school/cohort users should be invited or assigned by admin. Manual approvals are only for confirmed offline payments.</span>
          </div>
        </div>
      )}

      {/* Invoices tab */}
      {canManage && tab === 'invoices' && (
        <div>
          {paymentMessage && <div style={{ padding: '10px 12px', background: '#e2f5f2', border: '1px solid #b7ded8', color: '#135f55', borderRadius: 8, marginBottom: 12, fontSize: '0.86rem' }}>{paymentMessage}</div>}
          {paymentError && <div style={{ padding: '10px 12px', background: '#fff1ed', border: '1px solid #f2b9ae', color: '#8a2c21', borderRadius: 8, marginBottom: 12, fontSize: '0.86rem' }}>{paymentError}</div>}
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.user_email ?? inv.user_id?.slice(0, 8) + '…'}</td>
                  <td>{inv.plan_name ?? '—'}</td>
                  <td><strong>${Number(inv.amount_usd).toFixed(2)}</strong></td>
                  <td style={{ textTransform: 'capitalize' }}>{inv.payment_method ?? '—'}</td>
                  <td>
                    <span className={`status-badge status-${inv.status}`}>{inv.status}</span>
                  </td>
                  <td style={{ color: '#607478', fontSize: '0.84rem' }}>
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {inv.status === 'pending' ? (
                      <button
                        className="ghost-btn"
                        onClick={() => activateManualInvoice(inv)}
                        disabled={!inv.user_id || !inv.plan_name || activatingInvoice === inv.id}
                        title={inv.user_id && inv.plan_name ? 'Mark paid and activate subscription' : 'Needs a real user and plan'}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {activatingInvoice === inv.id ? 'Activating...' : 'Approve access'}
                      </button>
                    ) : (
                      <span style={{ color: '#8a999c', fontSize: '0.82rem' }}>No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Promo codes tab */}
      {canManage && tab === 'promos' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="primary-btn" onClick={() => setShowPromoForm(true)}>
              <PlusCircle size={15} /> New Promo Code
            </button>
          </div>

          {showPromoForm && (
            <div className="qm-editor" style={{ marginBottom: 16 }}>
              <div className="qm-editor-header">
                <strong>Create Promo Code</strong>
                <button className="icon-btn" onClick={() => setShowPromoForm(false)}><X size={16} /></button>
              </div>
              <div className="qm-form-grid">
                <div className="qm-form-row">
                  <label>Code</label>
                  <input value={newPromo.code} onChange={(e) => setNewPromo((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. SAVE20" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Discount %</label>
                  <input type="number" min="1" max="100" value={newPromo.discount_pct} onChange={(e) => setNewPromo((p) => ({ ...p, discount_pct: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Max Uses (blank = unlimited)</label>
                  <input type="number" min="1" value={newPromo.max_uses} onChange={(e) => setNewPromo((p) => ({ ...p, max_uses: e.target.value }))} placeholder="Unlimited" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Expiry Date (blank = never)</label>
                  <input type="date" value={newPromo.expires_at} onChange={(e) => setNewPromo((p) => ({ ...p, expires_at: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
              </div>
              <div className="editor-footer">
                <button className="ghost-btn" onClick={() => setShowPromoForm(false)}>Cancel</button>
                <button className="primary-btn" onClick={savePromo} disabled={!newPromo.code || !newPromo.discount_pct}>Save Promo</button>
              </div>
            </div>
          )}

          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Usage</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td><code style={{ background: '#e9f1ef', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{p.code}</code></td>
                  <td><strong>{p.discount_pct}% off</strong></td>
                  <td>{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                  <td style={{ color: '#607478', fontSize: '0.84rem' }}>{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : 'Never'}</td>
                  <td><span className={`status-badge status-${p.is_active ? 'paid' : 'failed'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="icon-btn" onClick={() => togglePromo(p.id, p.is_active)}>
                      {p.is_active ? <ToggleRight size={20} color="#29b7a3" /> : <ToggleLeft size={20} color="#8a999c" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
