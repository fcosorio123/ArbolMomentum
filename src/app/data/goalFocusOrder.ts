/**
 * Today-only Zeigarnik Set A (goal tiers) and Set B (within-goal task order).
 * Pure helpers — no persistence.
 */

import type { TaskStatus, TaskType } from './profiles';
import { taskPriorityScore, preferredTimeOfDay, type PrioritizedTask } from './taskPrioritization';
import type { PotentialValue } from './potentialValue';

export type GoalTier =
  | 'active_focus'
  | 'up_next_focus'
  | 'unfinished'
  | 'done_only'
  | 'empty';

export interface HierarchyTask {
  id: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  type: TaskType;
  status: TaskStatus | null;
  potentialValue?: PotentialValue;
  originalIndex: number;
}

export interface HierarchyGoalInput {
  id: string;
  originalIndex: number;
  tasks: HierarchyTask[];
}

export interface OrderedGoalResult {
  goalId: string;
  tier: GoalTier;
  originalIndex: number;
  tasks: HierarchyTask[];
  hasUnfinished: boolean;
}

function toPrioritized(t: HierarchyTask): PrioritizedTask {
  return {
    id: t.id,
    label: t.label,
    timeOfDay: t.timeOfDay,
    type: t.type,
    status: t.status,
    potentialValue: t.potentialValue,
  };
}

function classifyGoalTier(
  goal: HierarchyGoalInput,
  focusTaskId: string | null,
  focusLabel: 'active' | 'up_next' | null,
): { tier: GoalTier; hasUnfinished: boolean } {
  const visible = goal.tasks;
  if (visible.length === 0) return { tier: 'empty', hasUnfinished: false };

  if (focusTaskId && focusLabel === 'active' && visible.some(t => t.id === focusTaskId)) {
    return { tier: 'active_focus', hasUnfinished: true };
  }
  if (focusTaskId && focusLabel === 'up_next' && visible.some(t => t.id === focusTaskId)) {
    return { tier: 'up_next_focus', hasUnfinished: true };
  }

  const actionable = visible.filter(t => t.status !== 'skipped');
  if (actionable.length === 0) return { tier: 'empty', hasUnfinished: false };

  const unfinished = actionable.some(t => t.status !== 'done');
  if (unfinished) return { tier: 'unfinished', hasUnfinished: true };

  return { tier: 'done_only', hasUnfinished: false };
}

const TIER_RANK: Record<GoalTier, number> = {
  active_focus: 0,
  up_next_focus: 1,
  unfinished: 2,
  done_only: 3,
  empty: 4,
};

function bestPriorityInGoal(tasks: HierarchyTask[], preferred: 'morning' | 'evening'): number {
  const open = tasks.filter(t => t.status !== 'done' && t.status !== 'skipped');
  if (open.length === 0) return 9999;
  return Math.min(...open.map(t => taskPriorityScore(toPrioritized(t), preferred)));
}

/** Set B: Active → Up next → unfinished → done → skipped; within tier priority then original index. */
export function orderTasksWithinGoal(
  tasks: HierarchyTask[],
  focusTaskId: string | null,
  focusLabel: 'active' | 'up_next' | null,
  opts?: { hour?: number },
): HierarchyTask[] {
  const preferred = preferredTimeOfDay(opts?.hour);
  const tierOf = (t: HierarchyTask): number => {
    if (focusTaskId && t.id === focusTaskId && focusLabel === 'active') return 0;
    if (focusTaskId && t.id === focusTaskId && focusLabel === 'up_next') return 1;
    if (t.status === 'skipped') return 4;
    if (t.status === 'done') return 3;
    return 2;
  };
  return tasks.slice().sort((a, b) => {
    const ta = tierOf(a);
    const tb = tierOf(b);
    if (ta !== tb) return ta - tb;
    const sa = taskPriorityScore(toPrioritized(a), preferred);
    const sb = taskPriorityScore(toPrioritized(b), preferred);
    if (sa !== sb) return sa - sb;
    return a.originalIndex - b.originalIndex;
  });
}

/** Set A + Set B. Returns ordered goals with ordered tasks. */
export function orderGoalsForToday(
  goals: HierarchyGoalInput[],
  focusTaskId: string | null,
  focusLabel: 'active' | 'up_next' | null,
  opts?: { hour?: number },
): OrderedGoalResult[] {
  const preferred = preferredTimeOfDay(opts?.hour);
  const classified = goals.map(g => {
    const { tier, hasUnfinished } = classifyGoalTier(g, focusTaskId, focusLabel);
    return {
      goalId: g.id,
      tier,
      originalIndex: g.originalIndex,
      hasUnfinished,
      tasks: orderTasksWithinGoal(g.tasks, focusTaskId, focusLabel, opts),
      _bestPri: bestPriorityInGoal(g.tasks, preferred),
    };
  });

  classified.sort((a, b) => {
    const tr = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tr !== 0) return tr;
    if (a._bestPri !== b._bestPri) return a._bestPri - b._bestPri;
    return a.originalIndex - b.originalIndex;
  });

  return classified.map(({ _bestPri, ...rest }) => rest);
}

/** First 1–2 goals that contain unfinished work (after Set A order). */
export function unfinishedGoalsToExpand(ordered: OrderedGoalResult[], max = 2): Set<string> {
  const ids = new Set<string>();
  for (const g of ordered) {
    if (!g.hasUnfinished) continue;
    ids.add(g.goalId);
    if (ids.size >= max) break;
  }
  return ids;
}
