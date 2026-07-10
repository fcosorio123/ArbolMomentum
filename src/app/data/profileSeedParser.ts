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

/** Parse free-text goals into editable suggestion groups (user input only, no bundled defaults). */
export function parseGoalInput(text: string): SeedSuggestionGroup[] {
  _id = 0;
  const lines = splitLines(text);
  if (lines.length === 0) return [];

  const groups: SeedSuggestionGroup[] = [];

  for (const line of lines) {
    const theme = matchTheme(line);
    const recurrence = detectRecurrence(line);
    const label = cleanTaskLabel(line);
    if (label.length < 4) continue;

    if (theme) {
      const group = findOrCreateThemeGroup(groups, theme);
      const duplicate = group.tasks.some(t => t.label.toLowerCase() === label.toLowerCase());
      if (!duplicate) {
        group.tasks.push(makeTask(line, label, recurrence));
      }
      continue;
    }

    // Unmatched lines become their own concise goal + single task
    groups.push({
      id: nextId('goal'),
      goal: { title: label, deepWhy: 'A goal you set when creating this profile.' },
      selected: true,
      tasks: [makeTask(line, label, recurrence)],
    });
  }

  return groups.filter(g => g.tasks.length > 0);
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
