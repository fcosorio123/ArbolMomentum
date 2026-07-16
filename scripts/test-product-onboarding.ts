/**
 * Product onboarding v2 — empty-state detection and profile-scoped persistence.
 * Run: npx tsx scripts/test-product-onboarding.ts
 */

import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve Vite-style `/utils/supabase/info` for node tests
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('/utils/supabase/') || /\\/utils\\/supabase\\//.test(specifier)) {
      const name = specifier.split('/').pop();
      if (name === 'info' || specifier.includes('supabase/info')) {
        return {
          shortCircuit: true,
          url: 'data:text/javascript,export const projectId="test";export const publicAnonKey="test";',
        };
      }
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export const supabase=null;export default null;',
      };
    }
    return nextResolve(specifier, context);
  }
`), pathToFileURL(path.join(__dirname, '..')));

function installMemoryStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  (globalThis as any).localStorage = ls;
  (globalThis as any).window = {
    localStorage: ls,
    location: { origin: 'http://localhost', pathname: '/', hostname: 'localhost' },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    CustomEvent: class CustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
  };
}

async function main() {
  installMemoryStorage();

  const { getStorageKey: _gs } = await import('../src/app/data/environment.ts');
  void _gs;
  const {    ONBOARDING_TOUR_VERSION,
    getProfileContentState,
    shouldShowGettingStartedModal,
    markGettingStartedDismissed,
    markGettingStartedCompleted,
    getGettingStartedDisposition,
    isUserCreatedGoal,
  } = await import('../src/app/data/productOnboarding.ts');

  assert.equal(ONBOARDING_TOUR_VERSION, '2');

  const profileA = `onb-test-a-${Date.now()}`;
  const profileB = `onb-test-b-${Date.now() + 1}`;

  assert.equal(getProfileContentState(profileA).isEmpty, true);
  assert.equal(shouldShowGettingStartedModal(profileA), true);
  assert.equal(isUserCreatedGoal(profileA, `user-${profileA}-1`), true);
  assert.equal(isUserCreatedGoal(profileA, 'kyle-birthday-savings'), false);

  markGettingStartedDismissed(profileA);
  assert.equal(getGettingStartedDisposition(profileA), 'dismissed');
  assert.equal(shouldShowGettingStartedModal(profileA), false);

  assert.equal(shouldShowGettingStartedModal(profileB), true);
  markGettingStartedCompleted(profileB);
  assert.equal(getGettingStartedDisposition(profileB), 'completed');
  assert.equal(shouldShowGettingStartedModal(profileB), false);
  assert.equal(getGettingStartedDisposition(profileA), 'dismissed');

  const GOALS_DATA_VERSION = 'v6-2026-07-13';
  const profileD = `onb-test-d-${Date.now() + 3}`;
  // personalGoals / userTasks use unprefixed keys (not getStorageKey)
  localStorage.setItem(`arbol-personal-goals-${profileD}`, JSON.stringify([{
    id: `user-${profileD}-1`,
    profileId: profileD,
    title: 'Mine',
    deepWhy: 'test',
    targetValue: 100,
    currentValue: 0,
    unit: '',
    milestones: [],
    createdAt: Date.now(),
  }]));
  localStorage.setItem(`arbol-goals-version-${profileD}`, GOALS_DATA_VERSION);
  assert.equal(getProfileContentState(profileD).hasGoals, true);
  assert.equal(getProfileContentState(profileD).isEmpty, false);
  assert.equal(shouldShowGettingStartedModal(profileD), false);

  const profileSeed = `onb-seed-${Date.now() + 5}`;
  localStorage.setItem(`arbol-personal-goals-${profileSeed}`, JSON.stringify([{
    id: 'kyle-birthday-savings',
    profileId: profileSeed,
    title: 'Seeded',
    deepWhy: '',
    targetValue: 100,
    currentValue: 0,
    unit: '',
    milestones: [],
    createdAt: Date.now(),
  }]));
  localStorage.setItem(`arbol-goals-version-${profileSeed}`, GOALS_DATA_VERSION);
  // Catalog/default goals count as real content (do not interrupt existing demo profiles)
  assert.equal(getProfileContentState(profileSeed).hasGoals, true);
  assert.equal(getProfileContentState(profileSeed).isEmpty, false);
  assert.equal(shouldShowGettingStartedModal(profileSeed), false);

  const profileE = `onb-test-e-${Date.now() + 4}`;
  const tasksKey = `arbol-user-tasks-${profileE}`;
  localStorage.setItem(tasksKey, JSON.stringify([{
    id: `utask-${profileE}-1`,
    profileId: profileE,
    label: 'Active',
    timeOfDay: 'morning',
    type: 'goal',
    createdAt: Date.now(),
    potentialValue: { score: 3, label: 'Medium', rationale: '' },
  }]));
  assert.equal(getProfileContentState(profileE).isEmpty, false);
  localStorage.setItem(tasksKey, JSON.stringify([{
    id: `utask-${profileE}-1`,
    profileId: profileE,
    label: 'Archived',
    timeOfDay: 'morning',
    type: 'goal',
    createdAt: Date.now(),
    archivedAt: Date.now(),
    potentialValue: { score: 3, label: 'Medium', rationale: '' },
  }]));
  assert.equal(getProfileContentState(profileE).isEmpty, true);
  assert.equal(shouldShowGettingStartedModal(profileE), true);

  console.log('product-onboarding tests passed');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
