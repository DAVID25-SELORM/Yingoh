import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' });
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const PLAN_PRICE_MAP: Record<string, string> = {
  thirty_day: Deno.env.get('STRIPE_PRICE_30_DAY') ?? '',
  ninety_day: Deno.env.get('STRIPE_PRICE_90_DAY') ?? '',
  master_180: Deno.env.get('STRIPE_PRICE_180_DAY') ?? '',
  faculty_365: Deno.env.get('STRIPE_PRICE_365_DAY') ?? '',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { planId, successUrl, cancelUrl } = await req.json();

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });

    const priceId = PLAN_PRICE_MAP[planId];
    if (!priceId) return new Response(JSON.stringify({ error: `No Stripe price configured for plan: ${planId}` }), { status: 400, headers: corsHeaders });

    // Get or create Stripe customer
    const { data: profile } = await supabase.from('profiles').select('stripe_customer_id, email, full_name').eq('id', user.id).single();
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? `${req.headers.get('origin')}/`,
      cancel_url: cancelUrl ?? `${req.headers.get('origin')}/`,
      metadata: { supabase_user_id: user.id, plan_id: planId },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan_id: planId },
      },
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
