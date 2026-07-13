/**
 * Feedback trigger rules (WP-26 / PD-05).
 * Run: node scripts/test-feedback-triggers.mjs
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

console.log('\nFeedback trigger tests\n');

const triggers = read('src/app/data/feedbackTriggers.ts');
const app = read('src/app/App.tsx');
const feedback = read('src/app/data/feedback.ts');

assert('streak milestone rule present', triggers.includes('streak % 7 === 0'));
assert('9pm evening rule present', triggers.includes('getHours() >= 21'));
assert('max one nudge per day', triggers.includes('count >= 1'));
assert('App removed 90s timer', !app.includes('90_000'));
assert('App polls feedback triggers', app.includes('setInterval(check, 60_000'));
assert('feedback re-exports triggers', feedback.includes("from './feedbackTriggers'"));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
