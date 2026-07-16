// ──────────────────────────────────────────────
// State-based daily nudges - smart slots + custom reminders
// ──────────────────────────────────────────────

import type { Profile } from './profiles';
import { getTodayKey, computeLiveStreak } from './profiles';
import {
  getPendingTaskCount,
  getDoneTaskCountToday,
  isDailyCheckInComplete,
  getTopPendingTasks,
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
import { getEffectiveSmartSlots, isProfileEmailEnabled } from './profileAlertPrefs';
import type { SmartSlotConfig } from './emailSettings';
import { trackEvent, saveDeviceRecord } from './deviceAnalytics';

export const SMART_NUDGE_TAGS = ['daily-morning', 'daily-midday', 'daily-evening', 'daily-streak-risk'] as const;
export type SmartNudgeTag = (typeof SMART_NUDGE_TAGS)[number];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SLOT_TAG_MAP = {
  morning: 'daily-morning',
  midday: 'daily-midday',
  evening: 'daily-evening',
  streakRisk: 'daily-streak-risk',
} as const;

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
  streak: number;
  firstName: string;
  today: string;
  topTasks: Array<{ label: string; goalTitle?: string }>;
}

function formatTaskLines(tasks: Array<{ label: string; goalTitle?: string }>): string {
  if (!tasks.length) return '';
  return tasks
    .map(t => (t.goalTitle ? `• ${t.label} (${t.goalTitle})` : `• ${t.label}`))
    .join('\n');
}

export function buildNudgeContext(profile: Profile): NudgeContext {
  const today = getTodayKey();
  return {
    profile,
    pending: getPendingTaskCount(profile.id, today),
    done: getDoneTaskCountToday(profile.id, today),
    checkedIn: isDailyCheckInComplete(profile.id, today),
    streak: computeLiveStreak(profile.id),
    firstName: profile.name.split(' ')[0],
    today,
    topTasks: getTopPendingTasks(profile.id, today, 3),
  };
}

/** Build copy at fire-time so counts stay accurate */
export function buildSmartNudgeCopy(
  tag: SmartNudgeTag,
  ctx: NudgeContext,
): { title: string; body: string } | null {
  const { firstName, pending, done, checkedIn, streak, topTasks } = ctx;
  const taskWord = pending === 1 ? 'task' : 'tasks';
  const taskLines = formatTaskLines(topTasks);
  const taskSuffix = taskLines ? `\n\n${taskLines}` : '';
  const hour = new Date().getHours();
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const timeGreeting =
    hour < 12 ? `Good morning, ${firstName}! ☀️`
      : hour < 17 ? `Good afternoon, ${firstName}!`
      : `Good evening, ${firstName}!`;

  // Never ship night/evening tone in the morning (same rule as server cron).
  if ((tag === 'daily-evening' || tag === 'daily-streak-risk') && period !== 'evening') {
    return null;
  }
  if (tag === 'daily-morning' && period === 'evening') {
    return null;
  }

  if (tag === 'daily-morning') {
    if (pending <= 0) return null;
    return {
      title: timeGreeting,
      body: `You have ${pending} key ${taskWord} today. Open your check-in and update your progress.${taskSuffix}`,
    };
  }

  if (tag === 'daily-midday') {
    if (pending <= 0) return null;
    return {
      title: period === 'morning' ? timeGreeting : 'Quick check-in 📋',
      body: `${pending} ${taskWord} still open today. Tap a task to mark progress and keep your goals moving.${taskSuffix}`,
    };
  }

  if (tag === 'daily-evening') {
    if (done > 0) {
      const taskLabel = done === 1 ? 'task' : 'tasks';
      return {
        title: `Nice work today, ${firstName}! 🎓`,
        body: `Solid progress - ${done} ${taskLabel} completed toward your goals.`,
      };
    }
    if (pending > 0) {
      return {
        title: timeGreeting,
        body: `${pending} ${taskWord} still open. A few minutes now keeps your momentum going.${taskSuffix}`,
      };
    }
    return null;
  }

  if (tag === 'daily-streak-risk') {
    if (checkedIn || streak <= 0 || pending <= 0) return null;
    return {
      title: `Don't break your ${streak}-day streak! 🔥`,
      body: `Finish today's check-in and update your open tasks before the day ends.${taskSuffix}`,
    };
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

function upsertSlot(schedule: ScheduledNotif[], entry: ScheduledNotif): void {
  const idx = schedule.findIndex(n => n.tag === entry.tag);
  if (idx >= 0) schedule[idx] = { ...schedule[idx], ...entry };
  else schedule.push(entry);
}

let processingLock = false;

/** Build / merge today's schedule (smart + custom) without firing */
export function rebuildDailySchedule(profileId: string): ScheduledNotif[] {
  const slots = getEffectiveSmartSlots(profileId);
  const schedule: ScheduledNotif[] = [];

  const addSmart = (key: keyof typeof SLOT_TAG_MAP, slot: SmartSlotConfig, title: string, body: string) => {
    if (!slot.enabled) return;
    upsertSlot(schedule, {
      tag: SLOT_TAG_MAP[key],
      title,
      body,
      atMs: toMs(slot.hour, slot.minute),
      kind: 'smart',
    });
  };

  addSmart('morning', slots.morning, 'Good morning! ☀️', 'Your tasks for today are ready.');
  addSmart('midday', slots.midday, 'Quick check-in 📋', 'Check in on your goal-linked tasks.');
  addSmart('evening', slots.evening, 'Evening summary 🎓', 'See how your progress went today.');
  addSmart('streakRisk', slots.streakRisk, 'Streak reminder 🔥', 'Protect your streak - finish today\'s check-in.');

  for (const r of parseCustomReminders(profileId)) {
    if (!r.enabled) continue;
    const [h, m] = r.time.split(':').map(Number);
    upsertSlot(schedule, {
      tag: `reminder-${r.id}`,
      title: `${r.label} ⏰`,
      body: `Time for your ${r.label.toLowerCase()} - stay on track with your goals.`,
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
  sendBrowser?: boolean;
  sendEmail?: boolean;
}

/** Check schedule, fire due nudges with dedup - call every 60s + on visibility */
export async function processDueNudges({
  profile,
  swReg,
  sendBrowser = true,
  sendEmail = true,
}: ProcessNudgesOptions): Promise<void> {
  if (processingLock) return;

  const browserOk = sendBrowser
    && areNotificationsEnabled()
    && 'Notification' in window
    && Notification.permission === 'granted';

  const emailCfg = getEmailSettings();
  const hasEmail = !!getProfileEmail(profile.id);
  const emailOk = sendEmail
    && emailCfg.enabled
    && emailCfg.smartNudgeEnabled
    && emailCfg.triggerMode !== 'manual'
    && isProfileEmailEnabled(profile.id)
    && hasEmail;

  if (!browserOk && !emailOk) return;

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

      // Match server guards: evening/streak never fire in the morning local hours.
      const localHour = new Date().getHours();
      if (
        (notif.tag === 'daily-evening' || notif.tag === 'daily-streak-risk')
        && localHour < 16
      ) {
        continue;
      }
      if (notif.tag === 'daily-morning' && localHour >= 12) {
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

      if (browserOk) {
        await showNotification(swReg, title, body, notif.tag);
        trackEvent(profile.id, 'notif_sent', { tag: notif.tag });
        saveDeviceRecord(profile.id, { lastNotifSent: Date.now() });
      }

      if (emailOk) {
        requestEmailSend({
          profileId: profile.id,
          type: 'smart_nudge',
          tag: notif.tag,
          date: ctx.today,
          profileName: profile.name,
          title,
          body,
          pendingCount: ctx.pending,
          streak: ctx.streak,
          topTasks: ctx.topTasks,
          recipient: getProfileEmail(profile.id) || undefined,
        });
      }

      if (browserOk || emailOk) {
        markNudgeFiredToday(profile.id, notif.tag);
        markScheduleFired(profile.id, notif.tag);
      }
    }
  } finally {
    processingLock = false;
  }
}
