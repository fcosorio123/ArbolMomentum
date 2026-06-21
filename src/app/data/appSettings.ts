// ──────────────────────────────────────────────
// Global App Notification Settings
// ──────────────────────────────────────────────

import { supabase } from '/utils/supabase/client';
import { getStorageKey, isPublishedVersion } from './environment';

const FN = 'make-server-5d90ddf5';
const STORAGE_KEY = getStorageKey('arbol-app-settings');

export type NotificationChannel = 'browser';

export interface AppNotificationSettings {
  enabled: boolean;
  channel: NotificationChannel;
  updatedAt: number;
}

const DEFAULTS: AppNotificationSettings = {
  enabled: true,
  channel: 'browser',
  updatedAt: 0,
};

function readLocal(): AppNotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

let cached: AppNotificationSettings = readLocal();
function writeLocal(settings: AppNotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getAppNotificationSettings(): AppNotificationSettings {
  return cached;
}

export function areNotificationsEnabled(): boolean {
  return cached.enabled;
}

export async function fetchAppSettings(): Promise<AppNotificationSettings> {
  cached = readLocal();

  if (!isPublishedVersion()) return cached;

  try {
    const { data, error } = await supabase.functions.invoke(`${FN}/app-settings`, {
      method: 'GET',
    });
    if (!error && data?.ok && data.data) {
      cached = { ...DEFAULTS, ...data.data };
      writeLocal(cached);
    }
  } catch {
    // Keep local cache on fetch failure
  }

  return cached;
}

export async function saveAppSettings(
  settings: AppNotificationSettings,
): Promise<AppNotificationSettings> {
  const next: AppNotificationSettings = {
    ...settings,
    updatedAt: Date.now(),
  };
  cached = next;
  writeLocal(next);

  if (isPublishedVersion()) {
    try {
      await supabase.functions.invoke(`${FN}/app-settings`, {
        method: 'POST',
        body: next,
      });
    } catch {
      // Local save succeeded; cloud sync is best-effort
    }
  }

  return next;
}
