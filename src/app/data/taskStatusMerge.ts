/**
 * Task-status merge helpers: last-write-wins with timestamps so demotions
 * (done → inprogress, inprogress → Haven't yet) survive cloud sync.
 */

/** Explicit clear marker stored in backup / localStorage (reads as null). */
export const TASK_STATUS_CLEARED = '__cleared';

export function isTaskStatusValue(v: string | undefined | null): v is 'done' | 'inprogress' | 'skipped' {
  return v === 'done' || v === 'inprogress' || v === 'skipped';
}

export function statusKeyToUpdatedAtKey(statusKey: string): string {
  if (!statusKey.startsWith('task-')) return `task-at-${statusKey}`;
  return `task-at-${statusKey.slice('task-'.length)}`;
}

export function updatedAtKeyToStatusKey(atKey: string): string {
  if (!atKey.startsWith('task-at-')) return atKey;
  return `task-${atKey.slice('task-at-'.length)}`;
}

/** Legacy strength rank — only used when neither side has a timestamp. */
export function preferTaskStatusRank(a: string | undefined, b: string | undefined): string {
  const rank = (s: string | undefined) => {
    if (s === 'done') return 4;
    if (s === 'inprogress') return 3;
    if (s === 'skipped') return 2;
    if (s && s !== TASK_STATUS_CLEARED) return 1;
    return 0;
  };
  return (rank(b) > rank(a) ? b : a) || a || b || '';
}

/**
 * Prefer newer timestamp. Timestamped clears beat older done/inprogress.
 * Legacy backups without timestamps keep the old "stronger wins" behavior.
 */
export function preferTaskStatusLww(
  a: string | undefined,
  b: string | undefined,
  ta?: number,
  tb?: number,
): string {
  const left = a || '';
  const right = b || '';
  const hasTa = typeof ta === 'number' && Number.isFinite(ta) && ta > 0;
  const hasTb = typeof tb === 'number' && Number.isFinite(tb) && tb > 0;

  if (hasTa && hasTb) {
    if (tb > ta) return right;
    if (ta > tb) return left;
  } else if (hasTa && !hasTb) {
    return left;
  } else if (hasTb && !hasTa) {
    return right;
  }

  return preferTaskStatusRank(left || undefined, right || undefined);
}

export function asUpdatedAtMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

export function asStringMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k || v == null) continue;
    const s = String(v);
    if (s) out[k] = s;
  }
  return out;
}

/** Merge two task-status maps using companion updatedAt maps (same keys as statuses). */
export function mergeTaskStatusMaps(
  aStatuses: unknown,
  bStatuses: unknown,
  aUpdatedAt: unknown,
  bUpdatedAt: unknown,
): { taskStatuses: Record<string, string>; taskStatusUpdatedAt: Record<string, number> } {
  const left = asStringMap(aStatuses);
  const right = asStringMap(bStatuses);
  const leftAt = asUpdatedAtMap(aUpdatedAt);
  const rightAt = asUpdatedAtMap(bUpdatedAt);
  const keys = new Set([...Object.keys(left), ...Object.keys(right), ...Object.keys(leftAt), ...Object.keys(rightAt)]);
  const taskStatuses: Record<string, string> = {};
  const taskStatusUpdatedAt: Record<string, number> = {};

  for (const k of keys) {
    const next = preferTaskStatusLww(left[k], right[k], leftAt[k], rightAt[k]);
    if (!next) continue;
    taskStatuses[k] = next;
    const ta = leftAt[k] || 0;
    const tb = rightAt[k] || 0;
    const winnerAt = tb > ta ? tb : ta > tb ? ta : Math.max(ta, tb);
    if (winnerAt > 0) taskStatusUpdatedAt[k] = winnerAt;
  }

  return { taskStatuses, taskStatusUpdatedAt };
}
