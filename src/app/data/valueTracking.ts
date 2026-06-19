// ──────────────────────────────────────────────
// Value Tracking System
// Tracks real value created through task completion
// ──────────────────────────────────────────────

import type { ValueStats, ValueType } from './profiles';

export interface ValueTracker {
  profileId: string;
  daily: ValueStats;
  weekly: ValueStats;
  monthly: ValueStats;
  lifetime: ValueStats;
  lastUpdated: string; // ISO date (YYYY-MM-DD)
  weekStart: string;   // ISO date of Monday
  monthStart: string;  // ISO date of month start
}

// ──────────────────────────────────────────────
// Get current date keys
// ──────────────────────────────────────────────
function getDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  return monday.toISOString().split('T')[0];
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

// ──────────────────────────────────────────────
// Initialize empty value stats
// ──────────────────────────────────────────────
function createEmptyStats(): ValueStats {
  return { money: 0, health: 0, opportunity: 0 };
}

// ──────────────────────────────────────────────
// Get value tracker for profile
// ──────────────────────────────────────────────
export function getValueTracker(profileId: string): ValueTracker {
  const key = `value-tracker-${profileId}`;
  const stored = localStorage.getItem(key);

  const today = getDateKey();
  const thisWeekStart = getWeekStart();
  const thisMonthStart = getMonthStart();

  if (stored) {
    const tracker: ValueTracker = JSON.parse(stored);

    // Reset daily if new day
    if (tracker.lastUpdated !== today) {
      tracker.daily = createEmptyStats();
      tracker.lastUpdated = today;
    }

    // Reset weekly if new week
    if (tracker.weekStart !== thisWeekStart) {
      tracker.weekly = createEmptyStats();
      tracker.weekStart = thisWeekStart;
    }

    // Reset monthly if new month
    if (tracker.monthStart !== thisMonthStart) {
      tracker.monthly = createEmptyStats();
      tracker.monthStart = thisMonthStart;
    }

    return tracker;
  }

  // Create new tracker
  return {
    profileId,
    daily: createEmptyStats(),
    weekly: createEmptyStats(),
    monthly: createEmptyStats(),
    lifetime: createEmptyStats(),
    lastUpdated: today,
    weekStart: thisWeekStart,
    monthStart: thisMonthStart,
  };
}

// ──────────────────────────────────────────────
// Update value tracker when task is completed
// ──────────────────────────────────────────────
export function trackValue(
  profileId: string,
  valueType: ValueType,
  amount: number
): ValueTracker {
  const tracker = getValueTracker(profileId);

  // Update all timeframes
  tracker.daily[valueType] += amount;
  tracker.weekly[valueType] += amount;
  tracker.monthly[valueType] += amount;
  tracker.lifetime[valueType] += amount;

  // Save to localStorage
  const key = `value-tracker-${profileId}`;
  localStorage.setItem(key, JSON.stringify(tracker));

  // TODO: Sync to Supabase (async, non-blocking)
  // import('./supabaseSync').then(({ syncValueTracker }) => {
  //   syncValueTracker(profileId, valueType, amount);
  // });

  return tracker;
}

// ──────────────────────────────────────────────
// Format value message (motivational + minimalist)
// ──────────────────────────────────────────────
export function formatValueMessage(
  valueType: ValueType,
  amount: number,
  style: 'immediate' | 'summary' = 'immediate'
): { message: string; icon: string } {
  if (style === 'immediate') {
    // Immediate feedback on task completion
    switch (valueType) {
      case 'money':
        return {
          message: `You saved ₱${amount.toLocaleString()}`,
          icon: '💰',
        };
      case 'health':
        return {
          message: `You burned ${amount.toLocaleString()} cal`,
          icon: '🔥',
        };
      case 'opportunity':
        return {
          message: `${amount} ${amount === 1 ? 'opportunity' : 'opportunities'} created`,
          icon: '🎯',
        };
    }
  } else {
    // Summary format (weekly/monthly)
    switch (valueType) {
      case 'money':
        return {
          message: `₱${amount.toLocaleString()} saved`,
          icon: '💰',
        };
      case 'health':
        return {
          message: `${amount.toLocaleString()} calories burned`,
          icon: '🔥',
        };
      case 'opportunity':
        return {
          message: `${amount} ${amount === 1 ? 'opportunity' : 'opportunities'}`,
          icon: '🎯',
        };
    }
  }
}

// ──────────────────────────────────────────────
// Calculate compound projections (Option 5)
// ──────────────────────────────────────────────
export interface CompoundProjection {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
  realWorldImpact: string; // Motivational context
}

export function calculateCompoundProjection(
  valueType: ValueType,
  weeklyAverage: number
): CompoundProjection {
  const dailyAvg = weeklyAverage / 7;
  const monthlyAvg = dailyAvg * 30;
  const yearlyAvg = dailyAvg * 365;

  let realWorldImpact = '';

  switch (valueType) {
    case 'money':
      if (yearlyAvg >= 50000) {
        realWorldImpact = `That's ${Math.floor(yearlyAvg / 10000)} months of rent 🏠`;
      } else if (yearlyAvg >= 20000) {
        realWorldImpact = `That's a full emergency fund 💪`;
      } else if (yearlyAvg >= 10000) {
        realWorldImpact = `That's your birthday goal achieved 🎉`;
      } else {
        realWorldImpact = `Keep saving toward your goals! 🎯`;
      }
      break;

    case 'health':
      const yearlyHours = (yearlyAvg / 200) * 0.5; // Assume 200 cal/30min = 0.5hr
      if (yearlyHours >= 182) { // 30min/day
        realWorldImpact = `Research shows this adds ~4 years to your lifespan 💪`;
      } else if (yearlyHours >= 100) {
        realWorldImpact = `That's ${Math.floor(yearlyHours)} hours of movement 🔥`;
      } else {
        realWorldImpact = `Building a healthier you! 💚`;
      }
      break;

    case 'opportunity':
      if (yearlyAvg >= 100) {
        realWorldImpact = `${Math.floor(yearlyAvg)} chances to level up your career 🚀`;
      } else if (yearlyAvg >= 50) {
        realWorldImpact = `Success rate improves 3x with volume 📈`;
      } else {
        realWorldImpact = `Every opportunity counts! 🌟`;
      }
      break;
  }

  return {
    daily: dailyAvg,
    weekly: weeklyAverage,
    monthly: monthlyAvg,
    yearly: yearlyAvg,
    realWorldImpact,
  };
}

// ──────────────────────────────────────────────
// Get weekly summary with compound projections
// ──────────────────────────────────────────────
export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  values: ValueStats;
  projections: {
    money?: CompoundProjection;
    health?: CompoundProjection;
    opportunity?: CompoundProjection;
  };
  comparisonToLastWeek?: {
    money: number; // Difference (+ or -)
    health: number;
    opportunity: number;
  };
}

export function getWeeklySummary(profileId: string): WeeklySummary {
  const tracker = getValueTracker(profileId);

  // Get last week's data for comparison
  const lastWeekKey = `value-weekly-history-${profileId}`;
  const lastWeekData = localStorage.getItem(lastWeekKey);
  const lastWeek: ValueStats | null = lastWeekData ? JSON.parse(lastWeekData) : null;

  // Calculate compound projections (only if weekly value > 0)
  const projections: WeeklySummary['projections'] = {};

  if (tracker.weekly.money > 0) {
    projections.money = calculateCompoundProjection('money', tracker.weekly.money);
  }
  if (tracker.weekly.health > 0) {
    projections.health = calculateCompoundProjection('health', tracker.weekly.health);
  }
  if (tracker.weekly.opportunity > 0) {
    projections.opportunity = calculateCompoundProjection('opportunity', tracker.weekly.opportunity);
  }

  // Week date range
  const weekStart = new Date(tracker.weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    weekStart: tracker.weekStart,
    weekEnd: weekEnd.toISOString().split('T')[0],
    values: tracker.weekly,
    projections,
    comparisonToLastWeek: lastWeek ? {
      money: tracker.weekly.money - lastWeek.money,
      health: tracker.weekly.health - lastWeek.health,
      opportunity: tracker.weekly.opportunity - lastWeek.opportunity,
    } : undefined,
  };
}

// ──────────────────────────────────────────────
// Save current week to history (call at end of week)
// ──────────────────────────────────────────────
export function archiveWeeklyValues(profileId: string) {
  const tracker = getValueTracker(profileId);
  const key = `value-weekly-history-${profileId}`;
  localStorage.setItem(key, JSON.stringify(tracker.weekly));
}
