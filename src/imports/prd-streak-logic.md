# PRD — Streak Logic (Arbol Momentum)

Owner: Arbol
Surface: All user profiles
Status: Updated with Weekly & Monthly Streaks (Strava-style)
Last Updated: May 18, 2026

---

## 1. Overview

The app now tracks **three types of streaks** to provide flexible motivation:

### 1.1 Daily Streak (Existing)
Consecutive **days** with ≥1 task completed. The original daily engagement counter.

### 1.2 Weekly Streak (NEW - Strava-style)
Consecutive **weeks (Mon-Sun)** with ≥1 task completed. Easier to maintain than daily streaks, reducing pressure while encouraging weekly consistency.

### 1.3 Monthly Streak (NEW - Strava-style)
Consecutive **months** with ≥1 task completed. Long-term habit tracking for sustained momentum.

All three streaks surface in:
- The **profile card** (showing current and best streaks)
- **Badge achievements** (daily, weekly, and monthly milestones)
- **Admin dashboard** (tracking across all users)

Streaks are *motivation* metrics, not *scoring* metrics — they do not change pesos earned or task completion rates.

---

## 2. Goals

### 2.1 Daily Streak Goals (Original)
1. Reinforce a once-per-day return habit with the lightest possible threshold (1 completion).
2. Give students an at-a-glance read of "am I keeping it alive this week?" via 7 day-dots (Mon–Sun).
3. Trigger meaningful checkpoints (badge at 3 days, feedback prompt every 7 days).
4. Survive across devices for the same student via Supabase-backed completion history.

### 2.2 Weekly Streak Goals (NEW)
1. **Reduce streak anxiety** — Users found daily streaks stressful; weekly streaks are more forgiving.
2. **Better for irregular schedules** — Perfect for students with busy weekdays but free weekends.
3. **Strava-inspired model** — Proven in fitness apps to drive long-term engagement.
4. **Easier to recover** — Missing one day doesn't break the streak, encouraging continuation.

### 2.3 Monthly Streak Goals (NEW)
1. **Long-term habit tracking** — Celebrate sustained momentum over months/years.
2. **Realistic for life changes** — Moving, exams, travel won't immediately reset progress.
3. **Achievement milestones** — Unlock meaningful badges (3 months, 6 months, 1 year).
4. **Reduced pressure** — Just stay active once per month minimum to maintain streak.

## 3. Non-Goals

- No partial-day or hourly streak.
- No "streak freeze" / grace day / vacation mode (still under consideration for future).
- No social comparison or leaderboards.
- No integration with external fitness apps (though inspired by Strava's model).

---

## 4. Streak Type Comparison

| Feature | Daily Streak | Weekly Streak | Monthly Streak |
|---------|--------------|---------------|----------------|
| **Requirement** | ≥1 task per day | ≥1 task per week (Mon-Sun) | ≥1 task per month |
| **Difficulty** | High (365 days/year) | Medium (52 weeks/year) | Low (12 months/year) |
| **Best for** | Daily habit builders | Busy schedules | Long-term tracking |
| **Breaks when** | Miss any day | Miss entire week | Miss entire month |
| **Max lookback** | 365 days | 52 weeks | 24 months |
| **Pressure level** | Highest | Moderate | Lowest |
| **Badge count** | 6 badges | 4 badges | 4 badges |
| **Example** | "5-day streak" | "2-week streak" | "3-month streak" |

**User can maintain all three simultaneously:**
- Daily: 3 days
- Weekly: 2 weeks (even if daily streak breaks, weekly continues)
- Monthly: 1 month (even if both daily and weekly break)

## 5. User Stories

### 5.1 Daily Streak Stories
- As a student, when I finish my **first task of the day**, my daily streak should tick up by 1.
- As a student, when I open the app, I should see how many consecutive days I've shown up.
- As a student, if I miss a day, my daily streak resets but my weekly/monthly streaks may continue.

### 5.2 Weekly Streak Stories (NEW)
- As a busy student, I can complete tasks on **any day of the week** and keep my weekly streak alive.
- As a student with irregular schedule, I see my weekly streak increase even if my daily streak breaks.
- As a student, on Monday the new week starts but my multi-week count keeps growing.

### 5.3 Monthly Streak Stories (NEW)
- As a student, I can see I've stayed active for **3 consecutive months** even through busy exam periods.
- As a long-term user, I earn badges for 6-month and 12-month streaks showing sustained commitment.
- As a student, I have the freedom to take breaks within a month without losing my monthly progress.

---

## 6. Implementation Details

### 6.1 File Structure
```
src/app/data/
├── streakCalculations.ts       # NEW - Weekly/monthly streak logic
├── profiles.ts                 # Updated - Profile interface with new streak fields
└── personalGoals.ts            # Existing - No changes needed

src/imports/
└── prd-streak-logic.md         # This document
```

### 6.2 Profile Data Structure
```ts
interface Profile {
  // Daily streaks (existing)
  streak: number;              // Current daily streak
  bestStreak: number;          // Best daily streak ever

  // Weekly streaks (NEW)
  weeklyStreak: number;        // Current weekly streak
  bestWeeklyStreak: number;    // Best weekly streak ever

  // Monthly streaks (NEW)
  monthlyStreak: number;       // Current monthly streak
  bestMonthlyStreak: number;   // Best monthly streak ever

  // ... other profile fields
}
```

### 6.3 Best Streak Tracking
Best streaks are stored in `localStorage`:
```ts
localStorage.setItem(`streak-best-${profileId}`, JSON.stringify({
  daily: bestDailyStreak,
  weekly: bestWeeklyStreak,
  monthly: bestMonthlyStreak,
}));
```

### 6.4 Real-time Calculation
All streaks are calculated on-demand by scanning task completion history:
- `calculateDailyStreak(profileId)` - Walks back day by day
- `calculateWeeklyStreak(profileId)` - Walks back week by week
- `calculateMonthlyStreak(profileId)` - Walks back month by month

No caching needed - calculations are fast (< 10ms for 1 year of data).

## 7. Functional Spec

### 7.1 What counts as a "streak day"
A calendar date (device local, `YYYY-MM-DD`) is a streak day when **at least one task has been marked `done` on that date**. Effort, impact, stars, and which task are all irrelevant — a single completion sets `completionHistory[dateKey] = true` for the rest of time.

```ts
// On task completion (src/components/mobile-momentum-pwa.tsx ~L1146)
const nextHistory = { ...completionHistory, [todayDateKey]: true };
```

### 7.2 Daily Streak Computation
Walk backward from today; stop at the first missing day. Max lookback **365 days**.

```ts
// calculateDailyStreak (src/app/data/streakCalculations.ts)
for (let offset = 0; offset < 365; offset += 1) {
  const checkDate = new Date(today);
  checkDate.setDate(today.getDate() - offset);
  const dateKey = getDateKey(checkDate);

  if (hasCompletionOnDate(profileId, dateKey)) {
    streak++;
  } else {
    break; // Streak broken
  }
}
```

Consequences:
- **Today not yet completed** → streak shows yesterday's run (still "alive" until midnight).
- **Missed any prior day** → streak resets to 0 the moment that gap exists in history.
- **No "freeze" or recovery** — one missed midnight ends the run.

### 7.2b Weekly Streak Computation (NEW - Strava-style)
Walk backward week by week (Mon-Sun); stop at the first week with no completions. Max lookback **52 weeks**.

```ts
// calculateWeeklyStreak (src/app/data/streakCalculations.ts)
for (let weekOffset = 0; weekOffset < 52; weekOffset++) {
  // Get week start (Monday)
  const weekStartDate = getMondayOfWeek(today, weekOffset);

  // Check all 7 days (Mon-Sun)
  let hasCompletionThisWeek = false;
  for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
    const checkDate = new Date(weekStartDate);
    checkDate.setDate(weekStartDate.getDate() + dayInWeek);

    if (hasCompletionOnDate(profileId, getDateKey(checkDate))) {
      hasCompletionThisWeek = true;
      break;
    }
  }

  if (hasCompletionThisWeek) {
    streak++;
  } else {
    break; // Weekly streak broken
  }
}
```

Consequences:
- **Current week incomplete** → still counts if user has ≥1 completion this week
- **Any prior week empty** → weekly streak resets to 0
- **Easier to maintain** — only need 1 task per week (any day Mon-Sun)
- **Week boundary** — Monday 00:00 local time starts new week

### 7.2c Monthly Streak Computation (NEW - Strava-style)
Walk backward month by month; stop at the first month with no completions. Max lookback **24 months**.

```ts
// calculateMonthlyStreak (src/app/data/streakCalculations.ts)
for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
  const checkMonth = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);

  // Check all days in this month
  let hasCompletionThisMonth = false;
  for (let day = 1; day <= lastDayOfMonth; day++) {
    const checkDate = new Date(year, month, day);

    if (hasCompletionOnDate(profileId, getDateKey(checkDate))) {
      hasCompletionThisMonth = true;
      break;
    }
  }

  if (hasCompletionThisMonth) {
    streak++;
  } else {
    break; // Monthly streak broken
  }
}
```

Consequences:
- **Current month incomplete** → still counts if user has ≥1 completion this month
- **Any prior month empty** → monthly streak resets to 0
- **Long-term tracking** — sustainable for year-long habits
- **Month boundary** — 1st of month 00:00 local time starts new month

### 7.3 Day boundary
Uses the device's local timezone via `getLocalDateKey()`. The Manila-specific logic in `reminder-templates.ts` does not affect the client streak counter. Travelers see streaks tick over at *their* local midnight.

### 7.4 Weekly dot row (Mon–Sun)
Independent of the streak number — purely visual context for the current ISO-style week.

```ts
const dayOfWeek = (currentDate.getDay() + 6) % 7; // 0 = Mon
const monday = shiftDate(currentDate, -dayOfWeek);
// 7 dots: { label: "Mon".."Sun", active: history[dateKey], current: dateKey===today }
```

- **active** styling (`streak-dot-active`): day has ≥1 completion.
- **current** styling (`streak-dot-current`): today's dot.
- Resets visually every Monday; does not influence `metrics.streak`.

### 7.5 Persistence

| Layer | Key / Table | Purpose |
|---|---|---|
| `localStorage` | `momentum-completion-history:{studentId}` | Fast restore on next load |
| Supabase | `student_completions(student_id, task_id, date_key)` | Cross-device truth |
| Supabase | `student_resets(student_id)` | Logs manual reset events |

On load (L948): merge all `student_completions` rows into `completionHistory` keyed by `date_key`. Only **today's** rows restore `tasks[].status = "done"` — historical days roll fresh so the same task can be redone.

### 7.6 Reset behavior
`handleResetProgress` (L960) clears `completionHistory`, `earnedBadges`, today's `status`, and the `localStorage` history key. Streak immediately drops to 0. A `student_resets` row is logged.

### 7.7 Streak-driven side effects

| Trigger | Behavior | Source |
|---|---|---|
| **Daily Streaks** | | |
| `streak >= 1` | Unlocks `First Flame` badge | `BADGES` (profiles.ts) |
| `streak >= 3` | Unlocks `3-Day Spark` badge | `BADGES` (profiles.ts) |
| `streak >= 7` | Unlocks `Week Warrior` badge | `BADGES` (profiles.ts) |
| `streak >= 14` | Unlocks `Two-Week Strong` badge | `BADGES` (profiles.ts) |
| `streak >= 30` | Unlocks `Monthly Master` badge | `BADGES` (profiles.ts) |
| `streak >= bestStreak` | Unlocks `Personal Best` badge | `BADGES` (profiles.ts) |
| **Weekly Streaks** | | |
| `weeklyStreak >= 1` | Unlocks `1-Week Habit` badge | `BADGES` (profiles.ts) |
| `weeklyStreak >= 4` | Unlocks `Monthly Rhythm` badge (4 weeks = 1 month) | `BADGES` (profiles.ts) |
| `weeklyStreak >= 8` | Unlocks `2-Month Consistency` badge | `BADGES` (profiles.ts) |
| `weeklyStreak >= 12` | Unlocks `Quarter Champion` badge (3 months) | `BADGES` (profiles.ts) |
| **Monthly Streaks** | | |
| `monthlyStreak >= 1` | Unlocks `First Month` badge | `BADGES` (profiles.ts) |
| `monthlyStreak >= 3` | Unlocks `Quarter Streak` badge | `BADGES` (profiles.ts) |
| `monthlyStreak >= 6` | Unlocks `Half-Year Hero` badge | `BADGES` (profiles.ts) |
| `monthlyStreak >= 12` | Unlocks `Year-Long Legend` badge | `BADGES` (profiles.ts) |
| **Other** | | |
| `streak > 0 && streak % 7 === 0` AND ≥1 task done today | Auto-opens feedback modal once that day | L1326 |
| `hour >= 21` | Same feedback modal trigger (independent of streak) | L1326 |
| Reminder templates | Copy references "streak vibes" / "don't break the streak" | `reminder-templates.ts` |
| Admin dashboard | Computes all streak types per student | `AdminView.tsx` |

---

## 8. Edge Cases & Known Gaps

| # | Case | Current behavior | Concern |
|---|---|---|---|
| 1 | Student in a different TZ (e.g. Rafael in NY) | Streak uses device local date; reminders use Manila time | Day boundary mismatches reminder windows |
| 2 | Cross-device race | Last write wins per `date_key` (boolean), so safe | None |
| 3 | Server clock drift / wrong device date | Streak can be inflated or wiped | No server-side validation |
| 4 | One-tap "completion farming" | Any single task counts; no minimum effort | Acceptable per current design |
| 5 | Manual reset | Streak vanishes, no confirmation that it was N days long | Could lose motivational context |
| 6 | Lookback cap at 365 | Streaks > 1 year silently cap | Unlikely but worth a note |
| 7 | No "active today" visual nudge before completion | Today's dot is highlighted as `current` but inactive | Minor — already by design |
| 8 | Feedback `% 7` collides with hour ≥ 21 | Both can fire same day; guarded by `promptedKey` | Working as intended |
| 9 | `studentId` swap in same browser | Storage keys are scoped per student — safe | None |
| 10 | Admin dashboard streak counts visits OR completions inconsistently with client | Admin walks `compsByDay` only; matches client | Verify if visits ever feed into client streak (they do not today) |

---

## 9. Success Metrics

### 9.1 Daily Streak Metrics
- **% of days with ≥1 completion** (rolling 28d) per student.
- **Median daily streak length** at the moment a student opens the app.
- **3-Day Spark badge unlock rate** within first 7 days of use.
- **Feedback modal completion rate** when triggered by the 7-day milestone vs. the 9pm trigger.
- **Reset events / week** (signals frustration with streak loss).

### 9.2 Weekly Streak Metrics (NEW)
- **% of weeks with ≥1 completion** (rolling 12 weeks) per student.
- **Median weekly streak length** across all active users.
- **4-Week (Monthly Rhythm) badge unlock rate** within first 8 weeks.
- **Weekly streak vs daily streak correlation** (do users with broken daily streaks maintain weekly?).
- **Weekly streak recovery rate** after daily streak breaks.

### 9.3 Monthly Streak Metrics (NEW)
- **% of months with ≥1 completion** (rolling 12 months) per student.
- **Median monthly streak length** across all active users.
- **3-Month (Quarter Streak) badge unlock rate** within first 6 months.
- **12-Month (Year-Long Legend) badge unlock rate** within first 24 months.
- **Monthly streak retention** (users who maintain ≥1 month streak after 6 months).

### 9.4 Cross-Streak Metrics (NEW)
- **Users maintaining all 3 streak types simultaneously** (%).
- **Preferred streak type** (which badge users unlock most often).
- **Streak anxiety reduction** (user feedback comparing daily vs weekly/monthly pressure).
- **Long-term retention** (users with ≥6 monthly streak vs ≥30 daily streak).

---

## 10. Open Questions / Future Work

1. **Grace day / streak freeze** — should a student get 1 missed day per week without losing the run? Lightweight retention lever.
2. **Tiered badges** — 7-day, 14-day, 30-day, 100-day. Currently only 3-day exists.
3. **Timezone resolution** — fix per-student TZ in profile so Rafael's day boundary matches his reminders.
4. **Streak-aware copy** — celebrate milestones in the congratulatory modal (e.g. "Day 7 unlocked!").
5. **Restore-from-reset** — soft-reset (archive history) vs. hard-delete, so a student can "undo".
6. **Server-authoritative date** — compute `date_key` from server time at insert to prevent device-clock abuse.
7. **Inactive-today nudge** — different dot style when today is `current` but not yet `active`, to prompt action.
