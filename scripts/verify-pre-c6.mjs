/**
 * Pre-C6 verification runner (local — no GitHub push required).
 * Run: npm run test:pre-c6
 *
 * Optional: ARBOL_EDGE_BASE=http://127.0.0.1:54321/functions/v1/make-server-5d90ddf5
 * after `npm run serve:edge` (requires supabase login + deploy or local serve).
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEdgeBase, probeEdgeRoutes } from './edge-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const SCRIPTS = [
  'test-goal-task-resolution.mjs',
  'test-streak-logic.mjs',
  'test-feedback-triggers.mjs',
  'test-task-prioritization.mjs',
  'test-mobile-gate.mjs',
  'test-archive-session.mjs',
  'test-profile-seed-parser.mjs',
  'test-calendar-export.mjs',
  'test-alert-prefs.mjs',
  'test-day-stats.mjs',
  'test-beta-fixes.mjs',
  'test-ai-parse-schema.mjs',
  'test-cloud-backup-merge.mjs',
  'test-cron-runtime.mjs',
  'test-email-favio.mjs',
];

function run(cmd, args, label, options = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: options.shell ?? false,
  });
  return r.status === 0;
}

console.log('\n══════════════════════════════════════');
console.log(' Pre-C6 local verification');
console.log('══════════════════════════════════════\n');

const buildOk = run(npmCmd, ['run', 'build'], 'Production build', { shell: isWin });
if (!buildOk) {
  console.error('\n✗ Build failed — fix before proceeding.\n');
  process.exit(1);
}

let scriptFails = 0;
for (const s of SCRIPTS) {
  const path = join(__dirname, s);
  if (!existsSync(path)) {
    console.warn(`  ⚠ skip missing ${s}`);
    continue;
  }
  const ok = run(process.execPath, [path], s);
  if (!ok) scriptFails++;
}

console.log('\n▶ Edge route probe');
const base = getEdgeBase();
console.log(`  Base: ${base}`);
const routes = await probeEdgeRoutes(base);
let edgeMissing = 0;
for (const r of routes) {
  const label = r.path === '/backup stale guard'
    ? `stale guard: ${r.staleGuard ? 'active' : 'inactive'} (${r.status})`
    : `${r.path}: ${r.status}`;
  if (r.path === '/backup stale guard') {
    if (!r.staleGuard) { edgeMissing++; console.error(`  ✗ ${label}`); }
    else console.log(`  ✓ ${label}`);
  } else if (!r.ok) {
    edgeMissing++;
    console.error(`  ✗ ${label} — deploy edge: npm run deploy:edge`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

console.log('\n══════════════════════════════════════');
console.log(' Summary');
console.log('══════════════════════════════════════');
console.log(`  Build: pass`);
console.log(`  Script failures: ${scriptFails}`);
console.log(`  Edge gaps: ${edgeMissing}`);

if (edgeMissing > 0) {
  console.log('\n  Edge not fully deployed. To fix locally (no GitHub push):');
  console.log('    1. npx supabase login');
  console.log('    2. npm run deploy:edge');
  console.log('    3. npm run test:pre-c6');
  console.log('\n  Frontend local testing: npm run dev');
  console.log('  (Uses local C1–C5 code; edge must be deployed to Supabase project.)\n');
}

if (scriptFails > 0 || edgeMissing > 0) {
  process.exit(scriptFails > 0 ? 1 : 2);
}

console.log('\n✓ Pre-C6 verification passed.\n');
