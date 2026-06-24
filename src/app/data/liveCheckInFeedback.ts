// ──────────────────────────────────────────────
// Live Check-In Feedback (rules-based reports)
// ──────────────────────────────────────────────

import {
  type TaskStatus,
  type TaskType,
  getTaskCategoriesForProfile,
  getTaskStatus,
  setTaskStatus,
  isTaskActiveForDate,
  getTodayKey,
} from './profiles';
import { getActiveUserTasksForDate } from './userTasks';

export type MovementState = 'up' | 'flat' | 'down';
export type WarningType = null | 'blocker' | 'open_loops' | 'decline' | 'urgent_safety';

export interface RecommendedAction {
  label: string;
  reason: string;
  taskId?: string;
  /** Coach-style pace or focus adjustment */
  adjustment?: 'increase_pace' | 'maintain' | 'narrow_focus' | 'close_loops' | 'recover';
}

export interface ReportEntry {
  id: string;
  profileId: string;
  taskId: string;
  taskTitle: string;
  responseText: string;
  timestamp: number;
  dateKey: string;
  progressAtTime: number;
  previousProgress: number;
  movementState: MovementState;
  momentumScore: number;
  warningType: WarningType;
  recommendedNextAction: RecommendedAction;
  statusAtReport: TaskStatus | null;
  note?: string;
}

export interface ProgressSnapshot {
  id: string;
  profileId: string;
  date: string;
  progress: number;
  momentumScore: number;
  doneTaskCount: number;
  inProgressTaskCount: number;
  notStartedTaskCount: number;
  blockedTaskCount: number;
  reportEntryId: string;
}

export interface ScopedTask {
  id: string;
  label: string;
  type: TaskType;
}

const REPORTS_KEY = (profileId: string) => `arbol-live-reports-${profileId}`;
const SNAPSHOTS_KEY = (profileId: string) => `arbol-live-snapshots-${profileId}`;
const NOTE_KEY = (profileId: string, taskId: string, date: string) =>
  `task-note-${profileId}-${taskId}-${date}`;
const BLOCKED_KEY = (profileId: string, taskId: string, date: string) =>
  `arbol-task-blocked-${profileId}-${taskId}-${date}`;

const MAX_REPORTS = 50;

export const LOADER_MESSAGES = [
  'Reviewing how your day is going…',
  'Reading your progress pattern…',
  'Thinking through your next move…',
  'Checking what actually moved…',
  'Calibrating coaching advice…',
  'Preparing your check-in…',
];

const BLOCKER_KEYWORDS = [
  'stuck', 'blocked', 'waiting on', "can't", 'cannot', 'no time', 'skipped',
  'missed', 'gave up', 'too hard', "don't know how", 'confused',
];

const URGENT_KEYWORDS = [
  'emergency', 'unsafe', 'danger', 'hurt myself', 'self harm', 'suicidal',
  'suicide', 'harm someone', 'violence', 'abuse', 'crisis',
];

const URGENT_ESCALATION =
  'You mentioned something that may be urgent or outside what ArbolMomentum can safely evaluate. ArbolMomentum cannot assess emergencies, crisis situations, or serious personal harm. Pause this task and contact emergency services, your school, a qualified professional, or a trusted person before continuing.';

// ── Task enumeration ────────────────────────────────────────────────

export function getVisibleTasksForDate(profileId: string, dateKey: string): ScopedTask[] {
  const categories = getTaskCategoriesForProfile(profileId);
  const userTasks = getActiveUserTasksForDate(profileId, dateKey);
  const seen = new Set<string>();
  const out: ScopedTask[] = [];

  for (const cat of categories) {
    for (const t of cat.tasks) {
      if (!isTaskActiveForDate(profileId, t.id, dateKey)) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push({ id: t.id, label: t.label, type: t.type });
    }
  }

  for (const ut of userTasks) {
    if (!isTaskActiveForDate(profileId, ut.id, dateKey)) continue;
    if (seen.has(ut.id)) continue;
    seen.add(ut.id);
    out.push({ id: ut.id, label: ut.label, type: ut.type });
  }

  return out;
}

export function isTaskBlockedFlag(profileId: string, taskId: string, dateKey: string): boolean {
  return localStorage.getItem(BLOCKED_KEY(profileId, taskId, dateKey)) === 'true';
}

export function setTaskBlockedFlag(profileId: string, taskId: string, dateKey: string, blocked: boolean) {
  const key = BLOCKED_KEY(profileId, taskId, dateKey);
  if (blocked) localStorage.setItem(key, 'true');
  else localStorage.removeItem(key);
}

export function getTaskNote(profileId: string, taskId: string, dateKey: string): string {
  return localStorage.getItem(NOTE_KEY(profileId, taskId, dateKey)) || '';
}

export function saveTaskNote(profileId: string, taskId: string, dateKey: string, note: string) {
  const key = NOTE_KEY(profileId, taskId, dateKey);
  const trimmed = note.trim();
  if (trimmed) localStorage.setItem(key, trimmed);
  else localStorage.removeItem(key);
}

// ── Progress math ─────────────────────────────────────────────────────

export function taskStatusToPercent(
  status: TaskStatus | null,
  blocked: boolean,
): number {
  if (blocked) return 25;
  if (status === 'done') return 100;
  if (status === 'inprogress') return 50;
  return 0;
}

export function calculateScopeProgress(profileId: string, dateKey: string): {
  progress: number;
  doneTaskCount: number;
  inProgressTaskCount: number;
  notStartedTaskCount: number;
  blockedTaskCount: number;
} {
  const tasks = getVisibleTasksForDate(profileId, dateKey);
  let done = 0, inProgress = 0, notStarted = 0, blocked = 0;
  let sum = 0;

  for (const t of tasks) {
    const status = getTaskStatus(profileId, t.id, dateKey);
    const isBlocked = isTaskBlockedFlag(profileId, t.id, dateKey);
    if (isBlocked) blocked++;
    if (status === 'done') done++;
    else if (status === 'inprogress') inProgress++;
    else notStarted++;
    sum += taskStatusToPercent(status, isBlocked);
  }

  const progress = tasks.length > 0 ? Math.round(sum / tasks.length) : 0;
  return { progress, doneTaskCount: done, inProgressTaskCount: inProgress, notStartedTaskCount: notStarted, blockedTaskCount: blocked };
}

function getPreviousProgressBeforeToday(profileId: string, todayKey: string): number {
  const snaps = getSnapshots(profileId);
  const prior = snaps
    .filter(s => s.date < todayKey)
    .sort((a, b) => b.date.localeCompare(a.date));
  return prior[0]?.progress ?? 0;
}

/** Baseline for movement: last report today, else last snapshot before today. */
function getBaselineProgress(profileId: string, dateKey: string): number {
  const reports = readReports(profileId);
  const lastToday = reports.find(r => r.dateKey === dateKey);
  if (lastToday) return lastToday.progressAtTime;
  return getPreviousProgressBeforeToday(profileId, dateKey);
}

export function computeMovementState(current: number, previous: number): MovementState {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

// ── Keyword detection ─────────────────────────────────────────────────

export function detectKeywords(note: string): { blocker: boolean; urgentSafety: boolean } {
  const lower = note.toLowerCase();
  const urgentSafety = URGENT_KEYWORDS.some(k => lower.includes(k));
  const blocker = !urgentSafety && BLOCKER_KEYWORDS.some(k => lower.includes(k));
  return { blocker, urgentSafety };
}

// ── Momentum Score ────────────────────────────────────────────────────

export function calculateMomentumScore(opts: {
  progress: number;
  taskMovedToDoneToday: boolean;
  highPriorityMovedToInProgressToday: boolean;
  hasNote: boolean;
  inProgressCount: number;
  blockerDetected: boolean;
  progressDecreased: boolean;
  urgentSafety: boolean;
}): number {
  let score = opts.progress;
  if (opts.taskMovedToDoneToday) score += 10;
  if (opts.highPriorityMovedToInProgressToday) score += 5;
  if (opts.hasNote) score += 5;
  if (opts.inProgressCount > 2) score -= 10;
  if (opts.blockerDetected) score -= 15;
  if (opts.progressDecreased) score -= 10;
  if (opts.urgentSafety) score -= 20;
  return Math.max(0, Math.min(100, Math.round(score)));
}

type PaceStatus = 'ahead' | 'on_track' | 'behind' | 'catch_up';

function computePaceStatus(progress: number, hour: number): PaceStatus {
  const expected = Math.round((hour / 24) * 100);
  const gap = expected - progress;
  if (progress >= expected + 12) return 'ahead';
  if (gap >= 25) return 'catch_up';
  if (gap >= 12) return 'behind';
  return 'on_track';
}

function timeOfDayPhrase(hour: number): string {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export const ADJUSTMENT_LABELS: Record<NonNullable<RecommendedAction['adjustment']>, string> = {
  increase_pace: 'Increase pace',
  maintain: 'Maintain rhythm',
  narrow_focus: 'Narrow focus',
  close_loops: 'Close loops first',
  recover: 'Ease off / recover',
};

function pickAdjustment(
  warningType: WarningType,
  pace: PaceStatus,
  inProgressCount: number,
  progress: number,
  remaining: number,
): RecommendedAction['adjustment'] {
  if (warningType === 'open_loops' || inProgressCount > 2) return 'close_loops';
  if (progress >= 100) return 'recover';
  if (pace === 'catch_up') return 'increase_pace';
  if (pace === 'behind' && remaining >= 3) return 'increase_pace';
  if (pace === 'behind') return 'narrow_focus';
  if (remaining >= 5 && inProgressCount >= 1) return 'narrow_focus';
  return 'maintain';
}

// ── Recommended next action ───────────────────────────────────────────

export function recommendNextAction(
  profileId: string,
  dateKey: string,
  warningType: WarningType,
  scope?: {
    progress: number;
    doneTaskCount: number;
    inProgressTaskCount: number;
    notStartedTaskCount: number;
  },
): RecommendedAction {
  const counts = scope ?? calculateScopeProgress(profileId, dateKey);
  const remaining = counts.notStartedTaskCount + counts.inProgressTaskCount;
  const hour = new Date().getHours();
  const pace = computePaceStatus(counts.progress, hour);
  const adjustment = pickAdjustment(
    warningType,
    pace,
    counts.inProgressTaskCount,
    counts.progress,
    remaining,
  );

  if (warningType === 'urgent_safety') {
    return {
      label: 'Get appropriate help now',
      reason: 'outside what ArbolMomentum can safely evaluate',
      adjustment: 'recover',
    };
  }

  const tasks = getVisibleTasksForDate(profileId, dateKey);

  const blocked = tasks.find(t => isTaskBlockedFlag(profileId, t.id, dateKey));
  if (blocked) {
    return {
      label: blocked.label,
      reason: pace === 'catch_up'
        ? 'unblock this before you try to speed up elsewhere'
        : 'reduce friction here before adding more load',
      taskId: blocked.id,
      adjustment: 'narrow_focus',
    };
  }

  if (warningType === 'open_loops' || counts.inProgressTaskCount > 2) {
    const open = tasks.find(t => getTaskStatus(profileId, t.id, dateKey) === 'inprogress');
    if (open) {
      return {
        label: open.label,
        reason: 'finish one open loop before starting anything new',
        taskId: open.id,
        adjustment: 'close_loops',
      };
    }
  }

  const highInProgress = tasks.find(t =>
    t.type === 'priority' && getTaskStatus(profileId, t.id, dateKey) === 'inprogress',
  );
  if (highInProgress) {
    return {
      label: highInProgress.label,
      reason: pace === 'catch_up'
        ? 'stay on this priority — finishing it moves the whole day'
        : 'you already started the highest-leverage work',
      taskId: highInProgress.id,
      adjustment: pace === 'catch_up' ? 'increase_pace' : 'maintain',
    };
  }

  const highNotStarted = tasks.find(t =>
    t.type === 'priority' && !getTaskStatus(profileId, t.id, dateKey),
  );
  if (highNotStarted) {
    return {
      label: highNotStarted.label,
      reason: pace === 'catch_up' || pace === 'behind'
        ? 'pick up the priority task now to make up ground'
        : 'highest leverage if you want the day to feel different',
      taskId: highNotStarted.id,
      adjustment: pace === 'catch_up' ? 'increase_pace' : 'narrow_focus',
    };
  }

  const anyInProgress = tasks.find(t => getTaskStatus(profileId, t.id, dateKey) === 'inprogress');
  if (anyInProgress) {
    return {
      label: anyInProgress.label,
      reason: 'close what you already opened before spreading out',
      taskId: anyInProgress.id,
      adjustment: counts.inProgressTaskCount > 1 ? 'close_loops' : 'maintain',
    };
  }

  const anyNotStarted = tasks.find(t => !getTaskStatus(profileId, t.id, dateKey));
  if (anyNotStarted) {
    return {
      label: anyNotStarted.label,
      reason: remaining <= 2
        ? 'one of the last open items on your list'
        : 'next sensible step without overloading the day',
      taskId: anyNotStarted.id,
      adjustment: pace === 'catch_up' ? 'increase_pace' : 'maintain',
    };
  }

  return {
    label: 'Protect what you finished',
    reason: 'today’s list is complete — recovery counts as progress too',
    adjustment: 'recover',
  };
}

// ── Coaching feedback generator ───────────────────────────────────────

export function generateReportText(opts: {
  taskTitle: string;
  taskType?: TaskType;
  status: TaskStatus | null;
  statusChanged: boolean;
  progress: number;
  previousProgress: number;
  movementState: MovementState;
  momentumScore: number;
  warningType: WarningType;
  inProgressCount: number;
  doneCount: number;
  remaining: number;
  totalTasks: number;
  recommended: RecommendedAction;
  isFirstCompletionToday: boolean;
  hourOfDay: number;
}): string {
  const {
    taskTitle, taskType, status, progress, previousProgress,
    movementState, momentumScore, warningType, inProgressCount,
    doneCount, remaining, totalTasks, recommended,
    isFirstCompletionToday, hourOfDay,
  } = opts;

  const progressDelta = progress - previousProgress;
  const pace = computePaceStatus(progress, hourOfDay);
  const dayPart = timeOfDayPhrase(hourOfDay);
  const next = recommended.label;
  const adj = recommended.adjustment;
  const isPriority = taskType === 'priority';
  const significantJump = progressDelta >= 8 || (isPriority && status === 'done' && progressDelta >= 5);

  if (warningType === 'urgent_safety') return URGENT_ESCALATION;

  const paceAdvice = (() => {
    if (adj === 'increase_pace' && remaining > 0) {
      return `Given the ${dayPart} and ${remaining} task${remaining === 1 ? '' : 's'} still open, I'd increase intensity for the next stretch — not by doing everything, but by protecting time for "${next}".`;
    }
    if (adj === 'close_loops') {
      return `I'd slow the starting of new work and close loops first. "${next}" is the one I'd finish before opening anything else.`;
    }
    if (adj === 'narrow_focus') {
      return `Don't spread effort evenly right now. Narrow to "${next}" until something concrete moves.`;
    }
    if (adj === 'recover') {
      return `You're at ${progress}% with nothing left on today's list. I'd ease off execution pressure and let the completion land.`;
    }
    if (pace === 'ahead') {
      return `You're ahead of where I'd expect for this ${dayPart}. Keep the rhythm on "${next}" rather than adding busywork.`;
    }
    return `Stay with "${next}" at a steady pace — that's the move that keeps momentum honest.`;
  })();

  if (warningType === 'blocker') {
    return `I read your note on "${taskTitle}" as friction, not failure. You're at ${progress}% with momentum at ${momentumScore}, which tells me the plan is fine but this step needs a smaller entry. ${paceAdvice}`;
  }

  if (movementState === 'down') {
    return `Progress slipped from ${previousProgress}% to ${progress}%, so something reopened or got harder — that's worth treating seriously, not brushing off. Momentum is ${momentumScore}. Before you add new work, stabilize with "${next}". ${adj === 'increase_pace' ? 'Once stable, pick up the pace on that one task only.' : ''}`.trim();
  }

  if (progress >= 100 && remaining === 0) {
    return `You closed the full list — ${doneCount} task${doneCount === 1 ? '' : 's'} done. That last completion on "${taskTitle}" wasn't cosmetic; it finished the day. ${paceAdvice}`;
  }

  if (isFirstCompletionToday && status === 'done') {
    return `Good — "${taskTitle}" is your first completion today, and it moved you to ${progress}%. That sets the tone. ${isPriority ? 'Starting with a priority item was the right call.' : 'If you want the day to feel stronger, follow with your highest-leverage task next.'} ${paceAdvice}`;
  }

  if (significantJump && status === 'done') {
    return `That last one mattered: finishing "${taskTitle}" took you from ${previousProgress}% to ${progress}%${isPriority ? ' on a priority item' : ''}. That's meaningful progress, not a small tick. ${paceAdvice}`;
  }

  if (inProgressCount > 2) {
    return `You have ${inProgressCount} tasks in motion at once — activity without closure creates drag even when you're working hard. Progress is ${progress}% and momentum is ${momentumScore}. ${paceAdvice}`;
  }

  if (pace === 'catch_up' && remaining > 0) {
    return `Honest read: ${progress}% done this ${dayPart} with ${remaining} still open — you're behind the pace I'd want for today. The fix isn't panic; it's a focused catch-up block on "${next}". ${paceAdvice}`;
  }

  if (pace === 'behind' && remaining > 0) {
    return `You're at ${progress}% with ${remaining} task${remaining === 1 ? '' : 's'} left, and the day is further along than your progress shows. I'd trim scope mentally and push "${next}" ahead of lower-leverage items. ${paceAdvice}`;
  }

  if (status === 'done' && movementState === 'up') {
    return `"${taskTitle}" is done — progress moved from ${previousProgress}% to ${progress}% and momentum is ${momentumScore}. ${progressDelta >= 3 ? 'That was a real step forward.' : 'Solid closure.'} ${paceAdvice}`;
  }

  if (status === 'done') {
    return `"${taskTitle}" is checked off. You're at ${progress}% overall with ${remaining} still on the board${totalTasks > 0 ? ` out of ${totalTasks}` : ''}. ${paceAdvice}`;
  }

  if (movementState === 'flat') {
    return `You touched "${taskTitle}" but the scoreboard is still flat at ${progress}%. That usually means prep or partial work — not nothing, but not closure yet. ${paceAdvice}`;
  }

  return `Update on "${taskTitle}": progress is ${progress}% (from ${previousProgress}%), momentum ${momentumScore}. ${paceAdvice}`;
}

// ── Persistence ───────────────────────────────────────────────────────

function readReports(profileId: string): ReportEntry[] {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY(profileId)) || '[]');
  } catch {
    return [];
  }
}

function writeReports(profileId: string, reports: ReportEntry[]) {
  localStorage.setItem(REPORTS_KEY(profileId), JSON.stringify(reports.slice(0, MAX_REPORTS)));
}

export function getSnapshots(profileId: string): ProgressSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY(profileId)) || '[]');
  } catch {
    return [];
  }
}

function writeSnapshots(profileId: string, snapshots: ProgressSnapshot[]) {
  localStorage.setItem(SNAPSHOTS_KEY(profileId), JSON.stringify(snapshots));
}

export function getLatestReport(profileId: string): ReportEntry | null {
  const reports = readReports(profileId);
  return reports[0] ?? null;
}

export function getRecentReports(profileId: string, limit = 5): ReportEntry[] {
  return readReports(profileId).slice(0, limit);
}

export interface TodayChartPoint {
  label: string;
  progress: number;
  momentum: number;
}

/** Today's completion history for the live check-in chart (oldest → newest). */
export function getTodayChartData(profileId: string, dateKey?: string): TodayChartPoint[] {
  const today = dateKey ?? getTodayKey();
  const reports = readReports(profileId)
    .filter(r => r.dateKey === today)
    .slice()
    .reverse();
  if (reports.length === 0) return [];
  return reports.map((r, i) => ({
    label: i === 0 ? 'Start' : `${i + 1}`,
    progress: r.progressAtTime,
    momentum: r.momentumScore,
  }));
}

export function dispatchFeedbackUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('arbol-live-feedback-updated'));
  } catch { /* ignore */ }
}

// ── Submit report (single write path for task status) ─────────────────

export interface SubmitReportParams {
  profileId: string;
  taskId: string;
  taskTitle: string;
  status?: TaskStatus | null;
  note?: string;
  previousStatus?: TaskStatus | null;
}

export function submitReportUpdate(params: SubmitReportParams): ReportEntry {
  const { profileId, taskId, taskTitle } = params;
  const dateKey = getTodayKey();
  const currentStatus = getTaskStatus(profileId, taskId, dateKey);
  const targetStatus = params.status !== undefined ? params.status : currentStatus;
  const statusChanged = targetStatus !== currentStatus;

  if (statusChanged) {
    setTaskStatus(profileId, taskId, dateKey, targetStatus);
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch { /* ignore */ }
  }

  const note = (params.note ?? '').trim();
  saveTaskNote(profileId, taskId, dateKey, note);

  const previousProgress = getBaselineProgress(profileId, dateKey);
  const scope = calculateScopeProgress(profileId, dateKey);
  const { blocker, urgentSafety } = detectKeywords(note);

  let warningType: WarningType = null;
  if (urgentSafety) warningType = 'urgent_safety';
  else if (blocker) warningType = 'blocker';
  else if (scope.inProgressTaskCount > 2) warningType = 'open_loops';
  else if (scope.progress < previousProgress) warningType = 'decline';

  if (warningType === 'blocker') {
    setTaskBlockedFlag(profileId, taskId, dateKey, true);
  }

  const taskMovedToDone = statusChanged && targetStatus === 'done';
  const task = getVisibleTasksForDate(profileId, dateKey).find(t => t.id === taskId);
  const highPriInProgress =
    statusChanged &&
    targetStatus === 'inprogress' &&
    task?.type === 'priority';

  const movementState = computeMovementState(scope.progress, previousProgress);
  const momentumScore = calculateMomentumScore({
    progress: scope.progress,
    taskMovedToDoneToday: taskMovedToDone,
    highPriorityMovedToInProgressToday: highPriInProgress,
    hasNote: note.length > 0,
    inProgressCount: scope.inProgressTaskCount,
    blockerDetected: blocker,
    progressDecreased: scope.progress < previousProgress,
    urgentSafety,
  });

  const recommended = recommendNextAction(profileId, dateKey, warningType, scope);
  const remaining = scope.notStartedTaskCount + scope.inProgressTaskCount;
  const reportsToday = readReports(profileId).filter(r => r.dateKey === dateKey);
  const isFirstCompletionToday =
    targetStatus === 'done' && reportsToday.every(r => r.statusAtReport !== 'done');

  const responseText = generateReportText({
    taskTitle,
    taskType: task?.type,
    status: targetStatus,
    statusChanged,
    progress: scope.progress,
    previousProgress,
    movementState,
    momentumScore,
    warningType,
    inProgressCount: scope.inProgressTaskCount,
    doneCount: scope.doneTaskCount,
    remaining,
    totalTasks: scope.doneTaskCount + remaining,
    recommended,
    isFirstCompletionToday,
    hourOfDay: new Date().getHours(),
  });

  const entry: ReportEntry = {
    id: `${Date.now()}-${taskId}`,
    profileId,
    taskId,
    taskTitle,
    responseText,
    timestamp: Date.now(),
    dateKey,
    progressAtTime: scope.progress,
    previousProgress,
    movementState,
    momentumScore,
    warningType,
    recommendedNextAction: recommended,
    statusAtReport: targetStatus,
    note: note || undefined,
  };

  const reports = readReports(profileId);
  reports.unshift(entry);
  writeReports(profileId, reports);

  const snapshots = getSnapshots(profileId).filter(s => s.date !== dateKey);
  snapshots.unshift({
    id: `snap-${entry.id}`,
    profileId,
    date: dateKey,
    progress: scope.progress,
    momentumScore,
    doneTaskCount: scope.doneTaskCount,
    inProgressTaskCount: scope.inProgressTaskCount,
    notStartedTaskCount: scope.notStartedTaskCount,
    blockedTaskCount: scope.blockedTaskCount,
    reportEntryId: entry.id,
  });
  writeSnapshots(profileId, snapshots);

  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId));
  dispatchFeedbackUpdated();

  return entry;
}

/** Short headline for the momentum completion modal. */
export function getMomentumHeadline(entry: ReportEntry): string {
  const delta = entry.progressAtTime - entry.previousProgress;
  if (entry.warningType === 'urgent_safety') return 'Please pause and get help';
  if (entry.progressAtTime >= 100) return 'You closed the day strong 🎯';
  if (delta >= 8 || (entry.movementState === 'up' && delta >= 5)) return "You're building momentum 🚀";
  if (entry.momentumScore >= 70) return "You're on a roll today";
  if (entry.movementState === 'up') return 'Progress is moving forward';
  if (entry.movementState === 'flat') return 'Nice work - keep it going';
  return 'Keep stacking small wins';
}

/** Preview of Live Check-in feedback for the momentum modal (first sentence, truncated). */
export function getFeedbackTeaser(responseText: string, maxLen = 110): string {
  const cleaned = responseText
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/—/g, '-')
    .replace(/–/g, '-');
  if (!cleaned) return '';

  const firstSentence = cleaned.match(/^[^.]+\./)?.[0]?.trim() ?? cleaned;
  let excerpt = firstSentence.length <= maxLen ? firstSentence : cleaned;

  if (excerpt.length > maxLen) {
    const slice = excerpt.slice(0, maxLen);
    const lastSpace = slice.lastIndexOf(' ');
    excerpt = (lastSpace > 50 ? slice.slice(0, lastSpace) : slice).trim();
  }

  const hasMore = cleaned.length > excerpt.replace(/\.$/, '').length;
  if (hasMore || excerpt.length < cleaned.length) {
    return `${excerpt.replace(/\.$/, '')}...`;
  }
  return excerpt;
}

export function randomProcessingDelayMs(): number {
  return 1500 + Math.floor(Math.random() * 1001);
}
