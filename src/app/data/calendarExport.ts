import {
  getWeekPlanForProfile,
  getAllTasksForProfile,
  getTaskCategoriesForProfile,
  getTaskStatus,
  isTaskPermanentlyRemoved,
  getDateKey,
  getTodayKey,
} from './profiles';
import { getPersonalGoals } from './personalGoals';
import { getActiveUserTasksForDate, getUserTasks } from './userTasks';
import { getCanonicalProductionUrl } from './environment';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const EVENT_DURATION_MINUTES = 30;

export interface CalendarExportPrefs {
  morningHour: number;
  eveningHour: number;
  /** Minutes before each event start to fire a calendar alarm (0 = at task time). */
  alarmMinutesBefore: number;
  /** When syncing a single day after eveningHour, use tomorrow instead of today. */
  afterEveningTarget: 'tomorrow' | 'today';
}

export const DEFAULT_CALENDAR_PREFS: CalendarExportPrefs = {
  morningHour: 9,
  eveningHour: 18,
  alarmMinutesBefore: 0,
  afterEveningTarget: 'tomorrow',
};

export const CALENDAR_PREFS_KEY = (profileId: string) =>
  `arbol-calendar-prefs-${profileId}`;

export const CALENDAR_EXPORTED_KEY = (profileId: string) =>
  `arbol-calendar-exported-${profileId}`;

export const CALENDAR_PROVIDER_KEY = (profileId: string) =>
  `arbol-calendar-provider-${profileId}`;

export type CalendarProvider = 'google' | 'outlook' | 'apple' | 'ics';

export interface CalendarProviderOption {
  id: CalendarProvider;
  label: string;
  description: string;
  emoji: string;
}

export const CALENDAR_PROVIDER_OPTIONS: CalendarProviderOption[] = [
  {
    id: 'google',
    label: 'Google Calendar',
    description: 'Opens Google Calendar - or downloads a file to import many events',
    emoji: '📅',
  },
  {
    id: 'outlook',
    label: 'Outlook',
    description: 'Opens Outlook on the web - or downloads a file to import many events',
    emoji: '📧',
  },
  {
    id: 'apple',
    label: 'Apple Calendar',
    description: 'Downloads a file that opens in Calendar on iPhone or Mac',
    emoji: '🍎',
  },
  {
    id: 'ics',
    label: 'Other (.ics file)',
    description: 'Universal format - import into any calendar app',
    emoji: '📎',
  },
];

export function getSavedCalendarProvider(profileId: string): CalendarProvider | null {
  try {
    const raw = localStorage.getItem(CALENDAR_PROVIDER_KEY(profileId));
    if (raw === 'google' || raw === 'outlook' || raw === 'apple' || raw === 'ics') return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveCalendarProvider(profileId: string, provider: CalendarProvider) {
  localStorage.setItem(CALENDAR_PROVIDER_KEY(profileId), provider);
}

export function clearSavedCalendarProvider(profileId: string) {
  localStorage.removeItem(CALENDAR_PROVIDER_KEY(profileId));
}

/** Suggest a default provider from device OS. */
export function suggestCalendarProvider(os: string): CalendarProvider {
  if (os === 'iOS' || os === 'macOS') return 'apple';
  if (os === 'Windows') return 'outlook';
  return 'google';
}

export interface CalendarEventRow {
  taskId: string;
  dateKey: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  goalTitle?: string;
}

export function getCalendarPrefs(profileId: string): CalendarExportPrefs {
  try {
    const raw = localStorage.getItem(CALENDAR_PREFS_KEY(profileId));
    if (!raw) return { ...DEFAULT_CALENDAR_PREFS };
    const parsed = JSON.parse(raw) as Partial<CalendarExportPrefs>;
    return {
      morningHour: clampHour(parsed.morningHour, DEFAULT_CALENDAR_PREFS.morningHour),
      eveningHour: clampHour(parsed.eveningHour, DEFAULT_CALENDAR_PREFS.eveningHour),
      alarmMinutesBefore: clampAlarmMinutes(parsed.alarmMinutesBefore),
      afterEveningTarget: parsed.afterEveningTarget === 'today' ? 'today' : 'tomorrow',
    };
  } catch {
    return { ...DEFAULT_CALENDAR_PREFS };
  }
}

export function saveCalendarPrefs(profileId: string, prefs: CalendarExportPrefs) {
  localStorage.setItem(
    CALENDAR_PREFS_KEY(profileId),
    JSON.stringify({
      morningHour: clampHour(prefs.morningHour, DEFAULT_CALENDAR_PREFS.morningHour),
      eveningHour: clampHour(prefs.eveningHour, DEFAULT_CALENDAR_PREFS.eveningHour),
      alarmMinutesBefore: clampAlarmMinutes(prefs.alarmMinutesBefore),
      afterEveningTarget: prefs.afterEveningTarget === 'today' ? 'today' : 'tomorrow',
    }),
  );
}

function clampHour(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : fallback;
  return Math.min(22, Math.max(6, Math.round(n)));
}

function clampAlarmMinutes(value: unknown, fallback = DEFAULT_CALENDAR_PREFS.alarmMinutesBefore): number {
  const n = typeof value === 'number' ? value : fallback;
  return Math.min(120, Math.max(0, Math.round(n)));
}

/** RFC 5545 TRIGGER duration before event start (e.g. -PT15M). */
export function formatValarmTrigger(minutesBefore: number): string {
  const mins = clampAlarmMinutes(minutesBefore);
  if (mins === 0) return '-PT0M';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `-PT${h}H${m}M`;
  if (h > 0) return `-PT${h}H`;
  return `-PT${m}M`;
}

export function buildValarmLines(label: string, minutesBefore: number): string[] {
  return [
    'BEGIN:VALARM',
    foldIcsLine(`TRIGGER:${formatValarmTrigger(minutesBefore)}`),
    'ACTION:DISPLAY',
    foldIcsLine(`DESCRIPTION:${icsEscape(label)}`),
    'END:VALARM',
  ];
}

/** Mon-Sun of the current calendar week (same resolution as WeekPlan). */
export function getDateForWeekDay(day: string, ref = new Date()): Date {
  const weekIndex = WEEK_DAYS.indexOf(day as (typeof WEEK_DAYS)[number]);
  if (weekIndex < 0) return new Date(ref);
  const currentIndex = ref.getDay() === 0 ? 6 : ref.getDay() - 1;
  const date = new Date(ref);
  date.setDate(ref.getDate() + (weekIndex - currentIndex));
  return date;
}

export function getCurrentWeekDateKeys(ref = new Date()): { day: string; dateKey: string }[] {
  return WEEK_DAYS.map(day => ({
    day,
    dateKey: getDateKey(getDateForWeekDay(day, ref)),
  }));
}

export function dayNameFromDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()];
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

export interface DaySyncContext {
  dateKey: string;
  calendarDayLabel: 'today' | 'tomorrow';
  rolledForward: boolean;
  eveningHour: number;
  afterEveningTarget: CalendarExportPrefs['afterEveningTarget'];
}

/** Pick today or tomorrow for single-day calendar sync so events are not already in the past. */
export function getDaySyncContext(profileId: string, now = new Date()): DaySyncContext {
  const prefs = getCalendarPrefs(profileId);
  const todayKey = getTodayKey();
  const pastEveningCutoff = now.getHours() >= prefs.eveningHour;
  const rolledForward = pastEveningCutoff && prefs.afterEveningTarget === 'tomorrow';
  return {
    dateKey: rolledForward ? addDaysToDateKey(todayKey, 1) : todayKey,
    calendarDayLabel: rolledForward ? 'tomorrow' : 'today',
    rolledForward,
    eveningHour: prefs.eveningHour,
    afterEveningTarget: prefs.afterEveningTarget,
  };
}

export function getEffectiveDaySyncDateKey(profileId: string, now = new Date()): string {
  return getDaySyncContext(profileId, now).dateKey;
}

function slugifyProfileName(profileSlug: string): string {
  return profileSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
}

function buildCalendarEventRow(
  profileId: string,
  taskId: string,
  dateKey: string,
  day: string,
  weekPlan: Record<string, string[]>,
  allTasks: ReturnType<typeof getAllTasksForProfile>,
  userTasks: ReturnType<typeof getUserTasks>,
  goalMap: Record<string, string>,
): CalendarEventRow | null {
  const seedIds = (weekPlan[day] || []).filter(id => !isTaskPermanentlyRemoved(profileId, id));
  const userIds = getActiveUserTasksForDate(profileId, dateKey).map(ut => ut.id);
  if (!seedIds.includes(taskId) && !userIds.includes(taskId)) return null;

  const status = getTaskStatus(profileId, taskId, dateKey);
  if (status === 'skipped' || status === 'done') return null;

  const userTask = userTasks.find(ut => ut.id === taskId);
  if (userTask) {
    return {
      taskId,
      dateKey,
      label: userTask.label,
      timeOfDay: userTask.timeOfDay,
      goalTitle: userTask.goalId ? goalMap[userTask.goalId] : undefined,
    };
  }

  const seed = allTasks.find(t => t.id === taskId);
  if (!seed) return null;

  let goalId: string | undefined;
  for (const cat of getTaskCategoriesForProfile(profileId, day)) {
    if (cat.tasks.some(t => t.id === taskId)) {
      goalId = cat.goalId;
      break;
    }
  }

  return {
    taskId,
    dateKey,
    label: seed.label,
    timeOfDay: seed.timeOfDay,
    goalTitle: goalId ? goalMap[goalId] : undefined,
  };
}

/**
 * Tasks to export - mirrors Week tab task IDs, excludes done/skipped/removed seeds.
 */
export function formatShortDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Human-readable scope for provider modal and toasts. */
export function describeExportScope(events: CalendarEventRow[]): string {
  if (events.length === 0) return 'No open tasks';
  const uniqueDates = [...new Set(events.map(e => e.dateKey))];
  const taskWord = events.length === 1 ? 'task' : 'tasks';
  if (uniqueDates.length === 1) {
    const when = formatShortDateKey(uniqueDates[0]);
    if (events.length === 1) return `1 task · ${when}`;
    return `${events.length} ${taskWord} · ${when}`;
  }
  return `${events.length} ${taskWord} · this week`;
}

export function collectTodayCalendarEvents(
  profileId: string,
  dateKey = getTodayKey(),
): CalendarEventRow[] {
  return collectWeekCalendarEvents(profileId).filter(event => event.dateKey === dateKey);
}

export function collectWeekCalendarEvents(profileId: string): CalendarEventRow[] {
  const weekPlan = getWeekPlanForProfile(profileId);
  const allTasks = getAllTasksForProfile(profileId);
  const userTasks = getUserTasks(profileId);
  const goalMap = Object.fromEntries(getPersonalGoals(profileId).map(g => [g.id, g.title]));
  const events: CalendarEventRow[] = [];

  for (const { day, dateKey } of getCurrentWeekDateKeys()) {
    const seedIds = (weekPlan[day] || []).filter(id => !isTaskPermanentlyRemoved(profileId, id));
    const userIds = getActiveUserTasksForDate(profileId, dateKey).map(ut => ut.id);

    for (const taskId of [...seedIds, ...userIds]) {
      const row = buildCalendarEventRow(
        profileId, taskId, dateKey, day, weekPlan, allTasks, userTasks, goalMap,
      );
      if (row) events.push(row);
    }
  }

  return events;
}

export type CalendarExportScope = 'day' | 'week';

/** Export one task for a single day, or all open occurrences this week. */
export function collectTaskCalendarEvents(
  profileId: string,
  taskId: string,
  scope: CalendarExportScope,
  dateKey?: string,
): CalendarEventRow[] {
  if (scope === 'week') {
    return collectWeekCalendarEvents(profileId).filter(event => event.taskId === taskId);
  }
  if (!dateKey) return [];
  const day = dayNameFromDateKey(dateKey);
  const weekPlan = getWeekPlanForProfile(profileId);
  const allTasks = getAllTasksForProfile(profileId);
  const userTasks = getUserTasks(profileId);
  const goalMap = Object.fromEntries(getPersonalGoals(profileId).map(g => [g.id, g.title]));
  const row = buildCalendarEventRow(
    profileId, taskId, dateKey, day, weekPlan, allTasks, userTasks, goalMap,
  );
  return row ? [row] : [];
}

export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join('\r\n');
}

export function formatIcsLocalDateTime(dateKey: string, hour: number, minute = 0): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}${pad(m)}${pad(d)}T${pad(hour)}${pad(minute)}00`;
}

export function addMinutesToLocalDateTime(dt: string, minutes: number): string {
  const y = Number(dt.slice(0, 4));
  const m = Number(dt.slice(4, 6)) - 1;
  const d = Number(dt.slice(6, 8));
  const h = Number(dt.slice(9, 11));
  const min = Number(dt.slice(11, 13));
  const date = new Date(y, m, d, h, min + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

export function buildEventUid(profileId: string, taskId: string, dateKey: string): string {
  return `arbol-${profileId}-${taskId}-${dateKey}@arbolumomentum`;
}

export function buildIcsDocument(
  profileId: string,
  events: CalendarEventRow[],
  prefs: CalendarExportPrefs = DEFAULT_CALENDAR_PREFS,
  now = new Date(),
): string {
  const dtStamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const appUrl = getCanonicalProductionUrl();
  const lines: string[] = [
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
    ].filter(Boolean) as string[];

    const eventLines = [
      'BEGIN:VEVENT',
      foldIcsLine(`UID:${buildEventUid(profileId, event.taskId, event.dateKey)}`),
      foldIcsLine(`DTSTAMP:${dtStamp}`),
      foldIcsLine(`DTSTART:${dtStart}`),
      foldIcsLine(`DTEND:${dtEnd}`),
      foldIcsLine(`SUMMARY:${icsEscape(event.label)}`),
      foldIcsLine(`DESCRIPTION:${icsEscape(descriptionParts.join('\n'))}`),
      ...buildValarmLines(event.label, prefs.alarmMinutesBefore),
      'END:VEVENT',
    ];
    lines.push(...eventLines);
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function eventDateTimes(
  event: CalendarEventRow,
  prefs: CalendarExportPrefs,
): { start: string; end: string; startIso: string; endIso: string } {
  const hour = event.timeOfDay === 'morning' ? prefs.morningHour : prefs.eveningHour;
  const start = formatIcsLocalDateTime(event.dateKey, hour);
  const end = addMinutesToLocalDateTime(start, EVENT_DURATION_MINUTES);
  const startIso = `${event.dateKey}T${String(hour).padStart(2, '0')}:00:00`;
  const endHour = Number(end.slice(9, 11));
  const endMin = Number(end.slice(11, 13));
  const endIso = `${event.dateKey}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
  return { start, end, startIso, endIso };
}

function buildEventDescription(event: CalendarEventRow): string {
  const appUrl = getCanonicalProductionUrl();
  const parts = [
    event.goalTitle ? `Goal: ${event.goalTitle}` : undefined,
    `Open Arbol: ${appUrl}`,
  ].filter(Boolean) as string[];
  return parts.join('\n');
}

/** Google Calendar compose URL - works for a single event. */
export function buildGoogleCalendarUrl(
  event: CalendarEventRow,
  prefs: CalendarExportPrefs = DEFAULT_CALENDAR_PREFS,
): string {
  const { start, end } = eventDateTimes(event, prefs);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.label,
    dates: `${start}/${end}`,
    details: buildEventDescription(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook web compose URL - works for a single event. */
export function buildOutlookCalendarUrl(
  event: CalendarEventRow,
  prefs: CalendarExportPrefs = DEFAULT_CALENDAR_PREFS,
): string {
  const { startIso, endIso } = eventDateTimes(event, prefs);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.label,
    startdt: startIso,
    enddt: endIso,
    body: buildEventDescription(event),
    allday: 'false',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export interface CalendarDeliveryResult {
  eventCount: number;
  method: 'deeplink' | 'download';
  provider: CalendarProvider;
}

export function deliverEventsToCalendar(
  provider: CalendarProvider,
  profileId: string,
  events: CalendarEventRow[],
  filename: string,
): CalendarDeliveryResult {
  const prefs = getCalendarPrefs(profileId);
  const ics = buildIcsDocument(profileId, events, prefs);

  if (provider === 'google' && events.length === 1) {
    window.open(buildGoogleCalendarUrl(events[0], prefs), '_blank', 'noopener,noreferrer');
    return { eventCount: 1, method: 'deeplink', provider };
  }

  if (provider === 'outlook' && events.length === 1) {
    window.open(buildOutlookCalendarUrl(events[0], prefs), '_blank', 'noopener,noreferrer');
    return { eventCount: 1, method: 'deeplink', provider };
  }

  downloadIcsFile(ics, filename);
  return { eventCount: events.length, method: 'download', provider };
}

export function getCalendarDeliveryMessage(
  result: CalendarDeliveryResult,
  isFirstExport = false,
  scopeDescription?: string,
): string {
  const { eventCount, method, provider } = result;
  const scopePrefix = scopeDescription ? `${scopeDescription}. ` : '';
  const countLabel = eventCount === 1 ? '1 event' : `${eventCount} events`;

  if (method === 'deeplink') {
    if (provider === 'google') {
      return `${scopePrefix}Opened Google Calendar - save the event to add it.`;
    }
    if (provider === 'outlook') {
      return `${scopePrefix}Opened Outlook - save the event to add it.`;
    }
  }

  const importHints: Record<CalendarProvider, string> = {
    google: 'In Google Calendar: Settings → Import & export → Import → select the downloaded file.',
    outlook: 'In Outlook: Add calendar → Upload from file → select the downloaded file.',
    apple: 'Tap the downloaded file - it should open in Apple Calendar. Alarms are included.',
    ics: 'Open the file in your calendar app, or use its Import option.',
  };

  const alarmNote = isFirstExport
    ? ' Calendar alarms are included in the file.'
    : '';

  return `${scopePrefix}Downloaded ${countLabel}.${alarmNote} ${importHints[provider]}`;
}

export function downloadIcsFile(ics: string, filename: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildWeekExportFilename(profileSlug: string): string {
  const slug = slugifyProfileName(profileSlug);
  return `arbol-week-${slug}.ics`;
}

export function buildTaskExportFilename(
  profileSlug: string,
  events: CalendarEventRow[],
  scope: CalendarExportScope,
  dateKey?: string,
): string {
  const slug = slugifyProfileName(profileSlug);
  const labelSlug = events[0]?.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'task';
  const suffix = scope === 'day' && dateKey ? dateKey : 'week';
  return `arbol-${labelSlug}-${suffix}-${slug}.ics`;
}

export function prepareWeekCalendarExport(profileId: string, profileSlug: string) {
  const events = collectWeekCalendarEvents(profileId);
  return { events, filename: buildWeekExportFilename(profileSlug) };
}

export function prepareTodayCalendarExport(
  profileId: string,
  profileSlug: string,
  dateKey?: string,
) {
  const syncKey = dateKey ?? getEffectiveDaySyncDateKey(profileId);
  const events = collectTodayCalendarEvents(profileId, syncKey);
  const slug = slugifyProfileName(profileSlug);
  return { events, filename: `arbol-today-${syncKey}-${slug}.ics` };
}

export function prepareTaskCalendarExport(
  profileId: string,
  taskId: string,
  profileSlug: string,
  scope: CalendarExportScope,
  dateKey?: string,
) {
  const syncDateKey = scope === 'day'
    ? (dateKey ?? getEffectiveDaySyncDateKey(profileId))
    : dateKey;
  const events = collectTaskCalendarEvents(profileId, taskId, scope, syncDateKey);
  return {
    events,
    filename: buildTaskExportFilename(profileSlug, events, scope, syncDateKey),
  };
}
