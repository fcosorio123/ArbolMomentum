/**
 * Aggregate notification funnel metrics from event logs.
 * Separates Entry / Recovery / Execution. Never labels Profile as School.
 */

export type FunnelCategory = 'entry' | 'recovery' | 'execution';

export interface FunnelEventLike {
  event: string;
  profile_id?: string;
  profileId?: string;
  metadata?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  created_at?: string;
  timestamp?: number;
}

export interface FunnelTotals {
  entry: Record<string, number>;
  recovery: Record<string, number>;
  execution: Record<string, number>;
  uniqueProfilesClicked: number;
  uniqueNids: number;
}

const ENTRY_EVENTS = new Set([
  'notification_scheduled', 'notification_sent', 'notification_delivered',
  'notification_cta_clicked', 'notification_app_opened',
  'notification_destination_loaded', 'notification_destination_failed',
  'notification_workflow_opened', 'notif_sent', 'notif_clicked',
]);

const RECOVERY_EVENTS = new Set([
  'task_deferred', 'task_defer_reason_selected', 'task_reminder_time_selected',
  'task_reminder_changed', 'task_reminder_cancelled', 'task_reopened_after_defer',
  'task_deferred_repeatedly',
]);

const EXECUTION_EVENTS = new Set([
  'checkin_started_from_notification', 'checkin_completed_from_notification',
  'task_opened_from_notification', 'task_started_from_notification',
  'task_progressed_from_notification', 'task_completed_from_notification',
  'task_completed_after_defer',
]);

function metaOf(e: FunnelEventLike): Record<string, unknown> {
  return (e.metadata || e.data || {}) as Record<string, unknown>;
}

export function categoryOfEvent(event: string, meta?: Record<string, unknown>): FunnelCategory | null {
  if (meta?.category === 'entry' || meta?.category === 'recovery' || meta?.category === 'execution') {
    return meta.category as FunnelCategory;
  }
  if (ENTRY_EVENTS.has(event)) return 'entry';
  if (RECOVERY_EVENTS.has(event)) return 'recovery';
  if (EXECUTION_EVENTS.has(event)) return 'execution';
  if (event === 'meaningful_action') {
    const c = meta?.category;
    if (c === 'recovery' || c === 'execution') return c;
  }
  return null;
}

/** Sensitive reason codes must never appear in broad admin exports. */
export function scrubSensitiveMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out = { ...meta };
  delete out.reason;
  delete out.reasonText;
  // reasonCode allowed only when explicitly requested for support — strip from funnel CSV
  delete out.reasonCode;
  return out;
}

export function aggregateNotificationFunnel(
  events: FunnelEventLike[],
  opts?: { profileId?: string; channel?: string; appEnv?: string },
): FunnelTotals {
  const entry: Record<string, number> = {};
  const recovery: Record<string, number> = {};
  const execution: Record<string, number> = {};
  const clickedProfiles = new Set<string>();
  const nids = new Set<string>();

  for (const e of events) {
    const meta = metaOf(e);
    const profileId = String(e.profile_id || e.profileId || '');
    if (opts?.profileId && profileId !== opts.profileId) continue;
    if (opts?.channel && String(meta.channel || '') !== opts.channel) continue;
    if (opts?.appEnv && String(meta.app_env || '') !== opts.appEnv) continue;

    const cat = categoryOfEvent(e.event, meta);
    if (!cat) continue;

    const bucket = cat === 'entry' ? entry : cat === 'recovery' ? recovery : execution;
    bucket[e.event] = (bucket[e.event] || 0) + 1;

    const nid = meta.nid;
    if (typeof nid === 'string' && nid) nids.add(nid);
    if (e.event === 'notification_cta_clicked' || e.event === 'notif_clicked') {
      if (profileId) clickedProfiles.add(profileId);
    }
  }

  return {
    entry,
    recovery,
    execution,
    uniqueProfilesClicked: clickedProfiles.size,
    uniqueNids: nids.size,
  };
}
