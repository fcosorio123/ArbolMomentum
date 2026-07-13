import {
  getTaskStatus, getTodayKey, setTaskStatus, type TaskStatus,
} from './profiles';
import {
  saveTaskNote, submitReportUpdate, dispatchFeedbackUpdated, type ReportEntry,
} from './liveCheckInFeedback';
import { isLiveCheckInEnabled } from './liveCheckInSettings';

export type StatusUpdateSource = 'task_list' | 'check_in' | 'quick_checkin';

export interface ApplyTaskStatusUpdateParams {
  profileId: string;
  taskId: string;
  status: TaskStatus | null;
  note?: string;
  source: StatusUpdateSource;
  taskLabel?: string;
  previousStatus?: TaskStatus | null;
  liveCheckInEnabled?: boolean;
}

/** Unified status write path for Tasks tab and Check-In. */
export function applyTaskStatusUpdate(params: ApplyTaskStatusUpdateParams): ReportEntry | null {
  const today = getTodayKey();
  const live = params.liveCheckInEnabled ?? isLiveCheckInEnabled();
  const prev = params.previousStatus ?? getTaskStatus(params.profileId, params.taskId, today);

  if (live && params.taskLabel) {
    const entry = submitReportUpdate({
      profileId: params.profileId,
      taskId: params.taskId,
      taskTitle: params.taskLabel,
      status: params.status,
      note: params.note ?? '',
      previousStatus: prev,
    });
    dispatchFeedbackUpdated();
    return entry;
  }

  setTaskStatus(params.profileId, params.taskId, today, params.status);
  if (params.note !== undefined) {
    saveTaskNote(params.profileId, params.taskId, today, params.note);
  }
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch { /* ignore */ }
  dispatchFeedbackUpdated();
  return null;
}
