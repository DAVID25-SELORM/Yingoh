export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function dailyEmailMessage(job, appUrl) {
  const base = new URL(appUrl).origin;
  const link = `${base}/?dailyDelivery=${
    encodeURIComponent(job.id)
  }#/Question%20of%20the%20Day`;
  const settings = `${base}/#/Account`;
  const options = job.choices.map((c) =>
    `${String(c.id).toUpperCase()}. ${c.text}`
  );
  const greeting = `Hello ${job.name || "there"},`;
  return {
    to: job.email,
    subject: "Your Daily NCLEX Question | NurseFaculty",
    headers: { "Message-ID": `<daily-${job.id}@${new URL(base).hostname}>` },
    content:
      `NurseFaculty\n${greeting}\n\nDAILY NCLEX QUESTION\n${job.topic}\n\n${job.prompt}\n\n${
        options.join("\n")
      }\n\nAnswer Question: ${link}\n\nOne question a day. Keep building your NCLEX readiness.\nDaily email preferences: ${settings}`,
    html:
      `<div style="max-width:600px;margin:auto;padding:24px;font-family:Arial,sans-serif;color:#17212f"><h2 style="color:#135f55">NurseFaculty</h2><p>${
        escapeHtml(greeting)
      }</p><h1 style="font-size:24px">Daily NCLEX Question</h1><p>${
        escapeHtml(job.topic)
      }</p><p style="white-space:pre-wrap;line-height:1.6">${
        escapeHtml(job.prompt)
      }</p>${
        options.map((o) => `<p>${escapeHtml(o)}</p>`).join("")
      }<p style="margin:28px 0"><a style="background:#135f55;color:white;padding:14px 22px;text-decoration:none;border-radius:8px" href="${
        escapeHtml(link)
      }">Answer Question</a></p><p>One question a day. Keep building your NCLEX readiness.</p><p><a href="${
        escapeHtml(settings)
      }">Manage or disable daily question emails</a></p></div>`,
  };
}

// denomailer 1.6.0 uses "<SMTP code>: <response>" for explicit rejections.
// Network errors/timeouts are ambiguous: never blindly retry them with SMTP.
export function classifySmtpFailure(error) {
  if (/^4\d{2}: /.test(error?.message ?? "")) return "temporary_rejection";
  if (/^5\d{2}: 5\.1\.[13]\b/.test(error?.message ?? "")) {
    return "invalid_recipient";
  }
  if (/^5\d{2}: /.test(error?.message ?? "")) return "permanent_rejection";
  if (["ConnectionRefused", "NotFound"].includes(error?.name)) {
    return "temporary_rejection";
  }
  return "delivery_outcome_unknown";
}

export async function runDailyEmails(
  {
    rpc,
    send,
    appUrl,
    log = (entry) => console.log(JSON.stringify(entry)),
    now = Date.now,
  },
) {
  const started = now();
  log({ event: "daily_email_run_start" });
  const reserved = await rpc("reserve_daily_emails", { p_limit: 100 });
  const result = {
    ...reserved,
    sent: 0,
    failed: 0,
    retryable: 0,
    ambiguous: 0,
    permanent_failures: 0,
    processed: 0,
  };
  let claimed = 0;
  async function lane() {
    while (claimed++ < 100 && now() - started < 35000) {
      const claim = await rpc("claim_daily_email");
      if (!claim) break;
      const args = { p_id: claim.id, p_token: claim.lease_token };
      const job = await rpc("begin_daily_email", args);
      if (!job) continue;
      let outcome = "sent";
      try {
        await send(dailyEmailMessage(job, appUrl));
      } catch (error) {
        outcome = classifySmtpFailure(error);
      }
      const recorded = await rpc("finish_daily_email", {
        ...args,
        p_outcome: outcome,
      });
      if (!recorded) throw new Error("delivery_result_not_recorded");
      result.processed++;
      if (outcome === "sent") result.sent++;
      else result.failed++;
      if (outcome === "temporary_rejection") result.retryable++;
      if (outcome === "delivery_outcome_unknown") result.ambiguous++;
      if (["permanent_rejection", "invalid_recipient"].includes(outcome)) result.permanent_failures++;
      log({ event: "daily_email_result", delivery_id: claim.id, outcome });
    }
  }
  const lanes = await Promise.allSettled(
    Array.from({ length: 4 }, () => lane()),
  );
  if (lanes.some((r) => r.status === "rejected")) {
    throw new Error("delivery_worker_failed");
  }
  log({ event: "daily_email_run_end", ...result });
  return result;
}
