import { classifySmtpFailure } from "../daily-question-email/worker.js";

// Fixed approved recipient; no request-controlled recipient or retry path.
export function diagnosticHandler({ env, database, sender }) {
  const reply = (status, body) => Response.json(body, { status });
  return async (request) => {
    if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
    if (!env("CRON_SECRET") || request.headers.get("x-cron-secret") !== env("CRON_SECRET")) {
      return reply(401, { error: "Unauthorized" });
    }
    let attempted = false;
    try {
      const send = sender(); // Validate configuration before consuming the one-shot claim.
      const db = database();
      const claim = await db.rpc("claim_daily_email_diagnostic");
      if (claim.error) return reply(503, { error: "Diagnostic unavailable" });
      if (claim.data !== true) return reply(409, { attempted: 0, reason: "already_claimed_or_not_paused" });
      let outcome = "smtp_accepted";
      attempted = true;
      try {
        await send({
          to: "cryxtalcfc@gmail.com",
          subject: "NurseFaculty — controlled email diagnostic",
          content: "This is the single approved production-readiness SMTP test. The Daily NCLEX Email System remains paused. No learner campaign was run. Settings: https://nursefaculty.org/#/Account",
          html: '<h1>NurseFaculty</h1><p>This is the single approved production-readiness SMTP test.</p><p>The Daily NCLEX Email System remains paused. No learner campaign was run.</p><a href="https://nursefaculty.org/#/Account">Notification settings</a>',
        });
      } catch (error) {
        outcome = classifySmtpFailure(error);
      }
      const saved = await db.from("daily_email_diagnostic_runs").update({
        outcome, finished_at: new Date().toISOString(),
      }).eq("id", "production-readiness-20260919");
      return reply(saved.error ? 500 : 200, { attempted: 1, outcome, recorded: !saved.error });
    } catch {
      return reply(503, { attempted: attempted ? 1 : 0, outcome: attempted ? "delivery_outcome_unknown" : "configuration_or_database_failure" });
    }
  };
}
