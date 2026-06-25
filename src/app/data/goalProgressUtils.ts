import {
  getTaskCategoriesForProfile, getTaskStatus, isTaskActiveForDate, getTodayKey, setTaskStatus,
} from './profiles';
import { getUserTasks, isTaskScheduledForDate } from './userTasks';
import { getPersonalGoals, logGoalProgress, isMonetaryGoal, type PersonalGoal } from './personalGoals';

const ACCENT_COLORS = ['#3da9fc', '#2cb67d', '#7c3aed', '#ef4565', '#f5a623', '#094067', '#e85d04', '#90b4ce'];

export function getGoalAccentColor(goalId: string): string {
  return ACCENT_COLORS[Math.abs(goalId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % ACCENT_COLORS.length];
}

export type GoalTaskBreakdown = { done: number; inprogress: number; notStarted: number; total: number };

export function getGoalTaskBreakdown(profileId: string, goalId: string, dateKey: string): GoalTaskBreakdown {
  const categories = getTaskCategoriesForProfile(profileId);
  const userTasks = getUserTasks(profileId);
  let done = 0, inprogress = 0, notStarted = 0;
  const count = (taskId: string) => {
    if (!isTaskActiveForDate(profileId, taskId, dateKey)) return;
    const s = getTaskStatus(profileId, taskId, dateKey);
    if (s === 'skipped') return;
    if (s === 'done') done++;
    else if (s === 'inprogress') inprogress++;
    else notStarted++;
  };
  categories.forEach(cat => {
    if (cat.goalId !== goalId) return;
    cat.tasks.forEach(t => count(t.id));
  });
  userTasks.forEach(ut => {
    if (ut.goalId !== goalId) return;
    if (!isTaskScheduledForDate(ut, dateKey)) return;
    count(ut.id);
  });
  return { done, inprogress, notStarted, total: done + inprogress + notStarted };
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

function findFirstIncompleteTask(profileId: string, goalId: string, dateKey: string): { id: string; label: string } | null {
  const categories = getTaskCategoriesForProfile(profileId);
  for (const cat of categories) {
    if (cat.goalId !== goalId) continue;
    for (const task of cat.tasks) {
      if (!isTaskActiveForDate(profileId, task.id, dateKey)) continue;
      if (getTaskStatus(profileId, task.id, dateKey) === 'skipped') continue;
      if (getTaskStatus(profileId, task.id, dateKey) !== 'done') {
        return { id: task.id, label: task.label };
      }
    }
  }
  const userTasks = getUserTasks(profileId).filter(
    ut => ut.goalId === goalId && isTaskScheduledForDate(ut, dateKey),
  );
  for (const ut of userTasks) {
    if (!isTaskActiveForDate(profileId, ut.id, dateKey)) continue;
    if (getTaskStatus(profileId, ut.id, dateKey) === 'skipped') continue;
    if (getTaskStatus(profileId, ut.id, dateKey) !== 'done') {
      return { id: ut.id, label: ut.label };
    }
  }
  return null;
}

/** Swipe check-in: complete next task or log a daily progress entry. */
export function quickCheckInGoal(profileId: string, goalId: string): { ok: boolean; detail?: string } {
  const today = getTodayKey();
  const task = findFirstIncompleteTask(profileId, goalId, today);
  if (task) {
    setTaskStatus(profileId, task.id, today, 'done');
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
