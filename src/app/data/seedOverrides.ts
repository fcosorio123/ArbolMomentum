/** Per-profile edits to seeded tasks (update-in-place; no convert-to-user-task). */

import type { Task, TaskType, TimeOfDay } from './profiles';
import { getAllTasksForProfile } from './profiles';
import type { Recurrence, UserTask } from './userTasks';
import type { PotentialValue } from './potentialValue';
import { normalizePotentialValue } from './potentialValue';
import { scheduleSave } from './cloudBackup';

export interface SeedTaskOverride {
  label?: string;
  timeOfDay?: TimeOfDay;
  type?: TaskType;
  description?: string;
  potentialValue?: PotentialValue;
  recurrence?: Recurrence;
}

function storageKey(profileId: string) {
  return `arbol-seed-overrides-${profileId}`;
}

export function getSeedOverrides(profileId: string): Record<string, SeedTaskOverride> {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(profileId)) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

export function getSeedOverride(profileId: string, seedTaskId: string): SeedTaskOverride | undefined {
  return getSeedOverrides(profileId)[seedTaskId];
}

function persist(profileId: string, map: Record<string, SeedTaskOverride>) {
  localStorage.setItem(storageKey(profileId), JSON.stringify(map));
  scheduleSave(profileId);
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch { /* ignore */ }
}

/** Merge patch into seed override; omit empty description. */
export function setSeedOverride(
  profileId: string,
  seedTaskId: string,
  patch: SeedTaskOverride,
): void {
  const map = { ...getSeedOverrides(profileId) };
  const prev = map[seedTaskId] ?? {};
  const next: SeedTaskOverride = { ...prev, ...patch };
  if (patch.potentialValue) {
    next.potentialValue = normalizePotentialValue(patch.potentialValue) ?? patch.potentialValue;
  }
  if (patch.description !== undefined && !patch.description.trim()) {
    delete next.description;
  }
  map[seedTaskId] = next;
  persist(profileId, map);
}

/**
 * Apply the same override to every weekday seed with the same original label.
 * Keeps All Tasks "one setup + frequency" rows consistent when editing.
 */
export function setSeedOverrideForSameLabel(
  profileId: string,
  seedTaskId: string,
  patch: SeedTaskOverride,
): void {
  const catalog = getAllTasksForProfile(profileId);
  const source = catalog.find(t => t.id === seedTaskId);
  const labelKey = (source?.label || '').trim().toLowerCase();
  const targets = labelKey
    ? catalog.filter(t => t.label.trim().toLowerCase() === labelKey).map(t => t.id)
    : [seedTaskId];

  const map = { ...getSeedOverrides(profileId) };
  for (const id of targets) {
    const prev = map[id] ?? {};
    const next: SeedTaskOverride = { ...prev, ...patch };
    if (patch.potentialValue) {
      next.potentialValue = normalizePotentialValue(patch.potentialValue) ?? patch.potentialValue;
    }
    if (patch.description !== undefined && !patch.description.trim()) {
      delete next.description;
    }
    map[id] = next;
  }
  persist(profileId, map);
}

export function clearSeedOverride(profileId: string, seedTaskId: string): void {
  const map = { ...getSeedOverrides(profileId) };
  if (!(seedTaskId in map)) return;
  delete map[seedTaskId];
  persist(profileId, map);
}

export type MergedSeedTask = Task & {
  description?: string;
  potentialValue?: PotentialValue;
  recurrence?: Recurrence;
};

/** Apply local override fields onto a seed task row. */
export function applySeedOverride(seed: Task, override?: SeedTaskOverride | null): MergedSeedTask {
  if (!override) return { ...seed };
  return {
    ...seed,
    label: override.label?.trim() || seed.label,
    timeOfDay: override.timeOfDay ?? seed.timeOfDay,
    type: override.type ?? seed.type,
    description: override.description,
    potentialValue: normalizePotentialValue(override.potentialValue) ?? override.potentialValue,
    recurrence: override.recurrence,
  };
}

export function mergeSeedForProfile(profileId: string, seed: Task): MergedSeedTask {
  return applySeedOverride(seed, getSeedOverride(profileId, seed.id));
}

/** Build a UserTask-shaped object for the manage modal from a merged seed. */
export function seedAsEditableUserTask(
  profileId: string,
  seed: MergedSeedTask,
  goalId?: string,
): UserTask {
  return {
    id: seed.id,
    profileId,
    label: seed.label,
    timeOfDay: seed.timeOfDay,
    type: seed.type,
    goalId,
    description: seed.description,
    potentialValue: seed.potentialValue,
    recurrence: seed.recurrence,
    createdAt: 0,
  };
}
