/**
 * Pure Today-view focus selection (Zeigarnik Phase 1).
 * Ranking selects at most one emphasized task; it does not reorder lists.
 */

import type { TaskStatus, TaskType } from './profiles';
import type { PotentialValue } from './potentialValue';
import { pickTopRankedTask, type PrioritizedTask } from './taskPrioritization';

export type FocusLabel = 'active' | 'up_next';

export interface FocusCandidate {
  id: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  type: TaskType;
  goalId?: string;
  status: TaskStatus | null;
  potentialValue?: PotentialValue;
}

export interface FocusSelection {
  taskId: string;
  /** Display label: Active only when status is inprogress; otherwise Up next. */
  label: FocusLabel;
}

function toPrioritized(task: FocusCandidate): PrioritizedTask {
  return {
    id: task.id,
    label: task.label,
    timeOfDay: task.timeOfDay,
    type: task.type,
    goalId: task.goalId,
    status: task.status,
    potentialValue: task.potentialValue,
  };
}

/**
 * Select the single globally emphasized task for the current filtered Today view.
 * - If any eligible task is inprogress: emphasize the top-ranked among those; label Active.
 * - Else: emphasize the top-ranked open task; label Up next (never Active).
 * Does not mutate `candidates` and does not imply list reordering.
 */
export function selectFocusTask(
  candidates: FocusCandidate[],
  opts?: { preferredTimeOfDay?: 'morning' | 'evening'; hour?: number },
): FocusSelection | null {
  const inProgress = candidates.filter(t => t.status === 'inprogress');
  if (inProgress.length > 0) {
    const top = pickTopRankedTask(inProgress.map(toPrioritized), opts);
    if (!top) return null;
    return { taskId: top.id, label: 'active' };
  }

  const open = candidates.filter(t => t.status !== 'done' && t.status !== 'skipped');
  if (open.length === 0) return null;
  const top = pickTopRankedTask(open.map(toPrioritized), opts);
  if (!top) return null;
  return { taskId: top.id, label: 'up_next' };
}

/** Invariant helpers for tests / validation. */
export function focusLabelIsTruthful(
  selection: FocusSelection,
  status: TaskStatus | null,
): boolean {
  if (selection.label === 'active') return status === 'inprogress';
  return status !== 'inprogress';
}
