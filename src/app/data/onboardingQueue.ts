// ──────────────────────────────────────────────
// First-visit modal queue (WP-20): one modal at a time
// coach → daily summary → feedback survey
// Page tours (Home, Tasks, …) start only when queue is idle.
// ──────────────────────────────────────────────

import { coachStorageKey, areToursDismissedForProfile } from '../components/AppTour';
import { isSummaryEnabled, wasSummaryShownToday } from '../components/DailySummaryModal';
import { shouldShowFeedbackNudge } from './feedbackTriggers';

export type OnboardingModal = 'coach' | 'summary' | 'feedback';

export function isCoachDone(profileId: string): boolean {
  return areToursDismissedForProfile(profileId) || !!localStorage.getItem(coachStorageKey(profileId));
}

/** Next modal to show, or null when queue is idle for this visit. */
export function peekOnboardingModal(profileId: string): OnboardingModal | null {
  if (!isCoachDone(profileId)) return 'coach';
  if (isSummaryEnabled(profileId) && !wasSummaryShownToday(profileId)) return 'summary';
  if (shouldShowFeedbackNudge(profileId)) return 'feedback';
  return null;
}

/** After closing a modal, return the next queued step (skips the step just completed). */
export function nextOnboardingAfter(
  profileId: string,
  completed: OnboardingModal,
): OnboardingModal | null {
  if (completed === 'coach') {
    if (isSummaryEnabled(profileId) && !wasSummaryShownToday(profileId)) return 'summary';
    if (shouldShowFeedbackNudge(profileId)) return 'feedback';
    return null;
  }
  if (completed === 'summary') {
    if (shouldShowFeedbackNudge(profileId)) return 'feedback';
    return null;
  }
  return null;
}

export function markCoachDone(profileId: string): void {
  localStorage.setItem(coachStorageKey(profileId), 'true');
  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId));
}
