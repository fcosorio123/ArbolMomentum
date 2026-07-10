/**
 * Profile seed parser tests: comma/list splitting, no bundled defaults, recurrence.
 * Run: node scripts/test-profile-seed-parser.mjs
 *
 * Mirrors profileSeedParser.ts logic for node smoke tests (no TS import).
 */
import assert from 'node:assert/strict';

function splitLines(text) {
  return text
    .split(/\n|(?:^|\s)[•\-*]\s+|(?:[,;]\s+)/)
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(l => l.length >= 3);
}

function detectRecurrence(line) {
  const lower = line.toLowerCase();
  if (/\b(mwf|mon(?:day)?[\/\s,&-]+wed(?:nesday)?[\/\s,&-]+fri(?:day)?)\b/i.test(lower)) {
    return { type: 'weekly', weekdays: [0, 2, 4] };
  }
  if (/\bweekly\b|\bevery week\b/i.test(lower)) return { type: 'weekly', weekdays: [6] };
  if (/\bmonthly\b/i.test(lower)) return { type: 'monthly', monthDates: [1] };
  return { type: 'daily' };
}

function cleanTaskLabel(line) {
  return line
    .replace(/\s+\b(daily|weekly|monthly|mwf|tuth|every day|every week|each week|each month)\s*$/i, '')
    .replace(/\s+\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*$/i, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

const GOAL_THEMES = [
  { keywords: /fafsa|financial aid|bursar|tuition|scholarship|aid compliance/i, title: 'Financial Aid & Compliance' },
  { keywords: /budget|expense|save|savings|money|spending|financial/i, title: 'Budget & Savings' },
  { keywords: /exercise|workout|gym|run|walk|fitness|mwf|health/i, title: 'Health & Fitness' },
];

function matchTheme(line) {
  return GOAL_THEMES.find(t => t.keywords.test(line));
}

function parseGoalInput(text) {
  const lines = splitLines(text);
  const groups = [];
  for (const line of lines) {
    const theme = matchTheme(line);
    const label = cleanTaskLabel(line);
    if (label.length < 4) continue;
    if (theme) {
      let group = groups.find(g => g.goal.title === theme.title);
      if (!group) {
        group = { goal: { title: theme.title }, tasks: [] };
        groups.push(group);
      }
      if (!group.tasks.some(t => t.label.toLowerCase() === label.toLowerCase())) {
        group.tasks.push({ label, recurrence: detectRecurrence(line) });
      }
    } else {
      groups.push({ goal: { title: label }, tasks: [{ label, recurrence: detectRecurrence(line) }] });
    }
  }
  return groups.filter(g => g.tasks.length > 0);
}

const commaInput = 'Complete FAFSA, track monthly expenses, exercise MWF';
const groups = parseGoalInput(commaInput);

assert.equal(groups.length, 3, 'comma-separated input → 3 goals');

const fafsa = groups.find(g => g.goal.title === 'Financial Aid & Compliance');
assert.ok(fafsa, 'FAFSA line maps to financial aid goal');
assert.equal(fafsa.tasks.length, 1, 'no bundled default tasks');
assert.equal(fafsa.tasks[0].label, 'Complete FAFSA');

const budget = groups.find(g => g.goal.title === 'Budget & Savings');
assert.ok(budget);
assert.equal(budget.tasks[0].label, 'Track monthly expenses');

const health = groups.find(g => g.goal.title === 'Health & Fitness');
assert.ok(health);
assert.equal(health.tasks[0].label, 'Exercise');
assert.deepEqual(health.tasks[0].recurrence.weekdays, [0, 2, 4], 'MWF → Mon/Wed/Fri');

assert.equal(detectRecurrence('track expenses daily').type, 'daily');
assert.equal(detectRecurrence('budget check weekly').type, 'weekly');

console.log('profile seed parser tests: all passed');
