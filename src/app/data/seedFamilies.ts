/**
 * Canonical seed-family registry and durable hide-family tombstones.
 * Family identity is NEVER derived from labels.
 */

export type SeedFamilyId = string;

/** Explicit family → member task IDs (day siblings of the same seeded habit). */
export const SEED_FAMILY_MEMBERS: Record<SeedFamilyId, readonly string[]> = {
  // Favio recurring habits
  'fav-protein-breakfast': [
    'fav-mon-1', 'fav-tue-1', 'fav-wed-1', 'fav-thu-1', 'fav-fri-1', 'fav-sat-1', 'fav-sun-1',
  ],
  'fav-hydration': [
    'fav-mon-2', 'fav-tue-2', 'fav-wed-2', 'fav-thu-2', 'fav-fri-2', 'fav-sat-2', 'fav-sun-2',
  ],
  'fav-protein-lunch': [
    'fav-mon-3', 'fav-tue-3', 'fav-wed-3', 'fav-thu-3', 'fav-fri-3', 'fav-sat-3', 'fav-sun-4',
  ],
  'fav-protein-dinner': [
    'fav-mon-4', 'fav-tue-4', 'fav-wed-4', 'fav-thu-4', 'fav-fri-4', 'fav-sat-4', 'fav-sun-5',
  ],
  'fav-neck-reset': [
    'fav-mon-8', 'fav-tue-7', 'fav-wed-6', 'fav-thu-7', 'fav-fri-7', 'fav-sat-6', 'fav-sun-8',
  ],
  'fav-wife-intentional': [
    'fav-mon-9', 'fav-tue-9', 'fav-thu-9', 'fav-fri-9', 'fav-sat-8',
  ],
  'fav-wife-meaningful': [
    'fav-wed-7', 'fav-sun-10',
  ],
  'fav-no-intense-work': [
    'fav-mon-10', 'fav-tue-10', 'fav-wed-9', 'fav-thu-10', 'fav-fri-10', 'fav-sun-11',
  ],
  'fav-reading-bed': [
    'fav-mon-11', 'fav-tue-11', 'fav-thu-11', 'fav-sun-12',
  ],
  'fav-log-sleep': [
    'fav-mon-12', 'fav-tue-12', 'fav-wed-10', 'fav-thu-12', 'fav-fri-11', 'fav-sat-9', 'fav-sun-13',
  ],
  'fav-walk': [
    'fav-mon-7', 'fav-sun-6',
  ],
  // Roi recurring (explicit IDs only — never label-matched)
  'roi-walk': ['roi-mon-4', 'roi-wed-4', 'roi-fri-3'],
  'roi-hydrate': [
    'roi-mon-5', 'roi-tue-7', 'roi-wed-5', 'roi-thu-6', 'roi-fri-5', 'roi-sun-5',
  ],
};

const TASK_TO_FAMILY: Record<string, SeedFamilyId> = (() => {
  const map: Record<string, SeedFamilyId> = {};
  for (const [familyId, members] of Object.entries(SEED_FAMILY_MEMBERS)) {
    for (const id of members) map[id] = familyId;
  }
  return map;
})();

export function getSeedFamilyIdForTaskId(taskId: string): SeedFamilyId | null {
  return TASK_TO_FAMILY[taskId] ?? null;
}

export function listSeedTaskIdsInFamily(familyId: SeedFamilyId): string[] {
  return [...(SEED_FAMILY_MEMBERS[familyId] ?? [])];
}

export function hiddenSeedFamilyStorageKey(profileId: string) {
  return `arbol-hidden-seed-families-${profileId}`;
}

export function seedFamilyBackfillMarkerKey(profileId: string) {
  return `arbol-seed-family-backfill-v1-${profileId}`;
}

export function readHiddenSeedFamilyIds(profileId: string): Set<string> {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(hiddenSeedFamilyStorageKey(profileId)) || '[]') as string[],
    );
  } catch {
    return new Set();
  }
}

export function writeHiddenSeedFamilyIds(profileId: string, ids: Set<string> | string[]) {
  localStorage.setItem(
    hiddenSeedFamilyStorageKey(profileId),
    JSON.stringify([...ids]),
  );
}

export function unionIdArrays(a: unknown, b: unknown): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (!Array.isArray(v)) return;
    for (const x of v) {
      if (typeof x === 'string' && x.trim()) out.add(x.trim());
    }
  };
  add(a);
  add(b);
  return [...out];
}

export function hiddenSeedTaskStorageKey(profileId: string) {
  return `arbol-hidden-seed-${profileId}`;
}

export function readHiddenSeedTaskIds(profileId: string): Set<string> {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(hiddenSeedTaskStorageKey(profileId)) || '[]') as string[],
    );
  } catch {
    return new Set();
  }
}

export function writeHiddenSeedTaskIds(profileId: string, ids: Set<string> | string[]) {
  localStorage.setItem(hiddenSeedTaskStorageKey(profileId), JSON.stringify([...ids]));
}

/** True if task ID or its known family is tombstoned. */
export function isSeedHiddenByTombstones(profileId: string, taskId: string): boolean {
  const hiddenIds = readHiddenSeedTaskIds(profileId);
  if (hiddenIds.has(taskId)) return true;
  const familyId = getSeedFamilyIdForTaskId(taskId);
  return !!(familyId && readHiddenSeedFamilyIds(profileId).has(familyId));
}

/**
 * Write hide-ID and/or hide-family tombstones. Does not purge history or sync.
 * @returns familyId when a family was tombstoned.
 */
export function applySeedHideTombstones(profileId: string, taskId: string): string | null {
  const hidden = readHiddenSeedTaskIds(profileId);
  const familyId = getSeedFamilyIdForTaskId(taskId);

  if (familyId) {
    const families = readHiddenSeedFamilyIds(profileId);
    families.add(familyId);
    writeHiddenSeedFamilyIds(profileId, families);
    for (const memberId of listSeedTaskIdsInFamily(familyId)) {
      hidden.add(memberId);
    }
  } else {
    hidden.add(taskId);
  }

  writeHiddenSeedTaskIds(profileId, hidden);
  return familyId;
}

/**
 * One-shot: convert known hidden task IDs into family tombstones.
 * Idempotent via marker key.
 * @returns true if this call performed the backfill pass (marker was unset).
 */
export function runSeedFamilyBackfillCore(profileId: string): boolean {
  const marker = seedFamilyBackfillMarkerKey(profileId);
  if (localStorage.getItem(marker) === '1') return false;

  const hidden = readHiddenSeedTaskIds(profileId);
  const families = readHiddenSeedFamilyIds(profileId);
  let familyChanged = false;
  let idChanged = false;

  for (const taskId of [...hidden]) {
    const familyId = getSeedFamilyIdForTaskId(taskId);
    if (!familyId) continue;
    if (!families.has(familyId)) {
      families.add(familyId);
      familyChanged = true;
    }
    for (const memberId of listSeedTaskIdsInFamily(familyId)) {
      if (!hidden.has(memberId)) {
        hidden.add(memberId);
        idChanged = true;
      }
    }
  }

  if (familyChanged) writeHiddenSeedFamilyIds(profileId, families);
  if (idChanged) writeHiddenSeedTaskIds(profileId, hidden);
  localStorage.setItem(marker, '1');
  return true;
}
