/**
 * C7 checkpoint checks (WP-20, WP-21, WP-18, WP-23B).
 * Run: node scripts/test-c7-gate.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('\nC7 UX polish gate\n');

assert('onboardingQueue module', existsSync(join(root, 'src/app/data/onboardingQueue.ts')));

const queue = read('src/app/data/onboardingQueue.ts');
assert('queue peek function', /peekOnboardingModal/.test(queue));
assert('queue advance function', /nextOnboardingAfter/.test(queue));

const app = read('src/app/App.tsx');
assert('App uses onboarding modal state', /onboardingModal/.test(app));
assert('App advances queue on coach done', /advanceOnboarding\('coach'\)/.test(app));
assert('page tours blocked while queue active', /canStartPageTours=\{!onboardingQueueActive\}/.test(app));
assert('coach done does not dismiss all tours', !/dismissAllToursForProfile/.test(app));

const dashboard = read('src/app/components/Dashboard.tsx');
assert('Home Alerts shortcut', /onNavigateReminders/.test(dashboard) && /BellOutlined/.test(dashboard));

const admin = read('src/app/components/AdminView.tsx');
assert('Admin responsive max width', /maxWidth:\s*'min\(100vw,\s*900px\)'/.test(admin));

const goals = read('src/app/data/personalGoals.ts');
assert('john personal goals', /profileId:\s*'john'/.test(goals));
assert('john priorities goal', /id:\s*'john-priorities'/.test(goals));
assert('goals version bumped', /GOALS_DATA_VERSION = 'v6-2026-07-13'/.test(goals));

const activeGoals = read('src/app/components/ActiveGoalsList.tsx');
assert('goal scroll fade hint', /linear-gradient\(90deg,\s*transparent/.test(activeGoals));

const feedback = read('src/app/components/FeedbackModal.tsx');
assert('feedback modal destroyOnHidden', /destroyOnHidden/.test(feedback));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
