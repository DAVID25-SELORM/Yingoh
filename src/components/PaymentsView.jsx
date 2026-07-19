import React, { useEffect, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, Building2, CheckCircle2, CreditCard, DollarSign, FileText, History, PlusCircle, ReceiptText, Search, ShieldCheck, Smartphone, Sparkles, Tag, ToggleLeft, ToggleRight, Users, X } from 'lucide-react';
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

const INSTITUTION_PLANS = [
  { id: 'campus_starter', name: 'Campus Starter', audience: 'Nursing schools', seats: 100, price: 499, term: 'annual', color: '#2367ff', features: ['100 student seats', '5 instructor accounts', 'LMS classrooms', 'Institution-branded certificates', 'Cohort analytics', 'Question-bank access'] },
  { id: 'campus_premium', name: 'Campus Premium', audience: 'Nursing colleges', seats: 500, price: 1499, term: 'annual', color: '#8a35ff', features: ['500 student seats', 'Unlimited classrooms', 'Instructor management', 'Certificate templates', 'Department reports', 'Priority onboarding'] },
  { id: 'hospital_training', name: 'Hospital Training', audience: 'Hospitals', seats: 250, price: 999, term: 'annual', color: '#dc6b2f', features: ['Staff training seats', 'Compliance tracking', 'Continuing education reports', 'Department dashboards', 'Certificate verification', 'Finance reports'] },
];

const ENTERPRISE_LICENSES = [
  { label: 'Seats purchased', value: '500' },
  { label: 'Seats assigned', value: '318' },
  { label: 'Seats remaining', value: '182' },
  { label: 'AI usage', value: '42%' },
  { label: 'Certificates issued', value: '2,135' },
  { label: 'Storage used', value: '58%' },
];

const FEATURE_MATRIX = [
  ['Question bank', '150', '2,000+', '7,000+', '7,000+', '7,000+'],
  ['Mock / CAT exams', '1', '5', 'Unlimited', 'Unlimited', 'Unlimited'],
  ['Study Coach', '10/day', 'Unlimited', 'Personalized', 'Personalized', 'Institution-ready'],
  ['Analytics', 'Basic', 'Weak areas', 'Detailed', 'Advanced', 'Institution'],
  ['Certificates', '—', '—', 'Achievements', 'Formal + digital', 'Templates'],
  ['LMS classrooms', '—', '—', '—', 'Assignments', 'Faculty tools'],
  ['Live classes', '—', 'Video only', 'Video only', 'Included', 'Faculty webinars'],
];

const PAYMENT_METHODS = [
  { title: 'Ghana Mobile Money', details: 'MTN MoMo, Telecel Cash, AirtelTigo Money via Paystack.', icon: Smartphone },
  { title: 'International Cards', details: 'Visa and Mastercard once card gateway keys are configured.', icon: CreditCard },
  { title: 'Institution Invoice', details: 'Annual school, hospital, and enterprise seat licensing.', icon: ReceiptText },
];

function formatGhs(usdAmount) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(Number(usdAmount || 0) * USD_TO_GHS_RATE);
}

function formatUsd(usdAmount) {
  return `$${Number(usdAmount || 0).toFixed(2)}`;
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
  const subscription = useSubscription(session);
  const { plan: currentPlan, planLabel: currentPlanLabel, loading: subLoading } = subscription;
  const [checkingOut, setCheckingOut] = useState('');
  const [tab, setTab] = useState('my-subscription');
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
  const [newPromo, setNewPromo] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    applies_to_plans: [],
    valid_from: '',
    expires_at: '',
    max_uses: '',
    max_per_user: 1,
    eligibility: 'all',
    minimum_purchase_usd: '',
  });
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [mmPlan, setMmPlan] = useState('thirty_day');
  const [mmPhone, setMmPhone] = useState('');
  const [mmChannel, setMmChannel] = useState('mtn');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [mmLoading, setMmLoading] = useState(false);
  const [activatingInvoice, setActivatingInvoice] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.rpc('published_question_count')
      .then(({ data }) => { if (Number.isFinite(Number(data))) setBankCount(Number(data)); });
    supabase.from('payment_plans').select('*').order('sort_order').then(({ data }) => {
      if (data?.length) {
        setPlans(data.map((plan) => {
          const canonical = SUBSCRIPTION_PLANS.find((item) => normalizePlanName(item.name) === normalizePlanName(plan.name));
          return canonical ? { ...plan, features: canonical.features, question_limit: canonical.question_limit } : plan;
        }));
      }
    });
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
  const activePlan = plans.find((plan) => normalizePlanName(plan.name) === currentPlan) ?? plans[0];
  const questionLimit = Number.isFinite(subscription.questionLimit) ? subscription.questionLimit : bankCount;
  const questionsRemaining = Math.max(0, Math.min(questionLimit, bankCount));
  const coachLimitLabel = Number.isFinite(subscription.entitlements.coachDailyLimit)
    ? `${subscription.entitlements.coachDailyLimit} chats/day`
    : 'Unlimited';
  const paidPlans = plans.filter((plan) => Number(plan.price_usd) > 0);
  const mobileMoneyPlan = paidPlans.find((plan) => planKey(plan.name) === mmPlan) ?? paidPlans[0];
  const mobileMoneyBaseUsd = Number(mobileMoneyPlan?.price_usd ?? 0);
  const activePromoForMobileMoney = appliedPromo?.plan_key === mmPlan ? appliedPromo : null;
  const mobileMoneyDiscountUsd = Number(activePromoForMobileMoney?.discount_amount_usd ?? 0);
  const mobileMoneyFinalUsd = Number(activePromoForMobileMoney?.final_amount_usd ?? mobileMoneyBaseUsd);

  useEffect(() => {
    if (appliedPromo && appliedPromo.plan_key !== mmPlan && !selectedQuote) {
      setAppliedPromo(null);
      setPromoCode('');
      setPromoError('');
    }
  }, [mmPlan, appliedPromo, selectedQuote]);

  function localPromoValidation(code, planKeyValue, amountUsd) {
    const promo = promos.find((item) => String(item.code).toUpperCase() === String(code).trim().toUpperCase());
    if (!promo) return { valid: false, reason: 'Promo code does not exist.' };
    if (!promo.is_active) return { valid: false, reason: 'Promo code is inactive.' };
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return { valid: false, reason: 'Promo code has expired.' };
    if (promo.max_uses && Number(promo.used_count ?? 0) >= Number(promo.max_uses)) return { valid: false, reason: 'Promo code redemption limit has been reached.' };
    const appliesTo = Array.isArray(promo.applies_to_plans) ? promo.applies_to_plans : [];
    if (appliesTo.length && !appliesTo.includes(planKeyValue)) return { valid: false, reason: 'Promo code is not valid for this subscription plan.' };
    const type = promo.discount_type ?? 'percentage';
    const value = Number(promo.discount_value ?? promo.discount_amount ?? promo.discount_pct ?? 0);
    const discount = type === 'percentage' ? Math.round((amountUsd * Math.min(value, 100)) * 100) / 100
      : type === 'fixed_amount' ? Math.min(amountUsd, value)
      : 0;
    return {
      valid: true,
      promo_id: promo.id,
      code: promo.code,
      name: promo.name ?? promo.code,
      discount_type: type,
      discount_value: value,
      original_amount_usd: amountUsd,
      discount_amount_usd: discount,
      final_amount_usd: Math.max(amountUsd - discount, 0),
      message: type === 'free_trial' ? `${promo.trial_days ?? 0} days free trial applied.` : 'Promo code applied successfully.',
    };
  }

  async function applyPromo(planKeyValue = mmPlan, amountUsd = mobileMoneyBaseUsd) {
    const code = promoCode.trim();
    setPromoError('');
    if (!code) {
      setPromoError('Enter a promo code first.');
      return;
    }
    if (!session && supabase) {
      setPromoError('Sign in before applying a promo code.');
      return;
    }
    setPromoLoading(true);
    try {
      let result = null;
      if (supabase) {
        const { data, error } = await supabase.rpc('validate_promo_code', {
          p_code: code,
          p_plan_key: planKeyValue,
          p_amount_usd: Number(amountUsd),
          p_user_id: session?.user?.id ?? null,
        });
        if (error) throw error;
        result = data;
      } else {
        result = localPromoValidation(code, planKeyValue, Number(amountUsd));
      }
      if (!result?.valid) {
        setAppliedPromo(null);
        setPromoError(result?.reason ?? 'Promo code is not valid.');
        return;
      }
      setAppliedPromo({ ...result, plan_key: planKeyValue });
      setPromoCode(String(result.code ?? code).toUpperCase());
    } catch (err) {
      setAppliedPromo(null);
      setPromoError(err.message ?? 'Could not validate promo code.');
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  }

  async function togglePromo(id, current) {
    if (supabase) await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id);
    setPromos((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !current } : p));
  }

  async function savePromo() {
    const numericDiscount = Number(newPromo.discount_value);
    const payload = {
      code: newPromo.code.toUpperCase().trim(),
      name: newPromo.name.trim() || newPromo.code.toUpperCase().trim(),
      description: newPromo.description || null,
      discount_type: newPromo.discount_type,
      discount_value: numericDiscount,
      discount_amount: numericDiscount,
      discount_pct: newPromo.discount_type === 'percentage' ? Number(numericDiscount) : 0,
      applies_to_plans: newPromo.applies_to_plans,
      valid_from: newPromo.valid_from || null,
      max_uses: newPromo.max_uses ? Number(newPromo.max_uses) : null,
      max_per_user: newPromo.max_per_user ? Number(newPromo.max_per_user) : 1,
      eligibility: newPromo.eligibility,
      minimum_purchase_usd: newPromo.minimum_purchase_usd ? Number(newPromo.minimum_purchase_usd) : null,
      expires_at: newPromo.expires_at || null,
      is_active: true,
      used_count: 0,
      created_by: session?.user?.id ?? null,
    };
    if (!payload.code || !payload.discount_value) return;
    if (supabase) {
      const { data } = await supabase.from('promo_codes').insert(payload).select().single();
      if (data) setPromos((prev) => [data, ...prev]);
    } else {
      setPromos((prev) => [{ ...payload, id: `p${Date.now()}` }, ...prev]);
    }
    setNewPromo({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      applies_to_plans: [],
      valid_from: '',
      expires_at: '',
      max_uses: '',
      max_per_user: 1,
      eligibility: 'all',
      minimum_purchase_usd: '',
    });
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
        body: {
          planId: mmPlan,
          channel: mmChannel,
          phone: mmPhone,
          callbackUrl: window.location.origin,
          promoCode: activePromoForMobileMoney?.code ?? null,
        },
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

  function renderPromoBox(planKeyValue, amountUsd) {
    const promoForPlan = appliedPromo?.plan_key === planKeyValue ? appliedPromo : null;
    return (
      <div style={{ padding: 14, borderRadius: 12, border: '1px solid #dbe6e4', background: '#f8fbfa', display: 'grid', gap: 10 }}>
        <label style={{ fontWeight: 800, color: '#17212f', fontSize: '0.88rem' }}>Have a promo code?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={promoCode}
            onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
            placeholder="WELCOME50"
            style={{ flex: 1, height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px', fontWeight: 800, letterSpacing: '0.04em' }}
          />
          {promoForPlan ? (
            <button className="ghost-btn" onClick={removePromo}>Remove</button>
          ) : (
            <button className="primary-btn" onClick={() => applyPromo(planKeyValue, amountUsd)} disabled={promoLoading || !promoCode.trim()}>
              {promoLoading ? 'Checking…' : 'Apply'}
            </button>
          )}
        </div>
        {promoError && <span style={{ color: '#8a2c21', fontSize: '0.82rem', fontWeight: 700 }}>{promoError}</span>}
        {promoForPlan && (
          <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 10, background: '#e9f6f4', color: '#135f55', fontSize: '0.84rem' }}>
            <strong>{promoForPlan.code} applied — {promoForPlan.message ?? 'Promo code applied successfully.'}</strong>
            <div style={{ display: 'grid', gap: 4, color: '#42585e' }}>
              <span>Original: <strong>{formatUsd(promoForPlan.original_amount_usd)}</strong></span>
              <span>Discount: <strong>-{formatUsd(promoForPlan.discount_amount_usd)}</strong></span>
              <span>Total: <strong>{formatUsd(promoForPlan.final_amount_usd)} / {formatGhs(promoForPlan.final_amount_usd)}</strong></span>
            </div>
          </div>
        )}
      </div>
    );
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
          ? [
              ['my-subscription', 'My Subscription'],
              ['individual-plans', 'Individual Plans'],
              ['institution-plans', 'Institution Plans'],
              ['enterprise', 'Enterprise Licensing'],
              ['payment-methods', 'Payment Methods'],
              ['subscribers', 'Subscribers'],
              ['invoices', 'Invoices'],
              ['promos', 'Promo Codes'],
              ['access-policy', 'Access Policy'],
            ]
          : [
              ['my-subscription', 'My Subscription'],
              ['individual-plans', 'Individual Plans'],
              ['institution-plans', 'Institution Plans'],
              ['payment-methods', 'Payment Methods'],
            ]
        ).map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* My subscription tab */}
      {tab === 'my-subscription' && (
        <div className="billing-overview-grid">
          <div className="billing-current-card">
            <div className="billing-card-kicker">Current Plan</div>
            <h3>{currentPlanLabel || 'Explorer Pass'}</h3>
            <p>{subscription.isActive ? 'Active subscription' : session ? 'Free access active' : 'Sign in to activate your plan'}</p>
            <div className="billing-current-metrics">
              <div><span>Expires</span><strong>{subscription.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : 'No expiry'}</strong></div>
              <div><span>Questions Remaining</span><strong>{questionsRemaining.toLocaleString()}</strong></div>
              <div><span>Study Coach</span><strong>{coachLimitLabel}</strong></div>
              <div><span>Renewal</span><strong>{subscription.isActive ? 'Auto renew ON' : 'Manual upgrade'}</strong></div>
            </div>
            <button className="primary-btn" onClick={() => setTab('individual-plans')}><Sparkles size={15} /> Upgrade or renew</button>
          </div>
          <div className="billing-license-card">
            <div className="billing-card-kicker">Included Access</div>
            <h3>{activePlan?.name || 'Explorer Pass'}</h3>
            <ul>
              {(activePlan?.features ?? []).slice(0, 8).map((feature) => (
                <li key={feature}><CheckCircle2 size={14} /> {feature}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Individual plans tab */}
      {tab === 'individual-plans' && (
        <div className="payment-plans-grid">
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
                <div className="payment-plan-heading">
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
                    style={{ width: '100%', minWidth: 0, justifyContent: 'center', background: color, marginBottom: 8 }}
                    onClick={() => handleCheckout(plan)}
                    disabled={checkingOut === plan.name}
                    aria-label={`Choose ${plan.name} for $${Number(plan.price_usd).toFixed(2)}`}
                  >
                    <Sparkles size={14} /> {checkingOut === plan.name ? 'Starting checkout…' : 'Choose plan'}
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

      {tab === 'individual-plans' && (
        <div className="billing-matrix-card">
          <h3>Plan Comparison</h3>
          <div className="billing-matrix-wrap">
            <table className="billing-matrix">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Explorer</th>
                  <th>30-Day</th>
                  <th>90-Day</th>
                  <th>180-Day</th>
                  <th>365-Day</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => <td key={cell}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'institution-plans' && (
        <div className="billing-section">
          <div className="billing-section-head">
            <div>
              <h3>Institution Plans</h3>
              <p>Seat-based licensing for nursing schools, colleges, hospitals, and training departments.</p>
            </div>
            <Building2 size={24} />
          </div>
          <div className="institution-plan-grid">
            {INSTITUTION_PLANS.map((plan) => (
              <article key={plan.id} className="institution-plan-card" style={{ borderTopColor: plan.color }}>
                <span style={{ color: plan.color }}>{plan.audience}</span>
                <h4>{plan.name}</h4>
                <strong>${plan.price.toLocaleString()} <small>/ {plan.term}</small></strong>
                <p>{plan.seats.toLocaleString()} seats included</p>
                <ul>
                  {plan.features.map((feature) => <li key={feature}><CheckCircle2 size={14} /> {feature}</li>)}
                </ul>
                <button className="ghost-btn" onClick={() => setCustomerNotice({ type: 'info', message: `${plan.name} is handled by invoice. Contact NurseFaculty finance to create the institution quote and seats.` })}>
                  <ReceiptText size={14} /> Request invoice
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'enterprise' && (
        <div className="billing-section">
          <div className="billing-section-head">
            <div>
              <h3>Enterprise Licensing</h3>
              <p>Manage seats, classroom access, certificates, AI usage, and institution billing in one place.</p>
            </div>
            <BriefcaseBusiness size={24} />
          </div>
          <div className="enterprise-grid">
            {ENTERPRISE_LICENSES.map((item) => (
              <div key={item.label} className="enterprise-stat">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="license-workflow">
            {['Buy seats', 'Invite learners', 'Assign licenses', 'Track usage', 'Export reports'].map((step, index) => (
              <div key={step}>
                <strong>{index + 1}</strong>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'payment-methods' && (
        <div className="billing-section">
          <div className="billing-section-head">
            <div>
              <h3>Payment Methods</h3>
              <p>Local Ghana payments, international card payments, and institution invoicing.</p>
            </div>
            <CreditCard size={24} />
          </div>
          <div className="payment-method-grid">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              return (
                <button key={method.title} className="payment-method-card" onClick={() => method.title.includes('Mobile') ? setTab('mobile-money') : setCustomerNotice({ type: 'info', message: `${method.title} is part of the billing roadmap. Mobile Money is available now while gateway configuration is completed.` })}>
                  <Icon size={24} />
                  <strong>{method.title}</strong>
                  <span>{method.details}</span>
                </button>
              );
            })}
          </div>
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
                <strong style={{ display: 'block', color: '#102027', fontSize: '2rem', lineHeight: 1.1 }}>
                  {formatGhs(appliedPromo?.plan_key === planKey(selectedQuote.name) ? appliedPromo.final_amount_usd : selectedQuote.price_usd)}
                </strong>
                <span style={{ display: 'block', color: '#607478', fontSize: '0.78rem', marginTop: 7 }}>
                  {formatUsd(appliedPromo?.plan_key === planKey(selectedQuote.name) ? appliedPromo.final_amount_usd : selectedQuote.price_usd)} USD × {USD_TO_GHS_RATE.toFixed(2)} GHS
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                {renderPromoBox(planKey(selectedQuote.name), Number(selectedQuote.price_usd))}
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
          const matchPlan = subPlanFilter === 'all' || normalizePlanName(s.plan_name) === subPlanFilter;
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
                <option value="basic">30-Day Pass</option>
                <option value="pro">90-Day Success Plan</option>
                <option value="master">180-Day Master Plan</option>
                <option value="faculty">365-Day Faculty Pass</option>
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
                {paidPlans.map((plan) => (
                  <option key={plan.id} value={planKey(plan.name)}>
                    {plan.name} — {formatGhs(plan.price_usd)} / {plan.duration_days} days
                  </option>
                ))}
              </select>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: '#fff', border: '1px solid #e1ebe9', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.86rem', color: '#42585e' }}>
                <span>Original price</span>
                <strong>{formatUsd(mobileMoneyBaseUsd)} / {formatGhs(mobileMoneyBaseUsd)}</strong>
              </div>
              {activePromoForMobileMoney && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.86rem', color: '#135f55' }}>
                  <span>Promo discount ({activePromoForMobileMoney.code})</span>
                  <strong>-{formatUsd(mobileMoneyDiscountUsd)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #e1ebe9', paddingTop: 8 }}>
                <span style={{ fontWeight: 800, color: '#17212f' }}>Total to pay</span>
                <strong style={{ color: '#17212f' }}>{formatUsd(mobileMoneyFinalUsd)} / {formatGhs(mobileMoneyFinalUsd)}</strong>
              </div>
            </div>
            {renderPromoBox(mmPlan, mobileMoneyBaseUsd)}
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
                  <label>Name</label>
                  <input value={newPromo.name} onChange={(e) => setNewPromo((p) => ({ ...p, name: e.target.value }))} placeholder="Welcome Offer" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Discount Type</label>
                  <select value={newPromo.discount_type} onChange={(e) => setNewPromo((p) => ({ ...p, discount_type: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed USD amount</option>
                    <option value="free_trial">Free trial</option>
                    <option value="free_upgrade">Free upgrade</option>
                  </select>
                </div>
                <div className="qm-form-row">
                  <label>{newPromo.discount_type === 'percentage' ? 'Discount %' : newPromo.discount_type === 'fixed_amount' ? 'Discount USD' : 'Benefit Value'}</label>
                  <input type="number" min="0" max={newPromo.discount_type === 'percentage' ? 100 : undefined} value={newPromo.discount_value} onChange={(e) => setNewPromo((p) => ({ ...p, discount_value: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Applies To Plans</label>
                  <select multiple value={newPromo.applies_to_plans} onChange={(e) => setNewPromo((p) => ({ ...p, applies_to_plans: [...e.target.selectedOptions].map((option) => option.value) }))} style={{ minHeight: 92, borderRadius: 8, border: '1px solid #dbe6e4', padding: 8 }}>
                    {paidPlans.map((plan) => <option key={plan.id} value={planKey(plan.name)}>{plan.name}</option>)}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: '#607478' }}>Leave unselected for all paid plans.</span>
                </div>
                <div className="qm-form-row">
                  <label>Valid From</label>
                  <input type="date" value={newPromo.valid_from} onChange={(e) => setNewPromo((p) => ({ ...p, valid_from: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Max Uses (blank = unlimited)</label>
                  <input type="number" min="1" value={newPromo.max_uses} onChange={(e) => setNewPromo((p) => ({ ...p, max_uses: e.target.value }))} placeholder="Unlimited" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Max Per User</label>
                  <input type="number" min="1" value={newPromo.max_per_user} onChange={(e) => setNewPromo((p) => ({ ...p, max_per_user: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Expiry Date (blank = never)</label>
                  <input type="date" value={newPromo.expires_at} onChange={(e) => setNewPromo((p) => ({ ...p, expires_at: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
                <div className="qm-form-row">
                  <label>Eligibility</label>
                  <select value={newPromo.eligibility} onChange={(e) => setNewPromo((p) => ({ ...p, eligibility: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }}>
                    <option value="all">All users</option>
                    <option value="new_users">New subscribers only</option>
                    <option value="existing_users">Existing subscribers only</option>
                  </select>
                </div>
                <div className="qm-form-row">
                  <label>Minimum Purchase USD</label>
                  <input type="number" min="0" value={newPromo.minimum_purchase_usd} onChange={(e) => setNewPromo((p) => ({ ...p, minimum_purchase_usd: e.target.value }))} placeholder="Optional" style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                </div>
              </div>
              <div className="qm-form-row" style={{ marginTop: 12 }}>
                <label>Description</label>
                <textarea value={newPromo.description} onChange={(e) => setNewPromo((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Internal campaign notes, e.g. August nursing cohort welcome offer." />
              </div>
              <div className="editor-footer">
                <button className="ghost-btn" onClick={() => setShowPromoForm(false)}>Cancel</button>
                <button className="primary-btn" onClick={savePromo} disabled={!newPromo.code || !newPromo.discount_value}>Save Promo</button>
              </div>
            </div>
          )}

          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Discount</th>
                <th>Plans</th>
                <th>Usage</th>
                <th>Applied</th>
                <th>Revenue</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td><code style={{ background: '#e9f1ef', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{p.code}</code></td>
                  <td>{p.name ?? p.code}</td>
                  <td><strong>{(p.discount_type ?? 'percentage') === 'percentage' ? `${p.discount_value ?? p.discount_pct}% off` : (p.discount_type === 'fixed_amount' ? `${formatUsd(p.discount_value ?? p.discount_amount)} off` : p.discount_type?.replace('_', ' '))}</strong></td>
                  <td style={{ fontSize: '0.82rem', color: '#607478' }}>
                    {Array.isArray(p.applies_to_plans) && p.applies_to_plans.length ? p.applies_to_plans.join(', ') : 'All paid plans'}
                  </td>
                  <td>{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                  <td>{Number(p.applied_count ?? 0).toLocaleString()}</td>
                  <td>{formatUsd(p.revenue_generated_usd ?? 0)}</td>
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
