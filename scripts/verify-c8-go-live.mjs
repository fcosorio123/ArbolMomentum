/**
 * C8 — Full regression + Go-Live Gate (Section 11).
 * Local only — no GitHub push required.
 * Run: npm run test:c8
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEdgeBase, probeEdgeRoutes } from './edge-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const REGRESSION_SCRIPTS = [
  'test-goal-task-resolution.mjs',
  'test-streak-logic.mjs',
  'test-feedback-triggers.mjs',
  'test-task-prioritization.mjs',
  'test-mobile-gate.mjs',
  'test-c7-gate.mjs',
  'test-john-goals.mjs',
  'test-archive-session.mjs',
  'test-profile-seed-parser.mjs',
  'test-calendar-export.mjs',
  'test-alert-prefs.mjs',
  'test-day-stats.mjs',
  'test-beta-fixes.mjs',
  'test-check-in-flow.mjs',
  'test-admin-sync.mjs',
  'test-ai-parse-schema.mjs',
  'test-cloud-backup-merge.mjs',
  'test-cron-runtime.mjs',
  'test-email-favio.mjs',
  'c1-email-evidence.mjs',
];

function run(cmd, args, label, options = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: options.shell ?? false });
  return r.status === 0;
}

function loadCronSecret() {
  if (process.env.CRON_SECRET) return true;
  try {
    const raw = readFileSync(join(root, 'supabase/.secrets.env'), 'utf8');
    return /^CRON_SECRET=.+$/m.test(raw);
  } catch {
    return false;
  }
}

console.log('\n══════════════════════════════════════════════════');
console.log(' C8 — Full regression + Go-Live Gate (local)');
console.log('══════════════════════════════════════════════════\n');

const buildOk = run(npmCmd, ['run', 'build'], 'Production build', { shell: isWin });
if (!buildOk) {
  console.error('\n✗ Build failed.\n');
  process.exit(1);
}

let scriptFails = 0;
for (const s of REGRESSION_SCRIPTS) {
  const path = join(__dirname, s);
  if (!existsSync(path)) {
    console.warn(`  ⚠ skip missing ${s}`);
    continue;
  }
  const ok = run(process.execPath, [path], s);
  if (!ok) scriptFails++;
}

if (existsSync(join(root, '.github/protected-paths.txt'))) {
  const ok = run(process.execPath, [join(__dirname, 'verify-protected-paths.mjs')], 'verify-protected-paths.mjs');
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
    console.error(`  ✗ ${label}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

// V-01..V-12 matrix (automated vs manual)
const vMatrix = [
  { id: 'V-01', item: 'Deploy recency (GitHub SHA)', auto: false, note: 'Manual: confirm GitHub Pages deploy SHA matches HEAD' },
  { id: 'V-02', item: 'CRON_SECRET in GitHub Secrets', auto: false, note: 'Manual: confirm repo secret matches supabase/.secrets.env' },
  { id: 'V-03', item: 'Cron schedule runs', auto: false, note: 'Manual: GitHub Actions email-nudge-cron history' },
  { id: 'V-04', item: 'Cron auth 401 without secret', auto: scriptFails === 0, note: 'test-cron-runtime + c1-email-evidence' },
  { id: 'V-05', item: 'Global email enabled', auto: scriptFails === 0, note: 'test-alert-prefs + test-email-favio' },
  { id: 'V-06', item: 'Backup has profileEmail', auto: scriptFails === 0, note: 'test-cloud-backup-merge' },
  { id: 'V-07', item: 'Operational cron send', auto: scriptFails === 0, note: 'test-cron-runtime sent/dedup' },
  { id: 'V-08', item: 'Resend delivery', auto: false, note: 'Manual: Resend dashboard + inbox (favio tests send)' },
  { id: 'V-09', item: 'pg_cron state', auto: false, note: 'Manual: Supabase dashboard SQL jobs' },
  { id: 'V-10', item: 'Cross-device sync', auto: scriptFails === 0, note: 'test-beta-fixes + test-cloud-backup-merge' },
  { id: 'V-11', item: 'iOS core workflows', auto: scriptFails === 0, note: 'test-mobile-gate + C6 matrix (manual spot-check recommended)' },
  { id: 'V-12', item: 'Calendar Google mobile', auto: scriptFails === 0, note: 'test-calendar-export + manual device deeplink' },
];

console.log('\n▶ Verification matrix (Section 8)');
for (const v of vMatrix) {
  const status = v.auto ? 'automated pass' : `manual — ${v.note}`;
  console.log(`  ${v.auto ? '✓' : '○'} ${v.id}: ${v.item} — ${status}`);
}

const checkpoints = [
  ['C1', 'Email production evidence', scriptFails === 0],
  ['C2', 'Email repair WP-02–07', scriptFails === 0 && edgeMissing === 0],
  ['C3', 'Goal/task, streaks, feedback', scriptFails === 0],
  ['C4', 'AI workflow WP-08', scriptFails === 0 && edgeMissing === 0],
  ['C5', 'Archive, admin ops, backup', scriptFails === 0 && edgeMissing === 0],
  ['C6', 'WP-23A mobile gate', scriptFails === 0],
  ['C7', 'Modal queue, nav, john, cosmetic', scriptFails === 0],
  ['C8', 'Full regression (this run)', scriptFails === 0 && edgeMissing === 0 && buildOk],
];

console.log('\n▶ Checkpoint rollup');
for (const [id, label, ok] of checkpoints) {
  console.log(`  ${ok ? '✓' : '✗'} ${id}: ${label}`);
}

const secretsOk = loadCronSecret();
console.log('\n▶ Local prerequisites');
console.log(`  ${secretsOk ? '✓' : '○'} supabase/.secrets.env (CRON_SECRET)`);
console.log(`  ${edgeMissing === 0 ? '✓' : '✗'} Edge deployed to Supabase project`);
console.log('  ○ GitHub: confirm repo secrets (CRON_SECRET, SUPABASE_ACCESS_TOKEN) + Actions green');
console.log('  ○ Frontend publish: verify https://fcosorio123.github.io/ArbolMomentum/ after push');

console.log('\n══════════════════════════════════════════════════');
console.log(' Summary');
console.log('══════════════════════════════════════════════════');
console.log(`  Build: pass`);
console.log(`  Script failures: ${scriptFails}`);
console.log(`  Edge gaps: ${edgeMissing}`);
console.log(`  Automated V-items: ${vMatrix.filter(v => v.auto).length}/${vMatrix.length}`);
console.log(`  Manual V-items remaining: ${vMatrix.filter(v => !v.auto).length} (document before publish)`);

if (scriptFails > 0 || edgeMissing > 0) {
  console.log('\n  Fix failures above, then re-run: npm run test:c8\n');
  process.exit(scriptFails > 0 ? 1 : 2);
}

console.log('\n✓ C8 automated regression passed.');
console.log('  Complete manual V-items (V-01, V-02, V-03, V-08, V-09) before production publish.');
console.log('  Local UI: npm run dev → http://localhost:5173/\n');
