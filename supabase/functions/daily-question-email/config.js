export function smtpConfiguration(env) {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  const missing = required.filter((key) => !env(key));
  if (missing.length) {
    throw new Error(`Missing configuration: ${missing.join(", ")}`);
  }
  // Hosted Supabase blocks ports 25 and 587. Use the existing provider's SMTPS.
  const port = Number(env("SMTP_PORT") || "465");
  if (port !== 465) {
    throw new Error("SMTP_PORT must be 465 for this hosted worker");
  }
  const mailbox = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
  if (!mailbox.test(env("SMTP_FROM"))) {
    throw new Error("SMTP_FROM must be one mailbox address");
  }
  if (env("SMTP_REPLY_TO") && !mailbox.test(env("SMTP_REPLY_TO"))) {
    throw new Error("SMTP_REPLY_TO must be one mailbox address");
  }
  const fromName = env("SMTP_FROM_NAME") || "NurseFaculty";
  if (/[\r\n<>]/.test(fromName)) throw new Error("SMTP_FROM_NAME is invalid");
  return {
    connection: {
      hostname: env("SMTP_HOST"),
      port,
      tls: true,
      auth: { username: env("SMTP_USER"), password: env("SMTP_PASS") },
    },
    from: `"${fromName.replace(/[\\"]/g, "\\$&")}" <${env("SMTP_FROM")}>`,
    replyTo: env("SMTP_REPLY_TO") || undefined,
  };
}

export function diagnosticRecipient(args) {
  if (
    args.length !== 3 || args[0] !== "--to" || args[2] !== "--send-one" ||
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(args[1])
  ) {
    throw new Error("Usage: --to <explicit-test-mailbox> --send-one");
  }
  return args[1];
}
