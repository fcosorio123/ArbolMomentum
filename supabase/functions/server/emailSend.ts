// ── Email send orchestration (settings, dedup, Resend) ──────────────

import * as kv from "./kv_store.tsx";
import { buildEmailContent, type EmailType } from "./emailTemplates.ts";
import { isValidEmail, sendViaResend } from "./resend.ts";

const SETTINGS_KEY = "arbol-email-settings";

export type TriggerMode = "browser_aligned" | "event_only" | "manual";

export interface SmartSlotConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface SmartSlotsConfig {
  morning: SmartSlotConfig;
  midday: SmartSlotConfig;
  evening: SmartSlotConfig;
  streakRisk: SmartSlotConfig;
}

export const DEFAULT_SMART_SLOTS: SmartSlotsConfig = {
  morning: { enabled: true, hour: 8, minute: 0 },
  midday: { enabled: true, hour: 13, minute: 0 },
  evening: { enabled: true, hour: 19, minute: 30 },
  streakRisk: { enabled: true, hour: 20, minute: 0 },
};

export interface EmailSettings {
  enabled: boolean;
  welcomeEnabled: boolean;
  smartNudgeEnabled: boolean;
  taskCompletionEnabled: boolean;
  checkInConfirmationEnabled: boolean;
  taskCreatedEnabled: boolean;
  goalUpdatedEnabled: boolean;
  profileArchivedEnabled: boolean;
  triggerMode: TriggerMode;
  smartSlots: SmartSlotsConfig;
  fromName: string;
  replyTo: string;
  testRecipient: string;
  profileEmails: Record<string, string>;
  updatedAt: number;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  enabled: false,
  welcomeEnabled: true,
  smartNudgeEnabled: true,
  taskCompletionEnabled: false,
  checkInConfirmationEnabled: true,
  taskCreatedEnabled: false,
  goalUpdatedEnabled: false,
  profileArchivedEnabled: false,
  triggerMode: "browser_aligned",
  smartSlots: { ...DEFAULT_SMART_SLOTS },
  fromName: "Arbol Momentum",
  replyTo: "",
  testRecipient: "",
  profileEmails: {},
  updatedAt: 0,
};

export interface SendEmailPayload {
  profileId: string;
  type: EmailType;
  tag?: string;
  taskId?: string;
  date?: string;
  recipient?: string;
  /** Explicit multi-send list (manual nudge). Overrides profile resolution when non-empty. */
  recipients?: string[];
  profileName?: string;
  title?: string;
  body?: string;
  taskLabel?: string;
  pendingCount?: number;
  streak?: number;
  topTasks?: Array<{ label: string; goalTitle?: string }>;
  force?: boolean;
  /** Server cron path - bypasses client trigger_mode gates */
  scheduled?: boolean;
}

function mergeSettings(raw: unknown): EmailSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EMAIL_SETTINGS };
  const partial = raw as Partial<EmailSettings>;
  const merged = { ...DEFAULT_EMAIL_SETTINGS, ...partial };
  merged.smartSlots = { ...DEFAULT_SMART_SLOTS, ...(partial.smartSlots ?? {}) };
  for (const key of Object.keys(DEFAULT_SMART_SLOTS) as (keyof SmartSlotsConfig)[]) {
    merged.smartSlots[key] = { ...DEFAULT_SMART_SLOTS[key], ...(merged.smartSlots[key] ?? {}) };
  }
  return merged;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const data = await kv.get(SETTINGS_KEY);
  return mergeSettings(data);
}

export async function saveEmailSettings(settings: EmailSettings): Promise<void> {
  await kv.set(SETTINGS_KEY, { ...settings, updatedAt: Date.now() });
}

function typeEnabled(settings: EmailSettings, type: EmailType): boolean {
  if (type === "test") return true;
  if (!settings.enabled) return false;
  switch (type) {
    case "welcome":
      return settings.welcomeEnabled;
    case "smart_nudge":
      return settings.smartNudgeEnabled;
    case "task_completion":
      return settings.taskCompletionEnabled;
    case "check_in_confirmation":
      return settings.checkInConfirmationEnabled;
    case "task_created":
      return settings.taskCreatedEnabled;
    case "goal_updated":
      return settings.goalUpdatedEnabled;
    case "profile_archived":
      return settings.profileArchivedEnabled;
    case "test":
      return true;
    default:
      return false;
  }
}

function dedupeKey(payload: SendEmailPayload): string {
  switch (payload.type) {
    case "welcome":
      return "once";
    case "smart_nudge":
      return `${payload.date ?? "unknown"}-${payload.tag ?? "nudge"}`;
    case "task_completion":
      return `${payload.date ?? "unknown"}-${payload.taskId ?? "task"}`;
    case "check_in_confirmation":
      return payload.date ?? "unknown";
    case "task_created":
      return payload.taskId ?? "task";
    case "goal_updated":
      return `${payload.date ?? "unknown"}-${payload.tag ?? "goal"}`;
    case "profile_archived":
      return "once";
    case "test":
      return `test-${Date.now()}`;
    default:
      return String(Date.now());
  }
}

function sentLogKey(profileId: string, type: EmailType, dedupe: string): string {
  return `arbol-sent-email-${profileId}-${type}-${dedupe}`;
}

/**
 * Resolve outbound email for a profile.
 * Source of truth: that profile's backup email (set on Profile), then admin map fallback.
 * Never use testRecipient or another profile's address.
 */
export async function resolveProfileRecipient(
  profileId: string,
  settings?: EmailSettings,
): Promise<{ email: string | null; source: "profile" | "admin" | "none" }> {
  const cfg = settings ?? await getEmailSettings();
  const backup = await kv.get(`arbol-backup-${profileId}`);
  const backupEmail = typeof backup?.profileEmail === "string" ? backup.profileEmail.trim() : "";
  if (backupEmail && isValidEmail(backupEmail)) {
    return { email: backupEmail, source: "profile" };
  }
  const adminEmail = cfg.profileEmails?.[profileId]?.trim() ?? "";
  if (adminEmail && isValidEmail(adminEmail)) {
    return { email: adminEmail, source: "admin" };
  }
  return { email: null, source: "none" };
}

/** Enrich copy from this profile's cloud backup so content matches that user. */
async function loadProfileEmailContext(profileId: string): Promise<{
  profileName?: string;
  pendingCount?: number;
  streak?: number;
  topTasks?: Array<{ label: string; goalTitle?: string }>;
}> {
  const backup = await kv.get(`arbol-backup-${profileId}`);
  const snap = backup?.nudgeSnapshot;
  if (!snap || typeof snap !== "object") {
    return {
      profileName: profileId.charAt(0).toUpperCase() + profileId.slice(1),
    };
  }
  const name = typeof snap.profileName === "string" && snap.profileName.trim()
    ? snap.profileName.trim()
    : (profileId.charAt(0).toUpperCase() + profileId.slice(1));
  return {
    profileName: name,
    pendingCount: typeof snap.pending === "number" ? snap.pending : undefined,
    streak: typeof snap.streak === "number" ? snap.streak : undefined,
    topTasks: Array.isArray(snap.topTasks) ? snap.topTasks : undefined,
  };
}

function parseRecipientList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(
      raw.map((x) => String(x ?? "").trim().toLowerCase()).filter((e) => isValidEmail(e)),
    )];
  }
  if (typeof raw === "string") {
    return [...new Set(
      raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => isValidEmail(e)),
    )];
  }
  return [];
}

function triggerAllows(type: EmailType, mode: TriggerMode, force?: boolean, scheduled?: boolean): boolean {
  if (force || scheduled) return true;
  if (mode === "manual") return false;
  if (mode === "event_only") {
    return type === "welcome" || type === "task_completion" || type === "check_in_confirmation"
      || type === "task_created" || type === "goal_updated" || type === "profile_archived";
  }
  // browser_aligned: all automated types allowed
  return true;
}

export async function sendEmail(payload: SendEmailPayload): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  resendId?: string;
  sentTo?: string[];
}> {
  const settings = await getEmailSettings();
  const appEnv = (Deno.env.get("APP_ENV") || Deno.env.get("ARBOL_APP_ENV") || "").toLowerCase();
  const stagingMode = appEnv === "staging" || Deno.env.get("STAGING_EMAIL_MODE") === "1";

  if (payload.type !== "test" && !settings.enabled && !payload.force) {
    return { ok: false, skipped: true, reason: "global_disabled" };
  }

  if (payload.type !== "test" && !typeEnabled(settings, payload.type) && !payload.force) {
    return { ok: false, skipped: true, reason: "type_or_global_disabled" };
  }

  if (payload.type !== "test" && !triggerAllows(payload.type, settings.triggerMode, payload.force, payload.scheduled)) {
    return { ok: false, skipped: true, reason: "trigger_mode_blocked" };
  }

  let targets: string[] = [];
  if (payload.type === "test") {
    // Test only: explicit address, else admin testRecipient. Never another profile's mailbox.
    const one = payload.recipient?.trim() || settings.testRecipient?.trim() || "";
    targets = one && isValidEmail(one) ? [one.trim().toLowerCase()] : [];
  } else {
    const explicitList = parseRecipientList(payload.recipients);
    if (explicitList.length > 0) {
      // Manual multi-send: use the exact list the admin entered.
      targets = explicitList;
    } else {
      // Operational: always deliver to THIS profile's email (SoT), never a shared/test inbox.
      const resolved = await resolveProfileRecipient(payload.profileId, settings);
      if (resolved.email) {
        targets = [resolved.email.toLowerCase()];
      } else if (payload.recipient && isValidEmail(payload.recipient)) {
        targets = [payload.recipient.trim().toLowerCase()];
      }
    }
  }

  // Staging safety: never email real students — allowlist only (testRecipient + STAGING_EMAIL_ALLOWLIST).
  if (stagingMode && payload.type !== "test") {
    const allow = new Set([
      ...(settings.testRecipient ? [settings.testRecipient.trim().toLowerCase()] : []),
      ...parseRecipientList(Deno.env.get("STAGING_EMAIL_ALLOWLIST") || ""),
    ].filter((e) => isValidEmail(e)));
    targets = targets.filter((t) => allow.has(t));
    if (targets.length === 0) {
      return { ok: false, skipped: true, reason: "staging_recipient_blocked" };
    }
  }

  if (targets.length === 0) {
    return { ok: false, skipped: true, reason: "no_valid_recipient" };
  }

  const dedupe = dedupeKey(payload);
  if (payload.type !== "test" && !payload.force) {
    const existing = await kv.get(sentLogKey(payload.profileId, payload.type, dedupe));
    if (existing) {
      return { ok: false, skipped: true, reason: "already_sent" };
    }
  }

  // Always bind copy to this profile's snapshot so content never bleeds from another user.
  const profileCtx = await loadProfileEmailContext(payload.profileId);
  const profileName = payload.profileName?.trim() || profileCtx.profileName;
  const pendingCount = payload.pendingCount ?? profileCtx.pendingCount;
  const streak = payload.streak ?? profileCtx.streak;
  const topTasks = payload.topTasks?.length ? payload.topTasks : profileCtx.topTasks;
  const firstName = profileName?.split(" ")[0];

  let inviteUrl: string | undefined;
  if (payload.type === "welcome" && targets[0]) {
    try {
      const { mintInviteToken } = await import("./inviteTokens.ts");
      const minted = await mintInviteToken({
        profileId: payload.profileId,
        email: targets[0],
        profileName,
      });
      inviteUrl = minted.url;
    } catch (err) {
      console.log("[EmailSend] Invite mint failed:", err);
    }
  }

  const nid = `n_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const content = buildEmailContent(payload.type, {
    profileName,
    firstName,
    tag: payload.tag,
    title: payload.title,
    body: payload.body,
    taskLabel: payload.taskLabel,
    pendingCount,
    streak,
    topTasks,
    inviteUrl,
    nid,
    cta: payload.type === "smart_nudge" || payload.type === "welcome" || payload.type === "test"
      ? "cta.open_checkin"
      : undefined,
  });

  const replyTo = settings.replyTo?.trim() || undefined;
  const sentTo: string[] = [];
  let lastId: string | undefined;
  const failures: string[] = [];

  for (const to of targets) {
    const result = await sendViaResend({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo,
      // Sandbox FROM may only be used for intentional admin tests - never profile nudges.
      allowSandbox: payload.type === "test",
    });
    if (result.ok) {
      sentTo.push(to);
      lastId = result.id;
    } else {
      failures.push(`${to}:${result.error ?? "send_failed"}`);
      console.log("[EmailSend] Failed for", to, result.error);
    }
  }

  if (sentTo.length === 0) {
    return {
      ok: false,
      reason: failures[0] ? `send_failed:${failures[0]}` : "send_failed",
    };
  }

  if (payload.type !== "test") {
    await kv.set(sentLogKey(payload.profileId, payload.type, dedupe), {
      sentAt: Date.now(),
      resendId: lastId,
      type: payload.type,
      dedupe,
      sentTo,
      nid: content.nid,
      cta: content.cta,
      channel: "email",
      appEnv: stagingMode ? "staging" : "production",
    });
  }

  return {
    ok: true,
    resendId: lastId,
    sentTo,
    nid: content.nid,
    reason: failures.length > 0 ? `partial:${failures.join("|")}` : undefined,
  };
}
