import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Paystack amounts are in pesewas (GHS) or kobo (NGN) — multiply USD by exchange rate
const USD_TO_GHS = 11.34; // indicative rate; update when the gateway is configured

const PLAN_AMOUNTS_GHS: Record<string, number> = {
  thirty_day: Math.round(19 * USD_TO_GHS * 100),
  ninety_day: Math.round(49 * USD_TO_GHS * 100),
  master_180: Math.round(79 * USD_TO_GHS * 100),
  faculty_365: Math.round(129 * USD_TO_GHS * 100),
};

const PLAN_AMOUNTS_USD: Record<string, number> = {
  thirty_day: 19,
  ninety_day: 49,
  master_180: 79,
  faculty_365: 129,
};

const PLAN_NAMES: Record<string, string> = {
  thirty_day: '30-Day Pass',
  ninety_day: '90-Day Success Plan',
  master_180: '180-Day Master Plan',
  faculty_365: '365-Day Faculty Pass',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { planId, channel, phone, callbackUrl, promoCode } = await req.json();

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

    const baseAmountUsd = PLAN_AMOUNTS_USD[planId];
    if (!baseAmountUsd) {
      return new Response(JSON.stringify({ error: `Unknown plan: ${planId}` }), { status: 400, headers: corsHeaders });
    }
    let finalAmountUsd = baseAmountUsd;
    let promoResult: Record<string, unknown> | null = null;

    if (promoCode) {
      const { data: validation, error: promoError } = await supabase.rpc('validate_promo_code', {
        p_code: promoCode,
        p_plan_key: planId,
        p_amount_usd: baseAmountUsd,
        p_user_id: user.id,
      });
      if (promoError) throw promoError;
      if (!validation?.valid) {
        return new Response(JSON.stringify({ error: validation?.reason ?? 'Promo code is not valid.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      promoResult = validation;
      finalAmountUsd = Number(validation.final_amount_usd ?? baseAmountUsd);
    }

    const amountPesewas = Math.max(100, Math.round(finalAmountUsd * USD_TO_GHS * 100));
    const reference = `nursefaculty-${planId}-${user.id.slice(0, 8)}-${Date.now()}`;

    if (promoResult?.promo_id) {
      await supabase.from('promo_redemptions').insert({
        promo_id: promoResult.promo_id,
        user_id: user.id,
        plan_key: planId,
        plan_name: PLAN_NAMES[planId],
        original_amount_usd: baseAmountUsd,
        discount_amount_usd: Number(promoResult.discount_amount_usd ?? 0),
        final_amount_usd: finalAmountUsd,
        status: 'applied',
        provider: 'paystack',
        provider_reference: reference,
        metadata: { channel, phone_last4: String(phone ?? '').slice(-4) },
      });
    }

    const body: Record<string, unknown> = {
      email: user.email,
      amount: amountPesewas,
      currency: 'GHS',
      reference,
      metadata: {
        supabase_user_id: user.id,
        plan_id: planId,
        plan_name: PLAN_NAMES[planId],
        promo_code: promoResult?.code ?? null,
        promo_id: promoResult?.promo_id ?? null,
        original_amount_usd: baseAmountUsd,
        discount_amount_usd: promoResult?.discount_amount_usd ?? 0,
        final_amount_usd: finalAmountUsd,
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
