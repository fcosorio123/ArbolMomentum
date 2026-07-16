// ── Types ───────────────────────────────────────

export type OSType = 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'Other';
export type BrowserType = 'Chrome' | 'Samsung' | 'Safari' | 'Firefox' | 'Edge' | 'Opera' | 'Other';
export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';
export type EventType =
  | 'app_opened'
  | 'app_installed'
  | 'notif_permission_granted'
  | 'notif_permission_denied'
  | 'notif_sent'
  | 'notif_received'
  | 'notif_clicked'
  | 'badge_updated'
  | 'ai_assist_opened'
  | 'ai_assist_type_selected'
  | 'ai_assist_generate_submitted'
  | 'ai_assist_generate_succeeded'
  | 'ai_assist_generate_failed'
  | 'ai_assist_candidate_selected'
  | 'ai_assist_regenerate'
  | 'ai_assist_draft_edited'
  | 'ai_assist_goal_mode'
  | 'ai_assist_starters_generated'
  | 'ai_assist_goal_relationship'
  | 'ai_assist_abandoned'
  | 'ai_assist_save_attempted'
  | 'ai_assist_save_succeeded'
  | 'ai_assist_save_partial'
  | 'ai_assist_save_failed'
  | 'onboarding_empty_state_shown'
  | 'onboarding_empty_state_dismissed'
  | 'onboarding_create_goal_clicked'
  | 'onboarding_create_task_clicked'
  | 'onboarding_tour_started'
  | 'onboarding_tour_restarted'
  | 'onboarding_tour_step_viewed'
  | 'onboarding_tour_completed'
  | 'onboarding_tour_skipped'
  | 'coaching_mark_viewed'
  | 'coaching_mark_completed'
  | 'coaching_mark_skipped'
  | 'simplify_detail_assist_shown'
  | 'simplify_detail_suggestions_loaded'
  | 'simplify_detail_suggestion_selected'
  | 'simplify_detail_suggestions_refreshed'
  | 'simplify_detail_custom_text_used'
  | 'simplify_detail_assist_failed'
  | 'simplify_detail_validation_passed'
  | 'simplify_detail_validation_mismatch';

export interface DeviceRecord {
  profileId: string;
  os: OSType;
  browser: BrowserType;
  isPwa: boolean;
  notifPermission: NotifPermission;
  pushSupported: boolean;
  badgeSupported: boolean;
  lastUpdated: number;
  lastNotifSent: number | null;
  lastNotifReceived: number | null;
}

export interface EventLog {
  profileId: string;
  event: EventType;
  timestamp: number;
  data?: Record<string, string | number | boolean>;
}

// ── Detection ───────────────────────────────────

export function detectOS(): OSType {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}

export function detectBrowser(): BrowserType {
  const ua = navigator.userAgent;
  if (/samsungbrowser/i.test(ua)) return 'Samsung';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

export function detectDevice() {
  return {
    os: detectOS(),
    browser: detectBrowser(),
    isPwa:
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true,
    notifPermission: ('Notification' in window
      ? Notification.permission
      : 'unsupported') as NotifPermission,
    pushSupported: 'serviceWorker' in navigator && 'PushManager' in window,
    badgeSupported: 'setAppBadge' in navigator,
  };
}

// ── Storage ─────────────────────────────────────

function deviceKey(profileId: string) { return `arbol-device-${profileId}`; }
function eventKey(profileId: string, date: string) { return `arbol-events-${profileId}-${date}`; }

export function saveDeviceRecord(
  profileId: string,
  updates: Partial<Omit<DeviceRecord, 'profileId'>>,
): DeviceRecord {
  const existing = getDeviceRecord(profileId) ?? ({ profileId } as DeviceRecord);
  const merged: DeviceRecord = { ...existing, ...updates, profileId, lastUpdated: Date.now() };
  localStorage.setItem(deviceKey(profileId), JSON.stringify(merged));

  // Sync to Supabase (async, non-blocking)
  import('./supabaseSync').then(({ syncDeviceRecord }) => {
    syncDeviceRecord(profileId, {
      os: merged.os,
      browser: merged.browser,
      is_pwa: merged.isPwa,
      push_supported: merged.pushSupported,
      badge_supported: merged.badgeSupported,
      notif_permission: merged.notifPermission,
      last_notif_sent: merged.lastNotifSent,
    });
  });

  return merged;
}

export function getDeviceRecord(profileId: string): DeviceRecord | null {
  const raw = localStorage.getItem(deviceKey(profileId));
  return raw ? JSON.parse(raw) : null;
}

export function getAllDeviceRecords(): Record<string, DeviceRecord> {
  const result: Record<string, DeviceRecord> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('arbol-device-')) {
      try {
        const r: DeviceRecord = JSON.parse(localStorage.getItem(key)!);
        result[r.profileId] = r;
      } catch {}
    }
  }
  return result;
}

// ── Event Logging ────────────────────────────────

export function trackEvent(
  profileId: string,
  event: EventType,
  data?: Record<string, string | number | boolean>,
) {
  const date = localDateKey();
  const key = eventKey(profileId, date);
  const logs: EventLog[] = JSON.parse(localStorage.getItem(key) || '[]');
  logs.push({ profileId, event, timestamp: Date.now(), data });
  // Keep last 200 events per day per profile
  localStorage.setItem(key, JSON.stringify(logs.slice(-200)));

  // Sync to Supabase (async, non-blocking)
  import('./supabaseSync').then(({ syncEventLog }) => {
    syncEventLog(profileId, event, data);
  });
}

export function getEventLogs(profileId: string, days = 7): EventLog[] {
  const result: EventLog[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = localDateKey(d);
    const raw = localStorage.getItem(eventKey(profileId, date));
    if (raw) {
      try { result.push(...JSON.parse(raw)); } catch {}
    }
  }
  return result.sort((a, b) => b.timestamp - a.timestamp);
}

export function getAllEventLogs(): EventLog[] {
  const result: EventLog[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('arbol-events-')) {
      try { result.push(...JSON.parse(localStorage.getItem(key)!)); } catch {}
    }
  }
  return result.sort((a, b) => b.timestamp - a.timestamp).slice(0, 500);
}

// ── Notification Schedule Storage ────────────────
// Stored by main thread; checked on app focus to catch up on missed notifications.

export interface ScheduledNotif {
  tag: string;
  title: string;
  body: string;
  atMs: number; // absolute timestamp to fire
  kind?: 'smart' | 'custom';
  days?: string[]; // Mon–Sun for custom reminders
}

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function scheduleKey(profileId: string) {
  return `arbol-sched-${profileId}-${localDateKey()}`;
}

export function saveSchedule(profileId: string, notifs: ScheduledNotif[]) {
  localStorage.setItem(scheduleKey(profileId), JSON.stringify(notifs));
}

export function getSchedule(profileId: string): ScheduledNotif[] {
  const raw = localStorage.getItem(scheduleKey(profileId));
  return raw ? JSON.parse(raw) : [];
}

export function markScheduleFired(profileId: string, tag: string) {
  const list = getSchedule(profileId).filter(n => n.tag !== tag);
  localStorage.setItem(scheduleKey(profileId), JSON.stringify(list));
}

function firedKey(profileId: string) {
  return `arbol-fired-${profileId}-${localDateKey()}`;
}

/** Persistent per-day dedup - survives schedule rebuilds */
export function wasNudgeFiredToday(profileId: string, tag: string): boolean {
  try {
    const fired: string[] = JSON.parse(localStorage.getItem(firedKey(profileId)) || '[]');
    return fired.includes(tag);
  } catch {
    return false;
  }
}

export function markNudgeFiredToday(profileId: string, tag: string) {
  try {
    const fired: string[] = JSON.parse(localStorage.getItem(firedKey(profileId)) || '[]');
    if (!fired.includes(tag)) fired.push(tag);
    localStorage.setItem(firedKey(profileId), JSON.stringify(fired));
  } catch { /* ignore */ }
}

export function getFiredNudgesToday(profileId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(firedKey(profileId)) || '[]');
  } catch {
    return [];
  }
}
