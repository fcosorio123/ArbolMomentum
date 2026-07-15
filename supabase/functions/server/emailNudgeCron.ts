// ── Scheduled email nudges (server cron — app does not need to be open) ──

import * as kv from "./kv_store.tsx";
import {
  getEmailSettings,
  sendEmail,
  DEFAULT_SMART_SLOTS,
  type SmartSlotsConfig,
  type SmartSlotConfig,
  type EmailSettings,
} from "./emailSend.ts";
import { isValidEmail } from "./resend.ts";

const BACKUP_PREFIX = "arbol-backup-";
/** Wider window so GitHub Actions UTC schedule drift is less likely to miss a slot (C1 evidence). */
const CRON_WINDOW_MINUTES = 20;
export const CRON_LAST_RUN_KEY = "arbol-cron-last-run";
export const CRON_ATTEMPT_LOG_KEY = "arbol-cron-attempt-log";
const ATTEMPT_LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ATTEMPT_LOG_MAX_ENTRIES = 500;

export interface EmailAttemptLogEntry {
  profileId: string;
  tag: string;
  recipient?: string;
  attemptAt: number;
  status: string;
  skipReason?: string;
  resendId?: string;
}

export interface NudgeSnapshot {
  dateKey: string;
  pending: number;
  done: number;
  streak: number;
  checkedIn: boolean;
  topTasks?: Array<{ label: string; goalTitle?: string }>;
  profileName?: string;
  updatedAt?: number;
}

interface ProfileAlertPrefs {
  emailEnabled?: boolean | null;
  smartSlots?: Partial<SmartSlotsConfig> | null;
}

interface BackupPayload {
  profileEmail?: string | null;
  alertPrefs?: ProfileAlertPrefs | null;
  nudgeSnapshot?: NudgeSnapshot | null;
  tzOffset?: number;
  profileArchived?: boolean;
}

const SLOT_TAGS = {
  morning: "daily-morning",
  midday: "daily-midday",
  evening: "daily-evening",
  streakRisk: "daily-streak-risk",
} as const;

type SlotKey = keyof typeof SLOT_TAGS;

function mergeSlot(admin: SmartSlotConfig, user?: Partial<SmartSlotConfig>): SmartSlotConfig {
  if (!user) return { ...admin };
  return {
    enabled: user.enabled ?? admin.enabled,
    hour: user.hour ?? admin.hour,
    minute: user.minute ?? admin.minute,
  };
}

function effectiveSlots(settings: EmailSettings, prefs?: ProfileAlertPrefs | null): SmartSlotsConfig {
  const admin = settings.smartSlots ?? DEFAULT_SMART_SLOTS;
  const user = prefs?.smartSlots ?? {};
  return {
    morning: mergeSlot(admin.morning, user.morning),
    midday: mergeSlot(admin.midday, user.midday),
    evening: mergeSlot(admin.evening, user.evening),
    streakRisk: mergeSlot(admin.streakRisk, user.streakRisk),
  };
}

function isEmailEnabledForProfile(prefs?: ProfileAlertPrefs | null): boolean {
  return prefs?.emailEnabled !== false;
}

/** Local calendar parts for a profile timezone (tzOffset = Date.getTimezoneOffset()). */
export function localDateTimeForProfile(tzOffset: number): {
  dateKey: string;
  hour: number;
  minute: number;
  totalMinutes: number;
} {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const userMs = utcMs - tzOffset * 60_000;
  const local = new Date(userMs);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  return {
    dateKey: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

function isSlotDueNow(slot: SmartSlotConfig, localTotalMinutes: number): boolean {
  if (!slot.enabled) return false;
  const slotStart = slot.hour * 60 + slot.minute;
  return localTotalMinutes >= slotStart && localTotalMinutes < slotStart + CRON_WINDOW_MINUTES;
}

function formatTaskLines(tasks: Array<{ label: string; goalTitle?: string }>): string {
  if (!tasks?.length) return "";
  return tasks
    .map((t) => (t.goalTitle ? `• ${t.label} (${t.goalTitle})` : `• ${t.label}`))
    .join("\n");
}

function greetingForHour(hour: number, firstName: string): string {
  if (hour < 12) return `Good morning, ${firstName}! ☀️`;
  if (hour < 17) return `Good afternoon, ${firstName}!`;
  return `Good evening, ${firstName}!`;
}

/** Normalize to Date.getTimezoneOffset()-style minutes (positive west of UTC). */
function normalizeTzOffsetMinutes(offset: number): number {
  if (!Number.isFinite(offset)) return 300; // US Eastern fallback
  // Older backups accidentally stored ISO-style negatives (e.g. -300 for Eastern).
  if (offset < 0) return -offset;
  return offset;
}

function buildNudgeCopy(
  tag: string,
  snapshot: NudgeSnapshot | null,
  profileName: string,
  localHour: number,
): { title: string; body: string } | null {
  const firstName = profileName.split(" ")[0] || "there";
  const pending = snapshot?.pending ?? 0;
  const done = snapshot?.done ?? 0;
  const streak = snapshot?.streak ?? 0;
  const checkedIn = snapshot?.checkedIn ?? false;
  const topTasks = snapshot?.topTasks ?? [];
  const taskSuffix = formatTaskLines(topTasks);
  const taskLines = taskSuffix ? `\n\n${taskSuffix}` : "";
  const taskWord = pending === 1 ? "task" : "tasks";
  const timeGreeting = greetingForHour(localHour, firstName);

  if (tag === "daily-morning") {
    if (pending <= 0 && snapshot) return null;
    return {
      title: timeGreeting,
      body: pending > 0
        ? `You have ${pending} key ${taskWord} today. Open your check-in and update your progress.${taskLines}`
        : `Open Arbol Momentum to review today's goal-linked tasks.`,
    };
  }

  if (tag === "daily-midday") {
    if (pending <= 0 && snapshot) return null;
    return {
      title: "Quick check-in 📋",
      body: pending > 0
        ? `${pending} ${taskWord} still open today. Tap a task to mark progress and keep your goals moving.${taskLines}`
        : `Check in on your goals — open Arbol Momentum to update today's tasks.`,
    };
  }

  if (tag === "daily-evening") {
    if (done > 0) {
      const taskLabel = done === 1 ? "task" : "tasks";
      return {
        title: `Nice work today, ${firstName}! 🎓`,
        body: `Solid progress — ${done} ${taskLabel} completed toward your goals.`,
      };
    }
    if (pending > 0) {
      return {
        title: `Evening reminder, ${firstName}`,
        body: `${pending} ${taskWord} still open. A few minutes now keeps your momentum going.${taskLines}`,
      };
    }
    if (!snapshot) {
      return {
        title: `Evening check-in, ${firstName}`,
        body: "Open Arbol Momentum to wrap up today's tasks before the day ends.",
      };
    }
    return null;
  }

  if (tag === "daily-streak-risk") {
    if (checkedIn || streak <= 0) return null;
    if (pending <= 0 && !snapshot) return null;
    return {
      title: `Don't break your ${streak}-day streak! 🔥`,
      body: `Finish today's check-in and update your open tasks before the day ends.${taskLines}`,
    };
  }

  return null;
}

function resolveProfileName(profileId: string, backup: BackupPayload | null): string {
  if (backup?.nudgeSnapshot?.profileName) return backup.nudgeSnapshot.profileName;
  return profileId.charAt(0).toUpperCase() + profileId.slice(1);
}

async function collectProfileIds(settings: EmailSettings): Promise<string[]> {
  const ids = new Set<string>();
  for (const id of Object.keys(settings.profileEmails ?? {})) {
    if (id) ids.add(id);
  }
  const rows = await kv.listByPrefix(BACKUP_PREFIX);
  for (const row of rows) {
    const id = row.key.slice(BACKUP_PREFIX.length);
    if (id) ids.add(id);
  }
  return [...ids];
}

function truncateRecipient(email?: string): string | undefined {
  if (!email || typeof email !== "string") return undefined;
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const user = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `${user.slice(0, 2)}***@${domain}`;
}

async function logEmailAttempt(entry: EmailAttemptLogEntry): Promise<void> {
  const raw = await kv.get(CRON_ATTEMPT_LOG_KEY);
  const log: EmailAttemptLogEntry[] = Array.isArray(raw) ? raw as EmailAttemptLogEntry[] : [];
  log.push({
    ...entry,
    recipient: truncateRecipient(entry.recipient),
  });
  const cutoff = Date.now() - ATTEMPT_LOG_MAX_AGE_MS;
  const trimmed = log.filter((e) => e.attemptAt >= cutoff).slice(-ATTEMPT_LOG_MAX_ENTRIES);
  await kv.set(CRON_ATTEMPT_LOG_KEY, trimmed);
}

export async function getCronAttemptLog(profileId?: string): Promise<EmailAttemptLogEntry[]> {
  const raw = await kv.get(CRON_ATTEMPT_LOG_KEY);
  const log: EmailAttemptLogEntry[] = Array.isArray(raw) ? raw as EmailAttemptLogEntry[] : [];
  const cutoff = Date.now() - ATTEMPT_LOG_MAX_AGE_MS;
  const recent = log.filter((e) => e.attemptAt >= cutoff);
  if (!profileId) return recent.slice(-100);
  return recent.filter((e) => e.profileId === profileId).slice(-50);
}

export async function runScheduledEmailNudges(): Promise<{
  ok: boolean;
  processed: number;
  sent: number;
  skipped: number;
  details: Array<{ profileId: string; tag: string; status: string }>;
}> {
  const settings = await getEmailSettings();
  const details: Array<{ profileId: string; tag: string; status: string }> = [];
  let sent = 0;
  let skipped = 0;

  if (!settings.enabled || !settings.smartNudgeEnabled) {
    const disabledResult = {
      ok: true,
      processed: 0,
      sent: 0,
      skipped: 0,
      details: [{ profileId: "*", tag: "*", status: "global_disabled" }],
    };
    await kv.set(CRON_LAST_RUN_KEY, { ranAt: Date.now(), ...disabledResult });
    return disabledResult;
  }

  const profileIds = await collectProfileIds(settings);

  for (const profileId of profileIds) {
    const backup = (await kv.get(`${BACKUP_PREFIX}${profileId}`)) as BackupPayload | null;

    if (backup?.profileArchived === true) {
      skipped++;
      details.push({ profileId, tag: "*", status: "archived" });
      await logEmailAttempt({
        profileId,
        tag: "*",
        attemptAt: Date.now(),
        status: "not_qualified",
        skipReason: "archived",
      });
      continue;
    }

    const prefs = backup?.alertPrefs ?? null;

    if (!isEmailEnabledForProfile(prefs)) {
      skipped++;
      details.push({ profileId, tag: "*", status: "prefs_disabled" });
      await logEmailAttempt({
        profileId,
        tag: "*",
        attemptAt: Date.now(),
        status: "not_qualified",
        skipReason: "prefs_disabled",
      });
      continue;
    }

    const adminEmail = settings.profileEmails?.[profileId];
    const email = (typeof adminEmail === "string" && isValidEmail(adminEmail))
      ? adminEmail
      : (typeof backup?.profileEmail === "string" ? backup.profileEmail : "");
    if (!isValidEmail(email)) {
      skipped++;
      details.push({ profileId, tag: "*", status: "no_email" });
      await logEmailAttempt({
        profileId,
        tag: "*",
        attemptAt: Date.now(),
        status: "not_qualified",
        skipReason: "no_email",
      });
      continue;
    }

    const tzOffset = normalizeTzOffsetMinutes(
      typeof backup?.tzOffset === "number" ? backup.tzOffset : 300,
    );
    const local = localDateTimeForProfile(tzOffset);
    const slots = effectiveSlots(settings, prefs);
    const snapshot = backup?.nudgeSnapshot ?? null;
    const snapshotFresh = snapshot?.dateKey === local.dateKey ? snapshot : null;
    const profileName = resolveProfileName(profileId, backup);

    for (const key of Object.keys(SLOT_TAGS) as SlotKey[]) {
      const slot = slots[key];
      const tag = SLOT_TAGS[key];
      if (!isSlotDueNow(slot, local.totalMinutes)) continue;

      const copy = buildNudgeCopy(tag, snapshotFresh, profileName, local.hour);
      if (!copy) {
        skipped++;
        const skipReason = !snapshotFresh ? "no_snapshot" : "no_copy";
        details.push({ profileId, tag, status: skipReason });
        await logEmailAttempt({
          profileId,
          tag,
          recipient: email,
          attemptAt: Date.now(),
          status: "suppressed",
          skipReason,
        });
        continue;
      }

      const result = await sendEmail({
        profileId,
        type: "smart_nudge",
        tag,
        date: local.dateKey,
        profileName,
        recipient: email,
        title: copy.title,
        body: copy.body,
        pendingCount: snapshotFresh?.pending,
        streak: snapshotFresh?.streak,
        topTasks: snapshotFresh?.topTasks,
        scheduled: true,
      });

      if (result.ok) {
        sent++;
        details.push({ profileId, tag, status: `sent:${result.resendId ?? "ok"}` });
        await logEmailAttempt({
          profileId,
          tag,
          recipient: email,
          attemptAt: Date.now(),
          status: "provider_accepted",
          resendId: result.resendId,
        });
      } else {
        skipped++;
        const reason = result.reason ?? "skipped";
        details.push({
          profileId,
          tag,
          status: reason === "send_failed" ? `send_failed` : reason,
        });
        await logEmailAttempt({
          profileId,
          tag,
          recipient: email,
          attemptAt: Date.now(),
          status: reason === "send_failed" ? "provider_rejected" : "suppressed",
          skipReason: reason,
        });
      }
    }
  }

  const result = { ok: true, processed: profileIds.length, sent, skipped, details };
  await kv.set(CRON_LAST_RUN_KEY, { ranAt: Date.now(), ...result });
  return result;
}

export async function getCronLastRun(): Promise<Record<string, unknown> | null> {
  const data = await kv.get(CRON_LAST_RUN_KEY);
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}
