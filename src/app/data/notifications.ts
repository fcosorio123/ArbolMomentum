// ──────────────────────────────────────────────
// Browser notification display helper
// ──────────────────────────────────────────────

import { areNotificationsEnabled } from './appSettings';

const NOTIF_ICON = '/icon-192.svg';
const RECENT_TAG_MS = 90_000; // suppress duplicate tag within 90s

const recentTags = new Map<string, number>();

function shouldSuppress(tag: string): boolean {
  const last = recentTags.get(tag);
  const now = Date.now();
  if (last && now - last < RECENT_TAG_MS) return true;
  recentTags.set(tag, now);
  return false;
}

export async function showNotification(
  swReg: ServiceWorkerRegistration | null,
  title: string,
  body: string,
  tag: string,
  options?: { badgeCount?: number; url?: string },
) {
  if (!areNotificationsEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (shouldSuppress(tag)) return;

  const payload = {
    type: 'SHOW' as const,
    title,
    body,
    tag,
    badgeCount: options?.badgeCount,
    url: options?.url ?? '/',
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = swReg ?? (await navigator.serviceWorker.ready);
      if (reg?.active) {
        reg.active.postMessage(payload);
        return;
      }
    }
    new Notification(title, { body, tag, icon: NOTIF_ICON });
  } catch { /* ignore */ }
}
