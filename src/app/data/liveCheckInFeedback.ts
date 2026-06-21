// ──────────────────────────────────────────────
// Live Check-In Feedback (rules-based reports)
// ──────────────────────────────────────────────

import {
  type TaskStatus,
  type TaskType,
  getTaskCategoriesForProfile,
  getTaskStatus,
  setTaskStatus,
  isTaskDeleted,
  getTodayKey,
} from './profiles';
import { getUserTasks, isTaskScheduledForDate } from './userTasks';

export type MovementState = 'up' | 'flat' | 'down';
export type WarningType = null | 'blocker' | 'open_loops' | 'decline' | 'urgent_safety';

export interface RecommendedAction {
  label: string;
  reason: string;
  taskId?: string;
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
  'Reading your update…',
  'Checking task progress…',
  'Reviewing momentum…',
  'Looking for blockers…',
  'Checking execution signals…',
  'Preparing your report…',
  'Updating the plan…',
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
  const userTasks = getUserTasks(profileId);
  const seen = new Set<string>();
  const out: ScopedTask[] = [];

  for (const cat of categories) {
    for (const t of cat.tasks) {
      if (isTaskDeleted(profileId, t.id, dateKey)) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push({ id: t.id, label: t.label, type: t.type });
    }
  }

  for (const ut of userTasks) {
    if (!isTaskScheduledForDate(ut, dateKey)) continue;
    if (isTaskDeleted(profileId, ut.id, dateKey)) continue;
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

function bandPhrase(progress: number): string {
  if (progress >= 100) return 'complete';
  if (progress >= 81) return 'almost complete';
  if (progress >= 51) return 'showing strong progress';
  if (progress >= 26) return 'building traction';
  return 'still in low-momentum territory';
}

function statusLabel(status: TaskStatus | null): string {
  if (status === 'done') return 'Done';
  if (status === 'inprogress') return 'In Progress';
  return 'Not Started';
}

// ── Recommended next action ───────────────────────────────────────────

export function recommendNextAction(
  profileId: string,
  dateKey: string,
  warningType: WarningType,
): RecommendedAction {
  if (warningType === 'urgent_safety') {
    return {
      label: 'Get appropriate help now',
      reason: 'outside what ArbolMomentum can safely evaluate',
    };
  }

  const tasks = getVisibleTasksForDate(profileId, dateKey);

  const blocked = tasks.find(t => isTaskBlockedFlag(profileId, t.id, dateKey));
  if (blocked) {
    return {
      label: blocked.label,
      reason: 'blocked - reduce friction on this step',
      taskId: blocked.id,
    };
  }

  const highInProgress = tasks.find(t =>
    t.type === 'priority' && getTaskStatus(profileId, t.id, dateKey) === 'inprogress',
  );
  if (highInProgress) {
    return { label: highInProgress.label, reason: 'already in motion', taskId: highInProgress.id };
  }

  const highNotStarted = tasks.find(t =>
    t.type === 'priority' && !getTaskStatus(profileId, t.id, dateKey),
  );
  if (highNotStarted) {
    return { label: highNotStarted.label, reason: 'highest leverage next step', taskId: highNotStarted.id };
  }

  const anyInProgress = tasks.find(t => getTaskStatus(profileId, t.id, dateKey) === 'inprogress');
  if (anyInProgress) {
    return { label: anyInProgress.label, reason: 'already in motion', taskId: anyInProgress.id };
  }

  const anyNotStarted = tasks.find(t => !getTaskStatus(profileId, t.id, dateKey));
  if (anyNotStarted) {
    return { label: anyNotStarted.label, reason: 'next open task', taskId: anyNotStarted.id };
  }

  return { label: 'Pick your next task area', reason: 'current tasks are complete' };
}

// ── Report text generator ─────────────────────────────────────────────

export function generateReportText(opts: {
  taskTitle: string;
  status: TaskStatus | null;
  statusChanged: boolean;
  progress: number;
  previousProgress: number;
  movementState: MovementState;
  momentumScore: number;
  warningType: WarningType;
  inProgressCount: number;
  recommended: RecommendedAction;
}): string {
  const {
    taskTitle, status, statusChanged, progress, previousProgress,
    movementState, momentumScore, warningType, inProgressCount, recommended,
  } = opts;

  if (warningType === 'urgent_safety') return URGENT_ESCALATION;

  const next = recommended.label === 'Get appropriate help now'
    ? recommended.label
    : recommended.label;

  if (warningType === 'blocker') {
    return `You flagged friction on "${taskTitle}." Your progress is at ${progress}%, and this looks less like failure and more like a blocked next step. Your next move is to ${next} because it reduces the blocker.`;
  }

  if (movementState === 'down') {
    return `Your update moved progress from ${previousProgress}% to ${progress}%, so the plan is less certain right now. Momentum Score is ${momentumScore}, which means the next move should be stabilizing. Focus on ${next} next.`;
  }

  if (inProgressCount > 2) {
    return `You have ${inProgressCount} tasks in progress, which shows activity but also creates drag. Progress is at ${progress}% and Momentum Score is ${momentumScore}. Close one loop next by working on ${next}.`;
  }

  if (movementState === 'flat' && !statusChanged) {
    return `You updated "${taskTitle}," but progress is still flat at ${progress}%. That means activity happened, but the task list did not move forward yet. Your next move is to ${next}.`;
  }

  if (movementState === 'flat' && statusChanged) {
    return `You moved "${taskTitle}" to ${statusLabel(status)}, and progress is holding at ${progress}%. This is ${bandPhrase(progress)}. Your next move is to ${next}.`;
  }

  return `You moved "${taskTitle}" to ${statusLabel(status)}, bringing progress to ${progress}% from ${previousProgress}%. This is ${bandPhrase(progress)}, and Momentum Score is ${momentumScore}. Your next move is to ${next}.`;
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

  const previousProgress = getPreviousProgressBeforeToday(profileId, dateKey);
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

  const recommended = recommendNextAction(profileId, dateKey, warningType);
  const responseText = generateReportText({
    taskTitle,
    status: targetStatus,
    statusChanged,
    progress: scope.progress,
    previousProgress,
    movementState,
    momentumScore,
    warningType,
    inProgressCount: scope.inProgressTaskCount,
    recommended,
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

export function randomProcessingDelayMs(): number {
  return 1500 + Math.floor(Math.random() * 1001);
}
