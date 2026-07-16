/**
 * Pure persist/idempotency checks mirroring aiAssistPersist.ts (no app imports).
 * Run: node scripts/test-ai-assist-persist.mjs
 */

import assert from 'node:assert/strict';

function persistGoal(session, draft, onlyKeys, deps) {
  const createdGoalIds = [];
  const createdTaskIds = [];
  const failed = [];
  const createdIds = { ...session.createdIds };
  let goalId = createdIds[draft.clientKey];

  try {
    if (!goalId) {
      const g = deps.createUserGoal({ title: draft.title, deepWhy: draft.deepWhy });
      createdIds[draft.clientKey] = g.id;
      goalId = g.id;
      createdGoalIds.push(g.id);
    } else {
      createdGoalIds.push(goalId);
    }
  } catch (err) {
    failed.push({ role: 'goal', clientKey: draft.clientKey, message: String(err) });
    return { result: { ok: false, createdGoalIds, createdTaskIds, failed, partial: false }, session: { ...session, createdIds } };
  }

  if (draft.starterMode === 'goal_with_tasks') {
    for (const t of draft.starterTasks.filter(x => x.selected && x.label.trim())) {
      if (onlyKeys && !onlyKeys.includes(t.clientKey)) {
        if (createdIds[t.clientKey]) createdTaskIds.push(createdIds[t.clientKey]);
        continue;
      }
      if (createdIds[t.clientKey]) {
        createdTaskIds.push(createdIds[t.clientKey]);
        continue;
      }
      try {
        const task = deps.createUserTask({ label: t.label, goalId });
        createdIds[t.clientKey] = task.id;
        createdTaskIds.push(task.id);
      } catch (err) {
        failed.push({ role: 'task', clientKey: t.clientKey, message: String(err) });
      }
    }
  }

  const wanted = draft.starterMode === 'goal_with_tasks'
    ? draft.starterTasks.filter(t => t.selected).length
    : 0;
  const partial = failed.length > 0;
  const ok = failed.length === 0 && !!goalId && (wanted === 0 || createdTaskIds.length === wanted);
  return { result: { ok, createdGoalIds, createdTaskIds, failed, partial }, session: { ...session, createdIds } };
}

let gid = 0;
let tid = 0;
const createdGoals = [];
const createdTasks = [];
let failOnce = true;

const deps = {
  createUserGoal: (data) => {
    const id = `g${++gid}`;
    createdGoals.push(id);
    return { id, ...data };
  },
  createUserTask: (data) => {
    if (failOnce && data.label === 'Prep a healthy lunch') {
      failOnce = false;
      throw new Error('forced_fail');
    }
    const id = `t${++tid}`;
    createdTasks.push(id);
    return { id, ...data };
  },
};

const draft = {
  title: 'Healthier weekdays',
  deepWhy: 'Energy',
  starterMode: 'goal_with_tasks',
  starterTasks: [
    { id: 's1', label: 'Walk 20 minutes', selected: true, clientKey: 'k_a' },
    { id: 's2', label: 'Prep a healthy lunch', selected: true, clientKey: 'k_b' },
    { id: 's3', label: 'Skip me', selected: false, clientKey: 'k_c' },
  ],
  clientKey: 'goal_key_1',
};

let session = { createdIds: {} };
const first = persistGoal(session, draft, undefined, deps);
assert.equal(first.result.partial, true);
assert.equal(first.result.ok, false);
assert.equal(first.result.createdGoalIds.length, 1);
assert.equal(first.result.createdTaskIds.length, 1);
assert.equal(first.result.failed.length, 1);
assert.equal(createdGoals.length, 1);

const retry = persistGoal(first.session, draft, first.result.failed.map(f => f.clientKey), deps);
assert.equal(retry.result.ok, true);
assert.equal(createdGoals.length, 1);
assert.equal(createdTasks.length, 2);

console.log('AI Assist persist idempotency tests passed.');
