Arbol PRD Update: Student Financial Success Platform (New York Edition)
Empowering NYC-area students with clear funding pathways, retention tools, and motivational habits to graduate debt-smart.

1. Product Overview
Arbol is a financial success platform for higher education institutions, focused on New York students navigating tuition, aid, scholarships, and living costs in one of the country’s most expensive cities.
It aggregates data from SIS, financial aid, bursar, and personal finance inputs into personalized financial roadmaps, proactive risk alerts, and motivational habit-building tools that drive completion and persistence.
New Emphasis (per feedback):
Stronger personal goals + checklist logic, daily habits tied to financial motivation, and seamless real-time task flows from “Your Goals.”

2. Updated Goals & Non-Goals
New/Enhanced Goals

Deliver motivational checklist experiences in Personal Goals and Daily Habits that reinforce financial behaviors.
Make task completion real-time and flow directly to dedicated Task pages.
Use progress logic that fairly divides completion % across checklist items (currency/funding goals keep monetary tracking; others use equal-weighted checklists).
Boost student motivation by linking daily habits to broader personal/financial goals.

Non-Goals

Still not a banking platform or payment processor.
Does not replace institutional counseling.


3. Personas & Key User Stories (Updated)
Student Persona

First-gen / low-income NYC student balancing CUNY/SUNY costs, part-time work, and family responsibilities.
Needs motivation, clear next actions, and visible progress.

Updated User Stories

As a student, I want smart checklist logic on my Personal Goals so progress feels fair and motivating (currency goals track $; others divide 100% equally across tasks).
As a student, I want Daily Habits to auto-contribute to related Personal Goals for holistic motivation.
As a student, when I log progress on a goal (e.g., “Invest in Life Insurance”), I am taken to the dedicated Tasks page (real-time status sync), not back to the goals overview.
As a student, I want to see streaks, % completion, and motivational nudges to build financial discipline.


4. Functional Requirements – Enhanced Modules
Your Goals / Personal Goals Module (High Priority)
Core Features

Goal cards with title, motivational quote, progress circle (e.g., 100% Done), and milestone tracker.
Checklist Logic Flow:
Currency/funding goals (e.g., savings targets) retain monetary progress.
Non-monetary goals divide 100% completion equally across the number of checklist tasks (e.g., 5 tasks = 20% each).
Real-time updates: Completing a sub-task instantly refreshes the parent goal %.

Task Logging Flow:
“Log Progress” or individual task checkboxes → navigates to dedicated Tasks page.
Real-time sync across dashboard, goals, and tasks.
Educational content (articles/videos) linked per goal.

Examples from mockup: “Invest in Life Insurance”, Birthday, Fund, July, Job, Insurance.

Daily Habits Module (High Priority)

“1 of 10 done – 10% complete” tracker.
Habits list with progress bars (e.g., CHRA/acCPHR Review, Career & Job Prep, Financial Tracking, Evening Routine).
Cross-linking to Personal Goals: All habit completions that relate to a Personal Goal automatically increment that goal’s progress and streak.
Motivational messaging: “Every task counts — let’s go!” + Intern/Student/Arbol Momentum.

Current Streak & Motivation Layer

Flame icon + “X days” streak (e.g., 5 days).
Weekly progress bars.
Avg. completion % (e.g., 72%) and “Week 2 On program”.

Continue Tasks / Task Center

Centralized page for all active tasks with real-time status.
Filters by goal, habit, deadline, or priority.
One-click logging with immediate reflection on dashboard/goals.


5. Logic / System Behavior (New Checklist Rules)
Personal Goals Progress Calculation

Identify goal type:
Monetary → use currency/savings logic.
Non-monetary → progress = (completed_tasks / total_tasks) × 100 (equal weight per task).

Real-time update on any sub-task change.
Daily Habits that map to goals also increment parent progress.

Task Flow

Task complete → real-time DB update → dashboard + goals refresh → user redirected to full Tasks page for context/next actions.
Notifications for streaks, near-milestones, and motivational wins.

Risk & Motivation Integration
Habits like “Financial Tracking” or “Evening Routine” help reduce financial stress signals.

6. UI/UX Reference (Based on Provided Mockup)

Top: Current Streak (flame + days) + Best trophy.
Your Goals carousel with progress rings.
Daily Habits list with partial progress.
Continue Tasks card.
Bottom motivational banner.
Responsive, mobile-first for NYC students on the go.


7. Technical & Integration Notes

Real-time updates via WebSockets or polling (low latency).
Progress stored at task level; aggregated views computed on read.
Maintains all existing SIS integrations, FERPA compliance, etc.


8. Success Metrics (Updated)

Goal completion rate.
Daily habit adherence.
Task logging frequency from goals.
Student retention/persistence lift.
Streak length & engagement.