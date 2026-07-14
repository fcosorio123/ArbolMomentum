// ──────────────────────────────────────────────
// Global Email Notification Settings
// ──────────────────────────────────────────────

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getStorageKey, isPublishedVersion } from './environment';
import { getTodayKey } from './profiles';

const FN = 'make-server-5d90ddf5';
const FN_BASE = `https://${projectId}.supabase.co/functions/v1`;
const STORAGE_KEY = getStorageKey('arbol-email-settings');

/** Avoid apikey header — CORS preflight breaks browser POSTs to edge. */
async function edgeFetch(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<{ data: any; error: string | null }> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${publicAnonKey}`,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${FN_BASE}/${path.replace(/^\//, '')}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    let data: any = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) return { data, error: data?.error || data?.reason || `HTTP ${res.status}` };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

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
    const { data, error } = await edgeFetch(`${FN}/email-settings`, { method: 'GET' });
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
      await edgeFetch(`${FN}/email-settings`, { method: 'POST', body: next as unknown as Record<string, unknown> });
    } catch {
      // Local save succeeded; cloud sync is best-effort
    }
  }

  return next;
}

export async function sendTestEmail(recipient?: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await edgeFetch(`${FN}/send-test-email`, {
      method: 'POST',
      body: recipient ? { recipient } : {},
    });
    if (error) return { ok: false, reason: 'Could not reach email service.' };
    return data ?? { ok: false, reason: 'unknown' };
  } catch {
    return { ok: false, reason: 'Could not send test email.' };
  }
}

export interface CronLastRun {
  ranAt?: number;
  processed?: number;
  sent?: number;
  skipped?: number;
  details?: Array<{ profileId: string; tag: string; status: string }>;
}

export async function fetchCronLastRun(): Promise<CronLastRun | null> {
  if (!isPublishedVersion()) return null;
  try {
    const { data, error } = await edgeFetch(`${FN}/cron-last-run`, { method: 'GET' });
    if (!error && data?.ok && data.data) return data.data as CronLastRun;
  } catch {
    // ignore
  }
  return null;
}

export interface CronAttemptLogEntry {
  profileId: string;
  tag: string;
  recipient?: string;
  attemptAt: number;
  status: string;
  skipReason?: string;
  resendId?: string;
}

export async function fetchCronAttemptLog(profileId?: string): Promise<CronAttemptLogEntry[]> {
  if (!isPublishedVersion()) return [];
  try {
    const path = profileId
      ? `${FN}/cron-attempt-log?profileId=${encodeURIComponent(profileId)}`
      : `${FN}/cron-attempt-log`;
    const { data, error } = await edgeFetch(path, { method: 'GET' });
    if (!error && data?.ok && Array.isArray(data.data)) return data.data as CronAttemptLogEntry[];
  } catch {
    // ignore
  }
  return [];
}

export function isOperationalEmailLive(settings: EmailSettings): boolean {
  return settings.enabled && settings.smartNudgeEnabled;
}

export async function sendManualNudge(opts: {
  profileId: string;
  type: 'smart_nudge' | 'welcome' | 'check_in_confirmation';
  profileName?: string;
  tag?: string;
  title?: string;
  body?: string;
  /** Comma/semicolon-separated or array — wins over server profile lookup */
  recipient?: string;
  recipients?: string[];
}): Promise<{ ok: boolean; reason?: string; sentTo?: string[] }> {
  try {
    const recipientList = Array.isArray(opts.recipients)
      ? opts.recipients
      : (opts.recipient ?? '')
          .split(/[,;\s]+/)
          .map(e => e.trim())
          .filter(Boolean);

    const { data, error } = await edgeFetch(`${FN}/send-email`, {
      method: 'POST',
      body: {
        profileId: opts.profileId,
        type: opts.type,
        profileName: opts.profileName,
        tag: opts.tag,
        title: opts.title,
        body: opts.body,
        force: true,
        date: getTodayKey(),
        recipients: recipientList.length > 0 ? recipientList : undefined,
        recipient: recipientList[0],
      },
    });
    if (error) return { ok: false, reason: 'Could not reach email service. Try again.' };
    if (!data?.ok) {
      const reason = data?.reason === 'no_valid_recipient'
        ? 'No valid email on this profile. Enter an address and try again.'
        : data?.reason === 'global_disabled'
          ? 'Email sending is turned off in settings.'
          : 'Send failed. Check the address and try again.';
      console.warn('[Email] Manual nudge failed:', data?.reason);
      return { ok: false, reason };
    }
    return {
      ok: true,
      sentTo: Array.isArray(data.sentTo) ? data.sentTo : recipientList,
      reason: data.reason,
    };
  } catch (err) {
    console.warn('[Email] Manual nudge error:', err);
    return { ok: false, reason: 'Could not send. Check your connection and try again.' };
  }
}
