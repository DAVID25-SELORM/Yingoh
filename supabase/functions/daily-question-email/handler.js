import { runDailyEmails } from "./worker.js";

const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export function dailyEmailHandler(
  {
    env,
    database,
    sender,
    run = runDailyEmails,
    log = (entry) => console.log(JSON.stringify(entry)),
  },
) {
  return async (req) => {
    if (req.method !== "POST") {
      return reply(405, { error: "Method not allowed" });
    }
    if (
      !env("CRON_SECRET") ||
      req.headers.get("x-cron-secret") !== env("CRON_SECRET")
    ) return reply(401, { error: "Unauthorized" });
    if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) {
      return reply(503, { error: "Service configuration incomplete" });
    }
    try {
      const appUrl = env("APP_URL") || "https://nursefaculty.org";
      const app = new URL(appUrl);
      if (app.protocol !== "https:" || app.username || app.password) {
        return reply(503, { error: "Invalid application URL configuration" });
      }
      const db = database();
      const { data: config, error } = await db.from("daily_email_config")
        .select("enabled").eq("id", true).single();
      if (error || typeof config?.enabled !== "boolean") {
        throw new Error("pause_state_unavailable");
      }
      if (!config.enabled) {
        log({ event: "daily_email_run_paused", due: 0, reserved: 0, sent: 0 });
        return reply(200, { paused: true, due: 0, reserved: 0, sent: 0 });
      }
      const rpc = async (name, args = {}) => {
        const { data, error } = await db.rpc(name, args);
        if (error) throw new Error("database_operation_failed");
        return data;
      };
      return reply(
        200,
        await run({ rpc, appUrl: app.origin, send: sender(), log }),
      );
    } catch {
      log({
        event: "daily_email_run_failed",
        reason: "database_or_configuration_failure",
      });
      return reply(500, {
        error: "Daily email run failed; inspect delivery ledger",
      });
    }
  };
}
