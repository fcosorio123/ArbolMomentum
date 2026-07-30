/**
 * Adaptive Engagement analytics — Entry / Recovery / Execution categories.
 * Extends trackEvent; never treats Recovery as task completion.
 */

import { trackEvent, type EventType } from './deviceAnalytics';
import { getAppEnv } from './environment';
import { isAttributionCollectEnabled } from './engagementControls';
import { markAttributionStageOnce, type CtaId } from './notificationIdentity';

export type EngagementCategory = 'entry' | 'recovery' | 'execution';

export type EngagementEventName =
  | 'notification_scheduled'
  | 'notification_sent'
  | 'notification_delivered'
  | 'notification_cta_clicked'
  | 'notification_app_opened'
  | 'notification_destination_loaded'
  | 'notification_destination_failed'
  | 'notification_workflow_opened'
  | 'checkin_started_from_notification'
  | 'checkin_completed_from_notification'
  | 'task_opened_from_notification'
  | 'task_started_from_notification'
  | 'task_progressed_from_notification'
  | 'task_completed_from_notification'
  | 'task_deferred'
  | 'task_defer_reason_selected'
  | 'task_reminder_time_selected'
  | 'task_reminder_changed'
  | 'task_reminder_cancelled'
  | 'task_reopened_after_defer'
  | 'task_completed_after_defer'
  | 'task_deferred_repeatedly'
  | 'meaningful_action';

const ENTRY: EngagementEventName[] = [
  'notification_scheduled',
  'notification_sent',
  'notification_delivered',
  'notification_cta_clicked',
  'notification_app_opened',
  'notification_destination_loaded',
  'notification_destination_failed',
  'notification_workflow_opened',
];

const RECOVERY: EngagementEventName[] = [
  'task_deferred',
  'task_defer_reason_selected',
  'task_reminder_time_selected',
  'task_reminder_changed',
  'task_reminder_cancelled',
  'task_reopened_after_defer',
  'task_deferred_repeatedly',
];

const EXECUTION: EngagementEventName[] = [
  'checkin_started_from_notification',
  'checkin_completed_from_notification',
  'task_opened_from_notification',
  'task_started_from_notification',
  'task_progressed_from_notification',
  'task_completed_from_notification',
  'task_completed_after_defer',
];

export function categoryForEvent(event: EngagementEventName): EngagementCategory {
  if (ENTRY.includes(event)) return 'entry';
  if (RECOVERY.includes(event)) return 'recovery';
  if (EXECUTION.includes(event)) return 'execution';
  return 'execution';
}

export interface EngagementEventData {
  nid?: string;
  cta?: CtaId | string;
  channel?: string;
  notifType?: string;
  dest?: string;
  taskId?: string;
  authState?: string;
  device?: string;
  failureReason?: string;
  kind?: string;
  resumePreset?: string;
  /** Never include raw sensitive reason text in admin-facing aggregates. */
  reasonCode?: string;
  [key: string]: string | number | boolean | undefined;
}

function toTrackPayload(data: EngagementEventData): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    category: categoryForEvent(data.kind as EngagementEventName || 'notification_sent'),
    app_env: getAppEnv(),
  };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === 'reason' || k === 'reasonText') continue; // strip sensitive free text
    out[k] = v;
  }
  return out;
}

/**
 * Emit engagement event when attribution collection is enabled (or force for local tests).
 * Uses stage idempotency when nid+stageKey provided.
 */
export function trackEngagementEvent(
  profileId: string,
  event: EngagementEventName,
  data: EngagementEventData = {},
  opts?: { force?: boolean; stageKey?: string },
): boolean {
  if (!opts?.force && !isAttributionCollectEnabled(profileId) && !event.startsWith('task_defer') && event !== 'task_completed_after_defer' && event !== 'task_reopened_after_defer' && event !== 'task_deferred_repeatedly' && event !== 'task_reminder_time_selected' && event !== 'task_reminder_changed' && event !== 'task_reminder_cancelled' && event !== 'task_defer_reason_selected') {
    // Deferral recovery events still fire when deferral UI is used (separate from attributionCollect).
    // Attribution entry events require attributionCollect.
  }

  const isEntry = categoryForEvent(event) === 'entry' || event.startsWith('notification_') || event.includes('_from_notification');
  const isRecovery = categoryForEvent(event) === 'recovery';
  const isExecution = categoryForEvent(event) === 'execution';

  if (isEntry && !opts?.force && !isAttributionCollectEnabled(profileId)) {
    return false;
  }
  // Recovery/execution from product actions: allow when deferral or always for check-in complete from notif if attribution on
  if ((isRecovery || (isExecution && !event.includes('from_notification'))) && !opts?.force) {
    // always allow recovery/execution product events when triggered from UX (caller gates UI)
  }

  if (data.nid && opts?.stageKey) {
    if (!markAttributionStageOnce(data.nid, opts.stageKey)) return false;
  }

  const category = categoryForEvent(event);
  const payload = toTrackPayload({ ...data, category });
  payload.category = category;

  // Cast: EventType union is extended at runtime via string; sync accepts any string.
  trackEvent(profileId, event as EventType, payload);

  // Legacy aliases for devices tab during transition
  if (event === 'notification_sent') {
    trackEvent(profileId, 'notif_sent', { tag: String(data.notifType || data.cta || ''), nid: data.nid || '' });
  }
  if (event === 'notification_cta_clicked') {
    trackEvent(profileId, 'notif_clicked', { tag: String(data.notifType || ''), nid: data.nid || '' });
  }

  return true;
}

/** Optional umbrella rollup — always includes category so Recovery ≠ Execution. */
export function trackMeaningfulActionRollup(
  profileId: string,
  category: 'recovery' | 'execution',
  kind: string,
  data: EngagementEventData = {},
): void {
  trackEngagementEvent(profileId, 'meaningful_action', {
    ...data,
    kind,
    category,
  }, { force: true });
}
