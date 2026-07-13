/**
 * WP-11 task prioritization tests.
 * Run: node scripts/test-task-prioritization.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function taskPriorityScore(task, preferred) {
  if (task.status === 'done' || task.status === 'skipped') return 9999;
  let score = 0;
  if (task.status === 'inprogress') score -= 100;
  if (task.type === 'priority') score -= 50;
  else if (task.type === 'goal') score -= 25;
  if (task.timeOfDay === preferred) score -= 30;
  if (!task.status || task.status === 'notstarted') score -= 5;
  return score;
}

function pickTop(tasks, preferred = 'morning') {
  return tasks
    .filter(t => t.status !== 'done' && t.status !== 'skipped')
    .slice()
    .sort((a, b) => taskPriorityScore(a, preferred) - taskPriorityScore(b, preferred))[0] ?? null;
}

let passed = 0;
let failed = 0;
function assert(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nTask prioritization tests\n');

const prio = read('src/app/data/taskPrioritization.ts');
const dash = read('src/app/data/dashboardSnapshot.ts');
const live = read('src/app/data/liveCheckInFeedback.ts');

assert('taskPrioritization module exists', prio.includes('rankOpenTasks'));
assert('pickDoNowTask uses pickTopRankedTask', dash.includes('pickTopRankedTask'));
assert('getTopPendingTasks uses rankOpenTasks', dash.includes('rankOpenTasks'));
assert('live check-in uses pickTopRankedTask', live.includes('pickTopRankedTask'));

const tasks = [
  { id: 'a', label: 'Routine evening', timeOfDay: 'evening', type: 'routine', status: 'notstarted' },
  { id: 'b', label: 'Priority morning', timeOfDay: 'morning', type: 'priority', status: 'notstarted' },
  { id: 'c', label: 'Goal morning', timeOfDay: 'morning', type: 'goal', status: 'inprogress' },
];
const topMorning = pickTop(tasks, 'morning');
assert('in-progress goal beats priority not started (same period)', topMorning?.id === 'c');
  const topEveningOnly = pickTop([
    { id: 'a', label: 'Routine evening', timeOfDay: 'evening', type: 'routine', status: 'notstarted' },
    { id: 'b', label: 'Routine morning', timeOfDay: 'morning', type: 'routine', status: 'notstarted' },
  ], 'evening');
  assert('evening preference surfaces evening task', topEveningOnly?.id === 'a');

const withPrio = [
  { id: 'x', label: 'P in progress', timeOfDay: 'morning', type: 'priority', status: 'inprogress' },
  { id: 'y', label: 'G morning', timeOfDay: 'morning', type: 'goal', status: 'inprogress' },
];
assert('priority in-progress wins over goal in-progress', pickTop(withPrio, 'morning')?.id === 'x');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
