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
  // Eunice recurring day siblings (eu-* IDs). Missing these made Delete Forever
  // look like a no-op: one day hidden, same habit still visible on other days / All Tasks.
  'eu-walk-dog': [
    'eu-mon-1', 'eu-tue-1', 'eu-wed-1', 'eu-thu-1', 'eu-fri-1', 'eu-sat-1', 'eu-sun-1',
  ],
  'eu-stretch-10': [
    'eu-mon-2', 'eu-tue-2', 'eu-wed-2', 'eu-thu-2', 'eu-fri-2',
  ],
  'eu-stretch-meditate-15': [
    'eu-sat-2', 'eu-sun-2',
  ],
  'eu-strava-5k': [
    'eu-mon-3', 'eu-wed-3', 'eu-fri-3',
  ],
  'eu-cook-lunch': [
    'eu-mon-4', 'eu-tue-3', 'eu-wed-4', 'eu-thu-3', 'eu-fri-4',
  ],
  'eu-check-work': [
    'eu-mon-5', 'eu-tue-4', 'eu-wed-5', 'eu-thu-4', 'eu-fri-5',
  ],
  'eu-work-block': [
    'eu-mon-6', 'eu-tue-6', 'eu-wed-6', 'eu-thu-7', 'eu-fri-6',
  ],
  'eu-play-dog': [
    'eu-mon-7', 'eu-tue-7', 'eu-wed-7', 'eu-thu-8', 'eu-fri-7', 'eu-sat-7', 'eu-sun-7',
  ],
  'eu-cook-dinner': [
    'eu-mon-8', 'eu-tue-8', 'eu-wed-8', 'eu-thu-9', 'eu-fri-8',
  ],
  'eu-wind-down': [
    'eu-mon-9', 'eu-tue-9', 'eu-wed-9', 'eu-thu-10', 'eu-fri-9', 'eu-sun-8',
  ],
  'eu-paint-30': [
    'eu-tue-5', 'eu-thu-5',
  ],
  'eu-paint-long': [
    'eu-sat-3', 'eu-sun-4',
  ],
  'eu-meditate-10': ['eu-thu-6'],
  'eu-review-artwork': ['eu-sat-4'],
  'eu-discover-restaurant': ['eu-sat-5'],
  'eu-restaurant-note': ['eu-sat-6'],
  'eu-light-cleaning': ['eu-sat-8'],
  'eu-sunday-lunch': ['eu-sun-3'],
  'eu-explore-cafe': ['eu-sun-5'],
  'eu-plan-week': ['eu-sun-6'],
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
  // v2: re-run after Eunice (+ future) family registry expansions so prior
  // single-ID "Delete Forever" hides expand to full families.
  return `arbol-seed-family-backfill-v2-${profileId}`;
}

export function seedLabelExpandMarkerKey(profileId: string) {
  return `arbol-seed-label-expand-v1-${profileId}`;
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
 * @param extraSiblingIds optional exact-label day copies (when registry incomplete).
 * @returns familyId when a family was tombstoned.
 */
export function applySeedHideTombstones(
  profileId: string,
  taskId: string,
  extraSiblingIds: readonly string[] = [],
): string | null {
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

  for (const sib of extraSiblingIds) {
    if (sib) hidden.add(sib);
    // If a sibling belongs to a known family, tombstone that family too.
    const sibFamily = getSeedFamilyIdForTaskId(sib);
    if (sibFamily) {
      const families = readHiddenSeedFamilyIds(profileId);
      if (!families.has(sibFamily)) {
        families.add(sibFamily);
        writeHiddenSeedFamilyIds(profileId, families);
      }
      for (const memberId of listSeedTaskIdsInFamily(sibFamily)) {
        hidden.add(memberId);
      }
    }
  }

  writeHiddenSeedTaskIds(profileId, hidden);
  return familyId;
}

/**
 * Expand already-hidden IDs using an exact-label sibling map from the seed catalog.
 * Used once per profile after registry gaps (e.g. Eunice) so prior deletes stick.
 */
export function expandHiddenSeedIdsByExactLabel(
  profileId: string,
  catalog: ReadonlyArray<{ id: string; label: string }>,
): boolean {
  const marker = seedLabelExpandMarkerKey(profileId);
  if (localStorage.getItem(marker) === '1') return false;

  const hidden = readHiddenSeedTaskIds(profileId);
  const byLabel = new Map<string, string[]>();
  for (const t of catalog) {
    if (!t?.id || typeof t.label !== 'string') continue;
    const list = byLabel.get(t.label) ?? [];
    list.push(t.id);
    byLabel.set(t.label, list);
  }

  let idChanged = false;
  let familyChanged = false;
  const families = readHiddenSeedFamilyIds(profileId);

  for (const taskId of [...hidden]) {
    const entry = catalog.find(t => t.id === taskId);
    if (!entry) continue;
    for (const sibId of byLabel.get(entry.label) ?? []) {
      if (!hidden.has(sibId)) {
        hidden.add(sibId);
        idChanged = true;
      }
      const fam = getSeedFamilyIdForTaskId(sibId);
      if (fam && !families.has(fam)) {
        families.add(fam);
        familyChanged = true;
        for (const memberId of listSeedTaskIdsInFamily(fam)) {
          if (!hidden.has(memberId)) {
            hidden.add(memberId);
            idChanged = true;
          }
        }
      }
    }
  }

  if (familyChanged) writeHiddenSeedFamilyIds(profileId, families);
  if (idChanged) writeHiddenSeedTaskIds(profileId, hidden);
  localStorage.setItem(marker, '1');
  return idChanged || familyChanged;
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
