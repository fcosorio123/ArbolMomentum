/**
 * WP-23A static mobile launch gate checks (complements manual device matrix).
 * Run: node scripts/test-mobile-gate.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'app', 'components');

const MOBILE_SCREENS = [
  'Dashboard.tsx',
  'GoalsPage.tsx',
  'TaskList.tsx',
  'WeekPlan.tsx',
  'CalendarScreen.tsx',
  'RemindersScreen.tsx',
  'ProfileScreen.tsx',
  'CheckInPage.tsx',
  'BottomNav.tsx',
];

const BOTTOM_NAV_CLEAR = /calc\(100px \+ env\(safe-area-inset-bottom/;
const SAFE_TOP = /safe-area-inset-top/;
const DYNAMIC_VH = /100dvh/;

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

console.log('\nWP-23A mobile static gate\n');

for (const file of MOBILE_SCREENS) {
  const path = join(src, file);
  if (!existsSync(path)) {
    assert(`${file} exists`, false, 'missing');
    continue;
  }
  const text = readFileSync(path, 'utf8');
  if (file === 'CheckInPage.tsx') {
    assert(`${file} full-viewport shell`, /inset:\s*0/.test(text) && /safe-area-inset-top/.test(text));
    continue;
  }
  assert(`${file} uses 100dvh`, DYNAMIC_VH.test(text) || file === 'BottomNav.tsx');
  if (!['BottomNav.tsx', 'CheckInPage.tsx'].includes(file)) {
    assert(`${file} safe-area top`, SAFE_TOP.test(text));
  }
  if (!['BottomNav.tsx', 'CheckInPage.tsx'].includes(file)) {
    assert(
      `${file} clears bottom nav`,
      BOTTOM_NAV_CLEAR.test(text)
        || /16px 100px/.test(text)
        || /160px \+ env\(safe-area-inset-bottom/.test(text)
        || (file === 'ProfileScreen.tsx' && /calc\(130px \+ env\(safe-area-inset-bottom/.test(text)),
    );
  }
}

// FAB screens must clear nav + FAB + safe-area
const goalsPage = readFileSync(join(src, 'GoalsPage.tsx'), 'utf8');
const taskListPad = readFileSync(join(src, 'TaskList.tsx'), 'utf8');
assert('GoalsPage FAB bottom clearance', /160px \+ env\(safe-area-inset-bottom/.test(goalsPage));
assert('TaskList FAB bottom clearance', /160px \+ env\(safe-area-inset-bottom/.test(taskListPad));

const checkIn = readFileSync(join(src, 'CheckInPage.tsx'), 'utf8');
assert('CheckInPage bottom safe-area', /paddingBottom:\s*['"]env\(safe-area-inset-bottom/.test(checkIn));

const themeCss = readFileSync(join(root, 'src', 'styles', 'theme.css'), 'utf8');
assert('toasts clear FAB', /72px \+ 52px \+ 20px \+ env\(safe-area-inset-bottom/.test(themeCss));

const bottomNav = readFileSync(join(src, 'BottomNav.tsx'), 'utf8');
assert('BottomNav min touch height', /minHeight:\s*44/.test(bottomNav));

const manageGoal = readFileSync(join(src, 'ManageGoalModal.tsx'), 'utf8');
assert('ManageGoalModal scroll body', /maxHeight:.*85dvh/.test(manageGoal) && /overflowY:\s*'auto'/.test(manageGoal));

// Core workflow modules present
const workflowModules = [
  'src/app/components/CreateProfileModal.tsx',
  'src/app/components/CheckInPage.tsx',
  'src/app/components/admin/OpsTab.tsx',
  'src/app/data/feedbackTriggers.ts',
  'src/app/data/taskPrioritization.ts',
  'src/app/data/aiTaskCreation.ts',
];

for (const rel of workflowModules) {
  assert(rel, existsSync(join(root, rel)));
}

const ai = readFileSync(join(root, 'src/app/data/aiTaskCreation.ts'), 'utf8');
assert('AI parse client rule fallback', /parseGoalInput/.test(ai) && /client_fallback/.test(ai));

const app = readFileSync(join(root, 'src/app/App.tsx'), 'utf8');
assert('viewport-fit=cover meta', /viewport-fit=cover/.test(app));
assert('no 90s feedback timer', !/setTimeout\([^,]+,\s*90000/.test(app));
assert('feedback trigger polling', /evaluateFeedbackTrigger|feedbackTriggers/.test(app));

const taskList = readFileSync(join(root, 'src/app/components/TaskList.tsx'), 'utf8');
assert('touch targets in TaskList', /touchIconButton|MIN_TOUCH/.test(taskList));
assert('TasksMonthView wired', existsSync(join(src, 'TasksMonthView.tsx')));
assert('tasksInventory helpers', existsSync(join(root, 'src/app/data/tasksInventory.ts')));
assert('SimplifyTaskModal wired', existsSync(join(src, 'SimplifyTaskModal.tsx')));
assert('potentialValue module', existsSync(join(root, 'src/app/data/potentialValue.ts')));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
