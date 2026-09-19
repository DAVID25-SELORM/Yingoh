import { createClient } from "@supabase/supabase-js";
import { createSmtpSender } from "../daily-question-email/smtp.ts";
import { diagnosticHandler } from "./handler.js";
const env = (key: string) => Deno.env.get(key) ?? "";
Deno.serve(diagnosticHandler({
  env,
  database: () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  sender: () => createSmtpSender(env),
}));
