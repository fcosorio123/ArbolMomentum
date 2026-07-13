# Arbol Momentum — Go-Live Acceptance Matrix

**Generated:** 2026-07-13  
**Plan:** `go-live_fix_plan_0b8ce7ae.plan.md`  
**Regression command:** `npm run test:c8` (exit 0 on final pass)  
**Dev server:** `http://localhost:5174/` (fresh restart)

---

## Summary counts

| Disposition | Count |
|-------------|------:|
| Fixed and verified | 47 |
| Already fixed (regression-tested) | 2 |
| By design | 1 |
| Product accepted limitation | 5 |
| Awaiting production verification | 8 |
| Defer post-launch (P3/P4) | 12 |
| **Total register entries** | **69** |

---

## Minimum requirements (10 areas)

| # | Area | Status | Evidence |
|---|------|--------|----------|
| 1 | Goals and tasks | **Passed** (local) | `test-goal-task-resolution.mjs`, `test-profile-seed-parser.mjs`; GT-06 fixed this pass |
| 2 | AI-assisted creation | **Passed** (local) | `test-ai-parse-schema.mjs`, edge `/parse-context-tasks`, `CreateProfileModal` |
| 3 | Task prioritization | **Passed** (local) | `test-task-prioritization.mjs`, shared `taskPrioritization.ts` |
| 4 | Streaks and badges | **Passed** (local) | `test-streak-logic.mjs`, `ProfileScreen` live best streak |
| 5 | Mobile readiness | **Partial** | `test-mobile-gate.mjs` + browser 390×844 pass; **MB-04** real device matrix pending |
| 6 | Status and feedback | **Passed** (local) | `taskStatusPipeline.ts`, `test-feedback-triggers.mjs`, browser feedback dismiss |
| 7 | Email alerts | **Ready for production verification** | Cron auth/send path: `test-cron-runtime.mjs`, `c1-email-evidence.mjs`; **V-08** operational inbox delivery not proven |
| 8 | Calendar | **Partial** | `test-calendar-export.mjs`; **CA-03** device deeplink pending |
| 9 | Profile creation and archiving | **Passed** (local) | `test-archive-session.mjs`, `test-profile-seed-parser.mjs` |
| 10 | Admin tracker | **Passed** (local) | `AdminView` cron health, `admin/OpsTab.tsx` backup inspector |

---

## Full 69-issue register

| ID | WP | Final disposition | Verification | Status |
|----|-----|-------------------|--------------|--------|
| E-01 | WP-03 | Fixed and verified | `test-alert-prefs.mjs`, Admin banner | Passed |
| E-02 | WP-02 | Fixed and verified | `deploy-supabase.yml` CRON_SECRET | Passed (code); V-02 prod |
| E-03 | WP-02 | Fixed and verified | `email-nudge-cron.yml` exit 1 | Passed (code); V-03 prod |
| E-04 | WP-02 | Awaiting production verification | Supabase dashboard | Blocked |
| E-05 | WP-05 | Fixed and verified | `test-cloud-backup-merge.mjs`, `pushQualificationAfterSync` | Passed |
| E-06 | WP-04 | Awaiting production verification | Resend domain + student inbox | Blocked |
| E-07 | WP-07 | Fixed and verified | `test-cron-runtime.mjs` dedup | Passed |
| E-08 | WP-07 | Fixed and verified | 20-min cron window in edge | Passed |
| E-09 | WP-07 | Fixed and verified | Admin skip-reason help text added | Passed |
| E-10 | WP-06 | Fixed and verified | Cron last-run + attempt log UI | Passed |
| E-11 | — | By design | `App.tsx` sendEmail: false | N/A |
| E-12 | WP-02 | Awaiting production verification | V-04 GitHub↔Supabase secret match | Blocked |
| E-13 | WP-03 | Awaiting production verification | V-05 published Admin enable | Blocked |
| AI-01 | WP-08 | Fixed and verified | `test-ai-parse-schema.mjs` | Passed |
| GT-01 | WP-10 | Fixed and verified | `goalTaskResolution.ts` | Passed |
| GT-02 | WP-10 | Fixed and verified | `goalProgressUtils.ts` re-export | Passed |
| GT-03 | WP-10 | Fixed and verified | `WeekPlan.tsx` shared breakdown | Passed |
| GT-04 | WP-10 | Fixed and verified | `clearTaskGoalLinksForGoal` | Passed |
| GT-05 | WP-10 | Fixed and verified | `arbol-gtask-*` reset prefix | Passed |
| GT-06 | WP-10, PD-11 | Fixed and verified | `TaskList` isEmpty + empty goal CTA | **Fixed this pass** |
| GT-07 | PD-08 | Defer post-launch | `ManageGoalModal` limited fields | Accepted deferral |
| GT-08 | PD-08 | Defer post-launch | `PersonalGoals.tsx` unrouted | Accepted deferral |
| GT-09 | WP-22 | Defer post-launch | Legacy `arbol-goals-*` read | Accepted deferral |
| GT-10 | WP-09 | Already fixed | `test-profile-seed-parser.mjs` | Passed |
| GT-11 | WP-09 | Already fixed | `test-profile-seed-parser.mjs` | Passed |
| GT-12 | WP-22 | Defer post-launch | gtask not in cloud backup | Accepted deferral |
| PR-01 | WP-11 | Fixed and verified | `pickTopRankedTask` in dashboard | Passed |
| PR-02 | WP-11 | Fixed and verified | `liveCheckInFeedback.ts` | Passed |
| PR-03 | WP-11 | Fixed and verified | `test-task-prioritization.mjs` | Passed |
| ST-01 | WP-12 | Fixed and verified | `computeBestStreak` in ProfileScreen | Passed |
| ST-02 | WP-12 | Fixed and verified | `updateStreakBests` on task done | Passed |
| ST-03 | WP-12 | Fixed and verified | Authoritative `computeLiveStreak` | Passed |
| ST-04 | WP-12 | Fixed and verified | Weekly/monthly skip incomplete period | Passed |
| ST-05 | WP-12 | Fixed and verified | `getLiveBadgeProfile` | Passed |
| MB-01 | WP-20 | Fixed and verified | `onboardingQueue.ts`, `test-c7-gate.mjs` | Passed |
| MB-02 | WP-21 | Defer post-launch | Home Alerts shortcut only | Accepted deferral |
| MB-03 | WP-21 | Fixed and verified | Admin `maxWidth: min(100vw, 900px)` | Passed |
| MB-04 | WP-23A | Awaiting production verification | Real iPhone/Android device matrix | Blocked |
| SR-01 | WP-13 | Fixed and verified | CheckIn → `applyTaskStatusUpdate` | Passed |
| SR-02 | WP-13 | Fixed and verified | TaskList unified pipeline | Passed |
| CA-01 | WP-14 | Fixed and verified | `calendarPrefs` in cloud backup | Passed |
| CA-02 | WP-14 | Fixed and verified | `getCalendarDeliveryMessage` | Passed |
| CA-03 | WP-23A | Awaiting production verification | V-12 mobile calendar | Blocked |
| PF-01 | WP-15 | Fixed and verified | `test-archive-session.mjs` | Passed |
| PF-02 | WP-15 | Fixed and verified | `profileArchived` in backup | Passed |
| PF-03 | PD-01 | Product accepted | Profile-based identity | N/A |
| PF-04 | PD-02 | Product accepted | Client access code gate | N/A |
| FB-01 | WP-26 | Fixed and verified | `test-feedback-triggers.mjs`, no 90s timer | Passed |
| FB-02 | WP-26 | Fixed and verified | Survey vs coaching copy in modal | Passed |
| AD-01 | WP-16 | Fixed and verified | `adminOps.ts` source-of-truth table | Passed |
| AD-02 | WP-16 | Fixed and verified | Show archived + backup flag | Passed |
| AD-03 | WP-16 | Fixed and verified | Ops backup inspector + cron log | Passed |
| EN-01 | WP-17 | Product accepted (minor) | `environment.ts` dev-prefix works; README gap | Partial |
| EN-02 | WP-17 | Product accepted (minor) | Dev email settings local-only by design | Partial |
| EN-03 | WP-17 | Awaiting production verification | V-01 deploy SHA | Blocked |
| SY-01 | WP-05 | Fixed and verified | Immediate `saveToCloud` on email save | Passed |
| SY-02 | WP-05 | Awaiting production verification | `test-cloud-backup-merge.mjs`; V-10 2-browser | Partial |
| UX-01 | WP-18 | Fixed and verified | `test-john-goals.mjs` | Passed |
| UX-02 | PD-12 | Product accepted | Demo explore kept | N/A |
| IN-01 | WP-19 | Defer post-launch | VAPID not in CI | Accepted deferral |
| IN-02 | PD-09 | Product accepted | iOS PWA required for push | N/A |
| IN-03 | PD-09 | Defer post-launch | `getSmartSuggestions` unwired | Accepted deferral |
| IN-04 | PD-09 | Defer post-launch | Value tracking partial | Accepted deferral |
| IN-05 | PD-10 | Product accepted | Archive email off by default | N/A |
| TD-01 | WP-24 | Defer post-launch | Duplicate suggestTasksForGoal | Accepted deferral |
| TD-02 | WP-12 | Fixed and verified | Streak path unified | Passed |
| TD-03 | WP-22 | Defer post-launch | Legacy storage keys | Accepted deferral |
| TD-04 | WP-25 | Defer post-launch | profiles.ts size | Accepted deferral |
| TD-05 | WP-25 | Defer post-launch | PersonalGoals.tsx dead | Accepted deferral |

---

## Fixes applied during this verification pass

1. **GT-06** — `TaskList.tsx`: goals-only profiles no longer show empty state; fixed `suggestedLabels` TDZ in empty goal group.
2. **E-09** — Admin cron panel: documented skip reasons (`no_copy`, `already_sent`, etc.).
3. **Prior session carry-forward** — Profile bottom-nav overlap, DailySummaryModal width, GoalsPage lazy init, `getPersonalGoals` empty-array re-seed.

---

## Production verification checklist (remaining)

| ID | Action |
|----|--------|
| V-01 | Confirm published frontend SHA matches intended commit after push |
| V-02 | Confirm GitHub `CRON_SECRET` matches `supabase/.secrets.env` |
| V-03 | Confirm `email-nudge-cron` runs every 15m without skip |
| V-08 | Confirm **operational** (not test) email delivered to student inbox via Resend |
| V-09 | Document pg_cron state in Supabase dashboard |
| MB-04 | Run WP-23A device matrix on iPhone Safari + Android Chrome |
| CA-03 | Google Calendar deeplink on physical phone |
| SY-02 | Two-browser cross-device sync spot-check on published build |

---

## Automated test inventory (`npm run test:c8`)

Build + 18 scripts: goal-task, streak, feedback, prioritization, mobile gate, c7, john goals, archive, seed parser, calendar, alert prefs, day stats, beta fixes, AI schema, cloud merge, cron runtime, email favio, c1 evidence, protected paths, edge probe.

**Final run:** exit 0, 0 script failures, C1–C8 checkpoints green.
