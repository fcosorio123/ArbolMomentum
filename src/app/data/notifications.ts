// ──────────────────────────────────────────────
// Browser notification display helper
// ──────────────────────────────────────────────

import { areNotificationsEnabled } from './appSettings';

const APP_BASE = import.meta.env.BASE_URL || '/';
const NOTIF_ICON = `${APP_BASE}icon-192.svg`;
const RECENT_TAG_MS = 90_000; // suppress duplicate tag within 90s

const recentTags = new Map<string, number>();

function shouldSuppress(tag: string): boolean {
  const last = recentTags.get(tag);
  const now = Date.now();
  if (last && now - last < RECENT_TAG_MS) return true;
  recentTags.set(tag, now);
  return false;
}

export type ShowNotificationResult = {
  ok: boolean;
  reason?: string;
};

export async function showNotification(
  swReg: ServiceWorkerRegistration | null,
  title: string,
  body: string,
  tag: string,
  options?: { badgeCount?: number; url?: string; skipDedupe?: boolean },
): Promise<ShowNotificationResult> {
  if (!areNotificationsEnabled()) {
    return { ok: false, reason: 'Notifications are turned off in admin settings.' };
  }
  if (!('Notification' in window)) {
    return { ok: false, reason: 'This browser does not support notifications.' };
  }
  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'Notification permission is not granted.' };
  }
  if (!options?.skipDedupe && shouldSuppress(tag)) {
    return { ok: false, reason: 'A similar notification was just sent - wait a moment and try again.' };
  }

  const payload = {
    type: 'SHOW' as const,
    title,
    body,
    tag,
    badgeCount: options?.badgeCount,
    url: options?.url ?? APP_BASE,
  };

  try {
    // Prefer the native Notification API for Test / explicit user actions -
    // SW postMessage alone is easy to miss and silent when the worker is idle.
    if (options?.skipDedupe || tag.startsWith('test')) {
      new Notification(title, { body, tag, icon: NOTIF_ICON });
      return { ok: true };
    }

    if ('serviceWorker' in navigator) {
      const reg = swReg ?? (await navigator.serviceWorker.ready);
      if (reg?.active) {
        reg.active.postMessage(payload);
        return { ok: true };
      }
    }
    new Notification(title, { body, tag, icon: NOTIF_ICON });
    return { ok: true };
  } catch (err) {
    console.warn('[Notification] show failed:', err);
    return { ok: false, reason: 'Could not display the notification - check system notification settings.' };
  }
}
