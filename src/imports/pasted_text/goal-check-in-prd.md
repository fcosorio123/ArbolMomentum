PRD Update: Goal & Task Check-in Flow Enhancement

Feature Name

Universal Goal Check-in Experience (All Student Profiles)

Objective

Create a lightweight check-in experience that allows students to quickly update the status of their goals and tasks while giving Arbol real-time visibility into progress, risk signals, and financial barriers.

This experience should work across all student profiles, goal types, and task types, not just financial aid workflows.

⸻

Design Alignment with Current Goal Cards

Based on the current goal card design:

* Goal cards remain the primary container.
* Check-ins occur at the goal level first, then task level.
* Progress rings, completion percentages, and task statuses remain visible.
* Goal cards can be expanded to show tasks.
* Status updates immediately affect:
    * Goal progress %
    * Task completion state
    * Risk detection engine
    * Staff dashboards
    * Student recommendations

The experience should visually match the current goal/task structure shown in the dashboard.

⸻

Updated Check-in Entry Point

Dashboard Banner

Displayed above the Goals section.

Dynamic Copy

High Priority

🔴 3 Goals Need Check-in
Quickly update your progress and keep your financial plan on track.

[Start Check-in]

Medium Priority

🟡 2 Goals Need Check-in
A few updates can help us provide better guidance.

[Continue Check-in]

Low Priority

🟢 You’re Almost Fully Updated
Complete your remaining check-ins.

[Finish Check-in]

⸻

Check-in Landing Page

Header

Weekly / Monthly Check-in

How did your goals and tasks progress during this period?

Progress Indicator

2 of 5 goals checked in (40%)

⸻

Goal Sections

✅ On Track Goals

Goals already confirmed or automatically detected.

Examples:

* Complete FAFSA Application
* Maintain SAP Requirements
* Scholarship Submission Goal
* Tuition Payment Plan

Each displays:

* Goal title
* Completion %
* Last updated date

⸻

⏰ Needs Check-in

Goals requiring user confirmation.

Examples:

* Resolve Bursar Hold
* Submit Verification Documents
* Complete Scholarship Applications
* Financial Wellness Goal

Each displays:

* Goal title
* Current progress
* Number of tasks needing confirmation

⸻

Smart Ordering

Goals should appear in order of:

1. Highest financial risk
2. Upcoming deadlines
3. Lowest confidence data
4. Longest time since last update

⸻

Goal Check-in Screen

The current expanded goal card becomes the check-in experience.

⸻

Goal Header

Goal Name

Example:

Complete FAFSA + TAP for Fall 2026

Progress: 75% Complete

Why This Matters

Display existing goal rationale.

Example:

Completing financial aid requirements helps prevent funding delays and registration holds.

⸻

Task Check-in Experience

Each task becomes a quick status confirmation.

⸻

Task Question Format

Instead of simply showing a task title:

Example

Did you submit your FAFSA verification documents?

Supporting text:

This requirement may affect your aid eligibility.

⸻

Status Options

🟢 Yes, Done

🟡 Working On It

⚪ Not Started Yet

⸻

Additional Examples

Tuition Goal

Did you make a payment or set up a payment plan?

⸻

Scholarship Goal

Did you submit your scholarship application?

⸻

Academic Success Goal

Did you meet with your academic advisor this month?

⸻

Career Goal

Did you attend a career center workshop?

⸻

Universal Goal Support

The check-in system must support all goal categories.

Examples include:

Financial Goals

* FAFSA
* TAP
* Scholarships
* Payment Plans
* Tuition Balances

Academic Goals

* SAP Maintenance
* Advisor Meetings
* Registration

Career Goals

* Internship Applications
* Resume Reviews
* Career Events

Wellness Goals

* Counseling Resources
* Student Support Programs

Institution-Specific Goals

* Custom advisor-created goals
* Program-specific requirements

The system should dynamically generate questions from task metadata regardless of goal type.

⸻

Smart Auto-Detection

When connected systems already provide verification:

Auto-Mark Complete

Examples:

* FAFSA submitted
* Verification received
* Payment posted
* Registration completed

Display:

✅ Verified by your school records

Students may still manually update if needed.

⸻

Remaining Goals Navigation

At all times display:

Remaining Goals

* FAFSA Goal ✓
* Scholarship Goal
* Tuition Goal
* SAP Goal

Students can:

* Jump between goals
* Skip goals
* Resume later

⸻

Real-Time Updates

As each response is submitted:

Update immediately:

* Task Status
* Goal Completion %
* Dashboard Progress Ring
* Risk Detection Score
* Advisor Visibility
* Recommended Actions

No batch save required.

⸻

New Completion Experience (Added)

Once all required goals have been checked in:

Processing Screen

Display a short transition state.

Loading State 1

⏳ Updating real-time task and goal statuses…

Progress animation shown.

⸻

Loading State 2

💾 Saving changes…

Progress animation shown.

⸻

Loading State 3

🌱 Refreshing your personalized financial roadmap…

Progress animation shown.

⸻

Check-in Success Screen

Celebration State

🎉 Congratulations! You’re checked in for today!

Thank you for keeping your progress up to date.

Your goals, tasks, and recommendations have been refreshed.

⸻

Summary Card

Today’s Updates

* 4 goals updated
* 12 tasks reviewed
* 3 tasks completed
* 1 risk resolved

⸻

Updated Progress

Example:

Goal	New Progress
FAFSA Goal	100%
Scholarship Goal	80%
Tuition Goal	60%

⸻

Badge & Achievement Integration

If new achievements were unlocked during check-in:

Display immediately after success state.

Achievement Section

🏅 New Achievement Earned

Examples:

* FAFSA Finisher
* Scholarship Seeker
* Consistency Streak (7 Days)
* On-Time Planner
* Financial Milestone Reached

Show:

* Badge icon
* Badge name
* Short achievement description

Multiple badges should be displayed in a carousel or stacked card layout.

⸻

Empty State

If no check-ins are required:

🎉 You’re all caught up!

No goals need updates right now.

We’ll notify you when new actions require attention.

⸻

Success Metrics

Track:

* Check-in completion rate
* Average goals checked in
* Average tasks reviewed
* Badge unlock rate
* Time to complete check-in
* Risk reductions after check-in
* Goal completion improvements
* Student retention correlation

Acceptance Criteria

* Works across all student profiles and goal categories.
* Matches existing goal card structure and visual hierarchy.
* Supports task-level status updates.
* Updates progress in real time.
* Includes completion processing screen.
* Includes celebration screen with confetti.
* Displays newly earned badges and achievements.
* Supports skipping and resuming check-ins.
* Integrates with risk detection and advisor dashboards.
* Auto-detects completion from SIS, Financial Aid, and institutional data sources where available.