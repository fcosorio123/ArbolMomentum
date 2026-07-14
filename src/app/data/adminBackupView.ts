/**
 * Admin views of student activity computed from KV profile backup —
 * same SoT students sync — not from the admin browser's localStorage.
 */

import {
  getTaskCategoriesForProfile,
  getDateKeyForTzOffset,
  type TaskStatus,
  type TaskType,
} from './profiles';
import { isTaskScheduledForDate, type UserTask } from './userTasks';
import type { PersonalGoal } from './personalGoals';
import {
  type DayStats,
  type TodayTaskRow,
  type RemoteDayOverlay,
  type TaskDisposition,
} from './dashboardSnapshot';

function mapGet(map: unknown, key: string): string | undefined {
  if (!map || typeof map !== 'object') return undefined;
  const v = (map as Record<string, string>)[key];
  return typeof v === 'string' ? v : undefined;
}

function parseStatus(raw: string | undefined): TaskStatus | null {
  if (raw === 'done' || raw === 'inprogress' || raw === 'skipped') return raw;
  return null;
}

function rowDisposition(status: TaskStatus | null): TaskDisposition {
  if (status === 'skipped') return 'skipped';
  return 'active';
}

function applyOverlay(rows: TodayTaskRow[], overlay?: RemoteDayOverlay): TodayTaskRow[] {
  if (!overlay) return rows;
  return rows
    .filter(row => !overlay.permanentlyRemovedIds?.has(row.id))
    .map(row => {
      if (overlay.skippedIds?.has(row.id)) {
        return { ...row, status: 'skipped' as const, disposition: 'skipped' as const };
      }
      const remote = overlay.completions?.get(row.id);
      if (remote) {
        return { ...row, status: remote, disposition: 'active' as const };
      }
      // When backup is SoT, do not fall back to admin-local status for missing remote —
      // keep backup status already on the row.
      return row;
    });
}

function statsFromRows(rows: TodayTaskRow[]): DayStats {
  const countable = rows.filter(r => r.disposition === 'active');
  const done = countable.filter(r => r.status === 'done').length;
  const inprogress = countable.filter(r => r.status === 'inprogress').length;
  const notStarted = countable.filter(r => r.status === null).length;
  const skipped = rows.filter(r => r.disposition === 'skipped').length;
  const removed = rows.filter(r => r.disposition === 'removed').length;
  const total = countable.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return {
    done,
    inprogress,
    inprog: inprogress,
    notStarted,
    skipped,
    removed,
    deleted: removed,
    total,
    pct,
  };
}

function hiddenSeedSet(backup: Record<string, unknown>): Set<string> {
  const raw = backup.permanentlyHiddenSeedTasks;
  if (Array.isArray(raw)) return new Set(raw.map(String));
  return new Set();
}

function userTasksFromBackup(profileId: string, backup: Record<string, unknown>): UserTask[] {
  const raw = backup.userTasks;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is UserTask =>
      !!t && typeof t === 'object' && typeof (t as UserTask).id === 'string' && !(t as UserTask).archivedAt,
  ).map(t => ({ ...t, profileId: t.profileId || profileId }));
}

function statusFromBackup(
  backup: Record<string, unknown>,
  profileId: string,
  taskId: string,
  dateKey: string,
): TaskStatus | null {
  return parseStatus(mapGet(backup.taskStatuses, `task-${profileId}-${taskId}-${dateKey}`));
}

function hasActivityOnDateFromBackup(
  backup: Record<string, unknown>,
  profileId: string,
  dateKey: string,
): boolean {
  if (mapGet(backup.streakDays, `streak-${profileId}-${dateKey}`) === 'true') return true;
  const statuses = backup.taskStatuses;
  if (!statuses || typeof statuses !== 'object') return false;
  const prefix = `task-${profileId}-`;
  const suffix = `-${dateKey}`;
  for (const [k, v] of Object.entries(statuses as Record<string, string>)) {
    if (k.startsWith(prefix) && k.endsWith(suffix) && v === 'done') return true;
  }
  return false;
}

export function computeLiveStreakFromBackup(
  backup: Record<string, unknown>,
  profileId: string,
): number {
  const offset = typeof backup.tzOffset === 'number'
    ? backup.tzOffset
    : new Date().getTimezoneOffset();
  const todayKey = getDateKeyForTzOffset(new Date(), offset);
  const todayDone = hasActivityOnDateFromBackup(backup, profileId, todayKey);

  if (todayDone) {
    let count = 1;
    for (let i = 1; i <= 365; i++) {
      const key = getDateKeyForTzOffset(new Date(Date.now() - i * 86_400_000), offset);
      if (hasActivityOnDateFromBackup(backup, profileId, key)) count++;
      else break;
    }
    return count;
  }

  let count = 0;
  for (let i = 1; i <= 365; i++) {
    const key = getDateKeyForTzOffset(new Date(Date.now() - i * 86_400_000), offset);
    if (hasActivityOnDateFromBackup(backup, profileId, key)) count++;
    else break;
  }
  return count;
}

export function isCheckInCompleteFromBackup(
  backup: Record<string, unknown>,
  profileId: string,
  dateKey: string,
): boolean {
  return mapGet(backup.checkInDays, `arbol-checkin-${profileId}-${dateKey}`) === 'true';
}

export function goalsFromBackup(backup: Record<string, unknown> | null): PersonalGoal[] {
  if (!backup || !Array.isArray(backup.personalGoals)) return [];
  return backup.personalGoals as PersonalGoal[];
}

/** Build today's task rows from seed catalog + backup userTasks + backup statuses. */
export function getTaskRowsFromBackup(
  profileId: string,
  backup: Record<string, unknown>,
  dateKey: string,
): TodayTaskRow[] {
  const hidden = hiddenSeedSet(backup);
  const converted = new Set(
    userTasksFromBackup(profileId, backup)
      .map(u => u.sourceSeedTaskId)
      .filter((id): id is string => !!id),
  );
  const rows: TodayTaskRow[] = [];
  const seen = new Set<string>();

  for (const cat of getTaskCategoriesForProfile(profileId)) {
    for (const task of cat.tasks) {
      if (hidden.has(task.id) || converted.has(task.id)) continue;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      const status = statusFromBackup(backup, profileId, task.id, dateKey);
      rows.push({
        id: task.id,
        label: task.label,
        timeOfDay: task.timeOfDay,
        type: task.type as TaskType,
        category: task.category,
        goalId: cat.goalId,
        status,
        disposition: rowDisposition(status),
      });
    }
  }

  for (const ut of userTasksFromBackup(profileId, backup)) {
    if (!isTaskScheduledForDate(ut, dateKey)) continue;
    if (seen.has(ut.id)) continue;
    seen.add(ut.id);
    const status = statusFromBackup(backup, profileId, ut.id, dateKey);
    rows.push({
      id: ut.id,
      label: ut.label,
      timeOfDay: ut.timeOfDay,
      type: ut.type as TaskType,
      category: 'user',
      goalId: ut.goalId,
      status,
      disposition: rowDisposition(status),
    });
  }

  return rows;
}

export interface AdminBackupDayView {
  dayStats: DayStats;
  liveStreak: number;
  checkedIn: boolean;
  goals: PersonalGoal[];
  hasBackup: boolean;
  savedAt: number | null;
}

/**
 * Prefer backup as SoT. Optional SQL overlay replaces statuses when present
 * (write-through validation), without using admin-local storage.
 */
export function computeAdminViewFromBackup(
  profileId: string,
  backup: Record<string, unknown> | null,
  dateKey: string,
  overlay?: RemoteDayOverlay,
): AdminBackupDayView {
  if (!backup) {
    return {
      dayStats: {
        done: 0, inprogress: 0, inprog: 0, notStarted: 0,
        skipped: 0, removed: 0, deleted: 0, total: 0, pct: 0,
      },
      liveStreak: 0,
      checkedIn: false,
      goals: [],
      hasBackup: false,
      savedAt: null,
    };
  }

  let rows = getTaskRowsFromBackup(profileId, backup, dateKey);
  rows = applyOverlay(rows, overlay);
  rows = rows.filter(r => r.disposition !== 'removed');

  // Prefer profile timezone today for check-in display when dateKey is "today" locally —
  // callers pass an explicit dateKey for week cells.
  const offset = typeof backup.tzOffset === 'number'
    ? backup.tzOffset
    : new Date().getTimezoneOffset();
  const profileToday = getDateKeyForTzOffset(new Date(), offset);
  const checkDate = dateKey;

  return {
    dayStats: statsFromRows(rows),
    liveStreak: computeLiveStreakFromBackup(backup, profileId),
    checkedIn: isCheckInCompleteFromBackup(backup, profileId, checkDate === profileToday ? profileToday : dateKey),
    goals: goalsFromBackup(backup),
    hasBackup: true,
    savedAt: typeof backup.savedAt === 'number' ? backup.savedAt : null,
  };
}
