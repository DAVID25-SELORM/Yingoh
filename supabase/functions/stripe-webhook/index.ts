import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' });
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  async function upsertSubscription(sub: Stripe.Subscription) {
    const userId = sub.metadata?.supabase_user_id;
    const planId = sub.metadata?.plan_id;
    if (!userId) return;

    // Map Stripe plan to NurseFaculty plan
    const planNames: Record<string, string> = {
      thirty_day: '30-Day Pass',
      ninety_day: '90-Day Success Plan',
      master_180: '180-Day Master Plan',
      faculty_365: '365-Day Faculty Pass',
    };
    const lookupName = planNames[planId ?? ''] ?? planId;
    const { data: plan } = await supabase.from('payment_plans').select('name').ilike('name', lookupName ?? '').maybeSingle();
    const payload = {
      user_id: userId,
      plan_name: plan?.name ?? lookupName ?? 'Free',
      provider: 'stripe',
      provider_reference: sub.id,
      status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('provider', 'stripe')
      .eq('provider_reference', sub.id)
      .maybeSingle();
    if (existing?.id) {
      await supabase.from('subscriptions').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('subscriptions').insert(payload);
    }
  }

  async function recordInvoice(inv: Stripe.Invoice) {
    const userId = inv.subscription_details?.metadata?.supabase_user_id ?? inv.metadata?.supabase_user_id;
    if (!userId || inv.billing_reason === 'subscription_create') return; // skip initial — upsertSubscription handles that

    await supabase.from('invoices').insert({
      user_id: userId,
      amount_usd: (inv.amount_paid ?? 0) / 100,
      status: inv.paid ? 'paid' : 'pending',
      payment_method: 'stripe',
      payment_reference: inv.id,
      paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
    });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('provider', 'stripe').eq('provider_reference', sub.id);
      break;
    }
    case 'invoice.payment_succeeded':
      await recordInvoice(event.data.object as Stripe.Invoice);
      break;
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const userId = inv.metadata?.supabase_user_id;
      if (userId) await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
