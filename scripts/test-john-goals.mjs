/**
 * WP-18 — john demo profile has personal goals in defaults.
 * Run: node scripts/test-john-goals.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/data/personalGoals.ts'), 'utf8');

let passed = 0;
let failed = 0;

function assert(name, ok) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

const johnBlocks = [...src.matchAll(/profileId:\s*'john'/g)];
assert('john has default personal goals', johnBlocks.length >= 3);
assert('john-priorities goal id', /id:\s*'john-priorities'/.test(src));
assert('john-career goal id', /id:\s*'john-career'/.test(src));
assert('john-wellness goal id', /id:\s*'john-wellness'/.test(src));
assert('goals data version v6', /GOALS_DATA_VERSION = 'v6-2026-07-13'/.test(src));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
