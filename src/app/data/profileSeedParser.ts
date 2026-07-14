// ──────────────────────────────────────────────
// Rule-based goal/task suggestions from free-text input
// ──────────────────────────────────────────────

import type { Recurrence } from './userTasks';
import type { TaskType } from './profiles';

export interface SeedTaskSuggestion {
  id: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  type: TaskType;
  recurrence: Recurrence;
  selected: boolean;
}

export interface SeedSuggestionGroup {
  id: string;
  goal: { title: string; deepWhy: string };
  tasks: SeedTaskSuggestion[];
  selected: boolean;
}

const GOAL_THEMES: Array<{
  keywords: RegExp;
  title: string;
  deepWhy: string;
}> = [
  {
    keywords: /fafsa|financial aid|bursar|tuition|scholarship|aid compliance/i,
    title: 'Financial Aid & Compliance',
    deepWhy: 'Staying on top of aid deadlines and requirements protects your funding and peace of mind.',
  },
  {
    keywords: /budget|expense|save|savings|money|spending|financial/i,
    title: 'Budget & Savings',
    deepWhy: 'Small daily money habits compound into real financial security over the semester.',
  },
  {
    keywords: /hungry|hunger|eat|food|meal|nutrition|protein|diet|snack|hydrate|water|cook/i,
    title: 'Eat well & feel nourished',
    deepWhy: 'Steady meals and simple food habits keep energy up and cravings down.',
  },
  {
    keywords: /exercise|workout|gym|run|walk|fitness|mwf|health/i,
    title: 'Health & Fitness',
    deepWhy: 'Moving your body regularly improves focus, energy, and long-term wellness.',
  },
  {
    keywords: /study|homework|class|exam|read|learn|academic|assignment/i,
    title: 'Academics',
    deepWhy: 'Consistent study blocks keep you ahead of deadlines and reduce last-minute stress.',
  },
  {
    keywords: /job|career|intern|apply|interview|resume|linkedin/i,
    title: 'Career & Work',
    deepWhy: 'Steady career actions build momentum toward opportunities you actually want.',
  },
];

/** Vague feelings/needs → outcome goals + concrete action tasks (never echo the dump as the goal title). */
const OUTCOME_STARTERS: Array<{
  match: RegExp;
  title: string;
  deepWhy: string;
  tasks: string[];
}> = [
  {
    match: /\b(i'?m\s+hungry|feeling\s+hungry|so\s+hungry|starving|need\s+(to\s+)?eat|want\s+(some\s+)?food)\b/i,
    title: 'Eat well & feel nourished',
    deepWhy: 'Getting real food on a predictable rhythm so you feel fed, not frantic.',
    tasks: [
      'Eat a balanced meal with protein and a vegetable',
      'Prep one grab-and-go snack you will actually eat',
      'Drink a full glass of water before your next meal',
    ],
  },
  {
    match: /\b(i'?m\s+tired|exhausted|no\s+energy|burnt?\s*out|need\s+(to\s+)?rest|want\s+to\s+sleep)\b/i,
    title: 'Restore energy & rest well',
    deepWhy: 'Protecting sleep and recovery so you can show up with steady energy.',
    tasks: [
      'Set a phone-down time 30 minutes before bed',
      'Take a 10-minute outdoor walk for fresh air',
      'Drink water and eat a light protein snack if you skipped a meal',
    ],
  },
  {
    match: /\b(i'?m\s+stressed|overwhelm|anxious|too\s+much\s+to\s+do)\b/i,
    title: 'Feel calmer and in control',
    deepWhy: 'Clearing mental load with small concrete resets instead of spinning.',
    tasks: [
      'Write the top 3 things on your mind in 5 minutes',
      'Pick one item and do only the first tiny step',
      'Take 5 slow breaths, then put your phone face-down for 10 minutes',
    ],
  },
];

function splitLines(text: string): string[] {
  return text
    .split(/\n|(?:^|\s)[•\-*]\s+|(?:[,;]\s+)/)
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(l => l.length >= 3);
}

function detectRecurrence(line: string): Recurrence {
  const lower = line.toLowerCase();

  if (/\b(mwf|mon(?:day)?[\/\s,&-]+wed(?:nesday)?[\/\s,&-]+fri(?:day)?)\b/i.test(lower)) {
    return { type: 'weekly', weekdays: [0, 2, 4] };
  }
  if (/\b(tuth|tue(?:sday)?[\/\s,&-]+thu(?:rsday)?)\b/i.test(lower)) {
    return { type: 'weekly', weekdays: [1, 3] };
  }

  const dayMap: Record<string, number> = {
    mon: 0, monday: 0, tue: 1, tuesday: 1, wed: 2, wednesday: 2,
    thu: 3, thursday: 3, fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6,
  };
  for (const [name, dow] of Object.entries(dayMap)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lower) && /every|weekly|each/i.test(lower)) {
      return { type: 'weekly', weekdays: [dow] };
    }
  }

  if (/\bweekly\b|\bevery week\b|\beach week\b/i.test(lower)) {
    return { type: 'weekly', weekdays: [6] }; // default Sunday
  }
  if (/\bmonthly\b|\bevery month\b/i.test(lower)) {
    return { type: 'monthly', monthDates: [1] };
  }

  return { type: 'daily' };
}

function inferTimeOfDay(line: string): 'morning' | 'evening' {
  const lower = line.toLowerCase();
  if (/\bevening|night|pm|before bed\b/.test(lower)) return 'evening';
  if (/\bmorning|am|wake\b/.test(lower)) return 'morning';
  return 'morning';
}

function inferTaskType(line: string): TaskType {
  const lower = line.toLowerCase();
  if (/\bsubmit|complete|finish|apply|review|check\b/.test(lower)) return 'priority';
  if (/\bgoal|target|save\b/.test(lower)) return 'goal';
  return 'routine';
}

function cleanTaskLabel(line: string): string {
  return line
    .replace(/\s+\b(daily|weekly|monthly|mwf|tuth|every day|every week|each week|each month)\s*$/i, '')
    .replace(/\s+\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*$/i, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

function matchTheme(line: string) {
  return GOAL_THEMES.find(t => t.keywords.test(line));
}

let _id = 0;
function nextId(prefix: string) {
  _id += 1;
  return `${prefix}-${_id}`;
}

function makeTask(line: string, label: string, recurrence: Recurrence): SeedTaskSuggestion {
  return {
    id: nextId('task'),
    label,
    timeOfDay: inferTimeOfDay(line),
    type: inferTaskType(line),
    recurrence,
    selected: true,
  };
}

function findOrCreateThemeGroup(
  groups: SeedSuggestionGroup[],
  theme: (typeof GOAL_THEMES)[number],
): SeedSuggestionGroup {
  let group = groups.find(g => g.goal.title === theme.title);
  if (!group) {
    group = {
      id: nextId('goal'),
      goal: { title: theme.title, deepWhy: theme.deepWhy },
      selected: true,
      tasks: [],
    };
    groups.push(group);
  }
  return group;
}

function looksLikeAction(label: string): boolean {
  return /^(eat|drink|walk|run|call|email|write|read|submit|review|buy|prep|cook|clean|study|apply|send|finish|start|open|set|check|add|swap|do|make|plan|track|hit|complete|practice)\b/i
    .test(label.trim());
}

function pushUniqueTask(group: SeedSuggestionGroup, line: string, label: string, recurrence: Recurrence) {
  if (group.tasks.some(t => t.label.toLowerCase() === label.toLowerCase())) return;
  if (label.toLowerCase() === group.goal.title.toLowerCase()) return;
  group.tasks.push(makeTask(line, label, recurrence));
}

/** Parse free-text goals into editable suggestion groups (user input only, no bundled defaults). */
export function parseGoalInput(text: string): SeedSuggestionGroup[] {
  _id = 0;
  const lines = splitLines(text);
  if (lines.length === 0) return [];

  const groups: SeedSuggestionGroup[] = [];

  for (const line of lines) {
    const recurrence = detectRecurrence(line);
    const label = cleanTaskLabel(line);
    if (label.length < 3) continue;

    const outcome = OUTCOME_STARTERS.find(o => o.match.test(line));
    if (outcome) {
      let group = groups.find(g => g.goal.title === outcome.title);
      if (!group) {
        group = {
          id: nextId('goal'),
          goal: { title: outcome.title, deepWhy: outcome.deepWhy },
          selected: true,
          tasks: [],
        };
        groups.push(group);
      }
      for (const taskLabel of outcome.tasks) {
        pushUniqueTask(group, line, taskLabel, recurrence);
      }
      continue;
    }

    const theme = matchTheme(line);
    if (theme) {
      const group = findOrCreateThemeGroup(groups, theme);
      // Feeling/keyword dumps become starter actions under the outcome theme — not the goal title itself
      if (looksLikeAction(label) && label.length >= 8) {
        pushUniqueTask(group, line, label, recurrence);
      } else if (group.tasks.length === 0) {
        const defaults =
          /eat|food|meal|hung|protein|nutrition/i.test(theme.title + line)
            ? [
              'Eat a balanced meal with protein and a vegetable',
              'Prep one healthy snack you will actually eat',
              'Drink a full glass of water with your next meal',
            ]
            : [
              `Take one concrete action toward ${theme.title.toLowerCase()} today`,
              `Spend 15 focused minutes on ${theme.title.toLowerCase()}`,
            ];
        for (const taskLabel of defaults) {
          pushUniqueTask(group, line, taskLabel, recurrence);
        }
      }
      continue;
    }

    // Unmatched action lines → task under a short outcome goal derived from the action
    if (looksLikeAction(label)) {
      const outcomeTitle = label.length > 48 ? `${label.slice(0, 45)}…` : label;
      groups.push({
        id: nextId('goal'),
        goal: {
          title: `Follow through: ${outcomeTitle}`,
          deepWhy: 'Turning this action into a clear outcome you can keep returning to.',
        },
        selected: true,
        tasks: [makeTask(line, label, recurrence)],
      });
      continue;
    }

    // Last resort: outcome-framed goal + concrete starters (never meta coaching prompts)
    groups.push({
      id: nextId('goal'),
      goal: {
        title: `Make progress on: ${label.slice(0, 50)}`,
        deepWhy: 'An outcome-oriented goal from what you wrote — edit the title if needed.',
      },
      selected: true,
      tasks: [
        makeTask(line, `Do the smallest useful version of this for 10 minutes`, recurrence),
        makeTask(line, `Gather what you need, then finish one visible next step`, {
          ...recurrence,
          type: recurrence.type === 'one-time' ? 'one-time' : 'daily',
        }),
      ],
    });
  }

  return groups.filter(g => g.goal.title.length > 0 && g.tasks.length > 0);
}

export function recurrenceSummary(recurrence: Recurrence): string {
  if (!recurrence || recurrence.type === 'daily') return 'Daily';
  if (recurrence.type === 'weekly') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const picked = (recurrence.weekdays ?? []).map(d => days[d]).join(', ');
    return picked ? `Weekly · ${picked}` : 'Weekly';
  }
  if (recurrence.type === 'monthly') return 'Monthly';
  return 'One-time';
}
