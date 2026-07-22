// ──────────────────────────────────────────────
// Global Email Notification Settings
// ──────────────────────────────────────────────

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getStorageKey, isPublishedVersion } from './environment';
import { getTodayKey } from './profiles';

const FN = 'make-server-5d90ddf5';
const FN_BASE = `https://${projectId}.supabase.co/functions/v1`;
const STORAGE_KEY = getStorageKey('arbol-email-settings');

/** Avoid apikey header - CORS preflight breaks browser POSTs to edge. */
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
    if (error) return { ok: false, reason: error || 'Could not reach email service.' };
    if (data?.ok) return { ok: true };
    const reason = data?.reason === 'no_test_recipient'
      ? 'Set a test recipient email above, then try again.'
      : typeof data?.reason === 'string' && data.reason.startsWith('send_failed')
        ? formatResendFailure(data.reason)
        : data?.reason || data?.error || 'unknown';
    return { ok: false, reason };
  } catch {
    return { ok: false, reason: 'Could not send test email.' };
  }
}

function formatResendFailure(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes('only send testing') || lower.includes('onboarding@resend') || lower.includes('verify a domain')) {
    return 'Resend is still in sandbox mode. Verify a sending domain and set EMAIL_FROM_ADDRESS, or emails only deliver to the Resend account owner.';
  }
  return `Email provider error: ${reason}`;
}

/** Send a test email to this profile's saved address (Alerts & Reminders). */
export async function sendProfileTestEmail(
  profileId: string,
  recipient: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await edgeFetch(`${FN}/send-email`, {
      method: 'POST',
      body: {
        profileId,
        type: 'test',
        recipient: recipient.trim(),
        force: true,
      },
    });
    if (error) return { ok: false, reason: error || 'Could not reach email service.' };
    if (data?.ok) return { ok: true };
    if (data?.reason === 'no_valid_recipient') {
      return { ok: false, reason: 'Add your email on Profile first, then try again.' };
    }
    if (typeof data?.reason === 'string' && data.reason.startsWith('send_failed')) {
      return { ok: false, reason: formatResendFailure(data.reason) };
    }
    return { ok: false, reason: data?.reason || data?.error || 'unknown' };
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
  pendingCount?: number;
  streak?: number;
  topTasks?: Array<{ label: string; goalTitle?: string }>;
  /** Comma/semicolon-separated or array - wins over server profile lookup */
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
        pendingCount: opts.pendingCount,
        streak: opts.streak,
        topTasks: opts.topTasks,
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
        : data?.reason === 'global_disabled' || data?.reason === 'type_or_global_disabled'
          ? 'Email or this nudge type is turned off - try again after enabling, or use Send nudge now (force may still apply after redeploy).'
          : data?.reason === 'no_test_recipient'
            ? 'Set a test recipient email first.'
            : typeof data?.reason === 'string' && data.reason.startsWith('send_failed')
              ? formatResendFailure(data.reason.replace(/^send_failed:?/, '') || data.reason)
              : data?.reason
                ? `Send failed (${data.reason}).`
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

/**
 * Admin: resend the account invite (welcome email with a fresh deep-link token).
 * Always forced so it works even if welcome was already sent once.
 */
export async function resendAccountInvite(opts: {
  profileId: string;
  profileName?: string;
  recipient?: string;
  recipients?: string[];
}): Promise<{ ok: boolean; reason?: string; sentTo?: string[] }> {
  return sendManualNudge({
    profileId: opts.profileId,
    type: 'welcome',
    profileName: opts.profileName,
    recipient: opts.recipient,
    recipients: opts.recipients,
    title: 'Account invite',
    body: 'Your invite to Arbol Momentum was resent. Use the button in the email to open your account.',
  });
}
