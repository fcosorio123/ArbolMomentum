import {
  getWeekPlanForProfile,
  getAllTasksForProfile,
  getTaskCategoriesForProfile,
  getTaskStatus,
  isTaskPermanentlyRemoved,
  getDateKey,
} from './profiles';
import { getPersonalGoals } from './personalGoals';
import { getActiveUserTasksForDate, getUserTasks } from './userTasks';
import { getCanonicalProductionUrl } from './environment';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const EVENT_DURATION_MINUTES = 30;

export interface CalendarExportPrefs {
  morningHour: number;
  eveningHour: number;
}

export const DEFAULT_CALENDAR_PREFS: CalendarExportPrefs = {
  morningHour: 9,
  eveningHour: 18,
};

export const CALENDAR_PREFS_KEY = (profileId: string) =>
  `arbol-calendar-prefs-${profileId}`;

export const CALENDAR_EXPORTED_KEY = (profileId: string) =>
  `arbol-calendar-exported-${profileId}`;

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
    }),
  );
}

function clampHour(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : fallback;
  return Math.min(22, Math.max(6, Math.round(n)));
}

/** Mon–Sun of the current calendar week (same resolution as WeekPlan). */
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
 * Tasks to export — mirrors Week tab task IDs, excludes done/skipped/removed seeds.
 */
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
      'END:VEVENT',
    ];
    lines.push(...eventLines);
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
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

export function exportEventsToCalendar(
  profileId: string,
  events: CalendarEventRow[],
  filename: string,
): number {
  const prefs = getCalendarPrefs(profileId);
  const ics = buildIcsDocument(profileId, events, prefs);
  downloadIcsFile(ics, filename);
  return events.length;
}

export function exportWeekToCalendar(profileId: string, profileSlug: string): number {
  const events = collectWeekCalendarEvents(profileId);
  const slug = slugifyProfileName(profileSlug);
  return exportEventsToCalendar(profileId, events, `arbol-week-${slug}.ics`);
}

export function exportTaskToCalendar(
  profileId: string,
  taskId: string,
  profileSlug: string,
  scope: CalendarExportScope,
  dateKey?: string,
): number {
  const events = collectTaskCalendarEvents(profileId, taskId, scope, dateKey);
  const slug = slugifyProfileName(profileSlug);
  const labelSlug = events[0]?.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'task';
  const suffix = scope === 'day' && dateKey ? dateKey : 'week';
  return exportEventsToCalendar(profileId, events, `arbol-${labelSlug}-${suffix}-${slug}.ics`);
}
