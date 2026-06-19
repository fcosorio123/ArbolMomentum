Figma Make Command: Surgical Update to Tasks, Goal Context, Navigation, Profile Privacy, and User-Managed Goals/Tasks

Before making changes, first assess the current prototype structure and produce an execution plan. Do not start implementation until the plan is clear.

The plan should include:

What pages/components need to change
What data relationships currently exist between goals, tasks, users, logs, and profiles
Which changes are low-risk and can be done first
Which changes are more complex and should be done last
Any questions that must be answered before implementation
Any assumptions being made if the current structure is unclear

If there are blocking questions, ask them before executing. If there are no blocking questions, proceed using the instructions below.

Core product framing

This is not a Goals app. This is a Task app.

Tasks are the primary user action surface. The user should never have to hunt for tasks, click into multiple places to find tasks, or feel like goals have replaced the task experience.

Goals should act as motivational context. They should constantly remind the user why they are doing the task.

The intended experience is:

“Here is what I need to do next, and here is the goal/reason this task supports.”

The goal is the carrot. The task is the action.

Core execution principles
Optimize for asymmetric results: low-risk, high-return changes.
Be surgical: preserve the current structure, components, styling, and flows wherever possible.
Start wide, then narrow: first assess the existing prototype, then apply the smallest effective changes.
Keep tasks front and center.
Use goals to reinforce motivation and context, not to bury tasks.
Preserve the existing design language unless a change is necessary for clarity, usability, privacy, or functionality.
1. Update the Task page layout

On the Task page, keep tasks as the primary focus. Goals should be visible as context around the tasks, not as a replacement for the task list.

Use this structure:

Page title: Tasks
Short helper text:
Complete the tasks that move your goals forward.
Primary task list grouped by goal context
Unassigned Tasks section, only if needed
Goal Log access where relevant

Each task should remain directly visible on the Task page.

Each task row/card should include:

Task title
Task description, if available
Status
Due date, if available
Completion action, if available
Connected goal label or goal section
Short “why this matters” goal context

Preferred structure:

Goal: [Goal Name]
Why this matters: [Short goal reason]
Tasks:
Task 1
Task 2
Task 3

The goal section should support the task experience. It should not dominate the page.

Do not make users click into a goal to see its tasks. Tasks must be visible immediately.

2. Make every task appear on the Task page

Fix the Task page so every task appears somewhere.

Rules:

If a task belongs to a goal, show it under that goal context.
If a task does not belong to a goal, show it under Unassigned Tasks.
Do not hide incomplete tasks.
Do not hide completed tasks unless the current UI already has a completed/collapsed section.
Do not create a second competing task system.
The Task page should remain the single main place where users know what they need to do.

If the existing data structure does not clearly connect a task to a goal, use the visible goal label, tag, or closest available relationship in the prototype.

3. Keep tasks front and center while making goals visible

The Task page should constantly signal why the user is working on each task.

The user should understand:

What task they need to complete
What goal the task supports
Why that goal matters
What progress they are making

Use goals as motivational context, not navigation friction.

The experience should communicate:

“This task matters because it helps you make progress toward this goal.”

Do not make the page feel like a Goals dashboard. This is still the Task page.

4. Add guided coachmarks for the new flow

Add lightweight coachmarks to explain the updated flow to testers.

Add coachmarks in these places:

Coachmark 1: Task page

Copy:
Your tasks are the actions to complete. Goals explain why those tasks matter.

Coachmark 2: Goal context above grouped tasks

Copy:
This goal shows what these tasks are helping you move forward.

Coachmark 3: Task list under a goal

Copy:
Complete these tasks to make progress toward this goal.

Coachmark 4: Goal Log link or area

Copy:
Goal Logs show updates, progress, and what changed over time.

Coachmark requirements:

Coachmarks should be short.
Coachmarks should be dismissible.
Coachmarks should come with the ability to skip
Coachmarks should not block users from completing tasks.
Do not create a long onboarding flow.
Use the existing style of tooltips, modals, or helper UI if already available.
5. Make Goal Logs easier to find

Wherever a goal appears as context on the Task page, add a visible way to access its Goal Log.

Use one of these labels:

View Goal Log
Open Goal Log
See Progress Log

Use the label that best fits the current UI style.

Do not create a new major navigation pattern. Add Goal Log access inside the existing goal context area or task group.

6. Protect the all-profiles page with an access code

The page where all tester profiles are visible must not be accessible by default.

Add an access-code screen before the all-profiles page.

Access code:
Arbol123

Rules:

The user must enter the code before viewing the all-profiles page.
The code must be required every time the all-profiles page is accessed.
Do not remember the code.
Do not allow direct navigation to bypass the code screen.
If the code is incorrect, show this message:
Incorrect code. Please try again.

Access screen copy:

Title:
Enter access code

Helper text:
This page is restricted because it contains tester profile information.

Input label:
Access code

Button:
Continue

Important: This is a prototype privacy gate. Do not build a full authentication system for this update.

7. Build functional user-managed goals and tasks, but do this last

User-managed goals and tasks should be functional, not just a placeholder. However, this is likely the most complex change, so it should be planned carefully and executed after the lower-risk task visibility, goal context, coachmark, navigation, and privacy changes are complete.

Before building this feature, assess the current architecture and identify the safest way to support user-created goals and tasks without breaking the existing prototype.

The user should be able to:

Create a goal
Edit a goal
Delete a goal
Add tasks to a goal
Edit tasks
Delete tasks
Mark tasks complete
View goal progress
View goal logs
Understand which tasks belong to which goals

Functional requirements:

New user-created goals should appear in the relevant Goals experience.
Tasks created under a goal should appear on the Task page.
Edited goals should update wherever that goal appears.
Edited tasks should update wherever that task appears.
Deleted goals should not break the Task page.
If a goal is deleted and its tasks remain, those tasks should move to Unassigned Tasks unless the current architecture supports cascading deletion safely.
Deleted tasks should no longer appear in the active Task page.
Completed tasks should update progress if progress tracking already exists.
Goal Logs should reflect meaningful goal/task changes if the current architecture supports logs.

Add controls where appropriate:

Goal controls:

Add Goal
Edit Goal
Delete Goal

Task controls:

Add Task
Edit Task
Delete Task
Mark Complete

Use simple modals or existing form patterns. Do not introduce a new form system if one already exists.

Suggested Add Goal fields:

Goal name
Goal reason
Save goal
Cancel

Suggested Add Task fields:

Task name
Task description
Connected goal
Due date, if due dates already exist
Save task
Cancel

Do not overbuild this. Build the smallest functional version that supports user-managed goals and tasks while respecting the current architecture.

8. Preserve admin visibility into user performance

Do not remove admin visibility into tester activity.

Admins should still be able to view:

User goals
User tasks
Task completion status
Goal progress
Goal logs or updates
Users who appear stuck or inactive, if this already exists

If the admin portal already has these sections, preserve them. If the new user-managed goal/task functionality adds new user-created data, make sure admins can see that data in the admin portal or existing admin view.

The admin should not need to manually reach out weekly just to define the user’s goals and tasks. Users should be able to manage their own goals and tasks, while admins retain visibility into performance.

9. Suggested execution order

Execute in this order:

Phase 1: Visibility and clarity
Make all tasks visible on the Task page.
Add goal context around tasks.
Keep tasks front and center.
Add Unassigned Tasks if needed.
Phase 2: Guidance and navigation
Add coachmarks.
Make Goal Logs easier to find.
Clarify the updated flow.
Phase 3: Privacy
Add the access-code gate before the all-profiles page.
Require Arbol123 every time.
Phase 4: Functional user-managed goals and tasks
Assess the current architecture.
Identify the safest implementation path.
Build functional add/edit/delete behavior for goals and tasks.
Make sure new and edited items appear correctly on the Task page.
Preserve admin visibility.

Do not start Phase 4 until the current goal/task structure is understood.

10. What not to do

Do not:

Turn this into a Goals app
Redesign the full app
Create a new task system if the existing one can be extended
Hide tasks behind goal detail pages
Make users click multiple times to find tasks
Remove the old task visibility unless the new visibility fully replaces it
Build a complex onboarding flow
Build full authentication
Change unrelated pages
Change the admin portal beyond what is needed for visibility, tracking, and privacy
Add user-managed goals/tasks in a way that breaks existing task behavior
11. Acceptance criteria

This update is complete when:

The Task page remains task-first.
Goals are visible as motivational context.
Each task clearly shows why it matters.
Every task appears on the Task page.
Tasks connected to goals appear under the correct goal context.
Tasks without goals appear under Unassigned Tasks.
Users can immediately understand what they need to do next.
Users can understand which goal each task supports.
Coachmarks explain tasks, goals, and Goal Logs.
Goal Logs are easier to find.
The all-profiles page requires the code Arbol123 every time.
Users can create, edit, and delete goals.
Users can create, edit, and delete tasks.
User-created goals and tasks appear correctly in the Task page experience.
Admins can still track tester progress.
The update is surgical and does not redesign the broader app.