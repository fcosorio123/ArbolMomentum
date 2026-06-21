// ── Resend HTTP client (server-side only) ───────────────────────────

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export function getEmailConfig() {
  return {
    apiKey: Deno.env.get("RESEND_API_KEY") ?? "",
    fromAddress: Deno.env.get("EMAIL_FROM_ADDRESS") ?? "onboarding@resend.dev",
    fromName: Deno.env.get("EMAIL_FROM_NAME") ?? "Arbol Momentum",
    replyTo: Deno.env.get("EMAIL_REPLY_TO") ?? "",
    appBaseUrl: Deno.env.get("APP_BASE_URL") ?? "https://fcosorio123.github.io/ArbolMomentum",
  };
}

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<ResendSendResult> {
  const cfg = getEmailConfig();
  if (!cfg.apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  if (!cfg.fromAddress) {
    return { ok: false, error: "EMAIL_FROM_ADDRESS not configured" };
  }

  const from = cfg.fromName
    ? `${cfg.fromName} <${cfg.fromAddress}>`
    : cfg.fromAddress;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log("[Resend] Send failed:", res.status, body);
      return { ok: false, error: String(body?.message ?? body?.error ?? res.statusText) };
    }
    return { ok: true, id: body?.id };
  } catch (err) {
    console.log("[Resend] Request error:", err);
    return { ok: false, error: String(err) };
  }
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
