/**
 * Idempotent Favio-only goals/tasks replacement (plan v1).
 *
 * Scope: profileId === 'favio' only.
 * Does not modify other profiles, shared seed catalogs, or infrastructure.
 *
 * Run: node scripts/migrate-favio-goals-v1.mjs
 * Dry-run: node scripts/migrate-favio-goals-v1.mjs --dry-run
 * Rollback: node scripts/migrate-favio-goals-v1.mjs --rollback
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEdgeBase, ANON } from './edge-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = getEdgeBase();
const PROFILE_ID = 'favio';
const EXPECTED_EMAIL = 'favio.c.osorio@gmail.com';
const MIGRATION_ID = 'favio-plan-v1-2026-07-17';
const GOAL_PREFIX = 'user-favio-plan-v1-';
const TASK_PREFIX = 'utask-favio-plan-v1-';
const TODAY = '2026-07-17';

const dryRun = process.argv.includes('--dry-run');
const rollback = process.argv.includes('--rollback');

const headers = {
  Authorization: `Bearer ${ANON}`,
  'Content-Type': 'application/json',
};

const DAY = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Requested Day/Midday/Night -> schema morning|evening */
function daypart(requested) {
  if (requested === 'Night') return 'evening';
  return 'morning'; // Day + Midday
}

function taskId(slug) {
  return `${TASK_PREFIX}${slug}`;
}

function goalId(slug) {
  return `${GOAL_PREFIX}${slug}`;
}

function ms(id, level, title, targetValue, tasks) {
  return { id, level, title, targetValue, tasks, completed: false };
}

function feasibleDate(preferred, fallback = TODAY) {
  if (!preferred) return fallback;
  if (preferred >= TODAY) return preferred;
  return fallback;
}

const OLD_DEFAULT_GOAL_IDS = [
  'favio-lose-weight',
  'favio-founder-performance',
  'favio-longevity',
  'favio-neck-balance',
];

const FAVIO_SEED_TASK_IDS = [
  'fav-mon-1', 'fav-mon-2', 'fav-mon-3', 'fav-mon-4', 'fav-mon-5', 'fav-mon-6', 'fav-mon-7', 'fav-mon-8', 'fav-mon-9', 'fav-mon-10', 'fav-mon-11', 'fav-mon-12',
  'fav-tue-1', 'fav-tue-2', 'fav-tue-3', 'fav-tue-4', 'fav-tue-5', 'fav-tue-6', 'fav-tue-7', 'fav-tue-8', 'fav-tue-9', 'fav-tue-10', 'fav-tue-11', 'fav-tue-12',
  'fav-wed-1', 'fav-wed-2', 'fav-wed-3', 'fav-wed-4', 'fav-wed-5', 'fav-wed-6', 'fav-wed-7', 'fav-wed-8', 'fav-wed-9', 'fav-wed-10',
  'fav-thu-1', 'fav-thu-2', 'fav-thu-3', 'fav-thu-4', 'fav-thu-5', 'fav-thu-6', 'fav-thu-7', 'fav-thu-8', 'fav-thu-9', 'fav-thu-10', 'fav-thu-11', 'fav-thu-12',
  'fav-fri-1', 'fav-fri-2', 'fav-fri-3', 'fav-fri-4', 'fav-fri-5', 'fav-fri-6', 'fav-fri-7', 'fav-fri-8', 'fav-fri-9', 'fav-fri-10', 'fav-fri-11',
  'fav-sat-1', 'fav-sat-2', 'fav-sat-3', 'fav-sat-4', 'fav-sat-5', 'fav-sat-6', 'fav-sat-7', 'fav-sat-8', 'fav-sat-9',
  'fav-sun-1', 'fav-sun-2', 'fav-sun-3', 'fav-sun-4', 'fav-sun-5', 'fav-sun-6', 'fav-sun-7', 'fav-sun-8', 'fav-sun-9', 'fav-sun-10', 'fav-sun-11', 'fav-sun-12', 'fav-sun-13',
];

function buildGoals(now) {
  return [
    {
      id: goalId('weight'),
      profileId: PROFILE_ID,
      title: 'Reach a Healthier Weight Through Consistent Nutrition',
      deepWhy: 'Lose 20 pounds through sustainable nutrition, hydration, meal preparation, and weight monitoring. Success: lose 20 pounds; maintain a declining rolling weight trend during at least three of every four weeks.',
      targetValue: 20,
      currentValue: 0,
      unit: 'lbs',
      targetDate: '2026-09-22',
      createdAt: now,
      milestones: [
        ms('favio-v1-w-m1', 'light', 'Nutrition habits established', 5, ['Protein at 3 meals most days', 'Hit water target most days']),
        ms('favio-v1-w-m2', 'medium', 'Consistent weekly meal prep + weigh-ins', 10, ['Sunday meal prep', 'Sunday weigh-in and trend review']),
        ms('favio-v1-w-m3', 'medium-high', 'Halfway to 20 lbs', 10, ['Keep protein and hydration streak', 'Protect declining weekly trend']),
        ms('favio-v1-w-m4', 'hard', 'Final push toward target weight', 15, ['Tighten consistency if trend stalls']),
        ms('favio-v1-w-m5', 'epic', '20 lbs lost', 20, ['Confirm target weight reached']),
      ],
    },
    {
      id: goalId('fitness'),
      profileId: PROFILE_ID,
      title: 'Build Strength, Endurance, and Consistent Movement',
      deepWhy: 'Improve strength, cardiovascular capacity, athletic activity, and overall movement. Success: establish one strength and one cardio benchmark by July 26, 2026; improve each ~10%; reassess September 20, 2026.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      targetDate: '2026-09-20',
      createdAt: now,
      milestones: [
        ms('favio-v1-f-m1', 'light', 'Baselines established', 25, ['Record strength benchmark', 'Record cardio benchmark']),
        ms('favio-v1-f-m2', 'medium', 'Weekly movement streak', 50, ['Complete planned sessions most weeks']),
        ms('favio-v1-f-m3', 'hard', '~10% benchmark improvement', 80, ['Retest strength', 'Retest cardio']),
        ms('favio-v1-f-m4', 'epic', 'September reassessment complete', 100, ['Compare to July baselines']),
      ],
    },
    {
      id: goalId('mobility'),
      profileId: PROFILE_ID,
      title: 'Reduce Pain and Preserve Mobility',
      deepWhy: 'Reduce neck discomfort, preserve mobility, and prevent pain or stiffness from limiting exercise or daily activity. Success: establish a 7-day baseline neck rating (1-10); reduce average discomfort ~30%; review by September 22, 2026.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      targetDate: '2026-09-22',
      createdAt: now,
      milestones: [
        ms('favio-v1-m-m1', 'light', '7-day baseline recorded', 25, ['Log daily neck ratings']),
        ms('favio-v1-m-m2', 'medium', 'Warm-ups never skipped before workouts', 50, ['Warm up before planned workouts']),
        ms('favio-v1-m-m3', 'hard', '~30% discomfort reduction', 80, ['Compare weekly averages']),
        ms('favio-v1-m-m4', 'epic', 'Mobility preserved without stopping exercise', 100, ['Confirm no missed workouts due to neck pain']),
      ],
    },
    {
      id: goalId('sleep'),
      profileId: PROFILE_ID,
      title: 'Improve Sleep Consistency and Quality',
      deepWhy: 'Establish a reliable bedtime routine that supports sufficient sleep and better morning restfulness. Success: sleep at least 7 hours on ~5 nights/week; average morning restfulness 7/10 or higher.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      createdAt: now,
      milestones: [
        ms('favio-v1-s-m1', 'light', 'Phone-down reminder set', 20, ['Reminder created and repeating']),
        ms('favio-v1-s-m2', 'medium', 'Bedtime routine 5 nights/week', 50, ['Phone down', 'No intense work late', 'Read', 'Log routine']),
        ms('favio-v1-s-m3', 'hard', '7+ hours most nights', 80, ['Track sleep duration']),
        ms('favio-v1-s-m4', 'epic', 'Restfulness average 7+/10', 100, ['Review weekly restfulness']),
      ],
    },
    {
      id: goalId('relationships'),
      profileId: PROFILE_ID,
      title: 'Strengthen Marriage and Social Relationships',
      deepWhy: 'Maintain a strong connection with Nikki while protecting meaningful relationships with friends and family. Success: weekly relationship-connection rating ~8/10+; meaningful social time at least 3 weeks each month.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      createdAt: now,
      milestones: [
        ms('favio-v1-r-m1', 'light', 'Weekly connection rhythm set', 25, ['Short connection routines', 'Extended quality time']),
        ms('favio-v1-r-m2', 'medium', 'Social time most months', 50, ['Friends/family block']),
        ms('favio-v1-r-m3', 'hard', 'Connection rating sustained ~8/10', 80, ['Sunday check-in']),
        ms('favio-v1-r-m4', 'epic', 'Monthly social consistency review habit', 100, ['Monthly review']),
      ],
    },
    {
      id: goalId('mental'),
      profileId: PROFILE_ID,
      title: 'Protect Mental Well-Being Through Restorative Activities',
      deepWhy: 'Maintain mental energy and reduce accumulated stress through deliberate non-work restorative activities. Success: weekly mental-recharge rating ~7/10+; avoid stress above 7/10 across more than one consecutive week.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      createdAt: now,
      milestones: [
        ms('favio-v1-n-m1', 'light', 'Weekly restorative slots protected', 40, ['Drums', 'Comedy / stress relief']),
        ms('favio-v1-n-m2', 'medium', 'Weekly ratings logged', 70, ['Stress + recharge ratings']),
        ms('favio-v1-n-m3', 'epic', 'Recharge sustained without multi-week high stress', 100, ['Trend review']),
      ],
    },
    {
      id: goalId('founder'),
      profileId: PROFILE_ID,
      title: 'Advance Founder Priorities Through Focused Execution',
      deepWhy: 'Consistently advance the most important founder priorities through focused execution, planning, and reflection. Success: advance at least one named founder priority to its next milestone each week; begin each week with three ranked priorities.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      createdAt: now,
      milestones: [
        ms('favio-v1-o-m1', 'light', 'Weekly priority ranking habit', 25, ['Rank top 3 priorities']),
        ms('favio-v1-o-m2', 'medium', 'Focused execution blocks', 50, ['30+ min startup block']),
        ms('favio-v1-o-m3', 'hard', 'Weekly milestone advances', 80, ['Define next deliverable', 'Weekly review']),
        ms('favio-v1-o-m4', 'epic', 'Consistent founder cadence', 100, ['Four consecutive strong weeks']),
      ],
    },
    {
      id: goalId('admin'),
      profileId: PROFILE_ID,
      title: 'Stay Ahead of Essential Personal Responsibilities',
      deepWhy: 'Prevent important household and personal administrative responsibilities from becoming overdue or unnecessarily stressful. Success: zero overdue critical obligations; keep non-urgent backlog at ~5 open items or fewer.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      createdAt: now,
      milestones: [
        ms('favio-v1-a-m1', 'light', 'Weekly household task habit', 30, ['One meaningful household task']),
        ms('favio-v1-a-m2', 'medium', 'Tax documents organized', 60, ['Tax appointment docs complete']),
        ms('favio-v1-a-m3', 'epic', 'Backlog controlled', 100, ['Monthly responsibility review']),
      ],
    },
    {
      id: goalId('rental'),
      profileId: PROFILE_ID,
      title: 'Rent the Rental Unit by August 31, 2026',
      deepWhy: 'Prepare, market, and lease the rental unit to a qualified tenant by August 31, 2026. Milestones: showing-ready by July 31; listing live by August 1; move-in-ready by August 21; tenant selected by August 28; lease signed and move-in plan confirmed by August 31. Showing-ready means safe, clean, photo-ready, and showable even if some move-in work remains. Move-in-ready means required repairs, occupancy-critical electrical work, painting, safety items, and final cleaning are complete.',
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      targetDate: '2026-08-31',
      createdAt: now,
      milestones: [
        ms('favio-v1-l-m1', 'light', 'Showing-ready by July 31', 25, ['Critical repairs', 'Clean/stage/photo']),
        ms('favio-v1-l-m2', 'medium', 'Listing live and showings started', 50, ['Publish listing', 'Respond to inquiries']),
        ms('favio-v1-l-m3', 'hard', 'Move-in-ready by August 21', 75, ['Occupancy-critical repairs', 'Final clean']),
        ms('favio-v1-l-m4', 'epic', 'Lease signed by August 31', 100, ['Tenant selected', 'Lease executed', 'Move-in plan confirmed']),
      ],
    },
  ];
}

function ut(slug, goalSlug, label, opts) {
  const {
    description = '',
    frequency,
    weekdays,
    monthDates,
    specificDate,
    daypart: dp = 'Day',
    type = 'goal',
  } = opts;
  const timeOfDay = daypart(dp);
  let recurrence;
  if (frequency === 'daily') recurrence = { type: 'daily' };
  else if (frequency === 'weekly') recurrence = { type: 'weekly', weekdays: weekdays ?? [] };
  else if (frequency === 'monthly') recurrence = { type: 'monthly', monthDates: monthDates ?? [1] };
  else if (frequency === 'one-time') recurrence = { type: 'one-time', specificDate };
  else recurrence = { type: 'daily' };

  return {
    id: taskId(slug),
    profileId: PROFILE_ID,
    label,
    description,
    timeOfDay,
    type,
    goalId: goalId(goalSlug),
    createdAt: Date.now(),
    recurrence,
    potentialValue: {
      score: 2,
      label: 'Moderate',
      unit: 'progress',
      source: 'default',
      rationale: 'Supports this goal.',
      updatedAt: Date.now(),
    },
  };
}

function buildTasks() {
  const tasks = [];

  // Goal 1 weight
  tasks.push(ut('w-protein', 'weight', 'Eat protein at breakfast, lunch, and dinner', {
    description: 'Target: complete all 3 meals at least 6 days per week.',
    frequency: 'daily', daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('w-water', 'weight', 'Drink 3-4 liters of water', {
    description: 'Target: reach the target at least 6 days per week.',
    frequency: 'daily', daypart: 'Day', type: 'routine',
  }));
  tasks.push(ut('w-mealprep', 'weight', 'Prepare meals for the upcoming week', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Midday', type: 'goal',
  }));
  tasks.push(ut('w-weighin', 'weight', 'Record weight and review the rolling trend', {
    description: 'Target: 1 weigh-in and review.',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Day', type: 'routine',
  }));

  // Goal 2 fitness
  tasks.push(ut('f-str1', 'fitness', 'Complete Strength Session 1', {
    description: 'Target: 1 session. Warm-ups belong under Reduce Pain and Preserve Mobility.',
    frequency: 'weekly', weekdays: [DAY.Mon], daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('f-walk-mon', 'fitness', 'Walk for 20-30 minutes', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Mon], daypart: 'Day', type: 'goal',
  }));
  tasks.push(ut('f-run-tue', 'fitness', 'Complete an easy run', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Tue], daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('f-str2', 'fitness', 'Complete Strength Session 2', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Thu], daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('f-run-fri', 'fitness', 'Complete an easy run or long walk', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Fri], daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('f-tennis', 'fitness', 'Play tennis', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Sat], daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('f-longwalk', 'fitness', 'Complete a long walk', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Day', type: 'priority',
  }));

  // Goal 3 mobility
  tasks.push(ut('m-neck', 'mobility', 'Complete a five-minute neck reset', {
    description: 'Target: at least 6 of 7 days.',
    frequency: 'daily', daypart: 'Day', type: 'routine',
  }));
  tasks.push(ut('m-warmup', 'mobility', 'Complete the appropriate warm-up before each planned workout', {
    description: 'Target: 100% of applicable workouts (Mon, Tue, Thu, Fri, Sat).',
    frequency: 'weekly', weekdays: [DAY.Mon, DAY.Tue, DAY.Thu, DAY.Fri, DAY.Sat], daypart: 'Day', type: 'routine',
  }));
  tasks.push(ut('m-mobility', 'mobility', 'Complete a dedicated mobility session', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Wed], daypart: 'Day', type: 'routine',
  }));
  tasks.push(ut('m-rate', 'mobility', 'Record neck-discomfort rating (1-10)', {
    description: 'Target: 1 rating using a 1-10 scale. Log the number in notes if helpful.',
    frequency: 'daily', daypart: 'Night', type: 'routine',
  }));
  tasks.push(ut('m-review', 'mobility', 'Review the weekly neck-discomfort trend', {
    description: 'Target: 1 review.',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Day', type: 'goal',
  }));

  // Goal 4 sleep
  tasks.push(ut('s-phone', 'sleep', 'Put the phone down at least 30 minutes before bedtime', {
    description: 'Target: at least 5 of 7 nights.',
    frequency: 'daily', daypart: 'Night', type: 'priority',
  }));
  tasks.push(ut('s-work', 'sleep', 'Stop intense work at least one hour before bedtime', {
    description: 'Target: at least 5 of 7 nights.',
    frequency: 'daily', daypart: 'Night', type: 'routine',
  }));
  tasks.push(ut('s-read', 'sleep', 'Read as part of the bedtime routine', {
    description: 'Target: at least 5 of 7 nights.',
    frequency: 'daily', daypart: 'Night', type: 'goal',
  }));
  tasks.push(ut('s-log', 'sleep', 'Log completion of the sleep routine', {
    description: 'Target: at least 5 of 7 nights.',
    frequency: 'daily', daypart: 'Night', type: 'routine',
  }));
  tasks.push(ut('s-rest', 'sleep', 'Record morning restfulness (1-10)', {
    description: 'Target: 1 rating using a 1-10 scale.',
    frequency: 'daily', daypart: 'Day', type: 'routine',
  }));
  tasks.push(ut('s-review', 'sleep', 'Review sleep duration and restfulness trends', {
    description: 'Target: 1 review.',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Day', type: 'goal',
  }));
  tasks.push(ut('s-open-reminders', 'sleep', 'Open the Reminders app on the iPhone', {
    description: 'One-time setup. Target: app opened.',
    frequency: 'one-time', specificDate: feasibleDate('2026-07-17'), daypart: 'Night', type: 'priority',
  }));
  tasks.push(ut('s-create-reminder', 'sleep', 'Create a repeating phone-down reminder for 30 minutes before bedtime', {
    description: 'One-time setup. Target: reminder created and repeating correctly.',
    frequency: 'one-time', specificDate: feasibleDate('2026-07-17'), daypart: 'Night', type: 'priority',
  }));

  // Goal 5 relationships - combined Sunday connection + check-in to avoid double count
  tasks.push(ut('r-connect', 'relationships', 'Complete a short intentional connection routine with Nikki', {
    description: 'Target: 4 weekday/short sessions (Mon/Tue/Thu/Fri). Sunday uses the combined check-in task instead.',
    frequency: 'weekly', weekdays: [DAY.Mon, DAY.Tue, DAY.Thu, DAY.Fri], daypart: 'Night', type: 'priority',
  }));
  tasks.push(ut('r-extended', 'relationships', 'Protect extended meaningful time with Nikki', {
    description: 'Target: 2 longer blocks. Scheduled Wed and Sat only (not the same days as short connection routines).',
    frequency: 'weekly', weekdays: [DAY.Wed, DAY.Sat], daypart: 'Night', type: 'priority',
  }));
  tasks.push(ut('r-social', 'relationships', 'Spend meaningful social time with friends or family', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Sat], daypart: 'Midday', type: 'goal',
  }));
  tasks.push(ut('r-checkin', 'relationships', 'Complete Sunday connection routine with relationship check-in', {
    description: 'Combined Sunday short connection + relationship check-in (single task to avoid double-counting).',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Night', type: 'goal',
  }));
  // Monthly first Sunday -> weekly Sunday with note (schema gap)
  tasks.push(ut('r-monthly', 'relationships', 'Review monthly social consistency', {
    description: 'Target: 1 review. Prefer the first Sunday of each month (app schedules Sundays weekly; skip non-first Sundays if desired).',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Midday', type: 'routine',
  }));

  // Goal 6 mental
  tasks.push(ut('n-drums', 'mental', 'Complete a drums session', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Thu], daypart: 'Night', type: 'goal',
  }));
  tasks.push(ut('n-comedy', 'mental', 'Complete a comedy or deliberate stress-relief activity', {
    description: 'Target: 1 session.',
    frequency: 'weekly', weekdays: [DAY.Fri], daypart: 'Night', type: 'goal',
  }));
  tasks.push(ut('n-ratings', 'mental', 'Record weekly stress and mental-recharge ratings', {
    description: 'Target: 1 stress rating and 1 recharge rating (1-10 each).',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Night', type: 'routine',
  }));

  // Goal 7 founder
  tasks.push(ut('o-milestone', 'founder', 'Define the next founder milestone or deliverable', {
    description: 'Target: 1 specific milestone defined. Pair with the Tuesday focus block.',
    frequency: 'weekly', weekdays: [DAY.Tue], daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('o-focus', 'founder', 'Complete a focused startup-progress block', {
    description: 'Target: at least 30 uninterrupted minutes.',
    frequency: 'weekly', weekdays: [DAY.Tue], daypart: 'Day', type: 'priority',
  }));
  tasks.push(ut('o-review', 'founder', 'Complete the founder weekly review', {
    description: 'Target: 1 review.',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Midday', type: 'goal',
  }));
  tasks.push(ut('o-rank', 'founder', 'Rank the top three founder priorities for the upcoming week', {
    description: 'Target: 3 priorities ranked.',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Midday', type: 'priority',
  }));

  // Goal 8 admin
  tasks.push(ut('a-home', 'admin', 'Complete one meaningful household task', {
    description: 'Target: 1 completed task. Not rental-unit work.',
    frequency: 'weekly', weekdays: [DAY.Wed], daypart: 'Day', type: 'routine',
  }));
  tasks.push(ut('a-review', 'admin', 'Review personal and household responsibilities', {
    description: 'Target: 1 review. Prefer the first Sunday of each month (scheduled Sundays weekly).',
    frequency: 'weekly', weekdays: [DAY.Sun], daypart: 'Midday', type: 'goal',
  }));
  tasks.push(ut('a-tax', 'admin', 'Organize all documents required for the tax appointment', {
    description: 'One-time. Target: 100% collected and organized. Complete at least 3 days before the appointment.',
    frequency: 'one-time', specificDate: '2026-08-15', daypart: 'Day', type: 'priority',
  }));

  // Goal 9 rental - one-time sequence
  const rentalOnes = [
    ['l-access', 'Coordinate access and begin repairs while Josh is substantially moved out', '2026-07-17', 'Day', 'Repair work underway'],
    ['l-alina', "Confirm Alina's scope, schedule, arrival time, and access", '2026-07-17', 'Day', 'Alina activated and work started'],
    ['l-roman-pieces', 'Obtain the pieces Roman needs', '2026-07-20', 'Day', 'Required pieces available'],
    ['l-roman-scope', "Confirm Roman's repair and interior-painting scope", '2026-07-20', 'Day', 'Scope and start date confirmed'],
    ['l-roman-start', 'Have Roman begin repairs and interior painting', '2026-07-20', 'Day', 'Work initiated. Preferred July 20; fallback July 22.'],
    ['l-elec-outreach', 'Continue licensed-electrician quote outreach', '2026-07-20', 'Midday', 'Viable options evaluated'],
    ['l-nikki-elec', 'Have Nikki assist with electrician outreach and coordination', '2026-07-20', 'Midday', 'Assigned outreach completed'],
    ['l-roman-son', "Follow up on Roman's son as an electrician lead", '2026-07-20', 'Midday', 'Licensing, availability, and pricing confirmed'],
    ['l-austin', 'Follow up with Austin through Jimmy', '2026-07-20', 'Midday', 'Licensing, availability, and quote requested'],
    ['l-unbundle', 'Separate critical electrical work from optional work', '2026-07-21', 'Midday', 'Unbundled scope documented'],
    ['l-verify-elec', 'Verify electrician licensing and insurance', '2026-07-22', 'Midday', 'Documentation confirmed'],
    ['l-select-elec', 'Select the licensed electrician', '2026-07-22', 'Midday', 'Electrician selected'],
    ['l-sched-elec', 'Schedule the electrical work', '2026-07-24', 'Midday', 'Work date confirmed'],
    ['l-showing-repairs', 'Complete all showing-critical repairs', '2026-07-30', 'Day', 'Showing-readiness checklist complete'],
    ['l-photos', 'Clean, stage, and photograph the unit', '2026-07-31', 'Day', 'Listing-quality photos completed'],
    ['l-listing', 'Publish the rental listing', '2026-08-01', 'Midday', 'Listing live on selected channels'],
    ['l-occupancy', 'Complete all occupancy-critical repairs', '2026-08-20', 'Day', 'Move-in requirements completed'],
    ['l-final-clean', 'Complete final cleaning and move-in readiness review', '2026-08-21', 'Day', 'Unit approved as move-in-ready'],
    ['l-tenant', 'Select a qualified tenant', '2026-08-28', 'Midday', 'Tenant approved'],
    ['l-lease', 'Prepare and execute the lease', '2026-08-31', 'Midday', 'Lease signed'],
    ['l-movein', "Confirm the tenant's move-in plan", '2026-08-31', 'Midday', 'Move-in date and handoff confirmed'],
  ];
  for (const [slug, label, date, dp, target] of rentalOnes) {
    tasks.push(ut(slug, 'rental', label, {
      description: `One-time. Target: ${target}.`,
      frequency: 'one-time',
      specificDate: feasibleDate(date),
      daypart: dp,
      type: 'priority',
    }));
  }
  // Daily while listing active - no end date in schema; documented in description
  tasks.push(ut('l-inquiries', 'rental', 'Review inquiries and schedule showings', {
    description: 'Target: respond within 24 hours. Intended daily while listing is active beginning August 1, 2026 (no end-date field in app; stop manually after lease).',
    frequency: 'daily', daypart: 'Midday', type: 'priority',
  }));
  tasks.push(ut('l-screen', 'rental', 'Review applications and complete tenant screening', {
    description: 'Target: screen finalists consistently within 24 hours of each complete application. Treat as active while applications arrive.',
    frequency: 'daily', daypart: 'Midday', type: 'goal',
  }));

  return tasks;
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

function backupDir() {
  return join(__dirname, 'backups');
}

function latestBackupPath() {
  return join(backupDir(), 'favio-goals-tasks-backup-LATEST.json');
}

async function verifyIdentity(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('Missing favio backup');
  const email = String(backup.profileEmail || '').trim().toLowerCase();
  if (email !== EXPECTED_EMAIL) {
    throw new Error(`Identity mismatch: expected ${EXPECTED_EMAIL}, got ${email || '(none)'}`);
  }
  return true;
}

async function runRollback() {
  const path = latestBackupPath();
  if (!existsSync(path)) throw new Error(`No backup at ${path}`);
  const bak = JSON.parse(readFileSync(path, 'utf8'));
  const current = (await req(`/backup/${PROFILE_ID}`)).data?.data;
  await verifyIdentity(current);
  const restored = {
    ...current,
    personalGoals: bak.personalGoals,
    userTasks: bak.userTasks,
    taskGoalLinks: bak.taskGoalLinks,
    seedOverrides: bak.seedOverrides,
    permanentlyHiddenSeedTasks: bak.permanentlyHiddenSeedTasks,
    deletedUserGoals: bak.deletedUserGoals,
    deletedUserTasks: bak.deletedUserTasks,
    deletedDefaultGoals: bak.deletedDefaultGoals,
    goalsVersion: bak.goalsVersion,
    migrationMarker: null,
    savedAt: Date.now(),
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, action: 'rollback', wouldRestoreGoals: bak.personalGoals.length, wouldRestoreTasks: bak.userTasks.length }, null, 2));
    return;
  }
  const save = await req(`/backup/${PROFILE_ID}`, { method: 'POST', body: restored });
  if (!save.data?.ok) throw new Error(`Rollback failed: ${JSON.stringify(save.data)}`);
  console.log(JSON.stringify({ ok: true, action: 'rollback', from: path }, null, 2));
}

async function runMigrate() {
  const currentRes = await req(`/backup/${PROFILE_ID}`);
  const current = currentRes.data?.data;
  await verifyIdentity(current);

  // Safety: other profile probe
  const kyle = (await req('/backup/kyle')).data?.data;
  const kyleGoalsBefore = Array.isArray(kyle?.personalGoals) ? kyle.personalGoals.length : null;

  const now = Date.now();
  const newGoals = buildGoals(now);
  const newTasks = buildTasks();

  const oldGoalIds = (current.personalGoals || []).map((g) => g.id);
  const oldTaskIds = (current.userTasks || []).map((t) => t.id);
  // backupMerge filters personalGoals by deletedUserGoals only (not deletedDefaultGoals),
  // so default goal ids must also be listed here or they will be re-unioned from existing.
  const deletedUserGoals = [...new Set([
    ...(current.deletedUserGoals || []),
    ...OLD_DEFAULT_GOAL_IDS,
    ...oldGoalIds.filter((id) => !String(id).startsWith(GOAL_PREFIX)),
  ])];
  const deletedUserTasks = [...new Set([
    ...(current.deletedUserTasks || []),
    ...oldTaskIds.filter((id) => !String(id).startsWith(TASK_PREFIX)),
  ])];
  const deletedDefaultGoals = [...new Set([...(current.deletedDefaultGoals || []), ...OLD_DEFAULT_GOAL_IDS])];
  const permanentlyHiddenSeedTasks = [...new Set([...(current.permanentlyHiddenSeedTasks || []), ...FAVIO_SEED_TASK_IDS])];

  // Force-replace arrays: send only the new plan set; tombstones drop legacy ids on union merge.
  const next = {
    ...current,
    personalGoals: newGoals,
    userTasks: newTasks,
    taskGoalLinks: [],
    seedOverrides: {},
    permanentlyHiddenSeedTasks,
    deletedUserGoals,
    deletedUserTasks,
    deletedDefaultGoals,
    goalsVersion: 'v6-2026-07-13',
    migrationMarker: {
      id: MIGRATION_ID,
      appliedAt: new Date().toISOString(),
      goalCount: newGoals.length,
      taskCount: newTasks.length,
    },
    savedAt: Date.now(),
  };

  const report = {
    profileId: PROFILE_ID,
    email: current.profileEmail,
    dryRun,
    oldGoals: oldGoalIds.length,
    oldTasks: oldTaskIds.length,
    hiddenSeeds: permanentlyHiddenSeedTasks.length,
    newGoals: newGoals.length,
    newTasks: newTasks.length,
    recurring: newTasks.filter((t) => t.recurrence?.type !== 'one-time').length,
    oneTime: newTasks.filter((t) => t.recurrence?.type === 'one-time').length,
    goalTitles: newGoals.map((g) => g.title),
    schemaMappings: {
      daypart: { Day: 'morning', Midday: 'morning', Night: 'evening' },
      monthlyFirstSunday: 'weekly Sunday + description note',
      ratingTasks: 'encoded in task labels/descriptions',
      rentalDailyWindow: 'daily tasks with description; no endDate field',
    },
  };

  if (dryRun) {
    console.log(JSON.stringify({ ...report, action: 'dry-run' }, null, 2));
    return;
  }

  const save = await req(`/backup/${PROFILE_ID}`, { method: 'POST', body: next });
  if (!save.data?.ok) throw new Error(`Save failed: ${JSON.stringify(save.data)}`);

  // Validate
  const after = (await req(`/backup/${PROFILE_ID}`)).data?.data;
  const goals = after.personalGoals || [];
  const tasks = after.userTasks || [];
  const kyleAfter = (await req('/backup/kyle')).data?.data;
  const kyleGoalsAfter = Array.isArray(kyleAfter?.personalGoals) ? kyleAfter.personalGoals.length : null;

  const validation = {
    exactlyNineGoals: goals.length === 9,
    allGoalsFavio: goals.every((g) => g.profileId === PROFILE_ID),
    allTasksFavio: tasks.every((t) => t.profileId === PROFILE_ID),
    allTasksLinked: tasks.every((t) => goals.some((g) => g.id === t.goalId)),
    noOldDefaultGoalsActive: !goals.some((g) => OLD_DEFAULT_GOAL_IDS.includes(g.id)),
    noOldCustomTitles: !goals.some((g) => ['I need to sleep a lot', 'Health & Fitness', 'Lose 20 lbs This Summer'].includes(g.title)),
    seedsHidden: (after.permanentlyHiddenSeedTasks || []).length >= FAVIO_SEED_TASK_IDS.length,
    defaultsTombstoned: OLD_DEFAULT_GOAL_IDS.every((id) => (after.deletedDefaultGoals || []).includes(id)),
    migrationMarker: after.migrationMarker?.id === MIGRATION_ID,
    kyleUnchanged: kyleGoalsBefore === kyleGoalsAfter,
    duplicateGoalTitles: new Set(goals.map((g) => g.title)).size === goals.length,
    stableIds: goals.every((g) => g.id.startsWith(GOAL_PREFIX)) && tasks.every((t) => t.id.startsWith(TASK_PREFIX)),
  };

  // Idempotency second pass
  const save2 = await req(`/backup/${PROFILE_ID}`, { method: 'POST', body: { ...next, savedAt: Date.now() } });
  const after2 = (await req(`/backup/${PROFILE_ID}`)).data?.data;
  validation.idempotentNoDupGoals = (after2.personalGoals || []).length === 9;
  validation.idempotentNoDupTasks = (after2.userTasks || []).length === tasks.length;
  validation.secondSaveOk = save2.data?.ok === true;

  mkdirSync(backupDir(), { recursive: true });
  writeFileSync(join(backupDir(), 'favio-plan-v1-migration-report.json'), JSON.stringify({ report, validation, appliedAt: new Date().toISOString() }, null, 2));

  console.log(JSON.stringify({ ok: Object.values(validation).every(Boolean), report, validation }, null, 2));
  if (!Object.values(validation).every(Boolean)) process.exit(1);
}

if (rollback) await runRollback();
else await runMigrate();
