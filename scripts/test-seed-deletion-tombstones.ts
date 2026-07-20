/**
 * Seed deletion / family tombstone tests (Surgical UX P0).
 */
import assert from 'node:assert/strict';
import {
  getSeedFamilyIdForTaskId,
  listSeedTaskIdsInFamily,
  unionIdArrays,
  SEED_FAMILY_MEMBERS,
  seedFamilyBackfillMarkerKey,
  hiddenSeedFamilyStorageKey,
  hiddenSeedTaskStorageKey,
  applySeedHideTombstones,
  isSeedHiddenByTombstones,
  runSeedFamilyBackfillCore,
  readHiddenSeedFamilyIds,
  readHiddenSeedTaskIds,
} from '../src/app/data/seedFamilies.ts';

const store = new Map<string, string>();
(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

function resetProfile(profileId: string) {
  store.delete(hiddenSeedTaskStorageKey(profileId));
  store.delete(hiddenSeedFamilyStorageKey(profileId));
  store.delete(seedFamilyBackfillMarkerKey(profileId));
}

section('unionIdArrays survives empty / disjoint / shorter');
{
  assert.deepEqual(unionIdArrays(['a', 'b'], []), ['a', 'b']);
  assert.deepEqual(unionIdArrays([], ['a']), ['a']);
  assert.deepEqual(unionIdArrays(['a'], ['b']).sort(), ['a', 'b']);
  assert.deepEqual(unionIdArrays(['a', 'b'], ['b']).sort(), ['a', 'b']);
}

section('family registry: protein breakfast siblings share family');
{
  assert.equal(getSeedFamilyIdForTaskId('fav-mon-1'), 'fav-protein-breakfast');
  assert.equal(getSeedFamilyIdForTaskId('fav-tue-1'), 'fav-protein-breakfast');
  // Numeric slot is not a family key: Mon slot 5 ≠ Tue slot 5 conceptually
  assert.equal(getSeedFamilyIdForTaskId('fav-mon-5'), null);
  assert.equal(getSeedFamilyIdForTaskId('fav-tue-5'), null);
  assert.notEqual(
    getSeedFamilyIdForTaskId('fav-mon-2'),
    getSeedFamilyIdForTaskId('fav-mon-8'),
  );
}

section('family hide expands members + family tombstone; no purge of status keys');
{
  const profileId = 'test-seed-hide';
  resetProfile(profileId);
  const statusKey = `task-${profileId}-fav-mon-1-2026-07-20`;
  store.set(statusKey, 'done');
  applySeedHideTombstones(profileId, 'fav-mon-1');
  assert.ok(readHiddenSeedFamilyIds(profileId).has('fav-protein-breakfast'));
  for (const id of listSeedTaskIdsInFamily('fav-protein-breakfast')) {
    assert.ok(isSeedHiddenByTombstones(profileId, id), id);
  }
  assert.equal(store.get(statusKey), 'done', 'status history preserved');
  assert.ok(!isSeedHiddenByTombstones(profileId, 'fav-mon-2'), 'unrelated hydration visible');
}

section('one-off without family: ID tombstone only');
{
  const profileId = 'test-one-off';
  resetProfile(profileId);
  applySeedHideTombstones(profileId, 'fav-mon-5');
  assert.equal(getSeedFamilyIdForTaskId('fav-mon-5'), null);
  assert.ok(readHiddenSeedTaskIds(profileId).has('fav-mon-5'));
  assert.equal(readHiddenSeedFamilyIds(profileId).size, 0);
  assert.ok(!isSeedHiddenByTombstones(profileId, 'fav-tue-5'));
}

section('catalog churn: new member same family stays hidden via family tombstone');
{
  const profileId = 'test-churn';
  resetProfile(profileId);
  applySeedHideTombstones(profileId, 'fav-mon-1');
  store.set(hiddenSeedTaskStorageKey(profileId), JSON.stringify([]));
  assert.ok(readHiddenSeedFamilyIds(profileId).has('fav-protein-breakfast'));
  assert.ok(isSeedHiddenByTombstones(profileId, 'fav-wed-1'));
}

section('historical ID hide still works with empty family set');
{
  const profileId = 'test-hist-id';
  resetProfile(profileId);
  store.set(hiddenSeedTaskStorageKey(profileId), JSON.stringify(['fav-sat-7']));
  assert.ok(isSeedHiddenByTombstones(profileId, 'fav-sat-7'));
}

section('backfill maps hidden IDs → family; second call no-op');
{
  const profileId = 'test-backfill';
  resetProfile(profileId);
  store.set(hiddenSeedTaskStorageKey(profileId), JSON.stringify(['fav-mon-2', 'fav-tue-2']));
  assert.equal(runSeedFamilyBackfillCore(profileId), true);
  assert.ok(readHiddenSeedFamilyIds(profileId).has('fav-hydration'));
  assert.equal(store.get(seedFamilyBackfillMarkerKey(profileId)), '1');
  assert.equal(runSeedFamilyBackfillCore(profileId), false);
}

section('same label different families do not cross-hide via registry');
{
  assert.notEqual(
    getSeedFamilyIdForTaskId('fav-mon-9'),
    getSeedFamilyIdForTaskId('fav-wed-7'),
  );
  const profileId = 'test-wife';
  resetProfile(profileId);
  applySeedHideTombstones(profileId, 'fav-mon-9');
  assert.ok(isSeedHiddenByTombstones(profileId, 'fav-tue-9'));
  assert.ok(!isSeedHiddenByTombstones(profileId, 'fav-wed-7'));
}

section('SEED_FAMILY_MEMBERS entries are unique per family');
{
  for (const [fam, members] of Object.entries(SEED_FAMILY_MEMBERS)) {
    assert.equal(new Set(members).size, members.length, fam);
  }
}

console.log('\nAll seed deletion tombstone tests passed.\n');
