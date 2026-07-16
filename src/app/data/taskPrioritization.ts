// Centralized task ranking (WP-11) - shared by Dashboard, nudge snapshot, live check-in.

import type { TaskStatus, TaskType } from './profiles';
import type { PotentialValue } from './potentialValue';
import { potentialValuePriorityBonus } from './potentialValue';

export interface PrioritizedTask {
  id: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  type: TaskType;
  goalId?: string;
  goalTitle?: string;
  status: TaskStatus | null;
  potentialValue?: PotentialValue;
}

export function preferredTimeOfDay(hour = new Date().getHours()): 'morning' | 'evening' {
  return hour >= 17 ? 'evening' : 'morning';
}

/** Lower score = higher priority. */
export function taskPriorityScore(
  task: PrioritizedTask,
  preferred: 'morning' | 'evening',
): number {
  if (task.status === 'done' || task.status === 'skipped') return 9999;
  let score = 0;
  if (task.status === 'inprogress') score -= 100;
  if (task.type === 'priority') score -= 50;
  else if (task.type === 'goal') score -= 25;
  if (task.timeOfDay === preferred) score -= 30;
  if (!task.status || task.status === 'notstarted') score -= 5;
  score -= potentialValuePriorityBonus(task.potentialValue);
  return score;
}

export function rankOpenTasks(
  tasks: PrioritizedTask[],
  opts?: { preferredTimeOfDay?: 'morning' | 'evening'; hour?: number },
): PrioritizedTask[] {
  const preferred = opts?.preferredTimeOfDay ?? preferredTimeOfDay(opts?.hour);
  return tasks
    .filter(t => t.status !== 'done' && t.status !== 'skipped')
    .slice()
    .sort((a, b) => taskPriorityScore(a, preferred) - taskPriorityScore(b, preferred));
}

export function pickTopRankedTask(
  tasks: PrioritizedTask[],
  opts?: { preferredTimeOfDay?: 'morning' | 'evening'; hour?: number },
): PrioritizedTask | null {
  return rankOpenTasks(tasks, opts)[0] ?? null;
}
