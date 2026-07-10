// ──────────────────────────────────────────────
// Global Email Notification Settings
// ──────────────────────────────────────────────

import { supabase } from '/utils/supabase/client';
import { getStorageKey, isPublishedVersion } from './environment';
import { getTodayKey } from './profiles';

const FN = 'make-server-5d90ddf5';
const STORAGE_KEY = getStorageKey('arbol-email-settings');

export type EmailTriggerMode = 'browser_aligned' | 'event_only' | 'manual';

export interface SmartSlotConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface SmartSlotsConfig {
  morning: SmartSlotConfig;
  midday: SmartSlotConfig;
  evening: SmartSlotConfig;
  streakRisk: SmartSlotConfig;
}

export const DEFAULT_SMART_SLOTS: SmartSlotsConfig = {
  morning: { enabled: true, hour: 8, minute: 0 },
  midday: { enabled: true, hour: 13, minute: 0 },
  evening: { enabled: true, hour: 19, minute: 30 },
  streakRisk: { enabled: true, hour: 20, minute: 0 },
};

export interface EmailSettings {
  enabled: boolean;
  welcomeEnabled: boolean;
  smartNudgeEnabled: boolean;
  taskCompletionEnabled: boolean;
  checkInConfirmationEnabled: boolean;
  taskCreatedEnabled: boolean;
  goalUpdatedEnabled: boolean;
  profileArchivedEnabled: boolean;
  triggerMode: EmailTriggerMode;
  smartSlots: SmartSlotsConfig;
  fromName: string;
  replyTo: string;
  testRecipient: string;
  profileEmails: Record<string, string>;
  updatedAt: number;
}

const DEFAULTS: EmailSettings = {
  enabled: false,
  welcomeEnabled: true,
  smartNudgeEnabled: true,
  taskCompletionEnabled: false,
  checkInConfirmationEnabled: true,
  taskCreatedEnabled: false,
  goalUpdatedEnabled: false,
  profileArchivedEnabled: false,
  triggerMode: 'browser_aligned',
  smartSlots: { ...DEFAULT_SMART_SLOTS },
  fromName: 'Arbol Momentum',
  replyTo: '',
  testRecipient: '',
  profileEmails: {},
  updatedAt: 0,
};

function readLocal(): EmailSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = { ...DEFAULTS, ...JSON.parse(raw) };
    parsed.smartSlots = { ...DEFAULT_SMART_SLOTS, ...(parsed.smartSlots ?? {}) };
    for (const key of Object.keys(DEFAULT_SMART_SLOTS) as (keyof SmartSlotsConfig)[]) {
      parsed.smartSlots[key] = { ...DEFAULT_SMART_SLOTS[key], ...(parsed.smartSlots[key] ?? {}) };
    }
    return parsed;
  } catch {
    return { ...DEFAULTS };
  }
}

let cached: EmailSettings = readLocal();

function writeLocal(settings: EmailSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getEmailSettings(): EmailSettings {
  return cached;
}

export function isEmailEnabled(): boolean {
  return cached.enabled;
}

export function isEmailTypeEnabled(type: keyof Pick<
  EmailSettings,
  'welcomeEnabled' | 'smartNudgeEnabled' | 'taskCompletionEnabled' | 'checkInConfirmationEnabled'
  | 'taskCreatedEnabled' | 'goalUpdatedEnabled' | 'profileArchivedEnabled'
>): boolean {
  if (!cached.enabled) return false;
  return cached[type];
}

export async function fetchEmailSettings(): Promise<EmailSettings> {
  cached = readLocal();

  if (!isPublishedVersion()) return cached;

  try {
    const { data, error } = await supabase.functions.invoke(`${FN}/email-settings`, {
      method: 'GET',
    });
    if (!error && data?.ok && data.data) {
      const merged = { ...DEFAULTS, ...data.data };
      merged.smartSlots = { ...DEFAULT_SMART_SLOTS, ...(merged.smartSlots ?? {}) };
      for (const key of Object.keys(DEFAULT_SMART_SLOTS) as (keyof SmartSlotsConfig)[]) {
        merged.smartSlots[key] = { ...DEFAULT_SMART_SLOTS[key], ...(merged.smartSlots[key] ?? {}) };
      }
      cached = merged;
      writeLocal(cached);
    }
  } catch {
    // Keep local cache on fetch failure
  }

  return cached;
}

export async function saveEmailSettings(settings: EmailSettings): Promise<EmailSettings> {
  const next: EmailSettings = {
    ...settings,
    smartSlots: { ...DEFAULT_SMART_SLOTS, ...(settings.smartSlots ?? {}) },
    updatedAt: Date.now(),
  };
  for (const key of Object.keys(DEFAULT_SMART_SLOTS) as (keyof SmartSlotsConfig)[]) {
    next.smartSlots[key] = { ...DEFAULT_SMART_SLOTS[key], ...(next.smartSlots[key] ?? {}) };
  }
  cached = next;
  writeLocal(next);

  if (isPublishedVersion()) {
    try {
      await supabase.functions.invoke(`${FN}/email-settings`, {
        method: 'POST',
        body: next,
      });
    } catch {
      // Local save succeeded; cloud sync is best-effort
    }
  }

  return next;
}

export async function sendTestEmail(recipient?: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(`${FN}/send-test-email`, {
      method: 'POST',
      body: recipient ? { recipient } : {},
    });
    if (error) return { ok: false, reason: String(error) };
    return data ?? { ok: false, reason: 'unknown' };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export async function sendManualNudge(opts: {
  profileId: string;
  type: 'smart_nudge' | 'welcome' | 'check_in_confirmation';
  profileName?: string;
  tag?: string;
  title?: string;
  body?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(`${FN}/send-email`, {
      method: 'POST',
      body: {
        ...opts,
        force: true,
        date: getTodayKey(),
      },
    });
    if (error) return { ok: false, reason: String(error) };
    return data ?? { ok: false, reason: 'unknown' };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}
