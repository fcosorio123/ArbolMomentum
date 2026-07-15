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

/** Resend sandbox FROM — can only deliver to the Resend account owner, not each profile. */
export function isResendSandboxFrom(fromAddress: string): boolean {
  return /onboarding@resend\.dev/i.test((fromAddress ?? "").trim());
}

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** When true, allow sandbox FROM (admin/test probes only). */
  allowSandbox?: boolean;
}): Promise<ResendSendResult> {
  const cfg = getEmailConfig();
  if (!cfg.apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  if (!cfg.fromAddress) {
    return { ok: false, error: "EMAIL_FROM_ADDRESS not configured" };
  }

  // Hard stop: sandbox FROM makes every non-owner profile appear "broken" (only Favio receives).
  if (isResendSandboxFrom(cfg.fromAddress) && !opts.allowSandbox) {
    return {
      ok: false,
      error:
        "EMAIL_FROM_ADDRESS is still onboarding@resend.dev (Resend sandbox). "
        + "Verify a domain in Resend and set EMAIL_FROM_ADDRESS to an address on that domain, "
        + "then redeploy edge secrets. Until then only the Resend account owner can receive mail.",
    };
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
