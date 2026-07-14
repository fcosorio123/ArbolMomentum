import {
  getTaskCategoriesForProfile, getTaskStatus, isTaskActiveForDate,
} from './profiles';
import { getUserTasks, isTaskScheduledForDate } from './userTasks';
import { getPrimaryGoalIdForTask, getTaskGoalLinks, saveTaskGoalLinks } from './taskGoalLinks';

export type GoalTaskBreakdown = { done: number; inprogress: number; notStarted: number; total: number };

function countTaskStatus(
  profileId: string,
  taskId: string,
  dateKey: string,
  tallies: { done: number; inprogress: number; notStarted: number },
): void {
  if (!isTaskActiveForDate(profileId, taskId, dateKey)) return;
  const s = getTaskStatus(profileId, taskId, dateKey);
  if (s === 'skipped') return;
  if (s === 'done') tallies.done++;
  else if (s === 'inprogress') tallies.inprogress++;
  else tallies.notStarted++;
}

/** Single source of truth for goal ↔ task membership (user links override category defaults). */
export function getGoalTaskBreakdown(profileId: string, goalId: string, dateKey: string): GoalTaskBreakdown {
  const categories = getTaskCategoriesForProfile(profileId);
  const userTasks = getUserTasks(profileId);
  const tallies = { done: 0, inprogress: 0, notStarted: 0 };

  categories.forEach(cat => {
    cat.tasks.forEach(t => {
      const effectiveGoalId = getPrimaryGoalIdForTask(profileId, t.id, cat.goalId);
      if (effectiveGoalId !== goalId) return;
      countTaskStatus(profileId, t.id, dateKey, tallies);
    });
  });

  userTasks.forEach(ut => {
    if (ut.archivedAt) return;
    if (ut.goalId !== goalId) return;
    if (!isTaskScheduledForDate(ut, dateKey)) return;
    countTaskStatus(profileId, ut.id, dateKey, tallies);
  });

  return {
    ...tallies,
    total: tallies.done + tallies.inprogress + tallies.notStarted,
  };
}

export function getTasksForGoal(
  profileId: string,
  goalId: string,
  dateKey: string,
): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  const categories = getTaskCategoriesForProfile(profileId);

  categories.forEach(cat => {
    cat.tasks.forEach(t => {
      const effectiveGoalId = getPrimaryGoalIdForTask(profileId, t.id, cat.goalId);
      if (effectiveGoalId !== goalId) return;
      if (!isTaskActiveForDate(profileId, t.id, dateKey)) return;
      if (getTaskStatus(profileId, t.id, dateKey) === 'skipped') return;
      out.push({ id: t.id, label: t.label });
    });
  });

  getUserTasks(profileId).forEach(ut => {
    if (ut.archivedAt) return;
    if (ut.goalId !== goalId) return;
    if (!isTaskScheduledForDate(ut, dateKey)) return;
    if (!isTaskActiveForDate(profileId, ut.id, dateKey)) return;
    if (getTaskStatus(profileId, ut.id, dateKey) === 'skipped') return;
    out.push({ id: ut.id, label: ut.label });
  });

  return out;
}

export function findFirstIncompleteTaskForGoal(
  profileId: string,
  goalId: string,
  dateKey: string,
): { id: string; label: string } | null {
  for (const task of getTasksForGoal(profileId, goalId, dateKey)) {
    const s = getTaskStatus(profileId, task.id, dateKey);
    if (s !== 'done') return task;
  }
  return null;
}

export function clearTaskGoalLinksForGoal(profileId: string, goalId: string): void {
  const links = getTaskGoalLinks(profileId).filter(l => l.goalId !== goalId);
  saveTaskGoalLinks(profileId, links);
}
