const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor: `You are Yingoh, an expert NCLEX nursing tutor. Help nursing students prepare for the Next Generation NCLEX (NGN) exam. You specialize in clinical judgment, pharmacology, medical-surgical nursing, mental health, maternal-newborn, and pediatrics. Give clear, concise answers. When relevant, explain the nursing process (ADPIE) and clinical judgment model (recognize cues, analyze, prioritize, generate solutions, take action, evaluate). Keep responses focused and exam-oriented. Use plain text — no markdown headers or bullet symbols.`,

  explainer: `You are an expert NCLEX rationale explainer. When given a question and answer choice, provide a deep, educational rationale. Explain WHY the correct answer is right, WHY distractors are wrong, the underlying pathophysiology or pharmacology, and what a nurse should prioritize. End with the key nursing takeaway. Be thorough but clear. Use plain text.`,

  quiz: `You are an NCLEX question generator. Create realistic Next Generation NCLEX (NGN) style questions based on the requested topic. Format: write a brief clinical scenario, then the question, then 4-6 answer options labeled A-F, then state the correct answer(s) with a full rationale. For SATA questions, list all correct answers. Keep the difficulty at or above NCLEX passing standard. Output plain text only.`,

  planner: `You are an expert NCLEX study planner. Create detailed, realistic study schedules for nursing students preparing for the NCLEX. Ask about or use the provided exam date, current weak topics, and available study hours per day. Output a week-by-week plan with daily focus topics, recommended resources (Uworld, Hurst, textbooks), and built-in review days. Be specific and actionable. Use plain text.`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mode = 'tutor', message, history = [], context } = await req.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.tutor;
    const fullSystem = context
      ? `${systemPrompt}\n\nContext provided by student: ${context}`
      : systemPrompt;

    const messages = [
      ...history.slice(-10),
      { role: 'user', content: message },
    ];

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        system: fullSystem,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${err}`);
    }

    const data = await anthropicRes.json();
    const reply = data.content?.[0]?.text ?? 'No response from AI.';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
