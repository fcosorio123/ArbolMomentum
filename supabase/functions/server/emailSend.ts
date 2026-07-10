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
  profileName?: string;
  title?: string;
  body?: string;
  taskLabel?: string;
  pendingCount?: number;
  streak?: number;
  topTasks?: Array<{ label: string; goalTitle?: string }>;
  force?: boolean;
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

async function resolveRecipient(
  profileId: string,
  settings: EmailSettings,
  explicit?: string,
): Promise<string | null> {
  if (explicit && isValidEmail(explicit)) return explicit.trim();
  const adminEmail = settings.profileEmails?.[profileId];
  if (adminEmail && isValidEmail(adminEmail)) return adminEmail.trim();

  const backup = await kv.get(`arbol-backup-${profileId}`);
  const backupEmail = backup?.profileEmail;
  if (typeof backupEmail === "string" && isValidEmail(backupEmail)) {
    return backupEmail.trim();
  }
  return null;
}

function triggerAllows(type: EmailType, mode: TriggerMode, force?: boolean): boolean {
  if (force) return true;
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
}> {
  const settings = await getEmailSettings();

  if (payload.type !== "test" && !settings.enabled && !payload.force) {
    return { ok: false, skipped: true, reason: "global_disabled" };
  }

  if (payload.type !== "test" && !typeEnabled(settings, payload.type)) {
    return { ok: false, skipped: true, reason: "type_or_global_disabled" };
  }

  if (payload.type !== "test" && !triggerAllows(payload.type, settings.triggerMode, payload.force)) {
    return { ok: false, skipped: true, reason: "trigger_mode_blocked" };
  }

  const to = payload.type === "test"
    ? (settings.testRecipient?.trim() || payload.recipient?.trim() || "")
    : await resolveRecipient(payload.profileId, settings, payload.recipient);

  if (!to || !isValidEmail(to)) {
    return { ok: false, skipped: true, reason: "no_valid_recipient" };
  }

  const dedupe = dedupeKey(payload);
  if (payload.type !== "test" && !payload.force) {
    const existing = await kv.get(sentLogKey(payload.profileId, payload.type, dedupe));
    if (existing) {
      return { ok: false, skipped: true, reason: "already_sent" };
    }
  }

  const firstName = payload.profileName?.split(" ")[0];
  const content = buildEmailContent(payload.type, {
    profileName: payload.profileName,
    firstName,
    tag: payload.tag,
    title: payload.title,
    body: payload.body,
    taskLabel: payload.taskLabel,
    pendingCount: payload.pendingCount,
    streak: payload.streak,
    topTasks: payload.topTasks,
  });

  const replyTo = settings.replyTo?.trim() || undefined;
  const result = await sendViaResend({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo,
  });

  if (!result.ok) {
    return { ok: false, reason: result.error ?? "send_failed" };
  }

  if (payload.type !== "test") {
    await kv.set(sentLogKey(payload.profileId, payload.type, dedupe), {
      sentAt: Date.now(),
      resendId: result.id,
      type: payload.type,
      dedupe,
    });
  }

  return { ok: true, resendId: result.id };
}
