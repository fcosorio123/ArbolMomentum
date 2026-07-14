// ──────────────────────────────────────────────
// Cloud Backup: localStorage <-> Supabase KV
// ──────────────────────────────────────────────
// Backs up all profile-scoped localStorage data to the server so it
// survives Figma Make preview URL changes (which wipe localStorage).

import { supabase } from '/utils/supabase/client';
import { getStorageKey } from './environment';
import { getActiveProfiles, isProfileArchived, applyProfileArchivedFromSync } from './profiles';
import { CALENDAR_PREFS_KEY, CALENDAR_PROVIDER_KEY } from './calendarExport';
import { buildNudgeSnapshot } from './dashboardSnapshot';

const FN = 'make-server-5d90ddf5';
const PERSONAL_GOALS_KEY = (profileId: string) => `arbol-personal-goals-${profileId}`;
const LEGACY_GOALS_KEY = (profileId: string) => `arbol-goals-${profileId}`;
const TASK_GOAL_LINKS_KEY = (profileId: string) => `arbol-task-goal-links-${profileId}`;
const DELETED_DEFAULT_GOALS_KEY = (profileId: string) => `arbol-deleted-default-goals-${profileId}`;
const LOCAL_CLOUD_AT_KEY = (profileId: string) => `arbol-local-cloud-at-${profileId}`;
const TZ_OFFSET_KEY = (profileId: string) => `arbol-tz-offset-${profileId}`;

export function getStoredTzOffset(profileId: string): number {
  const raw = localStorage.getItem(TZ_OFFSET_KEY(profileId));
  if (raw != null && raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return new Date().getTimezoneOffset();
}

function persistTzOffset(profileId: string, offset: unknown): void {
  if (typeof offset === 'number' && Number.isFinite(offset)) {
    localStorage.setItem(TZ_OFFSET_KEY(profileId), String(offset));
  }
}

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

/** Prefer stronger task status so mobile/desktop done marks aren't lost. */
function preferTaskStatus(a: string | undefined, b: string | undefined): string {
  const rank = (s: string | undefined) => {
    if (s === 'done') return 4;
    if (s === 'inprogress') return 3;
    if (s === 'skipped') return 2;
    if (s) return 1;
    return 0;
  };
  return (rank(b) > rank(a) ? b : a) || a || b || '';
}

function preferBooleanish(a: string | undefined, b: string | undefined): string {
  if (a === 'true' || b === 'true') return 'true';
  return b || a || '';
}

function preferVisitCount(a: string | undefined, b: string | undefined): string {
  const na = parseInt(a || '0', 10) || 0;
  const nb = parseInt(b || '0', 10) || 0;
  return String(Math.max(na, nb));
}

/**
 * Union-merge string maps into localStorage.
 * `prefer` picks the winning value when both sides have the same key.
 * Returns true if any local key was written/changed.
 */
function unionMergeStringMap(
  cloudMap: unknown,
  prefer: (local: string | undefined, cloud: string | undefined) => string,
): boolean {
  if (!cloudMap || typeof cloudMap !== 'object') return false;
  let changed = false;
  for (const [k, cloudVal] of Object.entries(cloudMap as Record<string, string>)) {
    if (!k || cloudVal == null) continue;
    const localVal = localStorage.getItem(k) ?? undefined;
    const next = prefer(localVal, String(cloudVal));
    if (!next) continue;
    if (localVal !== next) {
      localStorage.setItem(k, next);
      changed = true;
    }
  }
  return changed;
}

function collectLocalData(profileId: string): Record<string, unknown> {
  const taskStatuses: Record<string, string> = {};
  const taskDeletions: Record<string, string> = {};
  const streakDays: Record<string, string> = {};
  const taskNotes: Record<string, string> = {};
  const taskBlocked: Record<string, string> = {};
  const goalProgressLogs: Record<string, string> = {};
  const checkInDays: Record<string, string> = {};
  const feedbackEntries: Record<string, string> = {};
  const goalTaskChecks: Record<string, string> = {};
  const visitCounts: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('arbol-goal-progress-')) {
      const v = localStorage.getItem(key);
      if (v) {
        try {
          const log = JSON.parse(v) as { profileId?: string };
          if (log.profileId === profileId) goalProgressLogs[key] = v;
        } catch { /* ignore */ }
      }
    } else if (key.startsWith(`task-${profileId}-`)) {
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
    } else if (key.startsWith(`arbol-checkin-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) checkInDays[key] = v;
    } else if (key.startsWith(`arbol-feedback-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) feedbackEntries[key] = v;
    } else if (key.startsWith(`arbol-gtask-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) goalTaskChecks[key] = v;
    } else if (key.startsWith(`visit-${profileId}-`)) {
      const v = localStorage.getItem(key);
      if (v) visitCounts[key] = v;
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
  const allToursK = getStorageKey(`arbol-tours-all-dismissed-${profileId}`);
  const allToursV = localStorage.getItem(allToursK);
  if (allToursV) tourDismissals[allToursK] = allToursV;

  const profile = getActiveProfiles(true).find(p => p.id === profileId);

  return {
    userTasks:      raw(`arbol-user-tasks-${profileId}`),
    personalGoals:  readPersonalGoals(profileId),
    userCategories: raw(`arbol-user-cats-${profileId}`),
    goalsVersion:   localStorage.getItem(`arbol-goals-version-${profileId}`),
    goalLogs:       raw(`arbol-goal-logs-${profileId}`),
    streakBest:     raw(`streak-best-${profileId}`),
    profileEmail:   localStorage.getItem(getStorageKey(`arbol-email-${profileId}`)) || null,
    alertPrefs:     raw(getStorageKey(`arbol-alert-prefs-${profileId}`)),
    tzOffset:       getStoredTzOffset(profileId),
    nudgeSnapshot:  profile ? buildNudgeSnapshot(profileId, profile.name) : null,
    liveReports:    raw(`arbol-live-reports-${profileId}`),
    liveSnapshots:  raw(`arbol-live-snapshots-${profileId}`),
    permanentlyHiddenSeedTasks: raw(`arbol-hidden-seed-${profileId}`),
    seedOverrides: raw(`arbol-seed-overrides-${profileId}`),
    taskGoalLinks:    raw(TASK_GOAL_LINKS_KEY(profileId)),
    deletedDefaultGoals: raw(DELETED_DEFAULT_GOALS_KEY(profileId)),
    taskStatuses,
    taskDeletions,
    streakDays,
    taskNotes,
    taskBlocked,
    goalProgressLogs,
    checkInDays,
    feedbackEntries,
    goalTaskChecks,
    visitCounts,
    tourDismissals,
    calendarPrefs: raw(CALENDAR_PREFS_KEY(profileId)),
    calendarProvider: localStorage.getItem(CALENDAR_PROVIDER_KEY(profileId)) || null,
    profileArchived: isProfileArchived(profileId),
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
  // Auto-seeded default goals alone must not block a full cloud restore on new devices.
  if (localStorage.getItem(`arbol-user-tasks-${profileId}`)) return true;
  if (localStorage.getItem(`arbol-user-cats-${profileId}`)) return true;
  if (localStorage.getItem(`arbol-hidden-seed-${profileId}`)) return true;
  if (localStorage.getItem(`arbol-seed-overrides-${profileId}`)) return true;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(`task-${profileId}-`) || k.startsWith(`streak-${profileId}-`)) return true;
    if (k.startsWith('arbol-goal-progress-')) {
      try {
        const log = JSON.parse(localStorage.getItem(k) || 'null') as { profileId?: string };
        if (log?.profileId === profileId) return true;
      } catch { /* ignore */ }
    }
  }
  return false;
}

function restoreStringMap(map: unknown): void {
  if (!map || typeof map !== 'object') return;
  for (const [k, v] of Object.entries(map as Record<string, string>)) {
    if (k && v) localStorage.setItem(k, v);
  }
}

/**
 * Union-merge cloud activity into local so mobile/desktop both keep progress.
 * Task statuses prefer "done"; streak/check-in flags OR together; visit counts take max.
 * When cloud is newer, also pull task/goal blob fields that aren't key-level mergeable.
 */
function mergeCloudActivityUnion(profileId: string, cloud: Record<string, unknown>): boolean {
  const localAt = Number(localStorage.getItem(LOCAL_CLOUD_AT_KEY(profileId)) || 0);
  const cloudAt = typeof cloud.savedAt === 'number' ? cloud.savedAt : 0;

  let changed = false;
  if (unionMergeStringMap(cloud.taskStatuses, preferTaskStatus)) changed = true;
  if (unionMergeStringMap(cloud.taskDeletions, (a, b) => b || a || '')) changed = true;
  if (unionMergeStringMap(cloud.streakDays, preferBooleanish)) changed = true;
  if (unionMergeStringMap(cloud.taskNotes, (a, b) => (b && b.length >= (a?.length ?? 0) ? b : a) || '')) changed = true;
  if (unionMergeStringMap(cloud.taskBlocked, preferBooleanish)) changed = true;
  if (unionMergeStringMap(cloud.goalProgressLogs, (a, b) => b || a || '')) changed = true;
  if (unionMergeStringMap(cloud.checkInDays, preferBooleanish)) changed = true;
  if (unionMergeStringMap(cloud.feedbackEntries, (a, b) => b || a || '')) changed = true;
  if (unionMergeStringMap(cloud.goalTaskChecks, preferBooleanish)) changed = true;
  if (unionMergeStringMap(cloud.visitCounts, preferVisitCount)) changed = true;
  if (unionMergeStringMap(cloud.tourDismissals, preferBooleanish)) changed = true;

  // Blobs: only overwrite when cloud is strictly newer (avoid clobbering concurrent edits).
  if (cloudAt > localAt) {
    const write = (k: string, v: unknown) => {
      if (v === null || v === undefined) return;
      const next = typeof v === 'string' ? v : JSON.stringify(v);
      if (localStorage.getItem(k) !== next) {
        localStorage.setItem(k, next);
        changed = true;
      }
    };

    write(`arbol-user-tasks-${profileId}`, cloud.userTasks);
    write(`arbol-user-cats-${profileId}`, cloud.userCategories);
    write(`arbol-goal-logs-${profileId}`, cloud.goalLogs);
    write(`streak-best-${profileId}`, cloud.streakBest);
    write(`arbol-live-reports-${profileId}`, cloud.liveReports);
    write(`arbol-live-snapshots-${profileId}`, cloud.liveSnapshots);
    write(`arbol-hidden-seed-${profileId}`, cloud.permanentlyHiddenSeedTasks);
    write(`arbol-seed-overrides-${profileId}`, cloud.seedOverrides);
    write(DELETED_DEFAULT_GOALS_KEY(profileId), cloud.deletedDefaultGoals);
  }

  if (changed && cloudAt > 0) {
    localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(Math.max(localAt, cloudAt)));
  }
  return changed;
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
  write(`arbol-seed-overrides-${profileId}`, data.seedOverrides);
  write(TASK_GOAL_LINKS_KEY(profileId), data.taskGoalLinks);
  write(DELETED_DEFAULT_GOALS_KEY(profileId), data.deletedDefaultGoals);

  if (typeof data.profileEmail === 'string' && data.profileEmail.trim()) {
    localStorage.setItem(getStorageKey(`arbol-email-${profileId}`), data.profileEmail.trim());
  }

  write(getStorageKey(`arbol-alert-prefs-${profileId}`), data.alertPrefs);

  if (data.goalsVersion && typeof data.goalsVersion === 'string') {
    localStorage.setItem(`arbol-goals-version-${profileId}`, data.goalsVersion);
  }

  const restoreMap = (map: unknown) => {
    restoreStringMap(map);
  };

  restoreMap(data.taskStatuses);
  restoreMap(data.taskDeletions);
  restoreMap(data.streakDays);
  restoreMap(data.taskNotes);
  restoreMap(data.taskBlocked);
  restoreMap(data.goalProgressLogs);
  restoreMap(data.checkInDays);
  restoreMap(data.feedbackEntries);
  restoreMap(data.goalTaskChecks);
  restoreMap(data.visitCounts);
  restoreMap(data.tourDismissals);

  if (typeof data.profileArchived === 'boolean') {
    applyProfileArchivedFromSync(profileId, data.profileArchived);
  }

  if (data.calendarPrefs != null) {
    write(CALENDAR_PREFS_KEY(profileId), data.calendarPrefs);
  }
  if (typeof data.calendarProvider === 'string' && data.calendarProvider.trim()) {
    localStorage.setItem(CALENDAR_PROVIDER_KEY(profileId), data.calendarProvider.trim());
  }
  persistTzOffset(profileId, data.tzOffset);
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

/** Merge email qualification fields when cloud is newer or local is missing them. */
function mergeQualificationFieldsFromCloud(profileId: string, cloud: Record<string, unknown>): boolean {
  const localAt = Number(localStorage.getItem(LOCAL_CLOUD_AT_KEY(profileId)) || 0);
  const cloudAt = typeof cloud.savedAt === 'number' ? cloud.savedAt : 0;
  const emailKey = getStorageKey(`arbol-email-${profileId}`);
  const prefsKey = getStorageKey(`arbol-alert-prefs-${profileId}`);

  const localEmail = localStorage.getItem(emailKey)?.trim() ?? '';
  const cloudEmail = typeof cloud.profileEmail === 'string' ? cloud.profileEmail.trim() : '';

  let changed = false;

  if (!localEmail && cloudEmail) {
    localStorage.setItem(emailKey, cloudEmail);
    changed = true;
  } else if (cloudAt > localAt && cloudEmail && cloudEmail !== localEmail) {
    localStorage.setItem(emailKey, cloudEmail);
    changed = true;
  }

  if (cloud.alertPrefs != null && cloudAt > localAt) {
    const next = typeof cloud.alertPrefs === 'string' ? cloud.alertPrefs : JSON.stringify(cloud.alertPrefs);
    const current = localStorage.getItem(prefsKey);
    if (current !== next) {
      localStorage.setItem(prefsKey, next);
      changed = true;
    }
  }

  if (cloud.calendarPrefs != null && cloudAt > localAt) {
    const next = typeof cloud.calendarPrefs === 'string' ? cloud.calendarPrefs : JSON.stringify(cloud.calendarPrefs);
    const current = localStorage.getItem(CALENDAR_PREFS_KEY(profileId));
    if (current !== next) {
      localStorage.setItem(CALENDAR_PREFS_KEY(profileId), next);
      changed = true;
    }
  }

  if (typeof cloud.calendarProvider === 'string' && cloud.calendarProvider.trim() && cloudAt > localAt) {
    const next = cloud.calendarProvider.trim();
    const current = localStorage.getItem(CALENDAR_PROVIDER_KEY(profileId));
    if (current !== next) {
      localStorage.setItem(CALENDAR_PROVIDER_KEY(profileId), next);
      changed = true;
    }
  }

  return changed;
}

function mergeArchiveFromCloud(profileId: string, cloud: Record<string, unknown>): boolean {
  if (typeof cloud.profileArchived !== 'boolean') return false;
  const localAt = Number(localStorage.getItem(LOCAL_CLOUD_AT_KEY(profileId)) || 0);
  const cloudAt = typeof cloud.savedAt === 'number' ? cloud.savedAt : 0;
  if (cloudAt <= localAt && isProfileArchived(profileId) === cloud.profileArchived) return false;
  if (isProfileArchived(profileId) === cloud.profileArchived) return false;
  applyProfileArchivedFromSync(profileId, cloud.profileArchived);
  return true;
}

type CloudBackupFetch =
  | { status: 'ok'; data: Record<string, unknown> }
  | { status: 'empty' }
  | { status: 'error'; error: unknown };

async function fetchCloudBackupResult(profileId: string): Promise<CloudBackupFetch> {
  const { data, error } = await invokeWithRetry(`${FN}/backup/${profileId}`, { method: 'GET' });
  if (error) return { status: 'error', error };
  // Transport/API failure without SDK error object
  if (data && typeof data === 'object' && 'error' in data && data.ok !== true && !('data' in data)) {
    return { status: 'error', error: (data as { error: unknown }).error };
  }
  if (!data?.ok || !data?.data) return { status: 'empty' };
  return { status: 'ok', data: data.data as Record<string, unknown> };
}

async function fetchCloudBackup(profileId: string): Promise<Record<string, unknown> | null> {
  const result = await fetchCloudBackupResult(profileId);
  return result.status === 'ok' ? result.data : null;
}

export async function fetchProfileBackupForAdmin(profileId: string): Promise<Record<string, unknown> | null> {
  return fetchCloudBackup(profileId);
}

export interface ProfileSyncStatus {
  profileId: string;
  localSavedAt: number;
  cloudSavedAt: number | null;
  lastSyncDirection: 'local_newer' | 'cloud_newer' | 'in_sync' | 'unknown';
  hasCloudBackup: boolean;
}

export async function getProfileSyncStatus(profileId: string): Promise<ProfileSyncStatus> {
  const localSavedAt = Number(localStorage.getItem(LOCAL_CLOUD_AT_KEY(profileId)) || 0);
  const result = await fetchCloudBackupResult(profileId);
  const cloud = result.status === 'ok' ? result.data : null;
  const cloudSavedAt = typeof cloud?.savedAt === 'number' ? cloud.savedAt : null;
  let lastSyncDirection: ProfileSyncStatus['lastSyncDirection'] = 'unknown';
  if (cloudSavedAt != null && localSavedAt > 0) {
    if (localSavedAt > cloudSavedAt + 1000) lastSyncDirection = 'local_newer';
    else if (cloudSavedAt > localSavedAt + 1000) lastSyncDirection = 'cloud_newer';
    else lastSyncDirection = 'in_sync';
  } else if (cloudSavedAt != null) {
    lastSyncDirection = 'cloud_newer';
  } else if (localSavedAt > 0) {
    lastSyncDirection = 'local_newer';
  }
  return {
    profileId,
    localSavedAt,
    cloudSavedAt,
    lastSyncDirection,
    hasCloudBackup: cloud != null,
  };
}

function rebuildStreakDaysFromDoneTasks(profileId: string): void {
  const dateRe = /(\d{4}-\d{2}-\d{2})$/;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(`task-${profileId}-`)) continue;
    if (localStorage.getItem(key) !== 'done') continue;
    const m = key.match(dateRe);
    if (!m) continue;
    localStorage.setItem(`streak-${profileId}-${m[1]}`, 'true');
  }
}

function mergeStringMaps(
  a: unknown,
  b: unknown,
  prefer: (local: string | undefined, cloud: string | undefined) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const left = (a && typeof a === 'object' ? a : {}) as Record<string, string>;
  const right = (b && typeof b === 'object' ? b : {}) as Record<string, string>;
  for (const k of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const next = prefer(left[k], right[k]);
    if (next) out[k] = next;
  }
  return out;
}

function mergeStreakBest(a: unknown, b: unknown): Record<string, number> {
  const left = (a && typeof a === 'object' ? a : {}) as Record<string, number>;
  const right = (b && typeof b === 'object' ? b : {}) as Record<string, number>;
  return {
    daily: Math.max(Number(left.daily) || 0, Number(right.daily) || 0),
    weekly: Math.max(Number(left.weekly) || 0, Number(right.weekly) || 0),
    monthly: Math.max(Number(left.monthly) || 0, Number(right.monthly) || 0),
  };
}

/**
 * Guarantee a save never drops the other device's activity.
 * Pull cloud → union into local → collect payload as the union of both.
 * Throws CLOUD_FETCH_FAILED when GET errors (fail-closed — do not POST sparse local).
 */
async function buildUnionPayload(profileId: string): Promise<Record<string, unknown>> {
  const fetch = await fetchCloudBackupResult(profileId);
  if (fetch.status === 'error') {
    throw new Error('CLOUD_FETCH_FAILED');
  }

  const cloud = fetch.status === 'ok' ? fetch.data : null;
  if (cloud) {
    mergeCloudActivityUnion(profileId, cloud);
    persistTzOffset(profileId, cloud.tzOffset);
    rebuildStreakDaysFromDoneTasks(profileId);
  } else {
    // First backup for this profile — stamp current device offset.
    persistTzOffset(profileId, new Date().getTimezoneOffset());
    rebuildStreakDaysFromDoneTasks(profileId);
  }

  const local = collectLocalData(profileId);
  if (!cloud) return local;

  local.taskStatuses = mergeStringMaps(local.taskStatuses, cloud.taskStatuses, preferTaskStatus);
  local.taskDeletions = mergeStringMaps(local.taskDeletions, cloud.taskDeletions, (a, b) => b || a || '');
  local.streakDays = mergeStringMaps(local.streakDays, cloud.streakDays, preferBooleanish);
  local.taskNotes = mergeStringMaps(local.taskNotes, cloud.taskNotes, (a, b) => (b && b.length >= (a?.length ?? 0) ? b : a) || '');
  local.taskBlocked = mergeStringMaps(local.taskBlocked, cloud.taskBlocked, preferBooleanish);
  local.goalProgressLogs = mergeStringMaps(local.goalProgressLogs, cloud.goalProgressLogs, (a, b) => b || a || '');
  local.checkInDays = mergeStringMaps(local.checkInDays, cloud.checkInDays, preferBooleanish);
  local.feedbackEntries = mergeStringMaps(local.feedbackEntries, cloud.feedbackEntries, (a, b) => b || a || '');
  local.goalTaskChecks = mergeStringMaps(local.goalTaskChecks, cloud.goalTaskChecks, preferBooleanish);
  local.visitCounts = mergeStringMaps(local.visitCounts, cloud.visitCounts, preferVisitCount);
  local.tourDismissals = mergeStringMaps(local.tourDismissals, cloud.tourDismissals, preferBooleanish);

  local.streakBest = mergeStreakBest(local.streakBest, cloud.streakBest);

  // Keep richer array blobs when cloud has more items (goals/tasks).
  const cloudTasks = Array.isArray(cloud.userTasks) ? cloud.userTasks : null;
  const localTasks = Array.isArray(local.userTasks) ? local.userTasks : null;
  if (cloudTasks && (!localTasks || cloudTasks.length > localTasks.length)) {
    local.userTasks = cloud.userTasks;
  }
  const cloudGoals = Array.isArray(cloud.personalGoals) ? cloud.personalGoals : null;
  const localGoals = Array.isArray(local.personalGoals) ? local.personalGoals : null;
  if (cloudGoals && (!localGoals || cloudGoals.length > localGoals.length)) {
    if (!localGoals || localGoals.length === 0) local.personalGoals = cloud.personalGoals;
  }

  // Prefer stored profile timezone (often from the first/primary device).
  if (typeof cloud.tzOffset === 'number') {
    local.tzOffset = cloud.tzOffset;
  }

  local.savedAt = Date.now();
  return local;
}

const saveChains: Record<string, Promise<boolean>> = {};
const pendingRetryTimers: Record<string, ReturnType<typeof setTimeout>> = {};

async function saveToCloudUnlocked(profileId: string, opts?: { retryOnStale?: boolean }): Promise<boolean> {
  let payload: Record<string, unknown>;
  try {
    payload = await buildUnionPayload(profileId);
  } catch (err) {
    if (String(err).includes('CLOUD_FETCH_FAILED')) {
      console.warn('[CloudBackup] Save skipped — cloud fetch failed (fail-closed)');
      // Retry later; do not upload incomplete local over unknown cloud state.
      if (pendingRetryTimers[profileId]) clearTimeout(pendingRetryTimers[profileId]);
      pendingRetryTimers[profileId] = setTimeout(() => {
        delete pendingRetryTimers[profileId];
        void saveToCloud(profileId);
      }, 8000);
      return false;
    }
    throw err;
  }

  // Apply unioned maps back into localStorage so the open tab matches what we saved.
  restoreStringMap(payload.taskStatuses);
  restoreStringMap(payload.taskDeletions);
  restoreStringMap(payload.streakDays);
  restoreStringMap(payload.checkInDays);
  restoreStringMap(payload.goalTaskChecks);
  restoreStringMap(payload.visitCounts);
  if (payload.streakBest != null) {
    localStorage.setItem(`streak-best-${profileId}`, JSON.stringify(payload.streakBest));
  }
  persistTzOffset(profileId, payload.tzOffset);

  const { data, error } = await invokeWithRetry(`${FN}/backup/${profileId}`, {
    method: 'POST',
    body: payload,
  });

  if (!error && data?.ok === true) {
    const at = typeof data.savedAt === 'number' ? data.savedAt : Number(payload.savedAt) || Date.now();
    localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(at));
    return true;
  }

  // Server now union-merges; stale_backup is rare / legacy — still retry once.
  if (data?.reason === 'stale_backup' && opts?.retryOnStale !== false) {
    await syncProfileFromCloud(profileId);
    try {
      const retryPayload = await buildUnionPayload(profileId);
      const retry = await invokeWithRetry(`${FN}/backup/${profileId}`, {
        method: 'POST',
        body: retryPayload,
      });
      if (!retry.error && retry.data?.ok === true) {
        const at = typeof retry.data.savedAt === 'number'
          ? retry.data.savedAt
          : Number(retryPayload.savedAt) || Date.now();
        localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(at));
        return true;
      }
    } catch {
      return false;
    }
  }

  if (error && !isTransientError(error)) {
    console.warn('[CloudBackup] Save failed:', error);
  }
  return false;
}

/** Serialized per-profile save — prevents overlapping buildUnionPayload races. */
export async function saveToCloud(profileId: string, opts?: { retryOnStale?: boolean }): Promise<boolean> {
  const prev = saveChains[profileId] ?? Promise.resolve(true);
  const next = prev
    .catch(() => false)
    .then(() => saveToCloudUnlocked(profileId, opts));
  saveChains[profileId] = next.finally(() => {
    if (saveChains[profileId] === next) delete saveChains[profileId];
  });
  return next;
}

/** After cloud pull, push email/qualification if local has fields cloud is missing. */
export async function pushQualificationAfterSync(profileId: string): Promise<void> {
  const result = await fetchCloudBackupResult(profileId);
  if (result.status === 'error') {
    // Fail-closed: don't invent a first backup while cloud status is unknown.
    scheduleSave(profileId);
    return;
  }
  if (result.status === 'empty') {
    await saveToCloud(profileId);
    return;
  }
  const cloud = result.data;
  const emailKey = getStorageKey(`arbol-email-${profileId}`);
  const localEmail = localStorage.getItem(emailKey)?.trim() ?? '';
  const cloudEmail = typeof cloud.profileEmail === 'string' ? cloud.profileEmail.trim() : '';
  const needsEmailPush = !!localEmail && !cloudEmail;
  if (needsEmailPush) {
    await saveToCloud(profileId);
  } else {
    scheduleSave(profileId);
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
  if (mergeQualificationFieldsFromCloud(profileId, cloud)) merged = true;
  if (mergeArchiveFromCloud(profileId, cloud)) merged = true;
  if (mergeCloudActivityUnion(profileId, cloud)) merged = true;

  rebuildStreakDaysFromDoneTasks(profileId);

  // After a successful cloud read, always treat as merged so we union-save + refresh UI.
  // buildUnionPayload prevents wiping peer-device keys on that save.
  import('./profiles').then(({ updateStreakBests }) => {
    try { updateStreakBests(profileId); } catch { /* ignore */ }
  }).catch(() => {});
  const cloudAt = typeof cloud.savedAt === 'number' ? cloud.savedAt : Date.now();
  const prev = Number(localStorage.getItem(LOCAL_CLOUD_AT_KEY(profileId)) || 0);
  localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(Math.max(prev, cloudAt)));
  scheduleSave(profileId);
  return 'merged';
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
