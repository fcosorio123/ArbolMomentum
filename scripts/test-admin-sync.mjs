/**
 * Admin sync helpers smoke test.
 * Run: node scripts/test-admin-sync.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function assert(name, ok) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

const sync = readFileSync(join(root, 'src/app/data/supabaseSync.ts'), 'utf8');
const admin = readFileSync(join(root, 'src/app/data/adminOps.ts'), 'utf8');
const dash = readFileSync(join(root, 'src/app/components/Dashboard.tsx'), 'utf8');

console.log('\nAdmin sync tests\n');
assert('syncProfileVisit exported', /export async function syncProfileVisit/.test(sync));
assert('fetchVisitCountForAdmin exported', /export async function fetchVisitCountForAdmin/.test(sync));
assert('email source resolver', /resolveEmailRecipientSource/.test(admin));
assert('Dashboard syncs visits', /syncProfileVisit/.test(dash));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
