import {
  type TaskType, type TaskStatus,
  getTaskCategoriesForProfile, getTaskStatus, isTaskActiveForDate,
  getTodayKey, computeLiveStreak, getPermanentlyHiddenSeedTaskIds,
} from './profiles';
import { getPersonalGoals, type PersonalGoal } from './personalGoals';
import { getUserTasks, isTaskScheduledForDate, type UserTask } from './userTasks';

export const DASHBOARD_REFRESH_EVENT = 'arbol-dashboard-refresh';
export const DAILY_CHECKIN_KEY = (profileId: string, dateKey: string) =>
  `arbol-checkin-${profileId}-${dateKey}`;

export function dispatchDashboardRefresh() {
  try { window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT)); } catch { /* ignore */ }
}

/** Daily check-in (reflection) is independent of task completion. */
export function isDailyCheckInComplete(profileId: string, dateKey = getTodayKey()): boolean {
  return localStorage.getItem(DAILY_CHECKIN_KEY(profileId, dateKey)) === 'true';
}

export type TaskDisposition = 'active' | 'skipped' | 'removed';

export interface TodayTaskRow {
  id: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  type: TaskType;
  category: string;
  goalId?: string;
  status: TaskStatus | null;
  disposition: TaskDisposition;
}

export type DashboardBannerState = 'red' | 'yellow' | 'green';

export interface GoalTaskGroup {
  goal: PersonalGoal;
  tasks: TodayTaskRow[];
}

export interface DashboardSnapshot {
  dateKey: string;
  personalGoals: PersonalGoal[];
  allTasks: TodayTaskRow[];
  countableTasks: TodayTaskRow[];
  doneCount: number;
  inProgressCount: number;
  notStartedCount: number;
  skippedCount: number;
  removedCount: number;
  totalCount: number;
  progressPercent: number;
  streak: number;
  checkedIn: boolean;
  bannerState: DashboardBannerState;
  checkInGoalTitles: string[];
  goalCount: number;
  goalTaskGroups: GoalTaskGroup[];
  ungroupedTasks: TodayTaskRow[];
}

function rowDisposition(status: TaskStatus | null, forceRemoved = false): TaskDisposition {
  if (forceRemoved) return 'removed';
  if (status === 'skipped') return 'skipped';
  return 'active';
}

function isScheduledUserTask(ut: UserTask, dateKey: string): boolean {
  return isTaskScheduledForDate(ut, dateKey) && isTaskActiveForDate(ut.profileId, ut.id, dateKey);
}

function toUserTaskRow(ut: UserTask, profileId: string, dateKey: string): TodayTaskRow {
  const status = getTaskStatus(profileId, ut.id, dateKey);
  return {
    id: ut.id,
    label: ut.label,
    timeOfDay: ut.timeOfDay,
    type: ut.type,
    category: 'user',
    goalId: ut.goalId,
    status,
    disposition: rowDisposition(status),
  };
}

/** Collect every task for today — active, skipped, and permanently removed. */
export function getTodayTaskRows(profileId: string, dateKey = getTodayKey()): TodayTaskRow[] {
  const categories = getTaskCategoriesForProfile(profileId);
  const userTasks = getUserTasks(profileId);
  const hiddenIds = getPermanentlyHiddenSeedTaskIds(profileId);
  const seen = new Set<string>();
  const rows: TodayTaskRow[] = [];

  for (const cat of categories) {
    for (const task of cat.tasks) {
      if (!isTaskActiveForDate(profileId, task.id, dateKey)) continue;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      const status = getTaskStatus(profileId, task.id, dateKey);
      rows.push({
        id: task.id,
        label: task.label,
        timeOfDay: task.timeOfDay,
        type: task.type,
        category: task.category,
        goalId: cat.goalId,
        status,
        disposition: rowDisposition(status),
      });
    }
  }

  for (const ut of userTasks) {
    if (!isScheduledUserTask(ut, dateKey)) continue;
    if (seen.has(ut.id)) continue;
    seen.add(ut.id);
    rows.push(toUserTaskRow(ut, profileId, dateKey));
  }

  if (hiddenIds.size > 0) {
    const rawCategories = getTaskCategoriesForProfile(profileId, undefined, true);
    for (const cat of rawCategories) {
      for (const task of cat.tasks) {
        if (!hiddenIds.has(task.id) || seen.has(task.id)) continue;
        seen.add(task.id);
        rows.push({
          id: task.id,
          label: task.label,
          timeOfDay: task.timeOfDay,
          type: task.type,
          category: task.category,
          goalId: cat.goalId,
          status: null,
          disposition: 'removed',
        });
      }
    }
  }

  return rows;
}

export function calculateBannerState(
  profileId: string,
  dateKey: string,
  doneCount: number,
  totalCount: number,
): { bannerState: DashboardBannerState; checkInGoalTitles: string[] } {
  const checkedIn = isDailyCheckInComplete(profileId, dateKey);

  if (!checkedIn) {
    const goals = getPersonalGoals(profileId);
    const cats = getTaskCategoriesForProfile(profileId);
    const uts = getUserTasks(profileId);
    const needingGoals = goals.filter(goal => {
      const seedTasks = cats.filter(c => c.goalId === goal.id).flatMap(c => c.tasks);
      const userTasksForGoal = uts.filter(ut => ut.goalId === goal.id && isTaskScheduledForDate(ut, dateKey));
      return [...seedTasks, ...userTasksForGoal].some(t => {
        if (!isTaskActiveForDate(profileId, t.id, dateKey)) return false;
        const st = getTaskStatus(profileId, t.id, dateKey);
        return st === null;
      });
    });
    return {
      bannerState: 'red',
      checkInGoalTitles: needingGoals.map(g => g.title),
    };
  }

  if (totalCount > 0 && doneCount < totalCount) {
    return { bannerState: 'yellow', checkInGoalTitles: [] };
  }

  return { bannerState: 'green', checkInGoalTitles: [] };
}

export function getDashboardSnapshot(profileId: string, dateKey = getTodayKey()): DashboardSnapshot {
  const personalGoals = getPersonalGoals(profileId);
  const allTasks = getTodayTaskRows(profileId, dateKey);
  const countableTasks = allTasks.filter(t => t.disposition === 'active');

  const doneCount = countableTasks.filter(t => t.status === 'done').length;
  const inProgressCount = countableTasks.filter(t => t.status === 'inprogress').length;
  const notStartedCount = countableTasks.filter(t => t.status === null).length;
  const skippedCount = allTasks.filter(t => t.disposition === 'skipped').length;
  const removedCount = allTasks.filter(t => t.disposition === 'removed').length;
  const totalCount = countableTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const streak = computeLiveStreak(profileId, progressPercent > 0);
  const checkedIn = isDailyCheckInComplete(profileId, dateKey);
  const { bannerState, checkInGoalTitles } = calculateBannerState(
    profileId, dateKey, doneCount, totalCount,
  );

  const goalTaskGroups: GoalTaskGroup[] = personalGoals
    .map(goal => ({
      goal,
      tasks: allTasks.filter(t => t.goalId === goal.id),
    }))
    .filter(g => g.tasks.length > 0);

  const linkedGoalIds = new Set(personalGoals.map(g => g.id));
  const ungroupedTasks = allTasks.filter(t => !t.goalId || !linkedGoalIds.has(t.goalId));

  return {
    dateKey,
    personalGoals,
    allTasks,
    countableTasks,
    doneCount,
    inProgressCount,
    notStartedCount,
    skippedCount,
    removedCount,
    totalCount,
    progressPercent,
    streak,
    checkedIn,
    bannerState,
    checkInGoalTitles,
    goalCount: personalGoals.length,
    goalTaskGroups,
    ungroupedTasks,
  };
}

/** Period-filtered counts for the streak card (morning / evening). */
export function getPeriodTaskCounts(profileId: string, dateKey = getTodayKey()) {
  const period: 'morning' | 'evening' = new Date().getHours() >= 17 ? 'evening' : 'morning';
  const rows = getTodayTaskRows(profileId, dateKey)
    .filter(t => t.disposition === 'active' && t.timeOfDay === period);
  const done = rows.filter(t => t.status === 'done').length;
  return { done, total: rows.length, period };
}

export function pickDoNowTask(profileId: string, dateKey = getTodayKey()): {
  id: string; label: string; timeOfDay: string; goalTitle?: string;
} | null {
  const hour = new Date().getHours();
  const preferredTime = hour >= 17 ? 'evening' : 'morning';
  const goals = getPersonalGoals(profileId);
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g.title]));
  const candidates = getTodayTaskRows(profileId, dateKey)
    .filter(t => t.disposition === 'active' && t.status !== 'done' && t.status !== 'skipped')
    .map(t => ({
      id: t.id,
      label: t.label,
      timeOfDay: t.timeOfDay,
      goalTitle: t.goalId ? goalMap[t.goalId] : undefined,
      status: t.status,
    }));

  return (
    candidates.find(t => t.status === 'inprogress' && t.timeOfDay === preferredTime) ??
    candidates.find(t => t.timeOfDay === preferredTime) ??
    candidates[0] ??
    null
  );
}
