import type { TimeOfDay, TaskType } from './profiles';
import { purgeTaskLocalState } from './profiles';
import { scheduleSave } from './cloudBackup';

// ── Recurrence ────────────────────────────────────────────────────────
export interface Recurrence {
  type: 'one-time' | 'daily' | 'weekly' | 'monthly';
  // weekly: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  weekdays?: number[];
  // monthly: 1–31
  monthDates?: number[];
  // one-time: YYYY-MM-DD
  specificDate?: string;
}

export interface UserTask {
  id: string;
  profileId: string;
  label: string;
  description?: string;
  timeOfDay: TimeOfDay;
  type: TaskType;
  goalId?: string;
  categoryId?: string;
  createdAt: number;
  recurrence?: Recurrence;
  // Dates (YYYY-MM-DD) where this occurrence is explicitly skipped
  skippedDates?: string[];
}

// ── Scheduling helpers ────────────────────────────────────────────────

/** Returns true if the task should appear on the given dateKey (YYYY-MM-DD). */
export function isTaskScheduledForDate(task: UserTask, dateKey: string): boolean {
  if (task.skippedDates?.includes(dateKey)) return false;

  const rec = task.recurrence;
  // No recurrence field or daily → appears every day (backward-compat default)
  if (!rec || rec.type === 'daily') return true;

  if (rec.type === 'one-time') return rec.specificDate === dateKey;

  // Parse without timezone issues
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (rec.type === 'weekly') {
    // JS: 0=Sun…6=Sat → convert to Mon=0…Sun=6
    const js = date.getDay();
    const dow = js === 0 ? 6 : js - 1;
    return rec.weekdays?.includes(dow) ?? false;
  }

  if (rec.type === 'monthly') {
    return rec.monthDates?.includes(date.getDate()) ?? false;
  }

  return true;
}

/** Returns a human-readable label for a recurrence setting. */
export function recurrenceLabel(rec?: Recurrence): string {
  if (!rec || rec.type === 'daily') return 'Daily';
  if (rec.type === 'one-time') return rec.specificDate ? `Once on ${rec.specificDate}` : 'One-time';
  if (rec.type === 'weekly') {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const selected = (rec.weekdays ?? []).sort((a, b) => a - b).map(d => DAYS[d]);
    return selected.length ? `Weekly: ${selected.join(', ')}` : 'Weekly';
  }
  if (rec.type === 'monthly') {
    const dates = (rec.monthDates ?? []).sort((a, b) => a - b);
    return dates.length ? `Monthly: ${dates.map(d => ordinal(d)).join(', ')}` : 'Monthly';
  }
  return 'Daily';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── CRUD ──────────────────────────────────────────────────────────────

function storageKey(profileId: string) {
  return `arbol-user-tasks-${profileId}`;
}

export function getUserTasks(profileId: string): UserTask[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(profileId)) || '[]');
  } catch {
    return [];
  }
}

/** User tasks scheduled for a date (excludes skipped occurrences). */
export function getActiveUserTasksForDate(profileId: string, dateKey: string): UserTask[] {
  return getUserTasks(profileId).filter(ut => isTaskScheduledForDate(ut, dateKey));
}

export function saveUserTasks(profileId: string, tasks: UserTask[]) {
  localStorage.setItem(storageKey(profileId), JSON.stringify(tasks));
  scheduleSave(profileId);
}

export function createUserTask(profileId: string, data: Omit<UserTask, 'id' | 'profileId' | 'createdAt'>): UserTask {
  const tasks = getUserTasks(profileId);
  const task: UserTask = {
    id: `utask-${profileId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    profileId,
    createdAt: Date.now(),
    ...data,
    label: data.label.trim(),
  };
  saveUserTasks(profileId, [...tasks, task]);
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
  return task;
}

export function updateUserTask(profileId: string, taskId: string, data: Partial<Omit<UserTask, 'id' | 'profileId' | 'createdAt'>>) {
  const tasks = getUserTasks(profileId);
  saveUserTasks(profileId, tasks.map(t =>
    t.id === taskId ? { ...t, ...data, label: (data.label ?? t.label).trim() } : t
  ));
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
}

export function deleteUserTask(profileId: string, taskId: string) {
  const tasks = getUserTasks(profileId);
  saveUserTasks(profileId, tasks.filter(t => t.id !== taskId));
  purgeTaskLocalState(profileId, taskId);
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
}

/** Skip one occurrence of a recurring task on a specific date. */
export function skipTaskOccurrence(profileId: string, taskId: string, dateKey: string) {
  const tasks = getUserTasks(profileId);
  saveUserTasks(profileId, tasks.map(t =>
    t.id === taskId
      ? { ...t, skippedDates: [...new Set([...(t.skippedDates ?? []), dateKey])] }
      : t
  ));
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
}

export function orphanUserTasksForGoal(profileId: string, goalId: string) {
  const tasks = getUserTasks(profileId);
  saveUserTasks(profileId, tasks.map(t => t.goalId === goalId ? { ...t, goalId: undefined } : t));
}
