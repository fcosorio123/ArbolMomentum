// ──────────────────────────────────────────────
// Web Push subscription + cross-platform permission helpers
// ──────────────────────────────────────────────

import { supabase } from '/utils/supabase/client';
import { detectDevice, saveDeviceRecord, trackEvent } from './deviceAnalytics';

const FN = 'make-server-5d90ddf5';
const SUB_KEY = (profileId: string) => `arbol-push-sub-${profileId}`;

/** VAPID public key — set VITE_VAPID_PUBLIC_KEY at build time, or fetched from server */
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? '';

let cachedVapidKey = VAPID_PUBLIC_KEY;

export async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) return cachedVapidKey;
  try {
    const { data } = await supabase.functions.invoke(`${FN}/push-vapid-key`);
    if (data?.publicKey) {
      cachedVapidKey = data.publicKey as string;
      return cachedVapidKey;
    }
  } catch { /* server may not have keys yet */ }
  return '';
}

export interface PushPlatformInfo {
  os: ReturnType<typeof detectDevice>['os'];
  browser: ReturnType<typeof detectDevice>['browser'];
  isPwa: boolean;
  pushSupported: boolean;
  notificationsSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  needsHomeScreenInstall: boolean;
  canRequestPermission: boolean;
  troubleshootingHint: string | null;
}

export function getPushPlatformInfo(): PushPlatformInfo {
  const d = detectDevice();
  const notificationsSupported = 'Notification' in window;
  const permission = notificationsSupported
    ? Notification.permission
    : ('unsupported' as const);

  const needsHomeScreenInstall =
    d.os === 'iOS' && !d.isPwa;

  let troubleshootingHint: string | null = null;
  if (!notificationsSupported) {
    troubleshootingHint = 'This browser does not support notifications. Try Chrome or Safari.';
  } else if (needsHomeScreenInstall) {
    troubleshootingHint =
      'On iPhone/iPad, add Arbol to your Home Screen first (Share → Add to Home Screen), then open the app and enable notifications.';
  } else if (permission === 'denied') {
    troubleshootingHint =
      d.os === 'iOS'
        ? 'Open Settings → Notifications → Arbol Momentum and allow alerts.'
        : 'Open browser site settings and allow notifications for this site.';
  } else if (d.pushSupported && !VAPID_PUBLIC_KEY) {
    troubleshootingHint =
      'In-app reminders work while Arbol is open. Background push requires server configuration.';
  }

  return {
    os: d.os,
    browser: d.browser,
    isPwa: d.isPwa,
    pushSupported: d.pushSupported,
    notificationsSupported,
    permission,
    needsHomeScreenInstall,
    canRequestPermission: notificationsSupported && !needsHomeScreenInstall && permission !== 'denied',
    troubleshootingHint,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function getLocalPushSubscription(profileId: string): PushSubscriptionJSON | null {
  try {
    const raw = localStorage.getItem(SUB_KEY(profileId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalPushSubscription(profileId: string, sub: PushSubscriptionJSON | null) {
  if (sub) localStorage.setItem(SUB_KEY(profileId), JSON.stringify(sub));
  else localStorage.removeItem(SUB_KEY(profileId));
}

async function registerSubscriptionOnServer(
  profileId: string,
  subscription: PushSubscriptionJSON,
): Promise<boolean> {
  try {
    const tzOffset = new Date().getTimezoneOffset();
    const { data, error } = await supabase.functions.invoke(`${FN}/register-push`, {
      method: 'POST',
      body: { profileId, subscription, tzOffset },
    });
    if (error) {
      console.warn('[Push] register-push failed:', error);
      return false;
    }
    return !!data?.ok;
  } catch (err) {
    console.warn('[Push] register-push error:', err);
    return false;
  }
}

export async function subscribeToPush(
  profileId: string,
  swReg: ServiceWorkerRegistration | null,
): Promise<PushSubscription | null> {
  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return null;
  if (!('PushManager' in window)) return null;

  try {
    const reg = swReg ?? (await navigator.serviceWorker.ready);
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = sub.toJSON();
    saveLocalPushSubscription(profileId, json);
    await registerSubscriptionOnServer(profileId, json);
    saveDeviceRecord(profileId, { pushSupported: true });
    return sub;
  } catch (err) {
    console.warn('[Push] subscribe failed:', err);
    return null;
  }
}

export async function unsubscribeFromPush(profileId: string): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
    }
  } catch { /* ignore */ }
  saveLocalPushSubscription(profileId, null);
}

export interface PermissionRequestResult {
  permission: NotificationPermission | 'unsupported';
  granted: boolean;
  pushSubscribed: boolean;
}

/** Unified permission flow with platform checks, analytics, and optional push subscribe */
export async function requestNotificationPermission(
  profileId: string,
  swReg: ServiceWorkerRegistration | null,
  profileName?: string,
): Promise<PermissionRequestResult> {
  const info = getPushPlatformInfo();

  if (!info.notificationsSupported) {
    return { permission: 'unsupported', granted: false, pushSubscribed: false };
  }

  if (info.needsHomeScreenInstall) {
    return { permission: info.permission as NotificationPermission, granted: false, pushSubscribed: false };
  }

  if (info.permission === 'granted') {
    const sub = await subscribeToPush(profileId, swReg);
    return { permission: 'granted', granted: true, pushSubscribed: !!sub };
  }

  if (info.permission === 'denied') {
    trackEvent(profileId, 'notif_permission_denied');
    saveDeviceRecord(profileId, { notifPermission: 'denied' });
    return { permission: 'denied', granted: false, pushSubscribed: false };
  }

  const result = await Notification.requestPermission();
  saveDeviceRecord(profileId, { notifPermission: result as 'granted' | 'denied' | 'default' });

  if (result === 'granted') {
    trackEvent(profileId, 'notif_permission_granted');
    const sub = await subscribeToPush(profileId, swReg);
    return { permission: 'granted', granted: true, pushSubscribed: !!sub };
  }

  trackEvent(profileId, 'notif_permission_denied');
  return { permission: result, granted: false, pushSubscribed: false };
}

/** Re-sync push subscription after SW update or app launch */
export async function ensurePushSubscription(
  profileId: string,
  swReg: ServiceWorkerRegistration | null,
): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const key = await getVapidPublicKey();
  if (!key) return;
  await subscribeToPush(profileId, swReg);
}
