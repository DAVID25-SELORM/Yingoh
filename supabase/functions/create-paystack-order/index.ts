import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Paystack amounts are in pesewas (GHS) or kobo (NGN) — multiply USD by exchange rate
const USD_TO_GHS = 15; // approximate; update as needed

const PLAN_AMOUNTS_GHS: Record<string, number> = {
  basic:   Math.round(9.99 * USD_TO_GHS * 100), // in pesewas
  pro:     Math.round(19.99 * USD_TO_GHS * 100),
  premium: Math.round(29.99 * USD_TO_GHS * 100),
};

const PLAN_NAMES: Record<string, string> = {
  basic: 'Starter Plan',
  pro: 'Pro Plan',
  premium: 'Premium Plan',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { planId, channel, phone, callbackUrl } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }

    if (!PAYSTACK_SECRET) {
      return new Response(JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not configured' }), {
        status: 500, headers: corsHeaders,
      });
    }

    const amountPesewas = PLAN_AMOUNTS_GHS[planId];
    if (!amountPesewas) {
      return new Response(JSON.stringify({ error: `Unknown plan: ${planId}` }), { status: 400, headers: corsHeaders });
    }

    const body: Record<string, unknown> = {
      email: user.email,
      amount: amountPesewas,
      currency: 'GHS',
      reference: `nursefaculty-${planId}-${user.id.slice(0, 8)}-${Date.now()}`,
      metadata: {
        supabase_user_id: user.id,
        plan_id: planId,
        plan_name: PLAN_NAMES[planId],
      },
      callback_url: callbackUrl ?? 'https://nursefaculty.org/payment-success',
    };

    // Mobile Money channels: mtn, vodafone, tigo
    if (channel && phone) {
      body.mobile_money = { phone, provider: channel };
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await paystackRes.json();
    if (!result.status) {
      throw new Error(result.message ?? 'Paystack initialization failed');
    }

    return new Response(JSON.stringify({
      url: result.data.authorization_url,
      reference: result.data.reference,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
