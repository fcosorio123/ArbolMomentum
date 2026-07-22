/**
 * Task status merge / demotion persistence tests.
 */
import assert from 'node:assert/strict';
import {
  TASK_STATUS_CLEARED,
  preferTaskStatusLww,
  mergeTaskStatusMaps,
} from '../src/app/data/taskStatusMerge.ts';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

section('newer inprogress beats older done (Done → In Progress persists)');
{
  const won = preferTaskStatusLww('done', 'inprogress', 1000, 2000);
  assert.equal(won, 'inprogress');
  const merged = mergeTaskStatusMaps(
    { 'task-eu-t1-2026-07-22': 'done' },
    { 'task-eu-t1-2026-07-22': 'inprogress' },
    { 'task-eu-t1-2026-07-22': 1000 },
    { 'task-eu-t1-2026-07-22': 2000 },
  );
  assert.equal(merged.taskStatuses['task-eu-t1-2026-07-22'], 'inprogress');
  assert.equal(merged.taskStatusUpdatedAt['task-eu-t1-2026-07-22'], 2000);
}

section('newer clear beats older inprogress (In Progress → Haven\'t yet persists)');
{
  const won = preferTaskStatusLww('inprogress', TASK_STATUS_CLEARED, 1000, 2000);
  assert.equal(won, TASK_STATUS_CLEARED);
  const merged = mergeTaskStatusMaps(
    { 'task-eu-t1-2026-07-22': 'inprogress' },
    { 'task-eu-t1-2026-07-22': TASK_STATUS_CLEARED },
    { 'task-eu-t1-2026-07-22': 1000 },
    { 'task-eu-t1-2026-07-22': 2000 },
  );
  assert.equal(merged.taskStatuses['task-eu-t1-2026-07-22'], TASK_STATUS_CLEARED);
}

section('newer clear beats older done');
{
  assert.equal(
    preferTaskStatusLww('done', TASK_STATUS_CLEARED, 1000, 2000),
    TASK_STATUS_CLEARED,
  );
}

section('timestamped local demotion beats untimestamped cloud done');
{
  assert.equal(
    preferTaskStatusLww('inprogress', 'done', 5000, undefined),
    'inprogress',
  );
}

section('legacy (no timestamps) still prefers stronger status');
{
  assert.equal(preferTaskStatusLww('inprogress', 'done'), 'done');
  assert.equal(preferTaskStatusLww(TASK_STATUS_CLEARED, 'inprogress'), 'inprogress');
}

section('weighted progress drops on demotion');
{
  const weighted = (percents: number[]) =>
    percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0;
  // 2 tasks: one done (100), one inprogress (50) → 75
  assert.equal(weighted([100, 50]), 75);
  // demote inprogress → haven't yet (0) → 50
  assert.equal(weighted([100, 0]), 50);
  // demote done → inprogress → 50
  assert.equal(weighted([50, 50]), 50);
  assert.ok(weighted([100, 50]) > weighted([100, 0]));
}

console.log('\nAll task status demotion merge tests passed.\n');
