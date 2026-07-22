/**
 * Momentum starter seed unit tests (localStorage mocked).
 */
import assert from 'node:assert/strict';
import {
  MOMENTUM_STARTER_TASK_KEYS,
  applyMomentumStarterSeedToData,
  inspectMomentumStarterSeedInData,
  momentumStarterGoalId,
  momentumStarterTaskId,
  shouldBackfillCustomProfile,
  matchesBackfillDisplayName,
  ensureMomentumStarterSeed,
  inspectMomentumStarterSeed,
} from '../src/app/data/momentumStarterSeed.ts';
import type { PersonalGoal } from '../src/app/data/personalGoals.ts';
import type { UserTask } from '../src/app/data/userTasks.ts';

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

section('stable ids are canonical and profile-scoped');
{
  const pid = 'custom-david-1';
  assert.equal(momentumStarterGoalId(pid), `user-${pid}-seed-momentum-starter-goal-v1`);
  assert.equal(
    momentumStarterTaskId(pid, 'momentum-starter-explore'),
    `utask-${pid}-seed-momentum-starter-explore-v1`,
  );
}

section('create: exactly 1 goal + 3 tasks linked');
{
  const pid = 'custom-new-100';
  const { goals, tasks, result } = applyMomentumStarterSeedToData(pid, [], []);
  assert.equal(result.changed, true);
  assert.equal(result.createdGoal, true);
  assert.equal(result.createdTaskKeys.length, 3);
  assert.equal(goals.length, 1);
  assert.equal(tasks.length, 3);
  assert.equal(goals[0].id, momentumStarterGoalId(pid));
  assert.ok(tasks.every(t => t.goalId === momentumStarterGoalId(pid)));
  assert.deepEqual(
    tasks.map(t => t.id).sort(),
    MOMENTUM_STARTER_TASK_KEYS.map(k => momentumStarterTaskId(pid, k)).sort(),
  );
}

section('idempotent: second apply makes no changes');
{
  const pid = 'custom-idem-1';
  const first = applyMomentumStarterSeedToData(pid, [], []);
  const second = applyMomentumStarterSeedToData(pid, first.goals, first.tasks);
  assert.equal(second.result.changed, false);
  assert.equal(second.goals.length, 1);
  assert.equal(second.tasks.length, 3);
}

section('partial repair: goal exists, missing tasks only');
{
  const pid = 'custom-partial-1';
  const goalId = momentumStarterGoalId(pid);
  const goals: PersonalGoal[] = [{
    id: goalId,
    profileId: pid,
    title: 'Build momentum with Arbol',
    deepWhy: 'x',
    targetValue: 100,
    currentValue: 0,
    unit: '',
    milestones: [],
    createdAt: 1,
  }];
  const oneTask: UserTask[] = [{
    id: momentumStarterTaskId(pid, 'momentum-starter-explore'),
    profileId: pid,
    label: 'Explore Arbol Momentum',
    timeOfDay: 'morning',
    type: 'priority',
    goalId,
    createdAt: 1,
  }];
  const { goals: g2, tasks: t2, result } = applyMomentumStarterSeedToData(pid, goals, oneTask);
  assert.equal(result.createdGoal, false);
  assert.equal(result.createdTaskKeys.length, 2);
  assert.equal(g2.length, 1);
  assert.equal(t2.length, 3);
}

section('preserves user-created goals and tasks');
{
  const pid = 'custom-user-1';
  const userGoal: PersonalGoal = {
    id: `user-${pid}-999`,
    profileId: pid,
    title: 'My own goal',
    deepWhy: 'mine',
    targetValue: 10,
    currentValue: 0,
    unit: '',
    milestones: [],
    createdAt: 1,
  };
  const userTask: UserTask = {
    id: `utask-${pid}-abc`,
    profileId: pid,
    label: 'My own task',
    timeOfDay: 'morning',
    type: 'routine',
    goalId: userGoal.id,
    createdAt: 1,
  };
  const { goals, tasks } = applyMomentumStarterSeedToData(pid, [userGoal], [userTask]);
  assert.equal(goals.length, 2);
  assert.equal(tasks.length, 4);
  assert.ok(goals.some(g => g.id === userGoal.id && g.title === 'My own goal'));
  assert.ok(tasks.some(t => t.id === userTask.id && t.label === 'My own task'));
}

section('builtins ineligible');
{
  const insp = inspectMomentumStarterSeedInData('favio', [], []);
  assert.equal(insp.status, 'ineligible');
  const applied = applyMomentumStarterSeedToData('favio', [], []);
  assert.equal(applied.result.changed, false);
  assert.equal(applied.goals.length, 0);
}

section('backfill targeting by name and recency');
{
  assert.equal(matchesBackfillDisplayName('David'), true);
  assert.equal(matchesBackfillDisplayName('James'), true);
  assert.equal(matchesBackfillDisplayName('Kevin'), true);
  assert.equal(matchesBackfillDisplayName('Test Profile'), true);
  assert.equal(matchesBackfillDisplayName('Sid'), false);
  const now = 1_000_000_000_000;
  assert.equal(
    shouldBackfillCustomProfile(
      { id: 'custom-sid-1', name: 'Sid', createdAt: now - 2 * 60 * 60 * 1000 },
      { hours: 36, now },
    ),
    true,
  );
  assert.equal(
    shouldBackfillCustomProfile(
      { id: 'custom-old-1', name: 'Old', createdAt: now - 40 * 60 * 60 * 1000 },
      { hours: 36, now },
    ),
    false,
  );
  assert.equal(
    shouldBackfillCustomProfile(
      { id: 'custom-kevin-1', name: 'Kevin', createdAt: now - 40 * 60 * 60 * 1000 },
      { hours: 36, now },
    ),
    true,
  );
}

section('ensureMomentumStarterSeed writes localStorage and is idempotent');
{
  store.clear();
  const pid = 'custom-ls-1';
  const r1 = ensureMomentumStarterSeed(pid);
  assert.equal(r1.changed, true);
  assert.equal(r1.seededTaskCount, 3);
  const insp = inspectMomentumStarterSeed(pid);
  assert.equal(insp.status, 'complete');
  const r2 = ensureMomentumStarterSeed(pid);
  assert.equal(r2.changed, false);
  assert.equal(
    JSON.parse(store.get(`arbol-personal-goals-${pid}`) || '[]').length,
    1,
  );
  assert.equal(
    JSON.parse(store.get(`arbol-user-tasks-${pid}`) || '[]').length,
    3,
  );
}

section('same-title user content is not overwritten');
{
  const pid = 'custom-sametitle-1';
  const userGoal: PersonalGoal = {
    id: `user-${pid}-own`,
    profileId: pid,
    title: 'Build momentum with Arbol',
    deepWhy: 'user wrote this',
    targetValue: 1,
    currentValue: 0,
    unit: '',
    milestones: [],
    createdAt: 1,
  };
  const { goals, tasks, result } = applyMomentumStarterSeedToData(pid, [userGoal], []);
  assert.equal(result.createdGoal, true);
  assert.equal(goals.length, 2);
  assert.equal(goals.find(g => g.id === userGoal.id)?.deepWhy, 'user wrote this');
  assert.equal(tasks.length, 3);
}

section('concurrent apply with stable ids yields one seed set (union by id)');
{
  const pid = 'custom-race-1';
  const a = applyMomentumStarterSeedToData(pid, [], [], 100);
  const b = applyMomentumStarterSeedToData(pid, [], [], 200);
  const byId = new Map<string, (typeof a.goals)[0]>();
  for (const g of [...a.goals, ...b.goals]) byId.set(g.id, g);
  const taskById = new Map<string, (typeof a.tasks)[0]>();
  for (const t of [...a.tasks, ...b.tasks]) taskById.set(t.id, t);
  assert.equal(byId.size, 1);
  assert.equal(taskById.size, 3);
  assert.equal([...byId.keys()][0], momentumStarterGoalId(pid));
}

section('invalid profile id fails safely (ineligible, no writes)');
{
  store.clear();
  const r = ensureMomentumStarterSeed('');
  assert.equal(r.status, 'ineligible');
  assert.equal(r.changed, false);
  assert.equal(store.size, 0);
}

console.log('\nAll momentum starter seed tests passed.\n');
