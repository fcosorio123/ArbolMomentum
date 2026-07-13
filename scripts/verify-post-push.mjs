/**
 * Post-push beta gate: automated + production smoke after GitHub deploy.
 * Run: node scripts/verify-post-push.mjs
 * Optional: PROD_URL=https://fcosorio123.github.io/ArbolMomentum/
 */
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEdgeBase } from './edge-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PROD_URL = (process.env.PROD_URL || 'https://fcosorio123.github.io/ArbolMomentum/').replace(/\/?$/, '/');
const COMMIT = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim();

function run(label, cmd, args) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status === 0;
}

console.log('\n══════════════════════════════════════════════════');
console.log(' Post-push beta verification');
console.log(` Commit: ${COMMIT}`);
console.log(` Production URL: ${PROD_URL}`);
console.log('══════════════════════════════════════════════════\n');

const checks = [];

// Phase 1: local regression (same as C8)
checks.push(['C8 regression suite', run('npm run test:c8', 'npm', ['run', 'test:c8'])]);

// Phase 2: production frontend reachable
console.log('\n▶ Production frontend HTTP');
try {
  const res = await fetch(PROD_URL, { redirect: 'follow' });
  const ok = res.ok;
  const html = await res.text();
  const hasRoot = html.includes('id="root"') || html.includes('Arbol');
  checks.push(['Production URL 200', ok]);
  checks.push(['Production HTML has app shell', hasRoot]);
  console.log(`  ${ok ? '✓' : '✗'} GET ${PROD_URL} — ${res.status}`);
  console.log(`  ${hasRoot ? '✓' : '✗'} App shell detected`);
} catch (e) {
  checks.push(['Production URL 200', false]);
  console.error('  ✗', e.message);
}

// Phase 3: edge health (deploy-supabase workflow should match)
console.log('\n▶ Edge health');
try {
  const base = getEdgeBase();
  const health = await fetch(`${base}/health`);
  checks.push(['Edge /health', health.ok]);
  console.log(`  ${health.ok ? '✓' : '✗'} ${base}/health — ${health.status}`);
} catch (e) {
  checks.push(['Edge /health', false]);
  console.error('  ✗', e.message);
}

// Phase 4: GitHub Actions (if gh available)
console.log('\n▶ GitHub Actions (latest on main)');
const gh = spawnSync('gh', ['run', 'list', '--branch', 'main', '--limit', '5', '--json', 'name,status,conclusion,headSha'], {
  cwd: root, encoding: 'utf8',
});
if (gh.status === 0) {
  try {
    const runs = JSON.parse(gh.stdout);
    const ours = runs.filter(r => r.headSha?.startsWith(COMMIT) || r.headSha === COMMIT);
    for (const r of (ours.length ? ours : runs).slice(0, 4)) {
      const pass = r.conclusion === 'success' || r.status === 'in_progress';
      console.log(`  ${r.conclusion === 'success' ? '✓' : r.status === 'in_progress' ? '…' : '✗'} ${r.name}: ${r.status}${r.conclusion ? ` (${r.conclusion})` : ''}`);
    }
    const deployOk = runs.some(r => r.name?.includes('Deploy frontend') && r.conclusion === 'success');
    const supaOk = runs.some(r => r.name?.includes('Supabase') && r.conclusion === 'success');
    checks.push(['Frontend deploy workflow', deployOk || runs.some(r => r.name?.includes('Deploy frontend') && r.status === 'in_progress')]);
    checks.push(['Supabase deploy workflow', supaOk || runs.some(r => r.name?.includes('Supabase') && r.status === 'in_progress')]);
  } catch { console.log('  (parse skipped)'); }
} else {
  console.log('  gh CLI not available — check Actions manually');
}

console.log('\n══════════════════════════════════════════════════');
console.log(' Manual runtime matrix (required before beta invite)');
console.log('══════════════════════════════════════════════════');
const manual = [
  ['MR-01', 'Goals & tasks CRUD', PROD_URL, 'Create/edit/delete goal + task; refresh persists'],
  ['MR-02', 'Goal-task consistency', PROD_URL, 'Same counts on Home, Goals, Tasks, Week'],
  ['MR-03', 'AI profile creation', PROD_URL, 'Paste context → review → save selected only'],
  ['MR-04', 'Task status + Check-in', PROD_URL, 'TaskList + Check-in both update streak/backup'],
  ['MR-05', 'Email prefs', PROD_URL, 'Save email on Profile; Ops tab shows qualification'],
  ['MR-06', 'Operational email', 'Admin + inbox', 'Cron or workflow_dispatch; non-test inbox delivery'],
  ['MR-07', 'Calendar export', PROD_URL, 'Google deeplink + ICS download'],
  ['MR-08', 'Archive profile', PROD_URL, 'Archive active profile → picker; cron skips'],
  ['MR-09', 'Mobile 390px', PROD_URL, 'Core workflows; Profile buttons not blocked'],
  ['MR-10', 'Admin ops', PROD_URL, 'Cron health, backup inspector, skip reasons'],
];
for (const [id, name, where, how] of manual) {
  console.log(`  ○ ${id}: ${name}`);
  console.log(`      ${where} — ${how}`);
}

const failed = checks.filter(([, ok]) => !ok).length;
console.log('\n══════════════════════════════════════════════════');
console.log(` Automated post-push: ${checks.length - failed}/${checks.length} passed`);
if (failed) console.log(' Re-run after deploy workflows complete: node scripts/verify-post-push.mjs');
console.log(' Complete manual matrix MR-01–MR-10 before beta invite.\n');
process.exit(failed ? 1 : 0);
