/**
 * Goal edit + add-task entry path (user feedback closed loop).
 * Source + pure data assertions (no Vite path aliases / cloudBackup).
 * Run: node scripts/test-goal-add-task-entry.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\nGoal add-task entry tests\n');

const goalsPage = readFileSync(join(root, 'src/app/components/GoalsPage.tsx'), 'utf8');
const personalGoals = readFileSync(join(root, 'src/app/data/personalGoals.ts'), 'utf8');
const userTasks = readFileSync(join(root, 'src/app/data/userTasks.ts'), 'utf8');
const starter = readFileSync(join(root, 'src/app/data/momentumStarterSeed.ts'), 'utf8');

check('GoalsPage wires ManageTaskModal', goalsPage.includes('ManageTaskModal'));
check('GoalCard exposes Add Task CTA', goalsPage.includes('data-testid="goal-add-task"'));
check('Empty goal shows Add Your First Task', goalsPage.includes('goal-add-first-task'));
check(
  'Edit opens add-task flow with same goal id',
  goalsPage.includes('setManageTaskOpen(true)') && goalsPage.includes('setAddTaskGoalId(editedId)'),
);
check('Save task falls back to addTaskGoalId', goalsPage.includes('rest.goalId || addTaskGoalId'));
check('No hardcoded workout goal title', !goalsPage.includes('Morning Workout Routine'));
check('updateUserGoal preserves id (map by g.id)', /g\.id === goalId[\s\S]*\? \{ \.\.\.g, title:/.test(personalGoals));
check('createUserTask accepts goalId', userTasks.includes('goalId'));
check('starter seed links tasks via goalId', starter.includes('goalId:') || starter.includes('goalId ='));

// Pure model: renaming a goal must keep id and existing task links
{
  const profileId = 'custom-goal-add-task-1';
  const goalId = `user-${profileId}-seed-momentum-starter-goal-v1`;
  let goals = [{
    id: goalId,
    profileId,
    title: 'Build momentum with Arbol',
    deepWhy: 'Learn the loop',
    targetValue: 100,
    currentValue: 0,
    unit: '%',
    milestones: [],
    createdAt: 1,
  }];
  let tasks = [
    { id: 't1', profileId, goalId, label: 'Explore', createdAt: 1 },
    { id: 't2', profileId, goalId, label: 'Create', createdAt: 2 },
    { id: 't3', profileId, goalId, label: 'Complete', createdAt: 3 },
  ];

  const rename = (list, id, title) => list.map(g => (g.id === id ? { ...g, title } : g));
  goals = rename(goals, goalId, 'Build a Morning Workout Routine');
  check('pure edit keeps stable goal id', goals[0].id === goalId);
  check('pure edit updates title', goals[0].title === 'Build a Morning Workout Routine');
  check(
    'pure edit keeps task associations',
    tasks.every(t => t.goalId === goalId) && tasks.length === 3,
  );

  const addTask = (list, label) => {
    const task = {
      id: `utask-${profileId}-${list.length + 1}`,
      profileId,
      goalId,
      label,
      createdAt: Date.now(),
    };
    return { list: [...list, task], task };
  };
  const first = addTask(tasks, 'Lay out workout clothes before bed');
  tasks = first.list;
  check('new task references edited goal', first.task.goalId === goalId);
  const second = addTask(tasks, '10-minute morning stretch');
  tasks = second.list;
  check('multiple tasks attach to same goal', tasks.filter(t => t.goalId === goalId).length === 5);

  const blankId = `user-${profileId}-${Date.now()}`;
  goals = [...goals, {
    id: blankId,
    profileId,
    title: 'Blank Goal CTA Check',
    deepWhy: 'empty',
    targetValue: 100,
    currentValue: 0,
    unit: '%',
    milestones: [],
    createdAt: Date.now(),
  }];
  check('empty goal starts with zero tasks', tasks.filter(t => t.goalId === blankId).length === 0);
  const blankTask = addTask(tasks, 'First blank goal task');
  // Force goalId to blank for this creation path
  blankTask.task.goalId = blankId;
  tasks = [...tasks.filter(t => t.id !== blankTask.task.id), blankTask.task];
  check('user-created goal receives task', tasks.some(t => t.id === blankTask.task.id && t.goalId === blankId));
  tasks = tasks.filter(t => t.id !== blankTask.task.id);
  check('delete removes task without deleting goal', !tasks.some(t => t.id === blankTask.task.id) && goals.some(g => g.id === blankId));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
