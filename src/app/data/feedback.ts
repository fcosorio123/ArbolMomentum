import { getTodayKey, getDateKey } from './profiles';

// ──────────────────────────────────────────────
// Feedback types
// ──────────────────────────────────────────────
export interface FeedbackEntry {
  profileId: string;
  date: string;
  rating: 1 | 2 | 3 | 4 | 5;
  whatWorked: string[];
  whatDidnt: string[];
  suggestion: string;
  timestamp: number;
}

export const WHAT_WORKED_OPTIONS = [
  'Easy to use',
  'Helped me stay on track',
  'Notifications were helpful',
  'Clear task structure',
];

export const WHAT_DIDNT_OPTIONS = [
  'Confusing tasks',
  'Too many notifications',
  'Not motivating',
  'Hard to navigate',
];

export const RATING_EMOJIS = ['😞', '😐', '🙂', '😊', '🎉'] as const;
export const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Amazing'] as const;

// ──────────────────────────────────────────────
// Feedback storage
// ──────────────────────────────────────────────
function feedbackKey(profileId: string, date: string) {
  return `arbol-feedback-${profileId}-${date}`;
}

export function saveFeedback(entry: FeedbackEntry) {
  localStorage.setItem(feedbackKey(entry.profileId, entry.date), JSON.stringify(entry));

  // Sync to Supabase (async, non-blocking)
  import('./supabaseSync').then(({ syncFeedback }) => {
    syncFeedback({
      profileId: entry.profileId,
      rating: entry.rating,
      whatWorked: entry.whatWorked,
      whatDidnt: entry.whatDidnt,
      suggestion: entry.suggestion,
      date: entry.date,
      timestamp: entry.timestamp,
    });
  });
}

export function getFeedback(profileId: string, date: string): FeedbackEntry | null {
  const raw = localStorage.getItem(feedbackKey(profileId, date));
  return raw ? JSON.parse(raw) : null;
}

export function hasFeedbackToday(profileId: string): boolean {
  return !!getFeedback(profileId, getTodayKey());
}

/** Returns all feedback for a profile, newest first */
export function getAllFeedback(profileId: string): FeedbackEntry[] {
  const results: FeedbackEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`arbol-feedback-${profileId}-`)) {
      try { results.push(JSON.parse(localStorage.getItem(key)!)); } catch {}
    }
  }
  return results.sort((a, b) => b.timestamp - a.timestamp);
}

/** Returns all feedback for all profiles */
export function getAllFeedbackAll(): FeedbackEntry[] {
  const results: FeedbackEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('arbol-feedback-')) {
      try { results.push(JSON.parse(localStorage.getItem(key)!)); } catch {}
    }
  }
  return results.sort((a, b) => b.timestamp - a.timestamp);
}

// ──────────────────────────────────────────────
// Feedback nudge state
// ──────────────────────────────────────────────
function nudgeKey(profileId: string, date: string) {
  return `arbol-feedback-nudge-${profileId}-${date}`;
}

export interface NudgeState { count: number; lastShownAt: number }

export function getNudgeState(profileId: string): NudgeState {
  const raw = localStorage.getItem(nudgeKey(profileId, getTodayKey()));
  return raw ? JSON.parse(raw) : { count: 0, lastShownAt: 0 };
}

export function recordNudge(profileId: string) {
  const state = getNudgeState(profileId);
  localStorage.setItem(nudgeKey(profileId, getTodayKey()), JSON.stringify({
    count: state.count + 1,
    lastShownAt: Date.now(),
  }));
}

export function shouldShowFeedbackNudge(profileId: string): boolean {
  if (hasFeedbackToday(profileId)) return false;
  const state = getNudgeState(profileId);
  if (state.count >= 2) return false;
  if (state.count === 0) return true;
  // After first dismissal, wait at least 3 hours
  return Date.now() - state.lastShownAt >= 3 * 60 * 60 * 1000;
}

// ──────────────────────────────────────────────
// Hourly activity tracking
// ──────────────────────────────────────────────
function activityKey(profileId: string, date: string) {
  return `arbol-activity-${profileId}-${date}`;
}

export function trackActivity(profileId: string) {
  const date = getTodayKey();
  const key = activityKey(profileId, date);
  const hours: number[] = JSON.parse(localStorage.getItem(key) || JSON.stringify(new Array(24).fill(0)));
  hours[new Date().getHours()]++;
  localStorage.setItem(key, JSON.stringify(hours));
}

export function getHourlyActivity(profileId: string, date: string): number[] {
  const raw = localStorage.getItem(activityKey(profileId, date));
  return raw ? JSON.parse(raw) : new Array(24).fill(0);
}

/** Returns hourly data bucketed for chart: morning/afternoon/evening */
export function getActivityChartData(profileId: string, date: string) {
  const hours = getHourlyActivity(profileId, date);
  const labels = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a',
                  '12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p'];
  return hours.map((count, h) => ({ hour: labels[h], h, count })).filter(d => d.count > 0 || [8,9,13,18,19,20].includes(d.h));
}

/** Returns past-7-day engagement data (visits + completion %) */
export function getWeeklyEngagement(profileId: string, completionFn: (profileId: string, date: string) => number) {
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date = getDateKey(d);
    const visits = parseInt(localStorage.getItem(`visit-${profileId}-${date}`) || '0');
    const pct = completionFn(profileId, date);
    return { label: DAYS[d.getDay()], date, visits, pct };
  });
}

// ──────────────────────────────────────────────
// Auto-generated user insight
// ──────────────────────────────────────────────
export function generateInsight(params: {
  completionRate: number;
  streak: number;
  todayPct: number;
  peakHour: number;
  visitCount: number;
}): string {
  const { completionRate, streak, todayPct, peakHour, visitCount } = params;
  const timeLabel = peakHour < 12 ? 'mornings' : peakHour < 17 ? 'afternoons' : 'evenings';

  if (completionRate >= 85 && streak >= 7)
    return `🌟 Highly consistent - completes most tasks daily. Most active in ${timeLabel}.`;
  if (completionRate >= 70 && streak >= 3)
    return `💪 Solid momentum. Regular ${timeLabel} activity, good follow-through on tasks.`;
  if (visitCount >= 3 && completionRate < 50)
    return `📋 Visits frequently but task completion needs improvement. Consider simplifying tasks.`;
  if (streak === 0 && todayPct === 0)
    return `⚠️ Low engagement today - hasn't started any tasks. May need a nudge.`;
  if (completionRate >= 60 && streak < 3)
    return `🌱 Getting started with good completion rate. Streak building in progress.`;
  if (todayPct >= 80)
    return `🔥 On track today! Strong finish expected based on current progress.`;
  return `📊 Moderate engagement. ${completionRate}% avg completion over the program.`;
}
