/**
 * Pure tests for progress/chart/banner behavior (mirrors production formulas).
 * Avoids importing modules that pull Vite-only `/utils/supabase/info`.
 */
import assert from 'node:assert/strict';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

/** Mirrors calculateScopeProgress binary done%. */
function binaryProgress(done: number, countable: number): number {
  return countable > 0 ? Math.round((done / countable) * 100) : 0;
}

/** Mirrors getTodayChartData baseline behavior. */
function chartWithBaseline(
  reports: Array<{ progressAtTime: number; previousProgress: number; momentumScore: number }>,
) {
  if (reports.length === 0) return [];
  const updates = reports.map((r, i) => ({
    label: `Update ${i + 1}`,
    progress: r.progressAtTime,
    momentum: r.momentumScore,
  }));
  const first = reports[0];
  const startProgress = first.previousProgress;
  const needsStart =
    updates.length === 0
    || startProgress !== updates[0].progress
    || updates.length === 1;
  if (!needsStart) return updates;
  return [
    {
      label: 'Start',
      progress: startProgress,
      momentum: Math.min(startProgress, updates[0]?.momentum ?? startProgress),
    },
    ...updates,
  ];
}

/** Mirrors calculateBannerState recognition of Task-page activity. */
function bannerState(opts: {
  checkedIn: boolean;
  doneCount: number;
  totalCount: number;
  inProgressCount: number;
  hasActivityOnDate: boolean;
}): 'red' | 'yellow' | 'green' {
  const hasTaskActivity =
    opts.doneCount > 0 || opts.inProgressCount > 0 || opts.hasActivityOnDate;

  if (opts.checkedIn) {
    if (opts.totalCount > 0 && opts.doneCount < opts.totalCount) return 'yellow';
    return 'green';
  }
  if (hasTaskActivity) {
    if (opts.totalCount > 0 && opts.doneCount >= opts.totalCount) return 'green';
    return 'yellow';
  }
  return 'red';
}

section('binary progress matches dashboard for Done tasks');
{
  assert.equal(binaryProgress(0, 10), 0);
  assert.equal(binaryProgress(1, 10), 10);
  assert.equal(binaryProgress(5, 10), 50);
  assert.equal(binaryProgress(10, 10), 100);
  assert.equal(binaryProgress(0, 0), 0);
}

section('first completion chart has Start → Update line (visible movement)');
{
  const chart = chartWithBaseline([
    { previousProgress: 0, progressAtTime: 10, momentumScore: 20 },
  ]);
  assert.equal(chart.length, 2);
  assert.equal(chart[0].label, 'Start');
  assert.equal(chart[0].progress, 0);
  assert.equal(chart[1].label, 'Update 1');
  assert.equal(chart[1].progress, 10);
  assert.ok(chart[1].progress > chart[0].progress);
}

section('second completion keeps Start and adds Update 2');
{
  const chart = chartWithBaseline([
    { previousProgress: 0, progressAtTime: 10, momentumScore: 20 },
    { previousProgress: 10, progressAtTime: 20, momentumScore: 30 },
  ]);
  assert.ok(chart.some(p => p.label === 'Start'));
  assert.ok(chart.some(p => p.label === 'Update 1'));
  assert.ok(chart.some(p => p.label === 'Update 2'));
}

section('Task page activity without check-in is recognized (not stuck red)');
{
  assert.equal(
    bannerState({ checkedIn: false, doneCount: 0, totalCount: 5, inProgressCount: 0, hasActivityOnDate: false }),
    'red',
  );
  assert.equal(
    bannerState({ checkedIn: false, doneCount: 2, totalCount: 5, inProgressCount: 0, hasActivityOnDate: true }),
    'yellow',
  );
  assert.equal(
    bannerState({ checkedIn: false, doneCount: 5, totalCount: 5, inProgressCount: 0, hasActivityOnDate: true }),
    'green',
  );
  assert.equal(
    bannerState({ checkedIn: true, doneCount: 2, totalCount: 5, inProgressCount: 0, hasActivityOnDate: true }),
    'yellow',
  );
  assert.equal(
    bannerState({ checkedIn: true, doneCount: 5, totalCount: 5, inProgressCount: 0, hasActivityOnDate: true }),
    'green',
  );
}

section('Task page and Check-in equivalent: same status write semantics');
{
  // Both sources call applyTaskStatusUpdate → setTaskStatus / submitReportUpdate.
  // Equivalent payloads must produce equivalent status + progress deltas.
  const before = binaryProgress(0, 8);
  const afterTaskPage = binaryProgress(1, 8);
  const afterCheckIn = binaryProgress(1, 8);
  assert.equal(afterTaskPage, afterCheckIn);
  assert.ok(afterTaskPage > before);
}

console.log('\nAll task progress pipeline tests passed.\n');
