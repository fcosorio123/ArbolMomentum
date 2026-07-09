// ──────────────────────────────────────────────
// Cloud Backup: localStorage <-> Supabase KV
// ──────────────────────────────────────────────
// Backs up all profile-scoped localStorage data to the server so it
// survives Figma Make preview URL changes (which wipe localStorage).

import { supabase } from '/utils/supabase/client';
import { getStorageKey } from './environment';

const FN = 'make-server-5d90ddf5';
const PERSONAL_GOALS_KEY = (profileId: string) => `arbol-personal-goals-${profileId}`;
const LEGACY_GOALS_KEY = (profileId: string) => `arbol-goals-${profileId}`;
const TASK_GOAL_LINKS_KEY = (profileId: string) => `arbol-task-goal-links-${profileId}`;
const DELETED_DEFAULT_GOALS_KEY = (profileId: string) => `arbol-deleted-default-goals-${profileId}`;
const LOCAL_CLOUD_AT_KEY = (profileId: string) => `arbol-local-cloud-at-${profileId}`;

function isUserCreatedGoal(profileId: string, goalId: string): boolean {
  return goalId.startsWith(`user-${profileId}-`);
}

function readPersonalGoals(profileId: string): unknown {
  const current = localStorage.getItem(PERSONAL_GOALS_KEY(profileId));
  if (current) {
    try { return JSON.parse(current); } catch { return null; }
  }
  const legacy = localStorage.getItem(LEGACY_GOALS_KEY(profileId));
  if (!legacy) return null;
  try { return JSON.parse(legacy); } catch { return null; }
}

// ── Collect all localStorage entries for a profile ──────────────────

function collectLocalData(profileId: string): Record<string, unknown> {
  const taskStatuses: Record<string, string> = {};
  const taskDeletions: Record<string, string> = {};
  const streakDays: Record<string, string> = {};
  const taskNotes: Record<string, string> = {};
  const taskBlocked: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(`task-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) taskStatuses[key] = v;
    } else if (key.startsWith(`task-del-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) taskDeletions[key] = v;
    } else if (key.startsWith(`streak-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) streakDays[key] = v;
    } else if (key.startsWith(`task-note-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) taskNotes[key] = v;
    } else if (key.startsWith(`arbol-task-blocked-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) taskBlocked[key] = v;
    }
  }

  const raw = (k: string) => {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
  };

  const tourDismissals: Record<string, string> = {};
  const tourBases = [
    'arbol-tour-home-done', 'arbol-tour-goals-done', 'arbol-tour-tasks-done',
    'arbol-tour-week-done', 'arbol-tour-calendar-done', 'arbol-tour-checkin-done',
  ];
  for (const base of tourBases) {
    const k = getStorageKey(`${base}-${profileId}`);
    const v = localStorage.getItem(k);
    if (v) tourDismissals[k] = v;
  }
  const coachK = getStorageKey(`arbol-coach-done-${profileId}`);
  const coachV = localStorage.getItem(coachK);
  if (coachV) tourDismissals[coachK] = coachV;

  return {
    userTasks:      raw(`arbol-user-tasks-${profileId}`),
    personalGoals:  readPersonalGoals(profileId),
    userCategories: raw(`arbol-user-cats-${profileId}`),
    goalsVersion:   localStorage.getItem(`arbol-goals-version-${profileId}`),
    goalLogs:       raw(`arbol-goal-logs-${profileId}`),
    streakBest:     raw(`streak-best-${profileId}`),
    profileEmail:   localStorage.getItem(getStorageKey(`arbol-email-${profileId}`)) || null,
    liveReports:    raw(`arbol-live-reports-${profileId}`),
    liveSnapshots:  raw(`arbol-live-snapshots-${profileId}`),
    permanentlyHiddenSeedTasks: raw(`arbol-hidden-seed-${profileId}`),
    taskGoalLinks:    raw(TASK_GOAL_LINKS_KEY(profileId)),
    deletedDefaultGoals: raw(DELETED_DEFAULT_GOALS_KEY(profileId)),
    taskStatuses,
    taskDeletions,
    streakDays,
    taskNotes,
    taskBlocked,
    tourDismissals,
    savedAt: Date.now(),
  };
}

// ── Merge cloud user goals into local (never drop local defaults) ───

function mergePersonalGoalsFromCloud(profileId: string, cloudGoals: unknown): boolean {
  if (!Array.isArray(cloudGoals) || cloudGoals.length === 0) return false;

  const cloudUser = cloudGoals.filter(
    (g: { id?: string }) => g?.id && isUserCreatedGoal(profileId, g.id),
  );
  if (cloudUser.length === 0) return false;

  let local: { id: string; createdAt?: number }[] = [];
  try {
    const raw = localStorage.getItem(PERSONAL_GOALS_KEY(profileId))
      || localStorage.getItem(LEGACY_GOALS_KEY(profileId));
    if (raw) local = JSON.parse(raw);
  } catch { local = []; }

  if (local.length === 0) {
    localStorage.setItem(PERSONAL_GOALS_KEY(profileId), JSON.stringify(cloudGoals));
    return true;
  }

  const byId = new Map(local.map(g => [g.id, g]));
  let changed = false;
  for (const cg of cloudUser) {
    const existing = byId.get(cg.id);
    if (!existing) {
      byId.set(cg.id, cg);
      changed = true;
    } else if (
      (cg.createdAt ?? 0) >= (existing.createdAt ?? 0) &&
      JSON.stringify(existing) !== JSON.stringify(cg)
    ) {
      byId.set(cg.id, cg);
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(PERSONAL_GOALS_KEY(profileId), JSON.stringify(Array.from(byId.values())));
  }
  return changed;
}

function mergeTaskGoalLinksFromCloud(profileId: string, cloudLinks: unknown): boolean {
  if (!Array.isArray(cloudLinks) || cloudLinks.length === 0) return false;

  const cloudUserLinks = cloudLinks.filter(
    (l: { profileId?: string; isUserCreated?: boolean }) =>
      l?.profileId === profileId && l.isUserCreated,
  );
  if (cloudUserLinks.length === 0) return false;

  let local: { taskId: string; goalId: string; isUserCreated?: boolean; createdAt?: number }[] = [];
  try {
    const raw = localStorage.getItem(TASK_GOAL_LINKS_KEY(profileId));
    if (raw) local = JSON.parse(raw);
  } catch { local = []; }

  if (local.length === 0) {
    localStorage.setItem(TASK_GOAL_LINKS_KEY(profileId), JSON.stringify(cloudLinks));
    return true;
  }

  const byKey = new Map(
    local.map(l => [`${l.taskId}:${l.goalId}`, l]),
  );
  let changed = false;
  for (const cl of cloudUserLinks) {
    const key = `${cl.taskId}:${cl.goalId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, cl);
      changed = true;
    } else if ((cl.createdAt ?? 0) > (existing.createdAt ?? 0)) {
      byKey.set(key, cl);
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(TASK_GOAL_LINKS_KEY(profileId), JSON.stringify(Array.from(byKey.values())));
  }
  return changed;
}

function hasLocalProfileData(profileId: string): boolean {
  if (localStorage.getItem(PERSONAL_GOALS_KEY(profileId))
    || localStorage.getItem(LEGACY_GOALS_KEY(profileId))
    || localStorage.getItem(`arbol-hidden-seed-${profileId}`)) {
    return true;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith(`task-${profileId}-`) || k.startsWith(`streak-${profileId}-`))) {
      return true;
    }
  }
  return false;
}

// ── Apply a backup payload back into localStorage ────────────────────

function applyLocalData(profileId: string, data: Record<string, unknown>): void {
  const write = (k: string, v: unknown) => {
    if (v === null || v === undefined) return;
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  };

  write(`arbol-user-tasks-${profileId}`, data.userTasks);
  write(PERSONAL_GOALS_KEY(profileId), data.personalGoals);
  write(`arbol-user-cats-${profileId}`, data.userCategories);
  write(`arbol-goal-logs-${profileId}`, data.goalLogs);
  write(`streak-best-${profileId}`, data.streakBest);
  write(`arbol-live-reports-${profileId}`, data.liveReports);
  write(`arbol-live-snapshots-${profileId}`, data.liveSnapshots);
  write(`arbol-hidden-seed-${profileId}`, data.permanentlyHiddenSeedTasks);
  write(TASK_GOAL_LINKS_KEY(profileId), data.taskGoalLinks);
  write(DELETED_DEFAULT_GOALS_KEY(profileId), data.deletedDefaultGoals);

  if (typeof data.profileEmail === 'string' && data.profileEmail.trim()) {
    localStorage.setItem(getStorageKey(`arbol-email-${profileId}`), data.profileEmail.trim());
  }

  if (data.goalsVersion && typeof data.goalsVersion === 'string') {
    localStorage.setItem(`arbol-goals-version-${profileId}`, data.goalsVersion);
  }

  const restoreMap = (map: unknown) => {
    if (!map || typeof map !== 'object') return;
    for (const [k, v] of Object.entries(map as Record<string, string>)) {
      if (k && v) localStorage.setItem(k, v);
    }
  };

  restoreMap(data.taskStatuses);
  restoreMap(data.taskDeletions);
  restoreMap(data.streakDays);
  restoreMap(data.taskNotes);
  restoreMap(data.taskBlocked);
  restoreMap(data.tourDismissals);
}

// ── API calls ────────────────────────────────────────────────────────

async function invokeWithRetry(
  path: string,
  options: { method: string; body?: Record<string, unknown> },
  maxAttempts = 3,
): Promise<{ data: any; error: any }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await supabase.functions.invoke(path, {
        method: options.method,
        // Pass plain object so the SDK serialises it correctly.
        // Passing a pre-stringified string causes the SDK to skip body assignment.
        ...(options.body !== undefined ? { body: options.body } : {}),
      });
      // If the Supabase client returned an error object (non-2xx), don't retry.
      return result;
    } catch (err) {
      // FunctionsFetchError = network-level failure (e.g. cold start). Retry.
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      } else {
        return { data: null, error: err };
      }
    }
  }
  return { data: null, error: new Error('unreachable') };
}

function isTransientError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes('FunctionsFetchError') || msg.includes('Failed to send') || msg.includes('NetworkError');
}

export async function saveToCloud(profileId: string): Promise<void> {
  const payload = collectLocalData(profileId);
  const { error } = await invokeWithRetry(`${FN}/backup/${profileId}`, {
    method: 'POST',
    body: payload,
  });
  // Silently swallow transient network failures - localStorage is the source of truth
  if (error && !isTransientError(error)) {
    console.warn('[CloudBackup] Save failed:', error);
  }
}

export async function restoreFromCloud(profileId: string): Promise<boolean> {
  const result = await syncProfileFromCloud(profileId);
  return result === 'full-restore';
}

/** Merge profile-scoped data from cloud; full restore only when local is empty. */
export async function syncProfileFromCloud(
  profileId: string,
): Promise<'full-restore' | 'merged' | 'noop'> {
  const { data, error } = await invokeWithRetry(`${FN}/backup/${profileId}`, {
    method: 'GET',
  });
  if (error) {
    if (!isTransientError(error)) console.warn('[CloudBackup] Sync failed:', error);
    return 'noop';
  }
  if (!data?.ok || !data?.data) return 'noop';

  const cloud = data.data as Record<string, unknown>;
  const cloudSavedAt = typeof cloud.savedAt === 'number' ? cloud.savedAt : 0;

  if (!hasLocalProfileData(profileId)) {
    applyLocalData(profileId, cloud);
    localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(cloudSavedAt || Date.now()));
    return 'full-restore';
  }

  let merged = false;
  if (mergePersonalGoalsFromCloud(profileId, cloud.personalGoals)) merged = true;
  if (mergeTaskGoalLinksFromCloud(profileId, cloud.taskGoalLinks)) merged = true;

  if (merged) {
    localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(Date.now()));
    scheduleSave(profileId);
    return 'merged';
  }

  return 'noop';
}

// ── Debounced save ───────────────────────────────────────────────────
// Waits 2 s after the last call before actually saving, so rapid
// consecutive writes (e.g. toggling tasks) only produce one request.

const pendingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function scheduleSave(profileId: string): void {
  if (pendingTimers[profileId]) clearTimeout(pendingTimers[profileId]);
  pendingTimers[profileId] = setTimeout(() => {
    delete pendingTimers[profileId];
    saveToCloud(profileId);
  }, 2000);
}
