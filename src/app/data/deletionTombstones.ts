/**
 * Tombstones so deleted user goals/tasks stay deleted across cloud merge and republish.
 * "Longer array wins" merge previously resurrected removed items from older cloud snapshots.
 */

import { getStorageKey } from './environment';

function goalsKey(profileId: string) {
  return getStorageKey(`arbol-deleted-user-goals-${profileId}`);
}

function tasksKey(profileId: string) {
  return getStorageKey(`arbol-deleted-user-tasks-${profileId}`);
}

function readIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string' && x.length > 0));
  } catch {
    return new Set();
  }
}

function writeIds(key: string, ids: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function getDeletedUserGoalIds(profileId: string): Set<string> {
  return readIds(goalsKey(profileId));
}

export function getDeletedUserTaskIds(profileId: string): Set<string> {
  return readIds(tasksKey(profileId));
}

export function recordDeletedUserGoal(profileId: string, goalId: string): void {
  if (!goalId) return;
  const set = getDeletedUserGoalIds(profileId);
  set.add(goalId);
  writeIds(goalsKey(profileId), set);
}

export function recordDeletedUserTask(profileId: string, taskId: string): void {
  if (!taskId) return;
  const set = getDeletedUserTaskIds(profileId);
  set.add(taskId);
  writeIds(tasksKey(profileId), set);
}

/** Union cloud + local tombstone ID lists (more deletes always win). */
export function unionIdLists(a: unknown, b: unknown): string[] {
  const out = new Set<string>();
  for (const src of [a, b]) {
    if (!Array.isArray(src)) continue;
    for (const x of src) {
      if (typeof x === 'string' && x) out.add(x);
    }
  }
  return [...out];
}

export function filterGoalsByTombstones<T extends { id?: string }>(
  goals: T[] | null | undefined,
  deleted: Set<string> | string[],
): T[] {
  if (!Array.isArray(goals)) return [];
  const dead = deleted instanceof Set ? deleted : new Set(deleted);
  return goals.filter(g => g?.id && !dead.has(g.id));
}

export function filterTasksByTombstones<T extends { id?: string }>(
  tasks: T[] | null | undefined,
  deleted: Set<string> | string[],
): T[] {
  if (!Array.isArray(tasks)) return [];
  const dead = deleted instanceof Set ? deleted : new Set(deleted);
  return tasks.filter(t => t?.id && !dead.has(t.id));
}

export function readDeletedUserGoalsRaw(profileId: string): string[] {
  return [...getDeletedUserGoalIds(profileId)];
}

export function readDeletedUserTasksRaw(profileId: string): string[] {
  return [...getDeletedUserTaskIds(profileId)];
}

export function writeDeletedUserGoalsRaw(profileId: string, ids: unknown): void {
  writeIds(goalsKey(profileId), new Set(unionIdLists(ids, [])));
}

export function writeDeletedUserTasksRaw(profileId: string, ids: unknown): void {
  writeIds(tasksKey(profileId), new Set(unionIdLists(ids, [])));
}
