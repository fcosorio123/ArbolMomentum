/**
 * Pure-function tests for day stats rollup logic.
 * Run: node scripts/test-day-stats.mjs
 */

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const PERMANENT_DELETION_DATE = 'permanent';

function buildRemoteDayOverlay(profileId, dateKey, completions, deletions) {
  const completionMap = new Map();
  for (const c of completions) {
    if (c.profile_id !== profileId || c.date !== dateKey) continue;
    if (c.status === 'done' || c.status === 'inprogress') {
      completionMap.set(c.task_id, c.status);
    }
  }
  const skippedIds = new Set();
  const permanentlyRemovedIds = new Set();
  for (const d of deletions) {
    if (d.profile_id !== profileId) continue;
    if (d.date === PERMANENT_DELETION_DATE) permanentlyRemovedIds.add(d.task_id);
    else if (d.date === dateKey) skippedIds.add(d.task_id);
  }
  return { completions: completionMap, skippedIds, permanentlyRemovedIds };
}

function computeDayStatsFromRows(rows) {
  const countable = rows.filter(r => r.disposition === 'active');
  const done = countable.filter(r => r.status === 'done').length;
  const inprogress = countable.filter(r => r.status === 'inprogress').length;
  const notStarted = countable.filter(r => r.status === null).length;
  const skipped = rows.filter(r => r.disposition === 'skipped').length;
  const removed = rows.filter(r => r.disposition === 'removed').length;
  const total = countable.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, inprogress, notStarted, skipped, removed, total, pct };
}

// skipped excluded from denominator
const rows = [
  { id: 'a', status: 'done', disposition: 'active' },
  { id: 'b', status: null, disposition: 'active' },
  { id: 'c', status: 'skipped', disposition: 'skipped' },
];
const stats = computeDayStatsFromRows(rows);
assert(stats.total === 2, 'skipped excluded from total');
assert(stats.done === 1, 'one done');
assert(stats.pct === 50, '50% completion');
assert(stats.skipped === 1, 'skipped counted separately');

const overlay = buildRemoteDayOverlay(
  'kyle',
  '2026-07-09',
  [{ profile_id: 'kyle', task_id: 't1', date: '2026-07-09', status: 'done' }],
  [{ profile_id: 'kyle', task_id: 't2', date: '2026-07-09' }],
);
assert(overlay.completions.get('t1') === 'done', 'completion overlay');
assert(overlay.skippedIds.has('t2'), 'skip overlay');
assert(overlay.permanentlyRemovedIds.size === 0, 'no permanent yet');

const permOverlay = buildRemoteDayOverlay(
  'kyle',
  '2026-07-09',
  [],
  [{ profile_id: 'kyle', task_id: 'seed-1', date: PERMANENT_DELETION_DATE }],
);
assert(permOverlay.permanentlyRemovedIds.has('seed-1'), 'permanent deletion overlay');

console.log('day stats tests: all passed');
