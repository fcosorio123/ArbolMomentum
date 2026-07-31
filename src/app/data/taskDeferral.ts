/**
 * Intentional task deferral — NOT a task status.
 * Timestamped LWW records in localStorage + cloudBackup map.
 */

import {
  getSchedule,
  saveSchedule,
  type ScheduledNotif,
} from './deviceAnalytics';
import { getEngagementControls, isDeferralRemindersEnabled } from './engagementControls';
import { trackEngagementEvent, trackMeaningfulActionRollup } from './engagementEvents';

function bumpSave(profileId: string): void {
  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId)).catch(() => {});
}
export type DeferResumePreset =
  | 'later_today'
  | 'tomorrow'
  | 'weekend'
  | 'datetime'
  | 'unsure';

export type DeferReasonCode =
  | 'busy'
  | 'overwhelmed'
  | 'need_info'
  | 'need_help'
  | 'too_difficult'
  | 'waiting'
  | 'other';

export type DeferralStatus = 'active' | 'cancelled' | 'consumed' | 'superseded';

export interface TaskDeferral {
  taskId: string;
  profileId: string;
  deferredAt: number;
  updatedAt: number;
  resumeAt: number | null;
  resumePreset: DeferResumePreset;
  reason?: DeferReasonCode;
  reminderId?: string;
  deferCountInWindow: number;
  windowStartedAt: number;
  sourceNid?: string;
  status: DeferralStatus;
}

const MAP_KEY = (profileId: string) => `arbol-task-deferrals-${profileId}`;
const UPDATED_KEY = (profileId: string) => `arbol-task-deferrals-at-${profileId}`;

function readMap(profileId: string): Record<string, TaskDeferral> {
  try {
    const raw = localStorage.getItem(MAP_KEY(profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TaskDeferral>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(profileId: string, map: Record<string, TaskDeferral>): void {
  localStorage.setItem(MAP_KEY(profileId), JSON.stringify(map));
  localStorage.setItem(UPDATED_KEY(profileId), String(Date.now()));
  bumpSave(profileId);
}

export function getTaskDeferralsMap(profileId: string): Record<string, TaskDeferral> {
  return readMap(profileId);
}

export function getActiveDeferral(profileId: string, taskId: string): TaskDeferral | null {
  const d = readMap(profileId)[taskId];
  if (!d || d.status !== 'active') return null;
  return d;
}

export function computeResumeAt(preset: DeferResumePreset, datetimeMs?: number): number | null {
  const now = new Date();
  if (preset === 'unsure') return null;
  if (preset === 'datetime') return datetimeMs && datetimeMs > Date.now() ? datetimeMs : null;
  if (preset === 'later_today') {
    const d = new Date(now);
    d.setHours(Math.min(22, now.getHours() + 3), 0, 0, 0);
    if (d.getTime() <= now.getTime()) d.setHours(22, 0, 0, 0);
    return d.getTime();
  }
  if (preset === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  // weekend: next Saturday 10:00
  const d = new Date(now);
  const day = d.getDay(); // 0 Sun
  const add = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(10, 0, 0, 0);
  return d.getTime();
}

function cancelReminderInSchedule(profileId: string, reminderId: string | undefined): void {
  if (!reminderId) return;
  const sched = getSchedule(profileId).filter((n) => n.tag !== reminderId);
  saveSchedule(profileId, sched);
}

function scheduleDeferralReminder(
  profileId: string,
  taskId: string,
  resumeAt: number,
  taskLabel: string,
): string | undefined {
  const tag = `defer-${taskId}`;
  cancelReminderInSchedule(profileId, tag);
  if (!isDeferralRemindersEnabled(profileId)) return undefined;
  const notif: ScheduledNotif = {
    tag,
    title: 'Ready to continue?',
    body: `Pick up: ${taskLabel}`,
    atMs: resumeAt,
    kind: 'custom',
  };
  const sched = getSchedule(profileId).filter((n) => n.tag !== tag);
  sched.push(notif);
  saveSchedule(profileId, sched);
  return tag;
}

/** User-facing confirmation after a successful defer commit. */
export function getDeferralSuccessMessage(opts: {
  resumeAt: number | null;
  reminderScheduled: boolean;
}): string {
  if (opts.reminderScheduled) {
    return 'Task moved to later and reminder added.';
  }
  return 'Task moved to later.';
}

export function deferTask(opts: {
  profileId: string;
  taskId: string;
  taskLabel: string;
  resumePreset: DeferResumePreset;
  datetimeMs?: number;
  reason?: DeferReasonCode;
  sourceNid?: string;
}): TaskDeferral {
  const { profileId, taskId, taskLabel, resumePreset, datetimeMs, reason, sourceNid } = opts;
  const hyp = getEngagementControls().hypotheses;
  const map = readMap(profileId);
  const prev = map[taskId];
  const now = Date.now();
  const windowMs = hyp.deferralWindowDays * 24 * 60 * 60 * 1000;

  let windowStartedAt = now;
  let deferCountInWindow = 1;
  if (prev && prev.windowStartedAt && now - prev.windowStartedAt < windowMs) {
    windowStartedAt = prev.windowStartedAt;
    deferCountInWindow = (prev.deferCountInWindow || 0) + 1;
  }

  if (prev?.status === 'active') {
    map[taskId] = { ...prev, status: 'superseded', updatedAt: now };
  }

  const resumeAt = computeResumeAt(resumePreset, datetimeMs);
  if (!resumeAt) cancelReminderInSchedule(profileId, prev?.reminderId || `defer-${taskId}`);
  const reminderId = resumeAt
    ? scheduleDeferralReminder(profileId, taskId, resumeAt, taskLabel)
    : undefined;

  const record: TaskDeferral = {
    taskId,
    profileId,
    deferredAt: now,
    updatedAt: now,
    resumeAt,
    resumePreset,
    reason,
    reminderId,
    deferCountInWindow,
    windowStartedAt,
    sourceNid,
    status: 'active',
  };
  map[taskId] = record;
  writeMap(profileId, map);

  trackEngagementEvent(profileId, 'task_deferred', {
    taskId,
    resumePreset,
    nid: sourceNid,
    reasonCode: reason,
  }, { force: true });
  trackEngagementEvent(profileId, 'task_reminder_time_selected', {
    taskId,
    resumePreset,
    nid: sourceNid,
  }, { force: true });
  if (reason) {
    trackEngagementEvent(profileId, 'task_defer_reason_selected', {
      taskId,
      reasonCode: reason,
    }, { force: true });
  }
  trackMeaningfulActionRollup(profileId, 'recovery', 'defer_commit', { taskId, resumePreset });

  if (deferCountInWindow >= hyp.repeatedDeferralCount) {
    trackEngagementEvent(profileId, 'task_deferred_repeatedly', {
      taskId,
      kind: String(deferCountInWindow),
    }, { force: true });
  }

  return record;
}

export function cancelDeferral(profileId: string, taskId: string): void {
  const map = readMap(profileId);
  const d = map[taskId];
  if (!d || d.status !== 'active') return;
  cancelReminderInSchedule(profileId, d.reminderId);
  map[taskId] = { ...d, status: 'cancelled', updatedAt: Date.now() };
  writeMap(profileId, map);
  trackEngagementEvent(profileId, 'task_reminder_cancelled', { taskId }, { force: true });
}

/** Call when task is completed — clears active deferral without marking skipped. */
export function consumeDeferralOnComplete(profileId: string, taskId: string): void {
  const map = readMap(profileId);
  const d = map[taskId];
  if (!d || d.status !== 'active') return;
  cancelReminderInSchedule(profileId, d.reminderId);
  map[taskId] = { ...d, status: 'consumed', updatedAt: Date.now() };
  writeMap(profileId, map);
  trackEngagementEvent(profileId, 'task_completed_after_defer', { taskId }, { force: true });
  trackMeaningfulActionRollup(profileId, 'execution', 'task_done_after_defer', { taskId });
}

export function clearDeferralOnDeleteOrArchive(profileId: string, taskId: string): void {
  const map = readMap(profileId);
  const d = map[taskId];
  if (!d) return;
  cancelReminderInSchedule(profileId, d.reminderId);
  map[taskId] = { ...d, status: 'cancelled', updatedAt: Date.now() };
  writeMap(profileId, map);
}

/** LWW merge helper for cloudBackup. */
export function mergeDeferralMaps(
  local: Record<string, TaskDeferral>,
  cloud: Record<string, TaskDeferral>,
): Record<string, TaskDeferral> {
  const out: Record<string, TaskDeferral> = { ...local };
  for (const [id, c] of Object.entries(cloud || {})) {
    const l = out[id];
    if (!l || (c.updatedAt ?? 0) >= (l.updatedAt ?? 0)) {
      out[id] = c;
    }
  }
  return out;
}

export function exportDeferralsForBackup(profileId: string): Record<string, TaskDeferral> {
  return readMap(profileId);
}

export function restoreDeferralsFromBackup(
  profileId: string,
  cloud: unknown,
): boolean {
  if (!cloud || typeof cloud !== 'object') return false;
  const cloudMap = cloud as Record<string, TaskDeferral>;
  const merged = mergeDeferralMaps(readMap(profileId), cloudMap);
  const before = JSON.stringify(readMap(profileId));
  const after = JSON.stringify(merged);
  if (before === after) return false;
  localStorage.setItem(MAP_KEY(profileId), after);
  localStorage.setItem(UPDATED_KEY(profileId), String(Date.now()));
  return true;
}

export const DEFER_REASON_NEXT_ACTION: Record<DeferReasonCode, string> = {
  busy: 'reminder',
  overwhelmed: 'simplify',
  need_info: 'resources',
  need_help: 'support',
  too_difficult: 'simplify',
  waiting: 'blocked',
  other: 'none',
};
