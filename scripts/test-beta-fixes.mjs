/**
 * Acceptance checks for surgical beta fixes (pure logic, no DOM).
 * Run: node scripts/test-beta-fixes.mjs
 */

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// ── Mirror hasLocalProfileData (goals-only must NOT count) ──────────
function hasLocalProfileData(store, profileId) {
  if (store.get(`arbol-user-tasks-${profileId}`)) return true;
  if (store.get(`arbol-user-cats-${profileId}`)) return true;
  if (store.get(`arbol-hidden-seed-${profileId}`)) return true;
  for (const [k, v] of store.entries()) {
    if (k.startsWith(`task-${profileId}-`) || k.startsWith(`streak-${profileId}-`)) return true;
    if (k.startsWith('arbol-goal-progress-') && v) {
      try {
        const log = JSON.parse(v);
        if (log.profileId === profileId) return true;
      } catch { /* ignore */ }
    }
  }
  return false;
}

// ── Mirror mergeCloudActivityWhenNewer gate ─────────────────────────
function shouldMergeCloudActivity(localAt, cloudSavedAt) {
  return cloudSavedAt > localAt;
}

// ── Mirror check-in completion rule ─────────────────────────────────
function shouldMarkCheckInComplete(totalTasks, reviewedCount) {
  return totalTasks === 0 || reviewedCount >= totalTasks;
}

console.log('\nBeta fix acceptance checks\n');

console.log('Cloud restore race (#1):');
{
  const store = new Map();
  store.set('arbol-personal-goals-kyle', '[]');
  store.set('arbol-goals-version-kyle', '2');
  assert('auto-seeded goals alone → not “has local data”', !hasLocalProfileData(store, 'kyle'));
  store.set('task-kyle-t1-2026-06-20', 'done');
  assert('task completion → has local data', hasLocalProfileData(store, 'kyle'));
}

console.log('\nCloud newer merge gate (#2):');
{
  assert('cloud newer than local → merge activity', shouldMergeCloudActivity(1000, 2000));
  assert('cloud older than local → skip activity merge', !shouldMergeCloudActivity(3000, 2000));
  assert('equal timestamps → skip', !shouldMergeCloudActivity(2000, 2000));
}

console.log('\nCheck-in completion guard (#4):');
{
  assert('0 tasks → can complete', shouldMarkCheckInComplete(0, 0));
  assert('all reviewed → can complete', shouldMarkCheckInComplete(5, 5));
  assert('partial review → cannot complete', !shouldMarkCheckInComplete(5, 3));
  assert('skipped-through middle tasks still blocks if not all counted', !shouldMarkCheckInComplete(5, 2));
}

console.log('\nGoal progress backup key filter (#6):');
{
  const logs = {};
  const profileId = 'kyle';
  const k1 = 'arbol-goal-progress-log-1';
  const k2 = 'arbol-goal-progress-log-2';
  logs[k1] = JSON.stringify({ profileId: 'kyle', id: 'log-1' });
  logs[k2] = JSON.stringify({ profileId: 'yesa', id: 'log-2' });
  const collected = Object.fromEntries(
    Object.entries(logs).filter(([, v]) => JSON.parse(v).profileId === profileId),
  );
  assert('collects only matching profile logs', Object.keys(collected).length === 1);
  assert('correct log kept', collected[k1] !== undefined);
}

console.log('\nPWA asset URL resolution (#12):');
{
  const swHref = 'https://example.com/ArbolMomentum/sw.js';
  const icon = new URL('icon-192.svg', swHref).href;
  const entry = new URL('./', swHref).href;
  assert('icon resolves under app base', icon === 'https://example.com/ArbolMomentum/icon-192.svg');
  assert('entry resolves under app base', entry === 'https://example.com/ArbolMomentum/');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
