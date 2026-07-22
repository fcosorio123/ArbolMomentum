/**
 * Canonical Momentum starter seed: one goal + three tasks for custom profiles.
 * Idempotent via stable IDs. Safe to rerun; never overwrites user-created content.
 *
 * Pure helpers have no Vite/cloud imports so unit tests can run in Node.
 */

export const MOMENTUM_STARTER_SEED_VERSION = 'v1';
export const MOMENTUM_STARTER_GOAL_KEY = 'momentum-starter-goal';

export const MOMENTUM_STARTER_TASK_KEYS = [
  'momentum-starter-explore',
  'momentum-starter-create',
  'momentum-starter-report',
] as const;

export type MomentumStarterTaskKey = (typeof MOMENTUM_STARTER_TASK_KEYS)[number];

export function momentumStarterGoalId(profileId: string): string {
  return `user-${profileId}-seed-${MOMENTUM_STARTER_GOAL_KEY}-${MOMENTUM_STARTER_SEED_VERSION}`;
}

export function momentumStarterTaskId(profileId: string, taskKey: MomentumStarterTaskKey): string {
  return `utask-${profileId}-seed-${taskKey}-${MOMENTUM_STARTER_SEED_VERSION}`;
}

export function isMomentumStarterGoalId(profileId: string, goalId: string): boolean {
  return goalId === momentumStarterGoalId(profileId);
}

export function isMomentumStarterTaskId(profileId: string, taskId: string): boolean {
  return MOMENTUM_STARTER_TASK_KEYS.some(k => taskId === momentumStarterTaskId(profileId, k));
}

const STARTER_GOAL = {
  title: 'Build momentum with Arbol',
  deepWhy:
    'Learn the Momentum loop: see your goal, take action on tasks, report what happened, and watch progress build.',
};

const STARTER_TASKS: Array<{
  key: MomentumStarterTaskKey;
  label: string;
  description: string;
  timeOfDay: 'morning' | 'evening';
  type: 'priority' | 'goal' | 'routine';
}> = [
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

export type StarterSeedStatus =
  | 'missing_all'
  | 'partial'
  | 'complete'
  | 'ineligible';

export interface StarterSeedInspection {
  profileId: string;
  status: StarterSeedStatus;
  goalPresent: boolean;
  taskKeysPresent: MomentumStarterTaskKey[];
  taskKeysMissing: MomentumStarterTaskKey[];
  goalCount: number;
  seededTaskCount: number;
}

export interface StarterSeedApplyResult extends StarterSeedInspection {
  changed: boolean;
  createdGoal: boolean;
  createdTaskKeys: MomentumStarterTaskKey[];
}

type GoalLike = {
  id: string;
  profileId: string;
  title: string;
  deepWhy: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  milestones: unknown[];
  createdAt: number;
};

type TaskLike = {
  id: string;
  profileId: string;
  label: string;
  description?: string;
  timeOfDay: 'morning' | 'evening';
  type: string;
  goalId?: string;
  createdAt: number;
  recurrence?: { type: 'daily' };
  potentialValue?: { score: number; label: string; source: string };
};

/** Pure inspect against in-memory goal/task arrays (also used by cloud backfill). */
export function inspectMomentumStarterSeedInData(
  profileId: string,
  goals: ReadonlyArray<{ id?: string }>,
  tasks: ReadonlyArray<{ id?: string; goalId?: string }>,
): StarterSeedInspection {
  if (!profileId || !profileId.startsWith('custom-')) {
    return {
      profileId,
      status: 'ineligible',
      goalPresent: false,
      taskKeysPresent: [],
      taskKeysMissing: [...MOMENTUM_STARTER_TASK_KEYS],
      goalCount: 0,
      seededTaskCount: 0,
    };
  }
  const goalId = momentumStarterGoalId(profileId);
  const goalPresent = goals.some(g => g.id === goalId);
  const taskKeysPresent = MOMENTUM_STARTER_TASK_KEYS.filter(k =>
    tasks.some(t => t.id === momentumStarterTaskId(profileId, k)),
  );
  const taskKeysMissing = MOMENTUM_STARTER_TASK_KEYS.filter(k => !taskKeysPresent.includes(k));
  const seededTaskCount = taskKeysPresent.length;
  let status: StarterSeedStatus = 'missing_all';
  if (goalPresent && taskKeysMissing.length === 0) status = 'complete';
  else if (goalPresent || seededTaskCount > 0) status = 'partial';
  return {
    profileId,
    status,
    goalPresent,
    taskKeysPresent: [...taskKeysPresent],
    taskKeysMissing: [...taskKeysMissing],
    goalCount: goalPresent ? 1 : 0,
    seededTaskCount,
  };
}

/**
 * Apply starter seed into goal/task arrays (immutable). Does not touch non-seed records.
 * Concurrency-safe when persisted under stable IDs (upsert by id).
 */
export function applyMomentumStarterSeedToData(
  profileId: string,
  goalsIn: GoalLike[],
  tasksIn: TaskLike[],
  now = Date.now(),
): { goals: GoalLike[]; tasks: TaskLike[]; result: StarterSeedApplyResult } {
  const before = inspectMomentumStarterSeedInData(profileId, goalsIn, tasksIn);
  if (before.status === 'ineligible' || before.status === 'complete') {
    return {
      goals: goalsIn,
      tasks: tasksIn,
      result: { ...before, changed: false, createdGoal: false, createdTaskKeys: [] },
    };
  }

  const gId = momentumStarterGoalId(profileId);
  let goals = [...goalsIn];
  let createdGoal = false;
  if (!before.goalPresent) {
    goals = [
      ...goals,
      {
        id: gId,
        profileId,
        title: STARTER_GOAL.title,
        deepWhy: STARTER_GOAL.deepWhy,
        targetValue: 100,
        currentValue: 0,
        unit: '',
        milestones: [],
        createdAt: now,
      },
    ];
    createdGoal = true;
  }

  let tasks = [...tasksIn];
  const createdTaskKeys: MomentumStarterTaskKey[] = [];
  for (const def of STARTER_TASKS) {
    const tid = momentumStarterTaskId(profileId, def.key);
    if (tasks.some(t => t.id === tid)) continue;
    tasks = [
      ...tasks,
      {
        id: tid,
        profileId,
        label: def.label,
        description: def.description,
        timeOfDay: def.timeOfDay,
        type: def.type,
        goalId: gId,
        createdAt: now,
        recurrence: { type: 'daily' },
        potentialValue: { score: 3, label: 'Moderate', source: 'default' },
      },
    ];
    createdTaskKeys.push(def.key);
  }

  const after = inspectMomentumStarterSeedInData(profileId, goals, tasks);
  return {
    goals,
    tasks,
    result: {
      ...after,
      changed: createdGoal || createdTaskKeys.length > 0,
      createdGoal,
      createdTaskKeys,
    },
  };
}

/** Storage keys must match personalGoals.ts / userTasks.ts (avoid importing those — they pull Vite-only cloudBackup). */
function goalsStorageKey(profileId: string) {
  return `arbol-personal-goals-${profileId}`;
}
function tasksStorageKey(profileId: string) {
  return `arbol-user-tasks-${profileId}`;
}
function goalsVersionKey(profileId: string) {
  return `arbol-goals-version-${profileId}`;
}

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * LocalStorage ensure — one authoritative client entry point.
 * Writes goals then tasks under stable IDs; cloud upsert merges by id (concurrency-safe).
 */
export function ensureMomentumStarterSeed(profileId: string): StarterSeedApplyResult {
  if (!profileId.startsWith('custom-')) {
    return {
      profileId,
      status: 'ineligible',
      goalPresent: false,
      taskKeysPresent: [],
      taskKeysMissing: [...MOMENTUM_STARTER_TASK_KEYS],
      goalCount: 0,
      seededTaskCount: 0,
      changed: false,
      createdGoal: false,
      createdTaskKeys: [],
    };
  }

  const goalsIn = readJsonArray<GoalLike>(goalsStorageKey(profileId));
  const tasksIn = readJsonArray<TaskLike>(tasksStorageKey(profileId));
  const { goals, tasks, result } = applyMomentumStarterSeedToData(profileId, goalsIn, tasksIn);

  if (!result.changed) return result;

  try {
    localStorage.setItem(goalsStorageKey(profileId), JSON.stringify(goals));
    localStorage.setItem(tasksStorageKey(profileId), JSON.stringify(tasks));
    localStorage.setItem(goalsVersionKey(profileId), 'v6-2026-07-13');
  } catch (err) {
    // Best-effort rollback so we do not leave goal-without-tasks (or vice versa) after a write failure.
    try {
      localStorage.setItem(goalsStorageKey(profileId), JSON.stringify(goalsIn));
      localStorage.setItem(tasksStorageKey(profileId), JSON.stringify(tasksIn));
    } catch { /* ignore */ }
    throw err instanceof Error ? err : new Error(String(err));
  }

  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch { /* ignore */ }

  // Cloud sync without static-importing Vite aliases (safe for Node unit tests).
  void import('./cloudBackup')
    .then(({ scheduleSave }) => scheduleSave(profileId))
    .catch(() => { /* offline / non-browser */ });

  return result;
}

export function inspectMomentumStarterSeed(profileId: string): StarterSeedInspection {
  return inspectMomentumStarterSeedInData(
    profileId,
    readJsonArray(goalsStorageKey(profileId)),
    readJsonArray(tasksStorageKey(profileId)),
  );
}

/** Names used only to locate recent profiles for backfill (mutation key is always profile id). */
export const BACKFILL_TARGET_DISPLAY_NAMES = [
  'david',
  'james',
  'kevin',
  'test profile',
  'testprofile',
] as const;

export function matchesBackfillDisplayName(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return (BACKFILL_TARGET_DISPLAY_NAMES as readonly string[]).includes(n)
    || /^test[\s_-]*profile$/i.test(name.trim());
}

export function isWithinLastHours(createdAt: number, hours: number, now = Date.now()): boolean {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
  return createdAt >= now - hours * 60 * 60 * 1000;
}

export function shouldBackfillCustomProfile(
  meta: { id: string; name: string; createdAt: number },
  opts: { hours: number; now?: number } = { hours: 36 },
): boolean {
  if (!meta.id.startsWith('custom-')) return false;
  if (matchesBackfillDisplayName(meta.name)) return true;
  return isWithinLastHours(meta.createdAt, opts.hours, opts.now);
}
