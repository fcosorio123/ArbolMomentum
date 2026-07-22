import {
  getTaskStatus, getTodayKey, setTaskStatus, type TaskStatus,
} from './profiles';
import {
  saveTaskNote, submitReportUpdate, dispatchFeedbackUpdated, type ReportEntry,
} from './liveCheckInFeedback';
import { isLiveCheckInEnabled } from './liveCheckInSettings';
import { trackActivity } from './feedback';

export type StatusUpdateSource =
  | 'task_list'
  | 'check_in'
  | 'quick_checkin'
  | 'week_plan'
  | 'personal_goals';

export interface ApplyTaskStatusUpdateParams {
  profileId: string;
  taskId: string;
  status: TaskStatus | null;
  note?: string;
  source: StatusUpdateSource;
  taskLabel?: string;
  previousStatus?: TaskStatus | null;
  liveCheckInEnabled?: boolean;
  /** Occurrence date for one-time / overdue tasks. Defaults to today. */
  dateKey?: string;
}

/** Unified status write path for Tasks tab, Check-In, and related surfaces. */
export function applyTaskStatusUpdate(params: ApplyTaskStatusUpdateParams): ReportEntry | null {
  const dateKey = params.dateKey ?? getTodayKey();
  const live = params.liveCheckInEnabled ?? isLiveCheckInEnabled();
  const prev = params.previousStatus ?? getTaskStatus(params.profileId, params.taskId, dateKey);

  try {
    trackActivity(params.profileId);
  } catch { /* ignore */ }

  if (live && params.taskLabel) {
    const entry = submitReportUpdate({
      profileId: params.profileId,
      taskId: params.taskId,
      taskTitle: params.taskLabel,
      status: params.status,
      note: params.note ?? '',
      previousStatus: prev,
      dateKey,
    });
    dispatchFeedbackUpdated();
    return entry;
  }

  setTaskStatus(params.profileId, params.taskId, dateKey, params.status);
  if (params.note !== undefined) {
    saveTaskNote(params.profileId, params.taskId, dateKey, params.note);
  }
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch { /* ignore */ }
  dispatchFeedbackUpdated();
  return null;
}
