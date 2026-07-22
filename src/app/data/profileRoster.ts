/**
 * Shared custom-profile roster helpers (local + cloud discovery).
 * Built-in profiles stay hardcoded; custom profiles must sync across devices.
 */

export type CustomProfileType = 'fresh' | 'seeded';

export interface RosterProfileMeta {
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
  profileType: CustomProfileType;
  createdAt: number;
}

export function isCustomProfileId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('custom-');
}

export function normalizeRosterMeta(raw: unknown): RosterProfileMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  if (!isCustomProfileId(id)) return null;
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : id;
  const profileType: CustomProfileType = o.profileType === 'seeded' ? 'seeded' : 'fresh';
  return {
    id,
    name,
    tagline: typeof o.tagline === 'string' && o.tagline.trim()
      ? o.tagline.trim()
      : `${name} · Custom profile`,
    avatar: typeof o.avatar === 'string' && o.avatar ? o.avatar : '🌱',
    streak: Number(o.streak) || 0,
    bestStreak: Number(o.bestStreak) || 0,
    weeklyStreak: Number(o.weeklyStreak) || 0,
    bestWeeklyStreak: Number(o.bestWeeklyStreak) || 0,
    monthlyStreak: Number(o.monthlyStreak) || 0,
    bestMonthlyStreak: Number(o.bestMonthlyStreak) || 0,
    role: typeof o.role === 'string' && o.role ? o.role : 'Custom',
    joinedWeek: Number(o.joinedWeek) || 1,
    completionRate: Number(o.completionRate) || 0,
    bio: typeof o.bio === 'string' && o.bio
      ? o.bio
      : profileType === 'fresh'
        ? 'A fresh profile - add your own goals and tasks.'
        : 'Profile created with personalized goal and task suggestions.',
    profileType,
    createdAt: Number(o.createdAt) || Date.now(),
  };
}

/** Reconstruct meta from an existing per-profile backup (orphan backfill). */
export function rosterMetaFromBackup(
  profileId: string,
  backup: Record<string, unknown> | null | undefined,
): RosterProfileMeta | null {
  if (!isCustomProfileId(profileId)) return null;
  const fromField = normalizeRosterMeta(backup?.customProfileMeta);
  if (fromField) return fromField;

  const snap = backup?.nudgeSnapshot;
  const snapName =
    snap && typeof snap === 'object' && typeof (snap as { profileName?: unknown }).profileName === 'string'
      ? String((snap as { profileName: string }).profileName).trim()
      : '';
  const fallbackName =
    snapName
    || profileId.replace(/^custom-/, '').replace(/-\d+$/, '').replace(/-/g, ' ').trim()
    || profileId;
  const savedAt = typeof backup?.savedAt === 'number' ? backup.savedAt : Date.now();
  return normalizeRosterMeta({
    id: profileId,
    name: fallbackName,
    tagline: `${fallbackName} · Custom profile`,
    avatar: '🌱',
    role: 'Custom',
    profileType: 'fresh',
    createdAt: savedAt,
    bio: 'A fresh profile - add your own goals and tasks.',
  });
}

/** Union by id; prefer richer / newer createdAt. */
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
      // Prefer newer createdAt; on tie keep non-default avatar/name richness.
      const richer =
        next.createdAt > prev.createdAt
        || (next.createdAt === prev.createdAt && next.name.length >= prev.name.length);
      byId.set(next.id, richer ? { ...prev, ...next } : { ...next, ...prev });
    }
  }
  return [...byId.values()].sort((x, y) => x.createdAt - y.createdAt || x.name.localeCompare(y.name));
}
