/**
 * Streak logic wiring (WP-12).
 * Run: node scripts/test-streak-logic.mjs
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

console.log('\nStreak logic tests\n');

const profiles = read('src/app/data/profiles.ts');
const profileScreen = read('src/app/components/ProfileScreen.tsx');
const streakCalc = read('src/app/data/streakCalculations.ts');
const pipeline = read('src/app/data/taskStatusPipeline.ts');

assert('updateStreakBests on done', profiles.includes('updateStreakBests(profileId)'));
assert('ProfileScreen uses computeBestStreak', profileScreen.includes('computeBestStreak'));
assert('weekly streak skips empty current week', streakCalc.includes('weekOffset === 0 && !hasCompletionThisWeek'));
assert('monthly streak skips empty current month', streakCalc.includes('monthOffset === 0 && !hasCompletionThisMonth'));
assert('status pipeline exists', pipeline.includes('applyTaskStatusUpdate'));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
