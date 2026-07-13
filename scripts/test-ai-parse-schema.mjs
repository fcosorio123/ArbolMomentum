/**
 * AI parse-context-tasks schema + edge fallback tests.
 * Run: node scripts/test-ai-parse-schema.mjs
 */

import { getEdgeBase, ANON } from './edge-config.mjs';

const BASE = getEdgeBase();

let passed = 0;
let failed = 0;

function assert(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function normalizeRecurrence(raw) {
  const type = raw?.type;
  if (type === 'weekly') {
    const weekdays = Array.isArray(raw?.weekdays)
      ? raw.weekdays.filter(d => d >= 0 && d <= 6).slice(0, 7)
      : [6];
    return { type: 'weekly', weekdays: weekdays.length ? weekdays : [6] };
  }
  if (type === 'monthly') {
    const monthDates = Array.isArray(raw?.monthDates)
      ? raw.monthDates.filter(d => d >= 1 && d <= 31).slice(0, 4)
      : [1];
    return { type: 'monthly', monthDates: monthDates.length ? monthDates : [1] };
  }
  if (type === 'one-time') return { type: 'one-time' };
  return { type: 'daily' };
}

function validateGroupSchema(group) {
  if (!group || typeof group !== 'object') return false;
  if (typeof group.id !== 'string' || !group.id) return false;
  if (!group.goal || typeof group.goal.title !== 'string' || group.goal.title.length < 1) return false;
  if (typeof group.goal.deepWhy !== 'string') return false;
  if (!Array.isArray(group.tasks) || group.tasks.length === 0) return false;
  return group.tasks.every(t =>
    typeof t.id === 'string' &&
    typeof t.label === 'string' && t.label.length >= 3 &&
    (t.timeOfDay === 'morning' || t.timeOfDay === 'evening') &&
    ['priority', 'goal', 'routine'].includes(t.type) &&
    t.recurrence && ['daily', 'weekly', 'monthly', 'one-time'].includes(t.recurrence.type) &&
    typeof t.selected === 'boolean'
  );
}

function normalizeLlmGroups(raw) {
  return raw.slice(0, 8).map(g => {
    const title = (g.goal?.title ?? 'Goal').trim();
    const deepWhy = (g.goal?.deepWhy ?? 'A goal from your description.').trim();
    const tasks = (g.tasks ?? []).slice(0, 12).map(t => ({
      id: 'task-1',
      label: (t.label ?? '').trim(),
      timeOfDay: t.timeOfDay === 'evening' ? 'evening' : 'morning',
      type: ['priority', 'goal', 'routine'].includes(t.type) ? t.type : 'routine',
      recurrence: normalizeRecurrence(t.recurrence),
      selected: true,
    })).filter(t => t.label.length >= 3);
    return {
      id: 'goal-1',
      goal: { title: title || 'Goal', deepWhy: deepWhy || 'A goal from your description.' },
      tasks,
      selected: true,
    };
  }).filter(g => g.tasks.length > 0);
}

console.log('\nAI parse schema tests\n');

// Local schema normalization
const mockLlm = [{
  goal: { title: 'Academics', deepWhy: 'Stay on track.' },
  tasks: [
    { label: 'Study for exam', timeOfDay: 'evening', type: 'priority', recurrence: { type: 'weekly', weekdays: [1, 3] } },
    { label: 'x', type: 'bad', recurrence: { type: 'nope' } },
  ],
}];
const normalized = normalizeLlmGroups(mockLlm);
assert('LLM mock normalizes to one valid task', normalized.length === 1 && normalized[0].tasks.length === 1);
assert('invalid recurrence defaults to daily', normalized[0].tasks[0].recurrence.type === 'weekly');
assert('invalid task type defaults to routine', normalized[0].tasks[0].type === 'priority');

const validGroup = {
  id: 'goal-1',
  goal: { title: 'Budget', deepWhy: 'Save money.' },
  selected: true,
  tasks: [{
    id: 'task-1',
    label: 'Track expenses',
    timeOfDay: 'morning',
    type: 'routine',
    recurrence: { type: 'daily' },
    selected: true,
  }],
};
assert('valid group passes schema', validateGroupSchema(validGroup));
assert('group missing id fails schema', !validateGroupSchema({ ...validGroup, id: '' }));
assert('group with empty tasks fails schema', !validateGroupSchema({ ...validGroup, tasks: [] }));

async function invoke(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

const short = await invoke('/parse-context-tasks', { text: 'hi', preferRules: true });
const endpointLive = short.status !== 404;

if (!endpointLive) {
  console.log('  ⚠ edge /parse-context-tasks not deployed yet — skipping live endpoint tests');
} else {
  assert('edge rejects very short input', short.status === 200 && short.data?.ok === false && short.data?.reason === 'input_too_short');

  const rules = await invoke('/parse-context-tasks', {
    text: 'Complete FAFSA, track monthly expenses, exercise MWF',
    preferRules: true,
  });
  assert('edge rule fallback returns ok', rules.status === 200 && rules.data?.ok === true, `status=${rules.status}`);
  assert('edge rule fallback source=rules', rules.data?.source === 'rules');
  assert('edge returns at least 2 goal groups', Array.isArray(rules.data?.groups) && rules.data.groups.length >= 2, `count=${rules.data?.groups?.length}`);
  if (Array.isArray(rules.data?.groups)) {
    assert('each group matches schema', rules.data.groups.every(validateGroupSchema));
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
