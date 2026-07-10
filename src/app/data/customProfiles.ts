// ──────────────────────────────────────────────
// User-created profiles (localStorage demo store)
// ──────────────────────────────────────────────

import type { Profile } from './profiles';
import { createUserGoal, savePersonalGoals } from './personalGoals';
import { createUserTask } from './userTasks';
import type { Recurrence } from './userTasks';
import type { SeedSuggestionGroup } from './profileSeedParser';

const CUSTOM_PROFILES_KEY = 'arbol-custom-profiles';
const FRESH_PROFILE_IDS_KEY = 'arbol-fresh-profile-ids';

export type CustomProfileType = 'fresh' | 'seeded';

export interface CustomProfileMeta extends Profile {
  profileType: CustomProfileType;
  createdAt: number;
}

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

function readMetas(): CustomProfileMeta[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_PROFILES_KEY) || '[]') as CustomProfileMeta[];
  } catch {
    return [];
  }
}

function writeMetas(metas: CustomProfileMeta[]): void {
  localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(metas));
}

export function getCustomProfiles(): Profile[] {
  return readMetas().map(({ profileType: _t, createdAt: _c, ...profile }) => profile);
}

export function getCustomProfileMeta(profileId: string): CustomProfileMeta | undefined {
  return readMetas().find(p => p.id === profileId);
}

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug.slice(0, 28) || 'profile';
}

function initializeEmptyGoals(profileId: string): void {
  savePersonalGoals(profileId, []);
  localStorage.setItem(goalsVersionKey(profileId), 'v5-2026-06-09');
}

export function createCustomProfile(input: CreateProfileInput): Profile {
  const id = `custom-${slugify(input.name)}-${Date.now()}`;
  const name = input.name.trim();
  const profile: CustomProfileMeta = {
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
      ? 'A fresh profile — add your own goals and tasks.'
      : 'Profile created with personalized goal and task suggestions.',
    profileType: input.profileType,
    createdAt: Date.now(),
  };

  writeMetas([...readMetas(), profile]);

  if (input.profileType === 'fresh') {
    registerFreshProfileId(id);
    initializeEmptyGoals(id);
  } else if (input.suggestions?.length) {
    for (const group of input.suggestions) {
      if (!group.selected) continue;
      const goal = createUserGoal(id, {
        title: group.goal.title,
        deepWhy: group.goal.deepWhy,
      });
      for (const task of group.tasks) {
        if (!task.selected) continue;
        createUserTask(id, {
          label: task.label,
          timeOfDay: task.timeOfDay,
          type: task.type,
          goalId: goal.id,
          recurrence: task.recurrence,
        });
      }
    }
  }

  import('./cloudBackup').then(({ saveToCloud }) => saveToCloud(id));

  const { profileType: _t, createdAt: _c, ...publicProfile } = profile;
  return publicProfile;
}
