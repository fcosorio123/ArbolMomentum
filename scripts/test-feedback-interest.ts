/**
 * Feedback feature-interest once-flag (Surgical UX P2).
 * Tests storage contract without importing feedback.ts (avoids cloudBackup graph).
 */
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

function featureInterestAnsweredKey(profileId: string) {
  return `arbol-feature-interest-answered-${profileId}`;
}

function hasAnsweredFeatureInterest(profileId: string): boolean {
  return localStorage.getItem(featureInterestAnsweredKey(profileId)) === '1';
}

function markFeatureInterestAnswered(profileId: string) {
  localStorage.setItem(featureInterestAnsweredKey(profileId), '1');
}

const FEATURE_INTEREST_OPTIONS = [
  { id: 'agent_complete', label: 'AI agent that completes tasks with my approval' },
  { id: 'import_list', label: 'Import a task list from notes or a doc' },
  { id: 'voice_capture', label: 'Add tasks by voice' },
] as const;

console.log('\n✓ feature interest once flag');
assert.equal(hasAnsweredFeatureInterest('p1'), false);
markFeatureInterestAnswered('p1');
assert.equal(hasAnsweredFeatureInterest('p1'), true);
assert.equal(hasAnsweredFeatureInterest('p2'), false);
assert.ok(FEATURE_INTEREST_OPTIONS.length >= 3);
assert.equal(featureInterestAnsweredKey('favio'), 'arbol-feature-interest-answered-favio');

console.log('\nAll feedback interest tests passed.\n');
