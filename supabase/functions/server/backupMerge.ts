/** Server-side union merge for profile backups (prevents LWW wipe of peer activity). */

function preferTaskStatus(a: string | undefined, b: string | undefined): string {
  const rank = (s: string | undefined) => {
    if (s === "done") return 4;
    if (s === "inprogress") return 3;
    if (s === "skipped") return 2;
    if (s) return 1;
    return 0;
  };
  return (rank(b) > rank(a) ? b : a) || a || b || "";
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

  merged.taskStatuses = mergeStringMaps(existing.taskStatuses, incoming.taskStatuses, preferTaskStatus);
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
  merged.userTasks = preferRicherArray(existing.userTasks, incoming.userTasks);
  merged.personalGoals = preferRicherArray(existing.personalGoals, incoming.personalGoals);
  merged.permanentlyHiddenSeedTasks = preferRicherArray(
    existing.permanentlyHiddenSeedTasks,
    incoming.permanentlyHiddenSeedTasks,
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

  return merged;
}
