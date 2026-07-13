/**
 * Check-in navigation + completion guards.
 * Run: node scripts/test-check-in-flow.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function nextTaskId(sessionTasks, currentId) {
  if (!currentId || sessionTasks.length === 0) return null;
  const idx = sessionTasks.findIndex(t => t.id === currentId);
  if (idx < 0 || idx >= sessionTasks.length - 1) return null;
  return sessionTasks[idx + 1].id;
}

function prevTaskId(sessionTasks, currentId) {
  if (!currentId || sessionTasks.length === 0) return null;
  const idx = sessionTasks.findIndex(t => t.id === currentId);
  if (idx <= 0) return null;
  return sessionTasks[idx - 1].id;
}

function firstUnansweredTaskId(sessionTasks, answeredIds) {
  const found = sessionTasks.find(t => !answeredIds.has(t.id));
  return found?.id ?? sessionTasks[0]?.id ?? null;
}

function canRecordCheckIn(sessionTasks, answeredIds) {
  return sessionTasks.length === 0 || answeredIds.size >= sessionTasks.length;
}

function shouldPersistSkipOnAdvance(taskId, answeredIds, selections) {
  if (answeredIds.has(taskId)) return false;
  return selections[taskId] === undefined;
}

let passed = 0;
let failed = 0;

function assert(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

console.log('\nCheck-in flow tests\n');

assert('next task', nextTaskId(tasks, 'a') === 'b');
assert('next from last', nextTaskId(tasks, 'c') === null);
assert('prev task', prevTaskId(tasks, 'b') === 'a');
assert('first unanswered', firstUnansweredTaskId(tasks, new Set(['a'])) === 'b');
assert('can record when all answered', canRecordCheckIn(tasks, new Set(['a', 'b', 'c'])));
assert('cannot record partial', !canRecordCheckIn(tasks, new Set(['a'])));
assert('skip on advance when unanswered', shouldPersistSkipOnAdvance('b', new Set(['a']), {}));
assert('no skip when already answered', !shouldPersistSkipOnAdvance('a', new Set(['a']), { a: 'done' }));

const checkInSrc = readFileSync(join(root, 'src/app/components/CheckInPage.tsx'), 'utf8');
assert('ID-based currentTaskId', /currentTaskId/.test(checkInSrc));
assert('frozen sessionTasksRef', /sessionTasksRef/.test(checkInSrc));
assert('finish uses finishCheckInFlow(true)', /isLast \? \(\) => finishCheckInFlow\(true\)/.test(checkInSrc));
assert('cancel advance timer', /cancelAdvance/.test(checkInSrc));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
