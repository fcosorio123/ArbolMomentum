/**
 * Today Set A / Set B hierarchy tests (Surgical UX P1).
 */
import assert from 'node:assert/strict';
import {
  orderGoalsForToday,
  orderTasksWithinGoal,
  unfinishedGoalsToExpand,
  type HierarchyGoalInput,
  type HierarchyTask,
} from '../src/app/data/goalFocusOrder.ts';
import { selectFocusTask } from '../src/app/data/taskFocusSelection.ts';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

function task(
  partial: Partial<HierarchyTask> & Pick<HierarchyTask, 'id' | 'label' | 'status' | 'originalIndex'>,
): HierarchyTask {
  return {
    timeOfDay: 'morning',
    type: 'goal',
    ...partial,
  };
}

section('Set A: Active goal first, then Up next, unfinished, done-only, empty');
{
  const goals: HierarchyGoalInput[] = [
    { id: 'empty', originalIndex: 0, tasks: [] },
    {
      id: 'done',
      originalIndex: 1,
      tasks: [task({ id: 'd1', label: 'D', status: 'done', originalIndex: 0 })],
    },
    {
      id: 'open',
      originalIndex: 2,
      tasks: [task({ id: 'o1', label: 'O', status: null, originalIndex: 0, type: 'routine' })],
    },
    {
      id: 'upnext-g',
      originalIndex: 3,
      tasks: [task({ id: 'u1', label: 'U', status: null, originalIndex: 0, type: 'priority' })],
    },
    {
      id: 'active-g',
      originalIndex: 4,
      tasks: [task({ id: 'a1', label: 'A', status: 'inprogress', originalIndex: 0 })],
    },
  ];
  const ordered = orderGoalsForToday(goals, 'a1', 'active');
  assert.deepEqual(
    ordered.map(g => g.goalId),
    ['active-g', 'upnext-g', 'open', 'done', 'empty'],
  );
}

section('Set A: Up next goal before unfinished-only');
{
  const goals: HierarchyGoalInput[] = [
    {
      id: 'open',
      originalIndex: 0,
      tasks: [task({ id: 'o1', label: 'O', status: null, originalIndex: 0, type: 'routine' })],
    },
    {
      id: 'next-g',
      originalIndex: 1,
      tasks: [task({ id: 'n1', label: 'N', status: null, originalIndex: 0, type: 'priority' })],
    },
  ];
  const ordered = orderGoalsForToday(goals, 'n1', 'up_next');
  assert.equal(ordered[0].goalId, 'next-g');
  assert.equal(ordered[0].tier, 'up_next_focus');
  assert.equal(ordered[1].tier, 'unfinished');
}

section('Set B: Active → unfinished → done → skipped');
{
  const tasks = [
    task({ id: 'sk', label: 'S', status: 'skipped', originalIndex: 0 }),
    task({ id: 'dn', label: 'D', status: 'done', originalIndex: 1 }),
    task({ id: 'op', label: 'O', status: null, originalIndex: 2, type: 'routine' }),
    task({ id: 'ac', label: 'A', status: 'inprogress', originalIndex: 4 }),
  ];
  const ordered = orderTasksWithinGoal(tasks, 'ac', 'active');
  assert.deepEqual(ordered.map(t => t.id), ['ac', 'op', 'dn', 'sk']);
}

section('Set B: Up next before other unfinished');
{
  const tasks = [
    task({ id: 'op', label: 'O', status: null, originalIndex: 0, type: 'routine' }),
    task({ id: 'up', label: 'U', status: null, originalIndex: 1, type: 'priority' }),
  ];
  const ordered = orderTasksWithinGoal(tasks, 'up', 'up_next');
  assert.equal(ordered[0].id, 'up');
  assert.equal(ordered[1].id, 'op');
}

section('expand first two unfinished only; done-only never primary-expanded');
{
  const goals: HierarchyGoalInput[] = [
    {
      id: 'g1',
      originalIndex: 0,
      tasks: [task({ id: 'a', label: 'A', status: 'inprogress', originalIndex: 0 })],
    },
    {
      id: 'g2',
      originalIndex: 1,
      tasks: [task({ id: 'b', label: 'B', status: null, originalIndex: 0 })],
    },
    {
      id: 'g3',
      originalIndex: 2,
      tasks: [task({ id: 'c', label: 'C', status: null, originalIndex: 0 })],
    },
    {
      id: 'done',
      originalIndex: 3,
      tasks: [task({ id: 'd', label: 'D', status: 'done', originalIndex: 0 })],
    },
  ];
  const ordered = orderGoalsForToday(goals, 'a', 'active');
  const expand = unfinishedGoalsToExpand(ordered, 2);
  assert.ok(expand.has('g1'));
  assert.ok(expand.has('g2'));
  assert.ok(!expand.has('g3'));
  assert.ok(!expand.has('done'));
}

section('single unfinished → one expanded');
{
  const goals: HierarchyGoalInput[] = [
    {
      id: 'only',
      originalIndex: 0,
      tasks: [task({ id: 'x', label: 'X', status: null, originalIndex: 0 })],
    },
    {
      id: 'done',
      originalIndex: 1,
      tasks: [task({ id: 'd', label: 'D', status: 'done', originalIndex: 0 })],
    },
  ];
  const ordered = orderGoalsForToday(goals, null, null);
  const expand = unfinishedGoalsToExpand(ordered, 2);
  assert.equal(expand.size, 1);
  assert.ok(expand.has('only'));
}

section('stable tie-break by originalIndex');
{
  const goals: HierarchyGoalInput[] = [
    {
      id: 'b',
      originalIndex: 1,
      tasks: [task({ id: 'b1', label: 'B', status: null, originalIndex: 0, type: 'routine' })],
    },
    {
      id: 'a',
      originalIndex: 0,
      tasks: [task({ id: 'a1', label: 'A', status: null, originalIndex: 0, type: 'routine' })],
    },
  ];
  const ordered = orderGoalsForToday(goals, null, null);
  assert.equal(ordered[0].goalId, 'a');
  assert.equal(ordered[1].goalId, 'b');
}

section('single focus invariant with selectFocusTask');
{
  const focus = selectFocusTask([
    { id: '1', label: 'A', timeOfDay: 'morning', type: 'goal', status: 'inprogress' },
    { id: '2', label: 'B', timeOfDay: 'morning', type: 'priority', status: null },
  ]);
  assert.equal(focus?.taskId, '1');
  assert.equal(focus?.label, 'active');
}

console.log('\nAll today hierarchy order tests passed.\n');
