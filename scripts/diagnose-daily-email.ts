import { createSmtpSender } from "../supabase/functions/daily-question-email/smtp.ts";
import { diagnosticRecipient } from "../supabase/functions/daily-question-email/config.js";
import {
  classifySmtpFailure,
  escapeHtml,
} from "../supabase/functions/daily-question-email/worker.js";

// No Supabase client, user query, assignment, or retry loop. One explicit mailbox only.
let attempted = 0;
try {
  const to = diagnosticRecipient(Deno.args);
  const env = (key: string) => Deno.env.get(key) ?? "";
  const app = new URL(env("APP_URL") || "https://nursefaculty.org");
  if (app.protocol !== "https:" || app.username || app.password) {
    throw new Error("Invalid APP_URL");
  }
  const link = `${app.origin}/#/Account`;
  const send = createSmtpSender(env);
  attempted = 1;
  await send({
    to,
    subject: "NurseFaculty — controlled email diagnostic",
    content:
      `This is one explicitly requested test email. No learner campaign was run.\nNotification settings: ${link}\nCheck Authentication-Results headers and inbox/spam placement.`,
    html:
      `<div style="font-family:Arial;max-width:600px;margin:auto;padding:24px"><h1>NurseFaculty</h1><p>This is one explicitly requested test email. No learner campaign was run.</p><p><a href="${
        escapeHtml(link)
      }">Notification settings</a></p><p>Please check Authentication-Results headers and inbox/spam placement.</p></div>`,
  });
  console.log(
    JSON.stringify({
      event: "controlled_email_diagnostic",
      outcome: "smtp_accepted",
      attempted: 1,
    }),
  );
} catch (error) {
  // Never print raw provider errors, input addresses, environment values or credentials.
  console.error(JSON.stringify({
    event: "controlled_email_diagnostic",
    attempted,
    outcome: attempted
      ? classifySmtpFailure(error)
      : "configuration_or_arguments_invalid",
    detail:
      "Check required configuration and explicit --to <mailbox> --send-one arguments. No automatic retry.",
  }));
  Deno.exitCode = 1;
}
