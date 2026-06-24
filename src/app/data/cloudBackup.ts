// ──────────────────────────────────────────────
// Cloud Backup: localStorage <-> Supabase KV
// ──────────────────────────────────────────────
// Backs up all profile-scoped localStorage data to the server so it
// survives Figma Make preview URL changes (which wipe localStorage).

import { supabase } from '/utils/supabase/client';
import { getStorageKey } from './environment';

const FN = 'make-server-5d90ddf5';

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

  return {
    userTasks:      raw(`arbol-user-tasks-${profileId}`),
    personalGoals:  raw(`arbol-goals-${profileId}`),
    userCategories: raw(`arbol-user-cats-${profileId}`),
    goalsVersion:   localStorage.getItem(`arbol-goals-version-${profileId}`),
    goalLogs:       raw(`arbol-goal-logs-${profileId}`),
    streakBest:     raw(`streak-best-${profileId}`),
    profileEmail:   localStorage.getItem(getStorageKey(`arbol-email-${profileId}`)) || null,
    liveReports:    raw(`arbol-live-reports-${profileId}`),
    liveSnapshots:  raw(`arbol-live-snapshots-${profileId}`),
    permanentlyHiddenSeedTasks: raw(`arbol-hidden-seed-${profileId}`),
    taskStatuses,
    taskDeletions,
    streakDays,
    taskNotes,
    taskBlocked,
    savedAt: Date.now(),
  };
}

// ── Apply a backup payload back into localStorage ────────────────────

function applyLocalData(profileId: string, data: Record<string, unknown>): void {
  const write = (k: string, v: unknown) => {
    if (v === null || v === undefined) return;
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  };

  write(`arbol-user-tasks-${profileId}`, data.userTasks);
  write(`arbol-goals-${profileId}`, data.personalGoals);
  write(`arbol-user-cats-${profileId}`, data.userCategories);
  write(`arbol-goal-logs-${profileId}`, data.goalLogs);
  write(`streak-best-${profileId}`, data.streakBest);
  write(`arbol-live-reports-${profileId}`, data.liveReports);
  write(`arbol-live-snapshots-${profileId}`, data.liveSnapshots);
  write(`arbol-hidden-seed-${profileId}`, data.permanentlyHiddenSeedTasks);

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
  const { data, error } = await invokeWithRetry(`${FN}/backup/${profileId}`, {
    method: 'GET',
  });
  if (error) {
    if (!isTransientError(error)) console.warn('[CloudBackup] Restore failed:', error);
    return false;
  }
  if (!data?.ok || !data?.data) return false;
  applyLocalData(profileId, data.data as Record<string, unknown>);
  return true;
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
