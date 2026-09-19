import { SMTPClient } from "denomailer";
import { smtpConfiguration } from "./config.js";

type Message = {
  to: string;
  subject: string;
  html: string;
  content: string;
  headers?: Record<string, string>;
};
export function createSmtpSender(env: (key: string) => string) {
  const config = smtpConfiguration(env);
  return async (message: Message) => {
    const client = new SMTPClient({
      connection: config.connection,
      debug: { log: false },
      client: { warning: "ignore" },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        client.send({ ...message, from: config.from, replyTo: config.replyTo }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("smtp_timeout")), 15000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      try {
        await client.close();
      } catch { /* Never retry an accepted email for a cleanup failure. */ }
    }
  };
}
