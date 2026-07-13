/**
 * Goal-task resolution consistency (WP-10).
 * Run: node scripts/test-goal-task-resolution.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

let passed = 0;
let failed = 0;

function assert(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nGoal-task resolution tests\n');

const resolution = read('src/app/data/goalTaskResolution.ts');
const goalsPage = read('src/app/components/GoalsPage.tsx');
const goalUtils = read('src/app/data/goalProgressUtils.ts');
const weekPlan = read('src/app/components/WeekPlan.tsx');
const personalGoals = read('src/app/data/personalGoals.ts');
const taskList = read('src/app/components/TaskList.tsx');

assert('goalTaskResolution module exists', resolution.includes('getPrimaryGoalIdForTask'));
assert('GoalsPage uses shared breakdown', !goalsPage.includes('cat.goalId !== goalId') && goalsPage.includes('getGoalTaskBreakdown'));
assert('goalProgressUtils re-exports breakdown', goalUtils.includes("from './goalTaskResolution'"));
assert('WeekPlan uses shared breakdown', weekPlan.includes('getGoalTaskBreakdown'));
assert('deleteUserGoal clears task goal links', personalGoals.includes('clearTaskGoalLinksForGoal'));
assert('resetGoalProgress uses arbol-gtask prefix', personalGoals.includes('arbol-gtask-${profileId}-${goalId}-'));
assert('TaskList shows goals when no tasks (GT-06)', /isEmpty\s*=\s*categories\.length\s*===\s*0\s*&&\s*userTasks\.length\s*===\s*0\s*&&\s*goals\.length\s*===\s*0/.test(taskList));
assert('empty goal group has Add task CTA', taskList.includes('No tasks yet for this goal today'));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
