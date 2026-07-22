// ──────────────────────────────────────────────
// User-created profiles (local + cloud roster)
// ──────────────────────────────────────────────

import type { Profile } from './profiles';
import { createUserGoal, savePersonalGoals } from './personalGoals';
import { createUserTask } from './userTasks';
import type { SeedSuggestionGroup } from './profileSeedParser';
import {
  type CustomProfileType,
  type RosterProfileMeta,
  mergeRosterProfiles,
  normalizeRosterMeta,
  isCustomProfileId,
} from './profileRoster';
import { ensureMomentumStarterSeed } from './momentumStarterSeed';

export type { CustomProfileType, RosterProfileMeta as CustomProfileMeta };

const CUSTOM_PROFILES_KEY = 'arbol-custom-profiles';
const FRESH_PROFILE_IDS_KEY = 'arbol-fresh-profile-ids';

export interface CreateProfileInput {
  name: string;
  avatar: string;
  tagline?: string;
  profileType: CustomProfileType;
  suggestions?: SeedSuggestionGroup[];
}

function goalsVersionKey(profileId: string) {
  return `arbol-goals-version-${profileId}`;
}

function readFreshProfileIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FRESH_PROFILE_IDS_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function registerFreshProfileId(profileId: string): void {
  const ids = readFreshProfileIds();
  ids.add(profileId);
  localStorage.setItem(FRESH_PROFILE_IDS_KEY, JSON.stringify([...ids]));
}

export function isRegisteredFreshProfile(profileId: string): boolean {
  return readFreshProfileIds().has(profileId);
}

function readMetas(): RosterProfileMeta[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_PROFILES_KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeRosterMeta).filter((p): p is RosterProfileMeta => !!p);
  } catch {
    return [];
  }
}

function writeMetas(metas: RosterProfileMeta[]): void {
  localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(metas));
}

export function getCustomProfiles(): Profile[] {
  return readMetas().map(({ profileType: _t, createdAt: _c, ...profile }) => profile);
}

export function getCustomProfileMeta(profileId: string): RosterProfileMeta | undefined {
  return readMetas().find(p => p.id === profileId);
}

/** Custom profiles (fresh or seeded) never use built-in demo task seeds. */
export function isUserDefinedProfile(profileId: string): boolean {
  return !!getCustomProfileMeta(profileId) || isCustomProfileId(profileId);
}

/** Merge remote roster entries into localStorage. Returns newly added ids. */
export function upsertCustomProfilesFromRoster(remote: unknown): string[] {
  const incoming = Array.isArray(remote)
    ? remote.map(normalizeRosterMeta).filter((p): p is RosterProfileMeta => !!p)
    : [];
  if (incoming.length === 0) return [];
  const before = new Set(readMetas().map(p => p.id));
  const merged = mergeRosterProfiles(readMetas(), incoming);
  writeMetas(merged);
  for (const p of incoming) {
    if (p.profileType === 'fresh') registerFreshProfileId(p.id);
  }
  return merged.map(p => p.id).filter(id => !before.has(id));
}

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug.slice(0, 28) || 'profile';
}

function initializeGoalsVersion(profileId: string): void {
  localStorage.setItem(goalsVersionKey(profileId), 'v6-2026-07-13');
}

export function createCustomProfile(input: CreateProfileInput): Profile {
  const id = `custom-${slugify(input.name)}-${Date.now()}`;
  const name = input.name.trim();
  const profile: RosterProfileMeta = {
    id,
    name,
    tagline: input.tagline?.trim() || `${name} · Custom profile`,
    avatar: input.avatar,
    streak: 0,
    bestStreak: 0,
    weeklyStreak: 0,
    bestWeeklyStreak: 0,
    monthlyStreak: 0,
    bestMonthlyStreak: 0,
    role: 'Custom',
    joinedWeek: 1,
    completionRate: 0,
    bio: input.profileType === 'fresh'
      ? 'Starter Momentum goal and tasks to learn the loop - then add your own.'
      : 'Profile created with personalized goal and task suggestions.',
    profileType: input.profileType,
    createdAt: Date.now(),
  };

  writeMetas(mergeRosterProfiles(readMetas(), [profile]));

  if (input.profileType === 'fresh') {
    registerFreshProfileId(id);
    savePersonalGoals(id, []);
    initializeGoalsVersion(id);
  } else if (input.suggestions?.length) {
    for (const group of input.suggestions) {
      if (!group.selected) continue;
      const goal = createUserGoal(id, {
        title: group.goal.title,
        deepWhy: group.goal.deepWhy,
      });
      for (const task of group.tasks) {
        if (!task.selected) continue;
        if (task.label.trim().toLowerCase() === group.goal.title.trim().toLowerCase()) continue;
        createUserTask(id, {
          label: task.label,
          timeOfDay: task.timeOfDay,
          type: task.type,
          goalId: goal.id,
          recurrence: task.recurrence,
        });
      }
    }
  } else {
    savePersonalGoals(id, []);
    initializeGoalsVersion(id);
  }

  // Authoritative Momentum starter seed (idempotent; preserves AI/user goals above).
  ensureMomentumStarterSeed(id);

  // Persist roster + per-profile backup so other devices can discover this id.
  import('./cloudBackup').then(({ registerCustomProfileToCloud, saveToCloud }) => {
    void registerCustomProfileToCloud(profile).finally(() => {
      void saveToCloud(id);
    });
  });

  const { profileType: _t, createdAt: _c, ...publicProfile } = profile;
  return publicProfile;
}

/**
 * Pull shared custom-profile roster (and backup backfill) into this device.
 * Safe to call on profile picker / app focus.
 */
export async function syncCustomProfilesFromCloud(): Promise<{ added: string[]; total: number }> {
  const { fetchCustomProfileRoster } = await import('./cloudBackup');
  const remote = await fetchCustomProfileRoster();
  const added = upsertCustomProfilesFromRoster(remote);
  return { added, total: readMetas().length };
}
