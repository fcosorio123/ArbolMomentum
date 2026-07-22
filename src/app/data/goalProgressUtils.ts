import {
  getTaskStatus, getTodayKey, type TaskStatus,
} from './profiles';
import { getPersonalGoals, logGoalProgress, isMonetaryGoal, type PersonalGoal } from './personalGoals';
import {
  getGoalTaskBreakdown,
  findFirstIncompleteTaskForGoal,
  type GoalTaskBreakdown,
} from './goalTaskResolution';
import { applyTaskStatusUpdate } from './taskStatusPipeline';
import { accentColorForId } from './colors';

export type { GoalTaskBreakdown };
export { getGoalTaskBreakdown };

export function getGoalAccentColor(goalId: string): string {
  return accentColorForId(goalId);
}

export function getGoalProgressPercent(profileId: string, goal: PersonalGoal, dateKey = getTodayKey()): number {
  const breakdown = getGoalTaskBreakdown(profileId, goal.id, dateKey);
  if (breakdown.total > 0) {
    return Math.round((breakdown.done / breakdown.total) * 100);
  }
  if (isMonetaryGoal(goal) && goal.targetValue > 0) {
    return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  }
  return 0;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Monday through today (local calendar), inclusive. */
export function getWeekDateKeysThroughToday(todayKey = getTodayKey()): string[] {
  const [y, m, d] = todayKey.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const dow = today.getDay(); // Sun=0
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(y, m - 1, d + mondayOffset + i);
    const key = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    if (key > todayKey) break;
    keys.push(key);
  }
  return keys;
}

/**
 * Week-to-date goal progress: sum of done/total for linked tasks Mon→today.
 * Falls back to monetary % when a goal has no linked tasks this week.
 */
export function getGoalWeekProgressPercent(
  profileId: string,
  goal: PersonalGoal,
  todayKey = getTodayKey(),
): number {
  let done = 0;
  let total = 0;
  for (const dk of getWeekDateKeysThroughToday(todayKey)) {
    const b = getGoalTaskBreakdown(profileId, goal.id, dk);
    done += b.done;
    total += b.total;
  }
  if (total > 0) return Math.round((done / total) * 100);
  if (isMonetaryGoal(goal) && goal.targetValue > 0) {
    return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  }
  return 0;
}

export function getGoalWeekBreakdown(
  profileId: string,
  goalId: string,
  todayKey = getTodayKey(),
): GoalTaskBreakdown {
  const tallies = { done: 0, inprogress: 0, notStarted: 0 };
  for (const dk of getWeekDateKeysThroughToday(todayKey)) {
    const b = getGoalTaskBreakdown(profileId, goalId, dk);
    tallies.done += b.done;
    tallies.inprogress += b.inprogress;
    tallies.notStarted += b.notStarted;
  }
  return {
    ...tallies,
    total: tallies.done + tallies.inprogress + tallies.notStarted,
  };
}

export function getGoalEmoji(goal: PersonalGoal): string {
  const text = `${goal.title} ${goal.deepWhy ?? ''}`.toLowerCase();
  if (/sleep|rest|recover/.test(text)) return '😴';
  if (/eat|food|diet|nutrition|meal/.test(text)) return '🥗';
  if (/move|exercise|workout|walk|run|gym|fit/.test(text)) return '💪';
  if (/save|money|budget|fund|financial/.test(text)) return '💰';
  if (/learn|study|read|skill/.test(text)) return '📚';
  if (/art|paint|creative|design/.test(text)) return '🎨';
  return '🎯';
}

/** Swipe check-in: complete next task or log a daily progress entry. */
export function quickCheckInGoal(profileId: string, goalId: string): { ok: boolean; detail?: string } {
  const today = getTodayKey();
  const task = findFirstIncompleteTaskForGoal(profileId, goalId, today);
  if (task) {
    applyTaskStatusUpdate({
      profileId,
      taskId: task.id,
      status: 'done',
      source: 'quick_checkin',
      taskLabel: task.label,
      dateKey: today,
    });
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
    return { ok: true, detail: task.label };
  }

  const goals = getPersonalGoals(profileId);
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return { ok: false };

  const swipeKey = `arbol-dashboard-swipe-${profileId}-${goalId}-${today}`;
  if (localStorage.getItem(swipeKey) === 'true') {
    return { ok: false };
  }
  localStorage.setItem(swipeKey, 'true');

  logGoalProgress({
    goalId,
    profileId,
    timestamp: Date.now(),
    taskCompleted: 'Daily check-in from dashboard',
    notes: 'Quick progress swipe',
  });

  return { ok: true, detail: 'Daily check-in logged' };
}
