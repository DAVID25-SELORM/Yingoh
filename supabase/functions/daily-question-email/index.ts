import { createClient } from "@supabase/supabase-js";
import { createSmtpSender } from "./smtp.ts";
import { dailyEmailHandler } from "./handler.js";

const env = (key: string) => Deno.env.get(key) ?? "";
Deno.serve(dailyEmailHandler({
  env,
  database: () =>
    createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  sender: () => createSmtpSender(env),
}));
