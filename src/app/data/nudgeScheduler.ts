// ──────────────────────────────────────────────
// State-based daily nudges — max 3 smart slots + custom reminders
// ──────────────────────────────────────────────

import type { Profile } from './profiles';
import { getTodayKey } from './profiles';
import {
  getPendingTaskCount,
  getDoneTaskCountToday,
  isDailyCheckInComplete,
} from './dashboardSnapshot';
import {
  type ScheduledNotif,
  getSchedule,
  saveSchedule,
  markScheduleFired,
  wasNudgeFiredToday,
  markNudgeFiredToday,
} from './deviceAnalytics';
import { showNotification } from './notifications';
import { areNotificationsEnabled } from './appSettings';
import { getEmailSettings } from './emailSettings';
import { requestEmailSend } from './emailNudges';
import { getProfileEmail } from './profileContact';
import { trackEvent, saveDeviceRecord } from './deviceAnalytics';

export const SMART_NUDGE_TAGS = ['daily-morning', 'daily-midday', 'daily-evening'] as const;
export type SmartNudgeTag = (typeof SMART_NUDGE_TAGS)[number];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayDayName(): string {
  return DAY_NAMES[new Date().getDay()];
}

function toMs(atH: number, atM: number): number {
  const d = new Date();
  d.setHours(atH, atM, 0, 0);
  return d.getTime();
}

export interface NudgeContext {
  profile: Profile;
  pending: number;
  done: number;
  checkedIn: boolean;
  firstName: string;
  today: string;
}

export function buildNudgeContext(profile: Profile): NudgeContext {
  const today = getTodayKey();
  return {
    profile,
    pending: getPendingTaskCount(profile.id, today),
    done: getDoneTaskCountToday(profile.id, today),
    checkedIn: isDailyCheckInComplete(profile.id, today),
    firstName: profile.name.split(' ')[0],
    today,
  };
}

/** Build copy at fire-time so counts stay accurate */
export function buildSmartNudgeCopy(
  tag: SmartNudgeTag,
  ctx: NudgeContext,
): { title: string; body: string } | null {
  const { firstName, pending, done } = ctx;
  const taskWord = pending === 1 ? 'task' : 'tasks';

  if (tag === 'daily-morning') {
    if (pending <= 0) return null;
    return {
      title: `Good morning, ${firstName}! ☀️`,
      body: `You have ${pending} key financial ${taskWord} today (FAFSA, TAP, payments) to stay on track.`,
    };
  }

  if (tag === 'daily-midday') {
    if (pending <= 0) return null;
    return {
      title: 'Quick check-in 📋',
      body: `How are your aid and scholarship tasks progressing? ${pending} ${taskWord} still open today.`,
    };
  }

  if (tag === 'daily-evening') {
    if (done > 0) {
      const taskLabel = done === 1 ? 'task' : 'tasks';
      return {
        title: `Nice work today, ${firstName}! 🎓`,
        body: `Solid progress — ${done} ${taskLabel} completed toward your college funding goals.`,
      };
    }
    if (pending > 0) {
      return {
        title: `Evening reminder, ${firstName}`,
        body: `${pending} funding ${taskWord} still open. A few minutes now keeps your momentum going.`,
      };
    }
    return null;
  }

  return null;
}

export interface CustomReminderInput {
  id: string;
  label: string;
  time: string;
  days: string[];
  enabled: boolean;
}

function parseCustomReminders(profileId: string): CustomReminderInput[] {
  try {
    const raw = localStorage.getItem(`reminders-${profileId}`);
    if (!raw) return [];
    return JSON.parse(raw) as CustomReminderInput[];
  } catch {
    return [];
  }
}

let processingLock = false;

/** Build / merge today's schedule (smart + custom) without firing */
export function rebuildDailySchedule(profileId: string): ScheduledNotif[] {
  const existing = getSchedule(profileId);
  const existingTags = new Set(existing.map(n => n.tag));
  const schedule: ScheduledNotif[] = [...existing];

  const addIfNew = (entry: ScheduledNotif) => {
    if (!existingTags.has(entry.tag)) {
      schedule.push(entry);
      existingTags.add(entry.tag);
    }
  };

  // Smart slots — titles/bodies refreshed at fire time
  addIfNew({
    tag: 'daily-morning',
    title: 'Good morning! ☀️',
    body: 'Your financial tasks for today are ready.',
    atMs: toMs(8, 0),
    kind: 'smart',
  });
  addIfNew({
    tag: 'daily-midday',
    title: 'Quick check-in 📋',
    body: 'Check in on your aid and scholarship tasks.',
    atMs: toMs(13, 0),
    kind: 'smart',
  });
  addIfNew({
    tag: 'daily-evening',
    title: 'Evening summary 🎓',
    body: 'See how your college funding progress went today.',
    atMs: toMs(19, 30),
    kind: 'smart',
  });

  for (const r of parseCustomReminders(profileId)) {
    if (!r.enabled) continue;
    const [h, m] = r.time.split(':').map(Number);
    addIfNew({
      tag: `reminder-${r.id}`,
      title: `${r.label} ⏰`,
      body: `Time for your ${r.label.toLowerCase()} — stay on track with your funding goals.`,
      atMs: toMs(h, m),
      kind: 'custom',
      days: r.days,
    });
  }

  saveSchedule(profileId, schedule);
  return schedule;
}

export interface ProcessNudgesOptions {
  profile: Profile;
  swReg: ServiceWorkerRegistration | null;
  sendEmail?: boolean;
}

/** Check schedule, fire due nudges with dedup — call every 60s + on visibility */
export async function processDueNudges({
  profile,
  swReg,
  sendEmail = true,
}: ProcessNudgesOptions): Promise<void> {
  if (processingLock) return;
  if (!areNotificationsEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  processingLock = true;
  try {
    const schedule = rebuildDailySchedule(profile.id);
    const ctx = buildNudgeContext(profile);
    const nowMs = Date.now();
    const todayDay = todayDayName();

    for (const notif of schedule) {
      if (nowMs < notif.atMs) continue;
      if (wasNudgeFiredToday(profile.id, notif.tag)) {
        markScheduleFired(profile.id, notif.tag);
        continue;
      }

      if (notif.kind === 'custom' && notif.days?.length && !notif.days.includes(todayDay)) {
        continue;
      }

      let title = notif.title;
      let body = notif.body;

      if (notif.kind === 'smart' && SMART_NUDGE_TAGS.includes(notif.tag as SmartNudgeTag)) {
        const copy = buildSmartNudgeCopy(notif.tag as SmartNudgeTag, ctx);
        if (!copy) {
          markNudgeFiredToday(profile.id, notif.tag);
          markScheduleFired(profile.id, notif.tag);
          continue;
        }
        title = copy.title;
        body = copy.body;
      }

      await showNotification(swReg, title, body, notif.tag);
      markNudgeFiredToday(profile.id, notif.tag);
      markScheduleFired(profile.id, notif.tag);
      trackEvent(profile.id, 'notif_sent', { tag: notif.tag });
      saveDeviceRecord(profile.id, { lastNotifSent: Date.now() });

      if (sendEmail) {
        const emailCfg = getEmailSettings();
        if (emailCfg.enabled && emailCfg.smartNudgeEnabled && emailCfg.triggerMode !== 'manual') {
          requestEmailSend({
            profileId: profile.id,
            type: 'smart_nudge',
            tag: notif.tag,
            date: ctx.today,
            profileName: profile.name,
            title,
            body,
            pendingCount: ctx.pending,
            recipient: getProfileEmail(profile.id) || undefined,
          });
        }
      }
    }
  } finally {
    processingLock = false;
  }
}
