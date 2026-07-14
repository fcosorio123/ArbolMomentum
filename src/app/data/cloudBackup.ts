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
    tzOffset:       new Date().getTimezoneOffset(),
    nudgeSnapshot:  profile ? buildNudgeSnapshot(profileId, profile.name) : null,
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

async function fetchCloudBackup(profileId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await invokeWithRetry(`${FN}/backup/${profileId}`, { method: 'GET' });
  if (error || !data?.ok || !data?.data) return null;
  return data.data as Record<string, unknown>;
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
  const cloud = await fetchCloudBackup(profileId);
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

export async function saveToCloud(profileId: string, opts?: { retryOnStale?: boolean }): Promise<boolean> {
  const payload = collectLocalData(profileId);
  const { data, error } = await invokeWithRetry(`${FN}/backup/${profileId}`, {
    method: 'POST',
    body: payload,
  });

  if (!error && data?.ok === true) {
    localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(payload.savedAt));
    return true;
  }

  if (data?.reason === 'stale_backup' && opts?.retryOnStale !== false) {
    await syncProfileFromCloud(profileId);
    const retryPayload = collectLocalData(profileId);
    const retry = await invokeWithRetry(`${FN}/backup/${profileId}`, {
      method: 'POST',
      body: retryPayload,
    });
    if (!retry.error && retry.data?.ok === true) {
      localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(retryPayload.savedAt));
      return true;
    }
  }

  if (error && !isTransientError(error)) {
    console.warn('[CloudBackup] Save failed:', error);
  }
  return false;
}

/** After cloud pull, push fresh qualification + snapshot data for email cron. */
export async function pushQualificationAfterSync(profileId: string): Promise<void> {
  const cloud = await fetchCloudBackup(profileId);
  const local = collectLocalData(profileId);
  const cloudAt = typeof cloud?.savedAt === 'number' ? cloud.savedAt : 0;
  const localEmail = typeof local.profileEmail === 'string' ? local.profileEmail.trim() : '';
  const cloudEmail = typeof cloud?.profileEmail === 'string' ? cloud.profileEmail.trim() : '';
  const needsEmailPush = !!localEmail && !cloudEmail;
  const localNewer = local.savedAt >= cloudAt;
  if (needsEmailPush || localNewer || !cloud) {
    await saveToCloud(profileId);
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

  if (merged) {
    const cloudAt = typeof cloud.savedAt === 'number' ? cloud.savedAt : Date.now();
    const prev = Number(localStorage.getItem(LOCAL_CLOUD_AT_KEY(profileId)) || 0);
    localStorage.setItem(LOCAL_CLOUD_AT_KEY(profileId), String(Math.max(prev, cloudAt)));
    // Recalc personal-best streaks after unioning activity from the other device.
    import('./profiles').then(({ updateStreakBests }) => {
      try { updateStreakBests(profileId); } catch { /* ignore */ }
    }).catch(() => {});
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
