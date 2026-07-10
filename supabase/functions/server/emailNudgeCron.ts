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
const CRON_WINDOW_MINUTES = 15;

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

function buildNudgeCopy(
  tag: string,
  snapshot: NudgeSnapshot | null,
  profileName: string,
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

  if (tag === "daily-morning") {
    if (pending <= 0 && snapshot) return null;
    return {
      title: `Good morning, ${firstName}! ☀️`,
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
    return { ok: true, processed: 0, sent: 0, skipped: 0, details: [{ profileId: "*", tag: "*", status: "global_disabled" }] };
  }

  const profileIds = await collectProfileIds(settings);

  for (const profileId of profileIds) {
    const backup = (await kv.get(`${BACKUP_PREFIX}${profileId}`)) as BackupPayload | null;
    const prefs = backup?.alertPrefs ?? null;

    if (!isEmailEnabledForProfile(prefs)) {
      skipped++;
      details.push({ profileId, tag: "*", status: "user_email_disabled" });
      continue;
    }

    const adminEmail = settings.profileEmails?.[profileId];
    const email = (typeof adminEmail === "string" && isValidEmail(adminEmail))
      ? adminEmail
      : (typeof backup?.profileEmail === "string" ? backup.profileEmail : "");
    if (!isValidEmail(email)) {
      skipped++;
      details.push({ profileId, tag: "*", status: "no_email" });
      continue;
    }

    const tzOffset = typeof backup?.tzOffset === "number" ? backup.tzOffset : 300; // default US Eastern
    const local = localDateTimeForProfile(tzOffset);
    const slots = effectiveSlots(settings, prefs);
    const snapshot = backup?.nudgeSnapshot ?? null;
    const snapshotFresh = snapshot?.dateKey === local.dateKey ? snapshot : null;
    const profileName = resolveProfileName(profileId, backup);

    for (const key of Object.keys(SLOT_TAGS) as SlotKey[]) {
      const slot = slots[key];
      const tag = SLOT_TAGS[key];
      if (!isSlotDueNow(slot, local.totalMinutes)) continue;

      const copy = buildNudgeCopy(tag, snapshotFresh, profileName);
      if (!copy) {
        skipped++;
        details.push({ profileId, tag, status: "no_copy" });
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
      } else {
        skipped++;
        details.push({ profileId, tag, status: result.reason ?? "skipped" });
      }
    }
  }

  return { ok: true, processed: profileIds.length, sent, skipped, details };
}
