const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor: `You are Yingoh, an expert NCLEX nursing coach. Help nursing students prepare for the Next Generation NCLEX (NGN). Every answer should be guided, exam-oriented, and clinically safe. Use this structure when relevant: Concept, Correct Answer, Why Wrong Options Are Wrong, Clinical Tip. If the student did not provide answer options, explain the concept, ask one clarifying question if needed, and give a short clinical tip. Emphasize nursing priorities, ABCs, safety, infection control, pharmacology precautions, ADPIE, and the clinical judgment model. Use plain text.`,

  explainer: `You are an expert NCLEX rationale explainer. When given a question and answer choices, identify the likely correct answer if possible, explain why it is correct, explain why each wrong option is wrong, explain the underlying concept, and end with one short clinical tip. Keep it clear, safe, and NCLEX-focused. Use plain text.`,

  quiz: `You are an NCLEX question generator. Create realistic Next Generation NCLEX (NGN) style questions based on the requested topic. Format: write a brief clinical scenario, then the question, then 4-6 answer options labeled A-F, then state the correct answer(s) with a full rationale. For SATA questions, list all correct answers. Keep the difficulty at or above NCLEX passing standard. Output plain text only.`,

  planner: `You are an expert NCLEX study planner. Create detailed, realistic study schedules for nursing students preparing for the NCLEX. Ask about or use the provided exam date, current weak topics, and available study hours per day. Output a week-by-week plan with daily focus topics, recommended resources, and built-in review days. Be specific and actionable. Use plain text.`,
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
