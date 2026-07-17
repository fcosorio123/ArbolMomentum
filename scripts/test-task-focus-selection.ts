/**
 * Automated tests for Today focus selection (Zeigarnik Phase 1).
 */
import assert from 'node:assert/strict';
import {
  selectFocusTask,
  focusLabelIsTruthful,
  type FocusCandidate,
} from '../src/app/data/taskFocusSelection.ts';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

function candidate(
  partial: Partial<FocusCandidate> & Pick<FocusCandidate, 'id' | 'label' | 'status'>,
): FocusCandidate {
  return {
    timeOfDay: 'morning',
    type: 'goal',
    ...partial,
  };
}

section('no tasks → null focus');
{
  assert.equal(selectFocusTask([]), null);
}

section('one inprogress → Active on that task');
{
  const tasks = [
    candidate({ id: 'a', label: 'A', status: null, type: 'routine' }),
    candidate({ id: 'b', label: 'B', status: 'inprogress', type: 'priority' }),
  ];
  const focus = selectFocusTask(tasks);
  assert.ok(focus);
  assert.equal(focus!.taskId, 'b');
  assert.equal(focus!.label, 'active');
  assert.ok(focusLabelIsTruthful(focus!, 'inprogress'));
}

section('multiple inprogress → one Active via ranking (priority preferred)');
{
  const tasks = [
    candidate({ id: 'low', label: 'Low', status: 'inprogress', type: 'routine' }),
    candidate({ id: 'high', label: 'High', status: 'inprogress', type: 'priority' }),
  ];
  const focus = selectFocusTask(tasks, { preferredTimeOfDay: 'morning' });
  assert.ok(focus);
  assert.equal(focus!.label, 'active');
  assert.equal(focus!.taskId, 'high');
  // Others remain eligible as inprogress; selection does not remove them
  assert.equal(tasks.filter(t => t.status === 'inprogress').length, 2);
}

section('no inprogress → Up next, never Active');
{
  const tasks = [
    candidate({ id: 'a', label: 'A', status: null, type: 'routine' }),
    candidate({ id: 'b', label: 'B', status: null, type: 'priority' }),
    candidate({ id: 'c', label: 'C', status: 'done', type: 'goal' }),
  ];
  const focus = selectFocusTask(tasks, { preferredTimeOfDay: 'morning' });
  assert.ok(focus);
  assert.equal(focus!.label, 'up_next');
  assert.equal(focus!.taskId, 'b');
  assert.ok(focusLabelIsTruthful(focus!, null));
  assert.equal(focus!.label === 'active', false);
}

section('only done/skipped → null');
{
  const tasks = [
    candidate({ id: 'd', label: 'D', status: 'done' }),
    candidate({ id: 's', label: 'S', status: 'skipped' }),
  ];
  assert.equal(selectFocusTask(tasks), null);
}

section('selection does not reorder candidate array');
{
  const tasks = [
    candidate({ id: '1', label: 'One', status: null, type: 'routine' }),
    candidate({ id: '2', label: 'Two', status: null, type: 'priority' }),
    candidate({ id: '3', label: 'Three', status: 'inprogress', type: 'goal' }),
  ];
  const before = tasks.map(t => t.id).join(',');
  selectFocusTask(tasks);
  assert.equal(tasks.map(t => t.id).join(','), before);
}

section('Active label never applied to unstarted task');
{
  const tasks = [
    candidate({ id: 'u', label: 'Unstarted', status: null, type: 'priority' }),
  ];
  const focus = selectFocusTask(tasks);
  assert.ok(focus);
  assert.equal(focus!.label, 'up_next');
  assert.ok(focusLabelIsTruthful(focus!, null));
}

section('at most one focus id returned');
{
  const tasks = [
    candidate({ id: 'a', label: 'A', status: 'inprogress', type: 'priority' }),
    candidate({ id: 'b', label: 'B', status: 'inprogress', type: 'priority' }),
    candidate({ id: 'c', label: 'C', status: null, type: 'goal' }),
  ];
  const focus = selectFocusTask(tasks);
  assert.ok(focus);
  assert.equal(typeof focus!.taskId, 'string');
  assert.ok(['a', 'b'].includes(focus!.taskId));
}

console.log('\nAll task-focus-selection tests passed.\n');
