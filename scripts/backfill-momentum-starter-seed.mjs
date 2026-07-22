/**
 * Controlled cloud backfill: ensure Momentum starter seed on recent custom profiles.
 * Mutation key = profile id. Display names used only for targeting/verification.
 *
 * Usage: node scripts/backfill-momentum-starter-seed.mjs
 * Dry run:  DRY_RUN=1 node scripts/backfill-momentum-starter-seed.mjs
 */
import assert from 'node:assert/strict';

const PROJECT = 'lhbvzojmtvjeauqnnmdu';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYnZ6b2ptdHZqZWF1cW5ubWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk3OTYsImV4cCI6MjA5NDY3NTc5Nn0.ZRNFRD6I2E03nmP3N8ScDQig5SeVsSbliyyw-XjkEXI';
const FN = `https://${PROJECT}.supabase.co/functions/v1/make-server-5d90ddf5`;
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const HOURS = Number(process.env.BACKFILL_HOURS || 36);

const VERSION = 'v1';
const GOAL_KEY = 'momentum-starter-goal';
const TASK_KEYS = [
  'momentum-starter-explore',
  'momentum-starter-create',
  'momentum-starter-report',
];

const TARGET_NAMES = new Set(['david', 'james', 'kevin', 'test profile']);

function goalId(pid) {
  return `user-${pid}-seed-${GOAL_KEY}-${VERSION}`;
}
function taskId(pid, key) {
  return `utask-${pid}-seed-${key}-${VERSION}`;
}

function matchesName(name) {
  const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return TARGET_NAMES.has(n) || /^test[\s_-]*profile$/i.test(String(name || '').trim());
}

function withinHours(createdAt, now) {
  return Number.isFinite(createdAt) && createdAt > 0 && createdAt >= now - HOURS * 3600_000;
}

function shouldTarget(p, now) {
  if (!String(p.id || '').startsWith('custom-')) return false;
  if (matchesName(p.name)) return true;
  return withinHours(Number(p.createdAt) || 0, now);
}

const STARTER_GOAL = {
  title: 'Build momentum with Arbol',
  deepWhy:
    'Learn the Momentum loop: see your goal, take action on tasks, report what happened, and watch progress build.',
};

const STARTER_TASKS = [
  {
    key: 'momentum-starter-explore',
    label: 'Explore Arbol Momentum',
    description: 'Open Momentum and review your starter goal and these three tasks.',
    timeOfDay: 'morning',
    type: 'priority',
  },
  {
    key: 'momentum-starter-create',
    label: 'Create a goal and task',
    description: 'Create at least one personal goal and add a task that helps you make progress toward it.',
    timeOfDay: 'morning',
    type: 'goal',
  },
  {
    key: 'momentum-starter-report',
    label: 'Complete a task and report back',
    description: 'Complete a task, report what happened, and share feedback on the Momentum experience.',
    timeOfDay: 'evening',
    type: 'routine',
  },
];

function inspect(pid, goals, tasks) {
  const gPresent = goals.some(g => g.id === goalId(pid));
  const present = TASK_KEYS.filter(k => tasks.some(t => t.id === taskId(pid, k)));
  const missing = TASK_KEYS.filter(k => !present.includes(k));
  let status = 'missing_all';
  if (gPresent && missing.length === 0) status = 'complete';
  else if (gPresent || present.length > 0) status = 'partial';
  return { status, gPresent, present, missing, seededTaskCount: present.length };
}

function apply(pid, goalsIn, tasksIn, now) {
  const before = inspect(pid, goalsIn, tasksIn);
  if (before.status === 'complete') {
    return { goals: goalsIn, tasks: tasksIn, before, after: before, changed: false, createdGoal: false, createdTasks: [] };
  }
  let goals = Array.isArray(goalsIn) ? [...goalsIn] : [];
  let tasks = Array.isArray(tasksIn) ? [...tasksIn] : [];
  let createdGoal = false;
  const createdTasks = [];
  const gid = goalId(pid);
  if (!before.gPresent) {
    goals.push({
      id: gid,
      profileId: pid,
      title: STARTER_GOAL.title,
      deepWhy: STARTER_GOAL.deepWhy,
      targetValue: 100,
      currentValue: 0,
      unit: '',
      milestones: [],
      createdAt: now,
    });
    createdGoal = true;
  }
  for (const def of STARTER_TASKS) {
    const tid = taskId(pid, def.key);
    if (tasks.some(t => t.id === tid)) continue;
    tasks.push({
      id: tid,
      profileId: pid,
      label: def.label,
      description: def.description,
      timeOfDay: def.timeOfDay,
      type: def.type,
      goalId: gid,
      createdAt: now,
      recurrence: { type: 'daily' },
      potentialValue: { score: 3, label: 'Moderate', source: 'default' },
    });
    createdTasks.push(def.key);
  }
  const after = inspect(pid, goals, tasks);
  return {
    goals,
    tasks,
    before,
    after,
    changed: createdGoal || createdTasks.length > 0,
    createdGoal,
    createdTasks,
  };
}

async function api(path, opts = {}) {
  const res = await fetch(`${FN}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${ANON}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const now = Date.now();
  console.log(`Momentum starter backfill (hours=${HOURS}, dryRun=${DRY_RUN})`);

  const roster = await api('/profile-roster', { method: 'GET' });
  assert.equal(roster.ok, true);
  const profiles = Array.isArray(roster.profiles) ? roster.profiles : [];
  const targets = profiles.filter(p => shouldTarget(p, now));
  console.log(`Roster size=${profiles.length}; targets=${targets.length}`);

  const report = [];

  for (const p of targets) {
    const pid = p.id;
    const name = p.name;
    const createdAt = Number(p.createdAt) || 0;
    let row = {
      profileId: pid,
      name,
      createdAt,
      createdAtIso: createdAt ? new Date(createdAt).toISOString() : null,
      previousStatus: null,
      action: null,
      finalGoalCount: null,
      finalSeededTaskCount: null,
      result: null,
      error: null,
    };

    try {
      const backupRes = await api(`/backup/${encodeURIComponent(pid)}`, { method: 'GET' });
      const backup = backupRes?.data && typeof backupRes.data === 'object' ? backupRes.data : {};
      const goalsIn = Array.isArray(backup.personalGoals) ? backup.personalGoals : [];
      const tasksIn = Array.isArray(backup.userTasks) ? backup.userTasks : [];
      const userGoalCountBefore = goalsIn.filter(g => String(g.id || '').startsWith(`user-${pid}-`)).length;
      const applied = apply(pid, goalsIn, tasksIn, now);
      row.previousStatus = applied.before.status;
      row.finalGoalCount = applied.goals.filter(g => g.id === goalId(pid)).length;
      row.finalSeededTaskCount = applied.after.seededTaskCount;

      if (!applied.changed) {
        row.action = 'noop_already_complete_or_unchanged';
        row.result = 'ok';
      } else if (DRY_RUN) {
        row.action = `dry_run_would_create_goal=${applied.createdGoal}_tasks=${applied.createdTasks.join(',')}`;
        row.result = 'dry_run';
      } else {
        const payload = {
          ...backup,
          personalGoals: applied.goals,
          userTasks: applied.tasks,
          customProfileMeta: backup.customProfileMeta || {
            id: pid,
            name,
            avatar: p.avatar || '🌱',
            profileType: p.profileType || 'fresh',
            createdAt,
          },
          savedAt: Date.now(),
        };
        const saved = await api(`/backup/${encodeURIComponent(pid)}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        assert.equal(saved.ok, true);
        // verify
        const verify = await api(`/backup/${encodeURIComponent(pid)}`, { method: 'GET' });
        const vg = Array.isArray(verify?.data?.personalGoals) ? verify.data.personalGoals : [];
        const vt = Array.isArray(verify?.data?.userTasks) ? verify.data.userTasks : [];
        const v = inspect(pid, vg, vt);
        row.finalGoalCount = v.gPresent ? 1 : 0;
        row.finalSeededTaskCount = v.seededTaskCount;
        row.action = `created_goal=${applied.createdGoal};created_tasks=${applied.createdTasks.join('|') || 'none'};user_goals_before=${userGoalCountBefore}`;
        row.result = v.status === 'complete' ? 'ok' : `incomplete:${v.status}`;
      }
    } catch (err) {
      row.error = String(err);
      row.result = 'error';
    }

    report.push(row);
    console.log(
      `- ${row.name} (${row.profileId}) prev=${row.previousStatus} → ${row.result} seededTasks=${row.finalSeededTaskCount} ${row.action || ''}`,
    );
  }

  const ok = report.filter(r => r.result === 'ok' || r.result === 'dry_run').length;
  const fail = report.filter(r => r.result === 'error' || (r.result && String(r.result).startsWith('incomplete'))).length;
  console.log(`\nDone. ok/dry=${ok} fail=${fail} total=${report.length}`);
  console.log(JSON.stringify({ dryRun: DRY_RUN, hours: HOURS, report }, null, 2));
  if (fail > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
