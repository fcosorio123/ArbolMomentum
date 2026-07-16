/**
 * Product onboarding v2 - empty-state detection, getting-started persistence, tour version.
 * Extends existing AppTour / CoachMarks rather than replacing them.
 */

import { getPersonalGoals } from './personalGoals';
import { getUserTasks } from './userTasks';
import { getStorageKey } from './environment';
import { trackEvent } from './deviceAnalytics';

/** Bump only when onboarding content/steps change materially. */
export const ONBOARDING_TOUR_VERSION = '2';

export type GettingStartedDisposition = 'dismissed' | 'completed';

function gettingStartedKey(profileId: string): string {
  return getStorageKey(`arbol-onboarding-v${ONBOARDING_TOUR_VERSION}-getting-started-${profileId}`);
}

export function getGettingStartedDisposition(profileId: string): GettingStartedDisposition | null {
  const v = localStorage.getItem(gettingStartedKey(profileId));
  if (v === 'dismissed' || v === 'completed') return v;
  return null;
}

export function markGettingStartedDismissed(profileId: string): void {
  localStorage.setItem(gettingStartedKey(profileId), 'dismissed');
  trackEvent(profileId, 'onboarding_empty_state_dismissed', {
    tourVersion: ONBOARDING_TOUR_VERSION,
  });
  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId)).catch(() => {});
}

export function markGettingStartedCompleted(profileId: string): void {
  localStorage.setItem(gettingStartedKey(profileId), 'completed');
  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId)).catch(() => {});
}

/** True for goals created via createUserGoal (id prefix). */
export function isUserCreatedGoal(profileId: string, goalId: string): boolean {
  return goalId.startsWith(`user-${profileId}-`);
}

/**
 * Active goals + non-archived user tasks.
 * Includes catalog/default goals that appear on Goals (real content for demo profiles).
 * Does not count archived/deleted drafts or unsaved AI candidates.
 */
export function getProfileContentState(profileId: string): {
  hasGoals: boolean;
  hasActiveTasks: boolean;
  isEmpty: boolean;
  goalCount: number;
  activeTaskCount: number;
} {
  const goals = getPersonalGoals(profileId);
  const activeTasks = getUserTasks(profileId).filter(t => !t.archivedAt);
  return {
    hasGoals: goals.length > 0,
    hasActiveTasks: activeTasks.length > 0,
    isEmpty: goals.length === 0 && activeTasks.length === 0,
    goalCount: goals.length,
    activeTaskCount: activeTasks.length,
  };
}

/** First-run getting-started modal: empty profile and not yet dismissed/completed for this tour version. */
export function shouldShowGettingStartedModal(profileId: string): boolean {
  if (getGettingStartedDisposition(profileId)) return false;
  return getProfileContentState(profileId).isEmpty;
}

export function noteGettingStartedShown(profileId: string): void {
  trackEvent(profileId, 'onboarding_empty_state_shown', {
    tourVersion: ONBOARDING_TOUR_VERSION,
    hadZeroGoals: true,
    hadZeroTasks: true,
  });
}
