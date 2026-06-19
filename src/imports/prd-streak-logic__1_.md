# PRD — Streak Logic (Arbol Momentum)

Owner: Arbol
Surface: `MobileMomentumPwa` (`src/components/mobile-momentum-pwa.tsx`)
Status: Reverse-engineered from current implementation

---

## 1. Overview

The **Streak** is a daily-engagement counter that rewards a student for completing at least **one task per local day**. It surfaces in:
- The **progress card** (Flame icon + "{n}-day streak" + weekly dot row).
- The **Today's earnings** card subline ("1 star = ₱2 · {n}-day streak").
- Reminder copy (morning/midday/evening templates).
- The **3-Day Streak badge** (one of six badges).
- The **feedback prompt** auto-trigger (every 7-day milestone).

The streak is a *motivation* metric, not a *scoring* metric — it does not change pesos earned or badge thresholds beyond `3-Day Streak`.

---

## 2. Goals

1. Reinforce a once-per-day return habit with the lightest possible threshold (1 completion).
2. Give students an at-a-glance read of "am I keeping it alive this week?" via 7 day-dots (Mon–Sun).
3. Trigger meaningful checkpoints (badge at 3 days, feedback prompt every 7 days).
4. Survive across devices for the same student via Supabase-backed completion history.

## 3. Non-Goals

- No partial-day or hourly streak.
- No "streak freeze" / grace day / vacation mode.
- No multi-tier streak rewards (e.g. 7/14/30-day badges) beyond the single 3-day badge.
- No social comparison or leaderboards.

---

## 4. User Stories

- As a student, when I finish my **first task of the day**, my streak should tick up by 1 and the today-dot should light.
- As a student, when I open the app, I should see how many consecutive days I've shown up.
- As a student, on Monday morning the weekly dot row resets visually so I start a fresh week — but my multi-week streak number keeps counting.
- As Arbol, when a student hits a 7-day milestone with at least one task done today, we surface the feedback modal once.

---

## 5. Functional Spec

### 5.1 What counts as a "streak day"
A calendar date (device local, `YYYY-MM-DD`) is a streak day when **at least one task has been marked `done` on that date**. Effort, impact, stars, and which task are all irrelevant — a single completion sets `completionHistory[dateKey] = true` for the rest of time.

```ts
// On task completion (src/components/mobile-momentum-pwa.tsx ~L1146)
const nextHistory = { ...completionHistory, [todayDateKey]: true };
```

### 5.2 Streak computation
Walk backward from today; stop at the first missing day. Max lookback **365 days**.

```ts
// computeStreak (L175)
for (let offset = 0; offset < 365; offset += 1) {
  const dateKey = getLocalDateKey(shiftDate(today, -offset));
  if (!history[dateKey]) break;
  streak += 1;
}
```

Consequences:
- **Today not yet completed** → streak shows yesterday's run (still "alive" until midnight).
- **Missed any prior day** → streak resets to 0 the moment that gap exists in history.
- **No "freeze" or recovery** — one missed midnight ends the run.

### 5.3 Day boundary
Uses the device's local timezone via `getLocalDateKey()`. The Manila-specific logic in `reminder-templates.ts` does not affect the client streak counter. Travelers see streaks tick over at *their* local midnight.

### 5.4 Weekly dot row (Mon–Sun)
Independent of the streak number — purely visual context for the current ISO-style week.

```ts
const dayOfWeek = (currentDate.getDay() + 6) % 7; // 0 = Mon
const monday = shiftDate(currentDate, -dayOfWeek);
// 7 dots: { label: "Mon".."Sun", active: history[dateKey], current: dateKey===today }
```

- **active** styling (`streak-dot-active`): day has ≥1 completion.
- **current** styling (`streak-dot-current`): today's dot.
- Resets visually every Monday; does not influence `metrics.streak`.

### 5.5 Persistence

| Layer | Key / Table | Purpose |
|---|---|---|
| `localStorage` | `momentum-completion-history:{studentId}` | Fast restore on next load |
| Supabase | `student_completions(student_id, task_id, date_key)` | Cross-device truth |
| Supabase | `student_resets(student_id)` | Logs manual reset events |

On load (L948): merge all `student_completions` rows into `completionHistory` keyed by `date_key`. Only **today's** rows restore `tasks[].status = "done"` — historical days roll fresh so the same task can be redone.

### 5.6 Reset behavior
`handleResetProgress` (L960) clears `completionHistory`, `earnedBadges`, today's `status`, and the `localStorage` history key. Streak immediately drops to 0. A `student_resets` row is logged.

### 5.7 Streak-driven side effects

| Trigger | Behavior | Source |
|---|---|---|
| `streak >= 3` | Unlocks `3-Day Streak` badge (one-time) | `BADGES` (L229) |
| `streak > 0 && streak % 7 === 0` AND ≥1 task done today | Auto-opens feedback modal once that day | L1326 |
| `hour >= 21` | Same feedback modal trigger (independent of streak) | L1326 |
| Reminder templates | Copy references "streak vibes" / "don't break the streak" | `reminder-templates.ts` |
| Admin dashboard | Computes its own streak (consecutive days with ≥1 completion, walking back) per student | `routes/admin.tsx` L181 |

---

## 6. Edge Cases & Known Gaps

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

## 7. Success Metrics

- **% of days with ≥1 completion** (rolling 28d) per student.
- **Median streak length** at the moment a student opens the app.
- **3-Day Streak badge unlock rate** within first 7 days of use.
- **Feedback modal completion rate** when triggered by the 7-day milestone vs. the 9pm trigger.
- **Reset events / week** (signals frustration with streak loss).

---

## 8. Open Questions / Future Work

1. **Grace day / streak freeze** — should a student get 1 missed day per week without losing the run? Lightweight retention lever.
2. **Tiered badges** — 7-day, 14-day, 30-day, 100-day. Currently only 3-day exists.
3. **Timezone resolution** — fix per-student TZ in profile so Rafael's day boundary matches his reminders.
4. **Streak-aware copy** — celebrate milestones in the congratulatory modal (e.g. "Day 7 unlocked!").
5. **Restore-from-reset** — soft-reset (archive history) vs. hard-delete, so a student can "undo".
6. **Server-authoritative date** — compute `date_key` from server time at insert to prevent device-clock abuse.
7. **Inactive-today nudge** — different dot style when today is `current` but not yet `active`, to prompt action.
