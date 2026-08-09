import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://nursefaculty.org')
  .split(',').map((value) => value.trim()).filter(Boolean);

const MODES = new Set(['tutor', 'explainer', 'quiz', 'planner']);
const SYSTEM_PROMPTS: Record<string, string> = {
  tutor: 'You are the NurseFaculty Study Coach, an expert NCLEX nursing coach. Give clinically safe educational guidance. When relevant use: Concept, Correct Answer, Why Wrong Options Are Wrong, Clinical Tip. Emphasize ABCs, safety, infection control, ADPIE, and clinical judgment. State that educational guidance does not replace clinical protocols or professional judgment.',
  explainer: 'You are an NCLEX rationale explainer. Identify the correct answer when the supplied information permits it, explain why it is correct, explain each distractor, teach the underlying concept, and finish with a clinical tip. Do not invent missing choices.',
  quiz: 'You generate original NCLEX-style practice questions for education. Include a short scenario, question, 4-6 choices, the correct answer, and a detailed rationale. Do not reproduce proprietary examination items.',
  planner: 'You are an NCLEX study planner. Create a realistic week-by-week plan using the learner exam date, weak topics, and available study time. Include review and recovery days.',
};

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function clientMessage(status: number) {
  if (status === 429) return 'Study Coach has reached its temporary usage limit. Please try again later.';
  if (status === 401 || status === 403) return 'Study Coach authorization failed. Please contact support.';
  return 'Study Coach is temporarily unavailable. Please try again shortly.';
}

function providerStatus(status: number) {
  if (status === 429) return 429;
  if (status === 401 || status === 403) return 503;
  if (status >= 400 && status < 500) return 502;
  return 503;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' });

  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json(req, 403, { error: 'Origin not allowed' });

  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return json(req, 401, { error: 'Please sign in to use Study Coach.' });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Study Coach Supabase environment is incomplete');
    return json(req, 503, { error: 'Study Coach is temporarily unavailable.' });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(req, 401, { error: 'Your session has expired. Please sign in again.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'Invalid request body.' });
  }

  const mode = typeof body.mode === 'string' ? body.mode : 'tutor';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const context = typeof body.context === 'string' ? body.context.trim() : '';
  const history = Array.isArray(body.history) ? body.history : [];
  if (!MODES.has(mode)) return json(req, 400, { error: 'Invalid Study Coach mode.' });
  if (!message || message.length > 8000) return json(req, 400, { error: 'Enter a message between 1 and 8,000 characters.' });
  if (context.length > 4000 || history.length > 10) return json(req, 400, { error: 'Study Coach context is too large.' });

  const normalizedHistory = history.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (!['user', 'assistant'].includes(String(role)) || typeof content !== 'string' || content.length > 8000) return [];
    return [{ role: String(role), content }];
  });

  const { error: quotaError } = await userClient.rpc('consume_study_coach_question');
  if (quotaError) {
    const limitReached = /limit reached/i.test(quotaError.message ?? '');
    console.warn('Study Coach quota rejected', { userId: authData.user.id, code: quotaError.code });
    return json(req, limitReached ? 429 : 403, {
      error: limitReached ? 'Your daily Study Coach allowance has been used.' : 'Your plan does not permit this request.',
    });
  }

  if (!OPENAI_KEY) {
    console.error('Study Coach OPENAI_API_KEY is not configured');
    return json(req, 503, { error: 'Study Coach is temporarily unavailable.' });
  }

  const instructions = context ? `${SYSTEM_PROMPTS[mode]}\n\nLearner context:\n${context}` : SYSTEM_PROMPTS[mode];
  const input = [...normalizedHistory, { role: 'user', content: message }];

  try {
    const providerResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions,
        input,
        max_output_tokens: 1800,
        reasoning: { effort: 'low' },
      }),
    });
    const providerBody = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok) {
      console.error('OpenAI Responses API failure', {
        status: providerResponse.status,
        code: providerBody?.error?.code ?? providerBody?.error?.type,
        requestId: providerResponse.headers.get('x-request-id'),
      });
      const status = providerStatus(providerResponse.status);
      return json(req, status, { error: clientMessage(providerResponse.status) });
    }

    const reply = String(providerBody?.output_text ?? providerBody?.output
      ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
      .map((item: { text?: string }) => item.text ?? '').filter(Boolean).join('\n') ?? '').trim();
    if (!reply) {
      console.error('OpenAI Responses API returned no text', { requestId: providerResponse.headers.get('x-request-id') });
      return json(req, 502, { error: 'Study Coach returned an incomplete response. Please try again.' });
    }
    return json(req, 200, { reply });
  } catch (error) {
    console.error('Study Coach provider request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    });
    return json(req, 503, { error: 'Study Coach is temporarily unavailable. Please try again shortly.' });
  }
});
