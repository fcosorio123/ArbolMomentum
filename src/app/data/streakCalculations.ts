// ──────────────────────────────────────────────
// Streak Calculations (Daily, Weekly, Monthly)
// ──────────────────────────────────────────────
// Simplified Strava-style streak system

import { getTaskStatus, getDateKey } from './profiles';

export interface StreakData {
  // Daily streaks (existing logic)
  dailyStreak: number;
  bestDailyStreak: number;

  // Weekly streaks (Strava-style: ≥1 task per week)
  weeklyStreak: number;
  bestWeeklyStreak: number;

  // Monthly streaks (Strava-style: ≥1 task per month)
  monthlyStreak: number;
  bestMonthlyStreak: number;
}

/**
 * Get week key in YYYY-Www format (ISO week)
 * Week starts on Monday
 */
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const firstMonday = new Date(year, 0, 1 + (dayOfWeek <= 1 ? 1 - dayOfWeek : 8 - dayOfWeek));

  const diff = date.getTime() - firstMonday.getTime();
  const weekNumber = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;

  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get month key in YYYY-MM format
 */
function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Check if user has any task completion on a specific date
 */
function hasCompletionOnDate(profileId: string, dateKey: string): boolean {
  // Check localStorage for any task completion on this date
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`task-${profileId}-`) && key.endsWith(`-${dateKey}`)) {
      const status = localStorage.getItem(key);
      if (status === 'done') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculate daily streak (existing logic)
 * Consecutive days with ≥1 task completed
 */
export function calculateDailyStreak(profileId: string): number {
  const today = new Date();
  let streak = 0;

  // Walk backward from today
  for (let offset = 0; offset < 365; offset++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - offset);
    const dateKey = getDateKey(checkDate);

    if (hasCompletionOnDate(profileId, dateKey)) {
      streak++;
    } else {
      // Streak broken
      break;
    }
  }

  return streak;
}

/**
 * Calculate weekly streak (Strava-style)
 * Consecutive weeks (Mon-Sun) with ≥1 task completed
 */
export function calculateWeeklyStreak(profileId: string): number {
  const today = new Date();
  let streak = 0;

  // Get current week's Monday
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6 days from Monday

  // Walk backward week by week
  for (let weekOffset = 0; weekOffset < 52; weekOffset++) {
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() - daysFromMonday - (weekOffset * 7));

    // Check all 7 days of this week (Mon-Sun)
    let hasCompletionThisWeek = false;
    for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
      const checkDate = new Date(weekStartDate);
      checkDate.setDate(weekStartDate.getDate() + dayInWeek);
      const dateKey = getDateKey(checkDate);

      if (hasCompletionOnDate(profileId, dateKey)) {
        hasCompletionThisWeek = true;
        break;
      }
    }

    if (hasCompletionThisWeek) {
      streak++;
    } else {
      // Weekly streak broken
      break;
    }
  }

  return streak;
}

/**
 * Calculate monthly streak (Strava-style)
 * Consecutive months with ≥1 task completed
 */
export function calculateMonthlyStreak(profileId: string): number {
  const today = new Date();
  let streak = 0;

  // Walk backward month by month
  for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
    const checkMonth = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const year = checkMonth.getFullYear();
    const month = checkMonth.getMonth();

    // Get first and last day of this month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Check all days in this month
    let hasCompletionThisMonth = false;
    for (let day = firstDay.getDate(); day <= lastDay.getDate(); day++) {
      const checkDate = new Date(year, month, day);
      const dateKey = getDateKey(checkDate);

      if (hasCompletionOnDate(profileId, dateKey)) {
        hasCompletionThisMonth = true;
        break;
      }
    }

    if (hasCompletionThisMonth) {
      streak++;
    } else {
      // Monthly streak broken
      break;
    }
  }

  return streak;
}

/**
 * Calculate all streak data for a profile
 */
export function calculateAllStreaks(profileId: string): StreakData {
  const dailyStreak = calculateDailyStreak(profileId);
  const weeklyStreak = calculateWeeklyStreak(profileId);
  const monthlyStreak = calculateMonthlyStreak(profileId);

  // Get best streaks from localStorage (or use current as default)
  const storedBest = localStorage.getItem(`streak-best-${profileId}`);
  const bestData = storedBest ? JSON.parse(storedBest) : {
    daily: dailyStreak,
    weekly: weeklyStreak,
    monthly: monthlyStreak,
  };

  // Update best streaks if current is higher
  const bestDailyStreak = Math.max(dailyStreak, bestData.daily || 0);
  const bestWeeklyStreak = Math.max(weeklyStreak, bestData.weekly || 0);
  const bestMonthlyStreak = Math.max(monthlyStreak, bestData.monthly || 0);

  // Save new best streaks
  localStorage.setItem(`streak-best-${profileId}`, JSON.stringify({
    daily: bestDailyStreak,
    weekly: bestWeeklyStreak,
    monthly: bestMonthlyStreak,
  }));

  return {
    dailyStreak,
    bestDailyStreak,
    weeklyStreak,
    bestWeeklyStreak,
    monthlyStreak,
    bestMonthlyStreak,
  };
}
