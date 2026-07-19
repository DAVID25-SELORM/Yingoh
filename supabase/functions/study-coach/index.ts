const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini';
const FALLBACK_MODEL = Deno.env.get('OPENAI_FALLBACK_MODEL') ?? 'gpt-4o-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor: `You are the NurseFaculty Study Coach, an expert NCLEX nursing coach. Help nursing students prepare for the Next Generation NCLEX (NGN). Every answer should be guided, exam-oriented, and clinically safe. Use this structure when relevant: Concept, Correct Answer, Why Wrong Options Are Wrong, Clinical Tip. If the student did not provide answer options, explain the concept, ask one clarifying question if needed, and give a short clinical tip. Emphasize nursing priorities, ABCs, safety, infection control, pharmacology precautions, ADPIE, and the clinical judgment model. Use plain text.`,

  explainer: `You are an expert NCLEX rationale explainer. When given a question and answer choices, identify the likely correct answer if possible, explain why it is correct, explain why each wrong option is wrong, explain the underlying concept, and end with one short clinical tip. Keep it clear, safe, and NCLEX-focused. Use plain text.`,

  quiz: `You are an NCLEX question generator. Create realistic Next Generation NCLEX (NGN) style questions based on the requested topic. Format: write a brief clinical scenario, then the question, then 4-6 answer options labeled A-F, then state the correct answer(s) with a full rationale. For SATA questions, list all correct answers. Keep the difficulty at or above NCLEX passing standard. Output plain text only.`,

  planner: `You are an expert NCLEX study planner. Create detailed, realistic study schedules for nursing students preparing for the NCLEX. Ask about or use the provided exam date, current weak topics, and available study hours per day. Output a week-by-week plan with daily focus topics, recommended resources, and built-in review days. Be specific and actionable. Use plain text.`,
};

function isGpt5Model(model: string) {
  return model.toLowerCase().startsWith('gpt-5');
}

function normalizeModel(model: string) {
  const requested = String(model || '').trim();
  // Older project configs used "gpt-5-mini". Current OpenAI guidance uses
  // the GPT-5.6 family names; luna is the low-latency / lower-cost lane.
  if (requested === 'gpt-5-mini') return 'gpt-5.6-luna';
  return requested || FALLBACK_MODEL;
}

function fallbackReply(message: string, detail = '') {
  return `Concept:
I can still help you study, but the live OpenAI Study Coach is temporarily unavailable.

What to do now:
Use ABCs, safety, Maslow, nursing process, and expected vs. unexpected findings. If this is a priority question, choose the action that prevents the most immediate harm.

Clinical Tip:
On NCLEX, urgent physiologic safety comes before teaching, documentation, routine comfort, or delayed provider notification.

Your question:
${message}
${detail ? `\nTechnical note for admin: ${detail}` : ''}`;
}

async function callOpenAI({
  model,
  messages,
  mode,
}: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  mode: string;
}) {
  const selectedModel = normalizeModel(model);

  if (isGpt5Model(selectedModel)) {
    const [system, ...conversation] = messages;
    const input = conversation.map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    }));

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        instructions: system?.content ?? SYSTEM_PROMPTS.tutor,
        input,
        max_output_tokens: 1800,
        reasoning: { effort: 'low' },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`OpenAI API error ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
    }

    const outputText = data.output_text
      ?? data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
        .map((content: { text?: string }) => content.text)
        .filter(Boolean)
        .join('\n')
      ?? '';

    return outputText.trim() || 'No response from the Study Coach.';
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      max_tokens: 1800,
      temperature: mode === 'quiz' ? 0.7 : 0.35,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  }

  return data.choices?.[0]?.message?.content?.trim() ?? 'No response from the Study Coach.';
}

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

    if (!OPENAI_KEY) {
      return new Response(JSON.stringify({
        reply: fallbackReply(message, 'OPENAI_API_KEY is not configured.'),
        warning: 'OPENAI_API_KEY not configured',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.tutor;
    const fullSystem = context
      ? `${systemPrompt}\n\nContext provided by student: ${context}`
      : systemPrompt;

    const messages = [
      { role: 'system', content: fullSystem },
      ...history
        .slice(-10)
        .filter((item: { role?: string; content?: string }) => ['user', 'assistant'].includes(item?.role ?? '') && typeof item?.content === 'string')
        .map((item: { role: string; content: string }) => ({ role: item.role, content: item.content })),
      { role: 'user', content: message },
    ];

    let reply = '';
    let warning = '';
    try {
      reply = await callOpenAI({ model: OPENAI_MODEL, messages, mode });
    } catch (openaiErr) {
      const detail = openaiErr instanceof Error ? openaiErr.message : String(openaiErr);
      warning = detail;

      try {
        reply = await callOpenAI({ model: FALLBACK_MODEL, messages, mode });
      } catch (_) {
        reply = fallbackReply(message, detail);
      }
    }

    return new Response(JSON.stringify({ reply, warning }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ reply: fallbackReply('your Study Coach request', detail), warning: detail }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
