import { computeLiveStreak, getTodayKey, hasActivityOnDate } from './profiles';
import { getNudgeState, hasFeedbackToday } from './feedback';

export type FeedbackTriggerReason = 'streak_milestone' | 'evening_9pm' | 'none';

/** PD-05: streak milestone OR 9 p.m. local, max one survey prompt per day. */
export function evaluateFeedbackTrigger(profileId: string): {
  show: boolean;
  reason: FeedbackTriggerReason;
} {
  if (hasFeedbackToday(profileId)) return { show: false, reason: 'none' };
  if (getNudgeState(profileId).count >= 1) return { show: false, reason: 'none' };

  const todayKey = getTodayKey();
  const hasDoneToday = hasActivityOnDate(profileId, todayKey);
  const streak = computeLiveStreak(profileId, hasDoneToday);

  if (streak > 0 && streak % 7 === 0 && hasDoneToday) {
    return { show: true, reason: 'streak_milestone' };
  }

  if (new Date().getHours() >= 21) {
    return { show: true, reason: 'evening_9pm' };
  }

  return { show: false, reason: 'none' };
}

export function shouldShowFeedbackNudge(profileId: string): boolean {
  if (hasFeedbackToday(profileId)) return false;
  if (getNudgeState(profileId).count >= 1) return false;
  return evaluateFeedbackTrigger(profileId).show;
}
