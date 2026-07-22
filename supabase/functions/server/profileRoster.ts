/** Shared custom-profile roster stored in KV + backfilled from backups. */

export const PROFILE_ROSTER_KEY = "arbol-custom-profile-roster";
const BACKUP_PREFIX = "arbol-backup-";

export type RosterProfileMeta = {
  id: string;
  name: string;
  tagline: string;
  avatar: string;
  streak: number;
  bestStreak: number;
  weeklyStreak: number;
  bestWeeklyStreak: number;
  monthlyStreak: number;
  bestMonthlyStreak: number;
  role: string;
  joinedWeek: number;
  completionRate: number;
  bio: string;
  profileType: "fresh" | "seeded";
  createdAt: number;
};

export function isCustomProfileId(id: string): boolean {
  return typeof id === "string" && id.startsWith("custom-");
}

export function normalizeRosterMeta(raw: unknown): RosterProfileMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!isCustomProfileId(id)) return null;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : id;
  const profileType: "fresh" | "seeded" = o.profileType === "seeded" ? "seeded" : "fresh";
  return {
    id,
    name,
    tagline: typeof o.tagline === "string" && o.tagline.trim()
      ? o.tagline.trim()
      : `${name} · Custom profile`,
    avatar: typeof o.avatar === "string" && o.avatar ? o.avatar : "🌱",
    streak: Number(o.streak) || 0,
    bestStreak: Number(o.bestStreak) || 0,
    weeklyStreak: Number(o.weeklyStreak) || 0,
    bestWeeklyStreak: Number(o.bestWeeklyStreak) || 0,
    monthlyStreak: Number(o.monthlyStreak) || 0,
    bestMonthlyStreak: Number(o.bestMonthlyStreak) || 0,
    role: typeof o.role === "string" && o.role ? o.role : "Custom",
    joinedWeek: Number(o.joinedWeek) || 1,
    completionRate: Number(o.completionRate) || 0,
    bio: typeof o.bio === "string" && o.bio
      ? o.bio
      : profileType === "fresh"
      ? "A fresh profile - add your own goals and tasks."
      : "Profile created with personalized goal and task suggestions.",
    profileType,
    createdAt: Number(o.createdAt) || Date.now(),
  };
}

export function rosterMetaFromBackup(
  profileId: string,
  backup: Record<string, unknown> | null | undefined,
): RosterProfileMeta | null {
  if (!isCustomProfileId(profileId)) return null;
  const fromField = normalizeRosterMeta(backup?.customProfileMeta);
  if (fromField) return fromField;
  const snap = backup?.nudgeSnapshot;
  const snapName =
    snap && typeof snap === "object" && typeof (snap as { profileName?: unknown }).profileName === "string"
      ? String((snap as { profileName: string }).profileName).trim()
      : "";
  const fallbackName =
    snapName ||
    profileId.replace(/^custom-/, "").replace(/-\d+$/, "").replace(/-/g, " ").trim() ||
    profileId;
  const savedAt = typeof backup?.savedAt === "number" ? backup.savedAt : Date.now();
  return normalizeRosterMeta({
    id: profileId,
    name: fallbackName,
    tagline: `${fallbackName} · Custom profile`,
    avatar: "🌱",
    role: "Custom",
    profileType: "fresh",
    createdAt: savedAt,
    bio: "A fresh profile - add your own goals and tasks.",
  });
}

export function mergeRosterProfiles(
  a: RosterProfileMeta[],
  b: RosterProfileMeta[],
): RosterProfileMeta[] {
  const byId = new Map<string, RosterProfileMeta>();
  for (const src of [a, b]) {
    for (const p of src) {
      const next = normalizeRosterMeta(p);
      if (!next) continue;
      const prev = byId.get(next.id);
      if (!prev) {
        byId.set(next.id, next);
        continue;
      }
      const richer =
        next.createdAt > prev.createdAt ||
        (next.createdAt === prev.createdAt && next.name.length >= prev.name.length);
      byId.set(next.id, richer ? { ...prev, ...next } : { ...next, ...prev });
    }
  }
  return [...byId.values()].sort(
    (x, y) => x.createdAt - y.createdAt || x.name.localeCompare(y.name),
  );
}

export async function readStoredRoster(kv: {
  get: (key: string) => Promise<unknown>;
}): Promise<RosterProfileMeta[]> {
  const raw = await kv.get(PROFILE_ROSTER_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRosterMeta).filter((p): p is RosterProfileMeta => !!p);
}

export async function upsertRosterProfiles(
  kv: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  },
  incoming: unknown,
): Promise<RosterProfileMeta[]> {
  const list = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
  const normalized = list.map(normalizeRosterMeta).filter((p): p is RosterProfileMeta => !!p);
  const existing = await readStoredRoster(kv);
  const merged = mergeRosterProfiles(existing, normalized);
  await kv.set(PROFILE_ROSTER_KEY, merged);
  return merged;
}

/** Roster key ∪ custom-* backups (repairs profiles created before roster existed). */
export async function buildFullProfileRoster(kv: {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  listByPrefix: (prefix: string) => Promise<{ key: string; value: unknown }[]>;
}): Promise<RosterProfileMeta[]> {
  const stored = await readStoredRoster(kv);
  const fromBackups: RosterProfileMeta[] = [];
  try {
    const rows = await kv.listByPrefix(BACKUP_PREFIX);
    for (const row of rows) {
      const id = row.key.slice(BACKUP_PREFIX.length);
      if (!isCustomProfileId(id)) continue;
      const backup =
        row.value && typeof row.value === "object"
          ? row.value as Record<string, unknown>
          : null;
      const meta = rosterMetaFromBackup(id, backup);
      if (meta) fromBackups.push(meta);
    }
  } catch (err) {
    console.log("[ProfileRoster] backup scan failed:", err);
  }
  const merged = mergeRosterProfiles(stored, fromBackups);
  // Persist healed roster so subsequent GETs stay cheap / complete.
  if (merged.length > stored.length) {
    try {
      await kv.set(PROFILE_ROSTER_KEY, merged);
    } catch { /* ignore */ }
  }
  return merged;
}
