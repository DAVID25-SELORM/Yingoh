import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nursefaculty.org';

const smtpHost = Deno.env.get('SMTP_HOST') ?? '';
const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '587');
const smtpUser = Deno.env.get('SMTP_USER') ?? '';
const smtpPass = Deno.env.get('SMTP_PASS') ?? '';
const smtpFrom = Deno.env.get('SMTP_FROM') ?? smtpUser;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emailHtml(topic: string, promptPreview: string, ctaUrl: string) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; color: #17212f;">
      <h2 style="color:#135f55;">Your NCLEX Question of the Day is ready</h2>
      <p style="color:#607478; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">${escapeHtml(topic ?? 'NCLEX Practice')}</p>
      <p style="line-height:1.6;">${escapeHtml(promptPreview)}</p>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(ctaUrl)}" style="background:#29b7a3; color:#fff; padding:12px 22px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block;">
          Solve Today's Question
        </a>
      </p>
      <p style="color:#8a999c; font-size:0.78rem;">You're receiving this because you have an active NurseFaculty subscription.</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const providedSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || providedSecret !== cronSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  if (!supabaseUrl || !supabaseServiceKey || !smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return jsonResponse({ error: 'Daily question email service is not fully configured' }, 503);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: dailyQuestion, error: dqError } = await supabase.rpc('get_or_create_daily_question');
    if (dqError || !dailyQuestion) {
      return jsonResponse({ error: dqError?.message ?? 'Could not resolve daily question' }, 500);
    }

    const { data: question, error: qError } = await supabase
      .from('questions')
      .select('prompt, topic')
      .eq('id', dailyQuestion.question_id)
      .single();
    if (qError || !question) {
      return jsonResponse({ error: qError?.message ?? 'Could not load question content' }, 500);
    }

    const { data: recipients, error: recipientsError } = await supabase.rpc('list_daily_question_recipients');
    if (recipientsError) {
      return jsonResponse({ error: recipientsError.message }, 500);
    }

    const ctaUrl = `${appUrl}/#/Question%20of%20the%20Day`;
    const promptPreview = question.prompt.length > 220 ? `${question.prompt.slice(0, 220)}…` : question.prompt;
    const html = emailHtml(question.topic, promptPreview, ctaUrl);

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients ?? []) {
      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: smtpPort,
          tls: false,
          auth: { username: smtpUser, password: smtpPass },
        },
      });
      try {
        await client.send({
          from: smtpFrom,
          to: recipient.email,
          subject: "Today's NCLEX Question is ready",
          content: 'auto',
          html,
        });
        await client.close();
        await supabase.from('daily_question_emails_sent').insert({
          user_id: recipient.user_id,
          date: dailyQuestion.date,
        });
        sent += 1;
      } catch (sendError) {
        failed += 1;
        console.error(`Failed to email ${recipient.user_id}:`, sendError);
        try { await client.close(); } catch { /* connection already closed */ }
      }
    }

    return jsonResponse({ sent, failed, total: sent + failed });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
