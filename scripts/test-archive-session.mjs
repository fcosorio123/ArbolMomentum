/**
 * Profile archive session hygiene tests (WP-15).
 * Run: node scripts/test-archive-session.mjs
 */
import assert from 'node:assert/strict';

const ARCHIVED_KEY = 'arbol-archived-profiles';
const ACTIVE_KEY = 'arbol-active-profile';
const UNLOCK_KEY = 'arbol-selector-unlocked';

function getArchivedIds(store) {
  try {
    return new Set(JSON.parse(store.get(ARCHIVED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function setProfileArchived(store, profileId, archived) {
  const ids = getArchivedIds(store);
  if (archived) ids.add(profileId);
  else ids.delete(profileId);
  store.set(ARCHIVED_KEY, JSON.stringify([...ids]));

  let clearedActiveSession = false;
  if (archived && store.get(ACTIVE_KEY) === profileId) {
    store.delete(ACTIVE_KEY);
    store.delete(UNLOCK_KEY);
    clearedActiveSession = true;
  }
  return { clearedActiveSession };
}

function getActiveProfiles(store, allProfiles, includeArchived = false) {
  const archived = getArchivedIds(store);
  if (includeArchived) return allProfiles;
  return allProfiles.filter(p => !archived.has(p.id));
}

class MemoryStore {
  constructor() { this.data = new Map(); }
  get(k) { return this.data.get(k) ?? null; }
  set(k, v) { this.data.set(k, v); }
  delete(k) { this.data.delete(k); }
}

const profiles = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
];

const store = new MemoryStore();
store.set(ACTIVE_KEY, 'alice');

const result = setProfileArchived(store, 'alice', true);
assert.equal(result.clearedActiveSession, true, 'archiving active profile clears session');
assert.equal(store.get(ACTIVE_KEY), null, 'active profile key removed');
assert.ok(getArchivedIds(store).has('alice'), 'profile marked archived');

const visible = getActiveProfiles(store, profiles, false);
assert.equal(visible.length, 1, 'archived profile hidden from active list');
assert.equal(visible[0].id, 'bob');

const all = getActiveProfiles(store, profiles, true);
assert.equal(all.length, 2, 'includeArchived returns all profiles');

// Restore does not affect session
store.set(ACTIVE_KEY, 'bob');
setProfileArchived(store, 'alice', false);
assert.equal(store.get(ACTIVE_KEY), 'bob', 'restore keeps other active session');

console.log('archive session tests: all passed');
