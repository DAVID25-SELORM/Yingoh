import React, { useEffect, useState } from 'react';
import { CheckCircle2, DollarSign, Tag, FileText, PlusCircle, Sparkles, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useSubscription, createCheckoutSession } from '../hooks/useSubscription';

const DEMO_PLANS = [
  { id: 'free', name: 'Free', price_usd: 0, duration_days: 36500, features: ['20 sample questions', 'Basic dashboard', 'Limited flashcards'], is_active: true, sort_order: 1 },
  { id: 'basic', name: 'Basic', price_usd: 19.99, duration_days: 30, features: ['Full question bank (500+ questions)', 'Practice & timed exam modes', 'Flashcard decks', 'Study planner', 'Digital notebook', 'Email support'], is_active: true, sort_order: 2 },
  { id: 'pro', name: 'Pro', price_usd: 39.99, duration_days: 30, features: ['Everything in Basic', 'CAT simulator', 'Advanced analytics', 'Pass probability tracking', 'Live coaching sessions', 'Priority support'], is_active: true, sort_order: 3 },
  { id: 'premium', name: 'Premium', price_usd: 59.99, duration_days: 30, features: ['Everything in Pro', 'Unlimited live coaching', '1-on-1 instructor sessions', 'USRN career track', 'Resume builder', 'Job board access', 'WhatsApp support'], is_active: true, sort_order: 4 },
];

const DEMO_INVOICES = [
  { id: 'inv1', user_email: 'nurse@example.com', plan_name: 'Pro', amount_usd: 39.99, status: 'paid', payment_method: 'stripe', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'inv2', user_email: 'student2@test.com', plan_name: 'Basic', amount_usd: 19.99, status: 'paid', payment_method: 'mobile_money', created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'inv3', user_email: 'rn2025@health.com', plan_name: 'Premium', amount_usd: 59.99, status: 'pending', payment_method: 'paypal', created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'inv4', user_email: 'nclex.prep@gmail.com', plan_name: 'Basic', amount_usd: 14.99, status: 'paid', payment_method: 'stripe', created_at: new Date(Date.now() - 86400000 * 8).toISOString() },
];

const DEMO_PROMOS = [
  { id: 'p1', code: 'NCLEX25', discount_pct: 25, max_uses: 100, used_count: 34, expires_at: new Date(Date.now() + 86400000 * 60).toISOString(), is_active: true },
  { id: 'p2', code: 'NEWSTUDENT', discount_pct: 50, max_uses: 200, used_count: 87, expires_at: new Date(Date.now() + 86400000 * 15).toISOString(), is_active: true },
  { id: 'p3', code: 'YINGOH10', discount_pct: 10, max_uses: null, used_count: 12, expires_at: null, is_active: true },
];

const PLAN_COLORS = { Free: '#8a999c', Basic: '#2b8a7d', Pro: '#e3a72f', Premium: '#c17f44' };

export default function PaymentsView({ session }) {
  const { plan: currentPlan, loading: subLoading } = useSubscription(session);
  const [checkingOut, setCheckingOut] = useState('');
  const [tab, setTab] = useState('plans');

  async function handleCheckout(planName) {
    if (!session) { alert('Sign in to subscribe.'); return; }
    setCheckingOut(planName);
    const { url, error } = await createCheckoutSession(planName.toLowerCase(), session);
    if (error || !url) {
      alert(error?.message ?? 'Stripe not configured. Add STRIPE_SECRET_KEY and price IDs to your Supabase Edge Function secrets.');
      setCheckingOut('');
      return;
    }
    window.location.href = url;
  }
  const [plans, setPlans] = useState(DEMO_PLANS);
  const [invoices, setInvoices] = useState(DEMO_INVOICES);
  const [promos, setPromos] = useState(DEMO_PROMOS);
  const [newPromo, setNewPromo] = useState({ code: '', discount_pct: 10, max_uses: '', expires_at: '' });
  const [showPromoForm, setShowPromoForm] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('payment_plans').select('*').order('sort_order').then(({ data }) => { if (data?.length) setPlans(data); });
    supabase.from('invoices').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data?.length) setInvoices(data); });
    supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data?.length) setPromos(data); });
  }, []);

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

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>Payments &amp; Subscriptions</h2>
      </div>

      {/* Revenue stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: '#29b7a3' },
          { label: 'Pending', value: `$${pendingRevenue.toFixed(2)}`, icon: DollarSign, color: '#e3a72f' },
          { label: 'Paid Invoices', value: invoices.filter((i) => i.status === 'paid').length, icon: FileText, color: '#2b8a7d' },
          { label: 'Active Promos', value: promos.filter((p) => p.is_active).length, icon: Tag, color: '#c17f44' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}`, textAlign: 'center' }}>
            <s.icon size={20} color={s.color} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.82rem', color: '#607478' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {[['plans', 'Plans'], ['invoices', 'Invoices'], ['promos', 'Promo Codes']].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Plans tab */}
      {tab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {plans.map((plan) => {
            const color = PLAN_COLORS[plan.name] ?? '#607478';
            const features = Array.isArray(plan.features) ? plan.features : (typeof plan.features === 'string' ? JSON.parse(plan.features) : []);
            return (
              <div key={plan.id} className="payment-plan-card" style={{ borderTop: `4px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color }}>{plan.name}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#17212f', lineHeight: 1.1 }}>
                      {plan.price_usd === 0 ? 'Free' : `$${Number(plan.price_usd).toFixed(2)}`}
                      {plan.price_usd > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#607478' }}>/mo</span>}
                    </div>
                    {!subLoading && currentPlan === plan.name.toLowerCase() && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', background: '#e2f5f2', color: '#135f55', borderRadius: 12 }}>Current Plan</span>
                    )}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 700, background: plan.is_active ? '#e2f5f2' : '#f2e2e1', color: plan.is_active ? '#135f55' : '#8a2c21' }}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
                {plan.price_usd > 0 && currentPlan !== plan.name.toLowerCase() && (
                  <button
                    className="primary-btn"
                    style={{ width: '100%', justifyContent: 'center', background: color, marginBottom: 8 }}
                    onClick={() => handleCheckout(plan.name)}
                    disabled={checkingOut === plan.name}
                  >
                    <Sparkles size={14} /> {checkingOut === plan.name ? 'Redirecting…' : `Subscribe — $${Number(plan.price_usd).toFixed(2)}/mo`}
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

      {/* Invoices tab */}
      {tab === 'invoices' && (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Promo codes tab */}
      {tab === 'promos' && (
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
