/**
 * Pure-function tests for calendar ICS export (no browser / localStorage).
 * Run: node scripts/test-calendar-export.mjs
 */

const EVENT_DURATION_MINUTES = 30;

function icsEscape(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldIcsLine(line) {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join('\r\n');
}

function formatIcsLocalDateTime(dateKey, hour, minute = 0) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}${pad(m)}${pad(d)}T${pad(hour)}${pad(minute)}00`;
}

function addMinutesToLocalDateTime(dt, minutes) {
  const y = Number(dt.slice(0, 4));
  const m = Number(dt.slice(4, 6)) - 1;
  const d = Number(dt.slice(6, 8));
  const h = Number(dt.slice(9, 11));
  const min = Number(dt.slice(11, 13));
  const date = new Date(y, m, d, h, min + minutes);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function buildEventUid(profileId, taskId, dateKey) {
  return `arbol-${profileId}-${taskId}-${dateKey}@arbolumomentum`;
}

function clampAlarmMinutes(value, fallback = 0) {
  const n = typeof value === 'number' ? value : fallback;
  return Math.min(120, Math.max(0, Math.round(n)));
}

function formatValarmTrigger(minutesBefore) {
  const mins = clampAlarmMinutes(minutesBefore);
  if (mins === 0) return '-PT0M';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `-PT${h}H${m}M`;
  if (h > 0) return `-PT${h}H`;
  return `-PT${m}M`;
}

function buildValarmLines(label, minutesBefore) {
  return [
    'BEGIN:VALARM',
    foldIcsLine(`TRIGGER:${formatValarmTrigger(minutesBefore)}`),
    'ACTION:DISPLAY',
    foldIcsLine(`DESCRIPTION:${icsEscape(label)}`),
    'END:VALARM',
  ];
}

function buildIcsDocument(profileId, events, prefs, now = new Date('2026-06-20T15:30:00Z')) {
  const dtStamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const appUrl = 'https://fcosorio123.github.io/ArbolMomentum';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arbol Momentum//Week Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    const hour = event.timeOfDay === 'morning' ? prefs.morningHour : prefs.eveningHour;
    const dtStart = formatIcsLocalDateTime(event.dateKey, hour);
    const dtEnd = addMinutesToLocalDateTime(dtStart, EVENT_DURATION_MINUTES);
    const descriptionParts = [
      event.goalTitle ? `Goal: ${event.goalTitle}` : undefined,
      `Open Arbol: ${appUrl}`,
    ].filter(Boolean);

    lines.push(
      'BEGIN:VEVENT',
      foldIcsLine(`UID:${buildEventUid(profileId, event.taskId, event.dateKey)}`),
      foldIcsLine(`DTSTAMP:${dtStamp}`),
      foldIcsLine(`DTSTART:${dtStart}`),
      foldIcsLine(`DTEND:${dtEnd}`),
      foldIcsLine(`SUMMARY:${icsEscape(event.label)}`),
      foldIcsLine(`DESCRIPTION:${icsEscape(descriptionParts.join('\n'))}`),
      ...buildValarmLines(event.label, prefs.alarmMinutesBefore ?? 0),
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getDateForWeekDay(day, ref = new Date('2026-06-20T12:00:00')) {
  const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekIndex = WEEK_DAYS.indexOf(day);
  const currentIndex = ref.getDay() === 0 ? 6 : ref.getDay() - 1;
  const date = new Date(ref);
  date.setDate(ref.getDate() + (weekIndex - currentIndex));
  return date;
}

// --- tests ---

assert(icsEscape('FAFSA; TAP, apply\nnow') === 'FAFSA\\; TAP\\, apply\\nnow', 'icsEscape');

const longSummary = 'A'.repeat(90);
const folded = foldIcsLine(`SUMMARY:${longSummary}`);
assert(folded.includes('\r\n '), 'foldIcsLine splits long lines');

assert(
  formatIcsLocalDateTime('2026-06-20', 9) === '20260620T090000',
  'formatIcsLocalDateTime morning',
);
assert(
  addMinutesToLocalDateTime('20260620T090000', 30) === '20260620T093000',
  'addMinutesToLocalDateTime +30',
);

const monday = getDateForWeekDay('Mon', new Date('2026-06-20T12:00:00'));
assert(monday.getDay() === 1, 'week Monday resolution on Friday ref');

const ics = buildIcsDocument(
  'kyle',
  [
    {
      taskId: 'pg-1',
      dateKey: '2026-06-20',
      label: 'Check FAFSA status',
      timeOfDay: 'morning',
      goalTitle: 'Save ₱10,000 Before Birthday',
    },
    {
      taskId: 'utask-1',
      dateKey: '2026-06-20',
      label: 'Evening review',
      timeOfDay: 'evening',
    },
  ],
  { morningHour: 9, eveningHour: 18, alarmMinutesBefore: 0 },
);

assert(ics.includes('BEGIN:VCALENDAR'), 'has calendar header');
assert(ics.includes('VERSION:2.0'), 'has version');
assert(ics.includes('UID:arbol-kyle-pg-1-2026-06-20@arbolumomentum'), 'stable UID');
assert(ics.includes('SUMMARY:Check FAFSA status'), 'summary');
assert(ics.includes('DTSTART:20260620T090000'), 'morning start');
assert(ics.includes('DTEND:20260620T093000'), 'morning end');
assert(ics.includes('DTSTART:20260620T180000'), 'evening start');
assert(ics.includes('Goal: Save'), 'goal in description');
assert(ics.includes('Open Arbol:'), 'app link in description');
assert(ics.includes('END:VCALENDAR'), 'calendar footer');
assert(ics.includes('BEGIN:VALARM'), 'includes VALARM block');
assert(ics.includes('TRIGGER:-PT0M'), 'alarm at event start by default');
assert(ics.includes('ACTION:DISPLAY'), 'display alarm action');

assert(formatValarmTrigger(15) === '-PT15M', 'formatValarmTrigger 15 min');
assert(formatValarmTrigger(90) === '-PT1H30M', 'formatValarmTrigger 1h30m');

const alarmIcs = buildIcsDocument(
  'kyle',
  [{ taskId: 'pg-1', dateKey: '2026-06-20', label: 'Check FAFSA status', timeOfDay: 'morning' }],
  { morningHour: 9, eveningHour: 18, alarmMinutesBefore: 15 },
);
assert(alarmIcs.includes('TRIGGER:-PT15M'), 'custom alarm offset');

// dayNameFromDateKey
function dayNameFromDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()];
}
assert(dayNameFromDateKey('2026-06-20') === 'Sat', 'dayNameFromDateKey Saturday');
assert(dayNameFromDateKey('2026-06-23') === 'Tue', 'dayNameFromDateKey Tuesday');

// Per-task week filter behavior
const weekEvents = [
  { taskId: 'pg-1', dateKey: '2026-06-20', label: 'A', timeOfDay: 'morning' },
  { taskId: 'pg-1', dateKey: '2026-06-22', label: 'A', timeOfDay: 'morning' },
  { taskId: 'pg-2', dateKey: '2026-06-20', label: 'B', timeOfDay: 'evening' },
];
const taskWeek = weekEvents.filter(e => e.taskId === 'pg-1');
assert(taskWeek.length === 2, 'task week filter keeps all occurrences');
const singleDay = weekEvents.filter(e => e.taskId === 'pg-2' && e.dateKey === '2026-06-20');
assert(singleDay.length === 1, 'task day filter keeps one occurrence');

const taskIcs = buildIcsDocument('kyle', singleDay, { morningHour: 9, eveningHour: 18, alarmMinutesBefore: 0 });
assert(taskIcs.includes('BEGIN:VEVENT'), 'single task ICS has one event');
assert((taskIcs.match(/BEGIN:VEVENT/g) || []).length === 1, 'single task ICS event count');

function eventDateTimes(event, prefs) {
  const hour = event.timeOfDay === 'morning' ? prefs.morningHour : prefs.eveningHour;
  const start = formatIcsLocalDateTime(event.dateKey, hour);
  const end = addMinutesToLocalDateTime(start, EVENT_DURATION_MINUTES);
  const startIso = `${event.dateKey}T${String(hour).padStart(2, '0')}:00:00`;
  const endHour = Number(end.slice(9, 11));
  const endMin = Number(end.slice(11, 13));
  const endIso = `${event.dateKey}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
  return { start, end, startIso, endIso };
}

function buildGoogleCalendarUrl(event, prefs) {
  const { start, end } = eventDateTimes(event, prefs);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.label,
    dates: `${start}/${end}`,
    details: `Open Arbol: https://fcosorio123.github.io/ArbolMomentum`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookCalendarUrl(event, prefs) {
  const { startIso, endIso } = eventDateTimes(event, prefs);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.label,
    startdt: startIso,
    enddt: endIso,
    body: 'Open Arbol',
    allday: 'false',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

const sampleEvent = {
  taskId: 'pg-1',
  dateKey: '2026-06-20',
  label: 'Check FAFSA status',
  timeOfDay: 'morning',
};
const prefs = { morningHour: 9, eveningHour: 18, alarmMinutesBefore: 0 };

const googleUrl = buildGoogleCalendarUrl(sampleEvent, prefs);
assert(googleUrl.includes('calendar.google.com'), 'google url host');
assert(googleUrl.includes('action=TEMPLATE'), 'google template action');
assert(googleUrl.includes('dates=20260620T090000%2F20260620T093000'), 'google date range');
assert(googleUrl.includes('text=Check+FAFSA+status'), 'google title');

const outlookUrl = buildOutlookCalendarUrl(sampleEvent, prefs);
assert(outlookUrl.includes('outlook.live.com'), 'outlook url host');
assert(outlookUrl.includes('subject=Check+FAFSA+status'), 'outlook subject');
assert(outlookUrl.includes('startdt=2026-06-20T09%3A00%3A00'), 'outlook start');

function suggestCalendarProvider(os) {
  if (os === 'iOS' || os === 'macOS') return 'apple';
  if (os === 'Windows') return 'outlook';
  return 'google';
}
assert(suggestCalendarProvider('iOS') === 'apple', 'suggest apple on iOS');
assert(suggestCalendarProvider('Windows') === 'outlook', 'suggest outlook on Windows');

function describeExportScope(events) {
  if (events.length === 0) return 'No open tasks';
  const uniqueDates = [...new Set(events.map(e => e.dateKey))];
  const taskWord = events.length === 1 ? 'task' : 'tasks';
  if (uniqueDates.length === 1) {
    const when = uniqueDates[0];
    if (events.length === 1) return `1 task · ${when}`;
    return `${events.length} ${taskWord} · ${when}`;
  }
  return `${events.length} ${taskWord} · this week`;
}

assert(describeExportScope([{ dateKey: '2026-06-20' }]) === '1 task · 2026-06-20', 'single day scope');
assert(describeExportScope([
  { dateKey: '2026-06-20' },
  { dateKey: '2026-06-22' },
]) === '2 tasks · this week', 'multi-day week scope');

console.log('calendar export tests: all passed');
