import {
  type Profile, type Task, type TaskStatus, type TaskType,
  getTaskCategoriesForProfile, getTaskStatus, isTaskActiveForDate,
  getTodayKey, computeLiveStreak,
} from './profiles';
import { getPersonalGoals, type PersonalGoal } from './personalGoals';
import { getUserTasks, isTaskScheduledForDate, type UserTask } from './userTasks';

export const DASHBOARD_REFRESH_EVENT = 'arbol-dashboard-refresh';

export function dispatchDashboardRefresh() {
  try { window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT)); } catch { /* ignore */ }
}

export interface TodayTaskRow {
  id: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  type: TaskType;
  category: string;
  goalId?: string;
  status: TaskStatus | null;
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

function isScheduledUserTask(ut: UserTask, dateKey: string): boolean {
  return isTaskScheduledForDate(ut, dateKey) && isTaskActiveForDate(ut.profileId, ut.id, dateKey);
}

function toUserTaskRow(ut: UserTask, profileId: string, dateKey: string): TodayTaskRow {
  return {
    id: ut.id,
    label: ut.label,
    timeOfDay: ut.timeOfDay,
    type: ut.type,
    category: 'user',
    goalId: ut.goalId,
    status: getTaskStatus(profileId, ut.id, dateKey),
  };
}

/** Collect every task visible on the dashboard for a given day. */
export function getTodayTaskRows(profileId: string, dateKey = getTodayKey()): TodayTaskRow[] {
  const categories = getTaskCategoriesForProfile(profileId);
  const userTasks = getUserTasks(profileId);
  const seen = new Set<string>();
  const rows: TodayTaskRow[] = [];

  for (const cat of categories) {
    for (const task of cat.tasks) {
      if (!isTaskActiveForDate(profileId, task.id, dateKey)) continue;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      rows.push({
        id: task.id,
        label: task.label,
        timeOfDay: task.timeOfDay,
        type: task.type,
        category: task.category,
        goalId: cat.goalId,
        status: getTaskStatus(profileId, task.id, dateKey),
      });
    }
  }

  for (const ut of userTasks) {
    if (!isScheduledUserTask(ut, dateKey)) continue;
    if (seen.has(ut.id)) continue;
    seen.add(ut.id);
    rows.push(toUserTaskRow(ut, profileId, dateKey));
  }

  return rows;
}

export function calculateBannerState(
  profileId: string,
  dateKey: string,
  doneCount: number,
  totalCount: number,
): { bannerState: DashboardBannerState; checkInGoalTitles: string[] } {
  const checkedIn = localStorage.getItem(`arbol-checkin-${profileId}-${dateKey}`) === 'true';

  if (totalCount > 0 && doneCount >= totalCount) {
    return { bannerState: 'green', checkInGoalTitles: [] };
  }
  if (doneCount > 0 || checkedIn) {
    return { bannerState: 'yellow', checkInGoalTitles: [] };
  }

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

export function getDashboardSnapshot(profileId: string, dateKey = getTodayKey()): DashboardSnapshot {
  const personalGoals = getPersonalGoals(profileId);
  const categories = getTaskCategoriesForProfile(profileId);
  const allTasks = getTodayTaskRows(profileId, dateKey);
  const countableTasks = allTasks.filter(t => t.status !== 'skipped');

  const doneCount = countableTasks.filter(t => t.status === 'done').length;
  const inProgressCount = countableTasks.filter(t => t.status === 'inprogress').length;
  const notStartedCount = countableTasks.filter(t => t.status === null).length;
  const skippedCount = allTasks.filter(t => t.status === 'skipped').length;
  const totalCount = countableTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const streak = computeLiveStreak(profileId, progressPercent > 0);
  const checkedIn = localStorage.getItem(`arbol-checkin-${profileId}-${dateKey}`) === 'true';
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
  const rows = getTodayTaskRows(profileId, dateKey).filter(t => t.timeOfDay === period && t.status !== 'skipped');
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
    .filter(t => t.status !== 'done' && t.status !== 'skipped')
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
