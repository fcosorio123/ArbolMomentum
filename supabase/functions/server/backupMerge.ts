/** Server-side union merge for profile backups (prevents LWW wipe of peer activity). */

const TASK_STATUS_CLEARED = "__cleared";

function preferTaskStatusRank(a: string | undefined, b: string | undefined): string {
  const rank = (s: string | undefined) => {
    if (s === "done") return 4;
    if (s === "inprogress") return 3;
    if (s === "skipped") return 2;
    if (s && s !== TASK_STATUS_CLEARED) return 1;
    return 0;
  };
  return (rank(b) > rank(a) ? b : a) || a || b || "";
}

/** Timestamp last-write-wins so demotions / clears survive sync. */
function preferTaskStatusLww(
  a: string | undefined,
  b: string | undefined,
  ta?: number,
  tb?: number,
): string {
  const left = a || "";
  const right = b || "";
  const hasTa = typeof ta === "number" && Number.isFinite(ta) && ta > 0;
  const hasTb = typeof tb === "number" && Number.isFinite(tb) && tb > 0;
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

function asUpdatedAtMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

function asStringMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k || v == null) continue;
    const s = String(v);
    if (s) out[k] = s;
  }
  return out;
}

function mergeTaskStatusMaps(
  aStatuses: unknown,
  bStatuses: unknown,
  aUpdatedAt: unknown,
  bUpdatedAt: unknown,
): { taskStatuses: Record<string, string>; taskStatusUpdatedAt: Record<string, number> } {
  const left = asStringMap(aStatuses);
  const right = asStringMap(bStatuses);
  const leftAt = asUpdatedAtMap(aUpdatedAt);
  const rightAt = asUpdatedAtMap(bUpdatedAt);
  const keys = new Set([
    ...Object.keys(left),
    ...Object.keys(right),
    ...Object.keys(leftAt),
    ...Object.keys(rightAt),
  ]);
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

function preferBooleanish(a: string | undefined, b: string | undefined): string {
  if (a === "true" || b === "true") return "true";
  return b || a || "";
}

function preferVisitCount(a: string | undefined, b: string | undefined): string {
  const na = parseInt(a || "0", 10) || 0;
  const nb = parseInt(b || "0", 10) || 0;
  return String(Math.max(na, nb));
}

function mergeStringMaps(
  a: unknown,
  b: unknown,
  prefer: (x: string | undefined, y: string | undefined) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const left = (a && typeof a === "object" ? a : {}) as Record<string, string>;
  const right = (b && typeof b === "object" ? b : {}) as Record<string, string>;
  for (const k of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const next = prefer(left[k], right[k]);
    if (next) out[k] = next;
  }
  return out;
}

function mergeStreakBest(a: unknown, b: unknown): Record<string, number> {
  const left = (a && typeof a === "object" ? a : {}) as Record<string, number>;
  const right = (b && typeof b === "object" ? b : {}) as Record<string, number>;
  return {
    daily: Math.max(Number(left.daily) || 0, Number(right.daily) || 0),
    weekly: Math.max(Number(left.weekly) || 0, Number(right.weekly) || 0),
    monthly: Math.max(Number(left.monthly) || 0, Number(right.monthly) || 0),
  };
}

function preferRicherArray(existing: unknown, incoming: unknown): unknown {
  if (!Array.isArray(incoming)) return existing ?? incoming;
  if (!Array.isArray(existing)) return incoming;
  return incoming.length >= existing.length ? incoming : existing;
}

function unionStringIds(a: unknown, b: unknown): string[] {
  const out = new Set<string>();
  for (const src of [a, b]) {
    if (!Array.isArray(src)) continue;
    for (const x of src) {
      if (typeof x === "string" && x) out.add(x);
    }
  }
  return [...out];
}

/** Union entities by id, drop tombstoned ids (deletes survive longer-array merges). */
function mergeEntityArraysById(existing: unknown, incoming: unknown, deleted: Set<string>): unknown {
  const byId = new Map<string, unknown>();
  for (const src of [existing, incoming]) {
    if (!Array.isArray(src)) continue;
    for (const item of src) {
      const id = item && typeof item === "object" ? (item as { id?: string }).id : undefined;
      if (!id || deleted.has(id)) continue;
      byId.set(id, item);
    }
  }
  return [...byId.values()];
}

function preferRicherObject(existing: unknown, incoming: unknown): unknown {
  if (incoming == null) return existing;
  if (existing == null) return incoming;
  if (typeof existing === "object" && typeof incoming === "object" && !Array.isArray(existing) && !Array.isArray(incoming)) {
    return { ...(existing as object), ...(incoming as object) };
  }
  return incoming;
}

/** Merge incoming client backup onto existing cloud backup without dropping peer activity. */
export function unionMergeBackupPayload(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || typeof existing !== "object") {
    return { ...incoming, savedAt: typeof incoming.savedAt === "number" ? incoming.savedAt : Date.now() };
  }

  const merged: Record<string, unknown> = { ...existing, ...incoming };

  const statusMerged = mergeTaskStatusMaps(
    existing.taskStatuses,
    incoming.taskStatuses,
    existing.taskStatusUpdatedAt,
    incoming.taskStatusUpdatedAt,
  );
  merged.taskStatuses = statusMerged.taskStatuses;
  merged.taskStatusUpdatedAt = statusMerged.taskStatusUpdatedAt;
  merged.taskDeletions = mergeStringMaps(
    existing.taskDeletions,
    incoming.taskDeletions,
    (a, b) => b || a || "",
  );
  merged.streakDays = mergeStringMaps(existing.streakDays, incoming.streakDays, preferBooleanish);
  merged.taskNotes = mergeStringMaps(
    existing.taskNotes,
    incoming.taskNotes,
    (a, b) => (b && b.length >= (a?.length ?? 0) ? b : a) || "",
  );
  merged.taskBlocked = mergeStringMaps(existing.taskBlocked, incoming.taskBlocked, preferBooleanish);
  merged.goalProgressLogs = mergeStringMaps(
    existing.goalProgressLogs,
    incoming.goalProgressLogs,
    (a, b) => b || a || "",
  );
  merged.checkInDays = mergeStringMaps(existing.checkInDays, incoming.checkInDays, preferBooleanish);
  merged.feedbackEntries = mergeStringMaps(
    existing.feedbackEntries,
    incoming.feedbackEntries,
    (a, b) => b || a || "",
  );
  merged.goalTaskChecks = mergeStringMaps(
    existing.goalTaskChecks,
    incoming.goalTaskChecks,
    preferBooleanish,
  );
  merged.visitCounts = mergeStringMaps(existing.visitCounts, incoming.visitCounts, preferVisitCount);
  merged.tourDismissals = mergeStringMaps(
    existing.tourDismissals,
    incoming.tourDismissals,
    preferBooleanish,
  );

  merged.streakBest = mergeStreakBest(existing.streakBest, incoming.streakBest);

  const deletedGoals = unionStringIds(existing.deletedUserGoals, incoming.deletedUserGoals);
  const deletedTasks = unionStringIds(existing.deletedUserTasks, incoming.deletedUserTasks);
  merged.deletedUserGoals = deletedGoals;
  merged.deletedUserTasks = deletedTasks;
  const deletedDefaultGoals = unionStringIds(existing.deletedDefaultGoals, incoming.deletedDefaultGoals);
  merged.deletedDefaultGoals = deletedDefaultGoals;

  merged.userTasks = mergeEntityArraysById(existing.userTasks, incoming.userTasks, new Set(deletedTasks));
  const allDeletedGoals = new Set([...deletedGoals, ...deletedDefaultGoals]);
  merged.personalGoals = mergeEntityArraysById(existing.personalGoals, incoming.personalGoals, allDeletedGoals);
  merged.permanentlyHiddenSeedTasks = unionStringIds(
    existing.permanentlyHiddenSeedTasks,
    incoming.permanentlyHiddenSeedTasks,
  );
  merged.permanentlyHiddenSeedFamilies = unionStringIds(
    existing.permanentlyHiddenSeedFamilies,
    incoming.permanentlyHiddenSeedFamilies,
  );
  merged.seedOverrides = preferRicherObject(existing.seedOverrides, incoming.seedOverrides);
  merged.liveReports = preferRicherObject(existing.liveReports, incoming.liveReports);
  merged.liveSnapshots = preferRicherObject(existing.liveSnapshots, incoming.liveSnapshots);

  const existingAt = typeof existing.savedAt === "number" ? existing.savedAt : 0;
  const incomingAt = typeof incoming.savedAt === "number" ? incoming.savedAt : 0;
  merged.savedAt = Math.max(existingAt, incomingAt, Date.now());

  // Never wipe a stored profile email with null/empty from a sparse client.
  const existingEmail = typeof existing.profileEmail === "string" ? existing.profileEmail.trim() : "";
  const incomingEmail = typeof incoming.profileEmail === "string" ? incoming.profileEmail.trim() : "";
  if (incomingEmail) {
    merged.profileEmail = incomingEmail;
  } else if (existingEmail) {
    merged.profileEmail = existingEmail;
  }

  // Prefer a valid IANA timezone from either side; never wipe with null/empty.
  const existingTz = typeof existing.timezone === "string" ? existing.timezone.trim() : "";
  const incomingTz = typeof incoming.timezone === "string" ? incoming.timezone.trim() : "";
  if (incomingTz.includes("/")) {
    merged.timezone = incomingTz;
  } else if (existingTz.includes("/")) {
    merged.timezone = existingTz;
  }

  return merged;
}

/** Exported for unit tests mirrored on the client. */
export { preferTaskStatusLww, mergeTaskStatusMaps, TASK_STATUS_CLEARED };
