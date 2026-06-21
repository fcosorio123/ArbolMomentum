// ──────────────────────────────────────────────
// Browser notification display helper
// ──────────────────────────────────────────────

import { areNotificationsEnabled } from './appSettings';

const NOTIF_ICON = '/icon-192.svg';

export async function showNotification(
  swReg: ServiceWorkerRegistration | null,
  title: string,
  body: string,
  tag: string,
) {
  if (!areNotificationsEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = swReg ?? (await navigator.serviceWorker.ready);
      if (reg?.active) {
        reg.active.postMessage({ type: 'SHOW', title, body, tag });
        return;
      }
    }
    new Notification(title, { body, tag, icon: NOTIF_ICON });
  } catch {}
}
