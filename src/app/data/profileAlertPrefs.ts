// ──────────────────────────────────────────────
// Per-profile alert preferences (inherits admin defaults)
// ──────────────────────────────────────────────

import { getStorageKey } from './environment';
import { scheduleSave } from './cloudBackup';
import {
  type SmartSlotsConfig,
  type SmartSlotConfig,
  DEFAULT_SMART_SLOTS,
  getEmailSettings,
} from './emailSettings';

export interface ProfileAlertPrefs {
  emailEnabled: boolean | null;
  smartSlots: Partial<SmartSlotsConfig> | null;
}

const DEFAULT_PREFS: ProfileAlertPrefs = {
  emailEnabled: null,
  smartSlots: null,
};

function storageKey(profileId: string): string {
  return getStorageKey(`arbol-alert-prefs-${profileId}`);
}

function mergeSlot(admin: SmartSlotConfig, user?: Partial<SmartSlotConfig>): SmartSlotConfig {
  if (!user) return { ...admin };
  return {
    enabled: user.enabled ?? admin.enabled,
    hour: user.hour ?? admin.hour,
    minute: user.minute ?? admin.minute,
  };
}

export function getProfileAlertPrefs(profileId: string): ProfileAlertPrefs {
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveProfileAlertPrefs(profileId: string, prefs: ProfileAlertPrefs): void {
  localStorage.setItem(storageKey(profileId), JSON.stringify(prefs));
  scheduleSave(profileId);
}

/** User email channel - default on unless explicitly disabled. */
export function isProfileEmailEnabled(profileId: string): boolean {
  const prefs = getProfileAlertPrefs(profileId);
  if (prefs.emailEnabled === false) return false;
  return true;
}

export function getEffectiveSmartSlots(profileId: string): SmartSlotsConfig {
  const admin = getEmailSettings().smartSlots ?? DEFAULT_SMART_SLOTS;
  const user = getProfileAlertPrefs(profileId).smartSlots ?? {};
  return {
    morning: mergeSlot(admin.morning, user.morning),
    midday: mergeSlot(admin.midday, user.midday),
    evening: mergeSlot(admin.evening, user.evening),
    streakRisk: mergeSlot(admin.streakRisk, user.streakRisk),
  };
}

export function toHtmlTimeValue(slot: SmartSlotConfig): string {
  return `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`;
}

/** 12-hour display (e.g. 8:00 AM) - avoid military time in the UI. */
export function formatSlotTime(slot: SmartSlotConfig): string {
  const h24 = slot.hour;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  const mm = String(slot.minute).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

export function formatHourMinute12(hour: number, minute: number): string {
  return formatSlotTime({ enabled: true, hour, minute });
}

/** Format stored "HH:MM" (24h) as 12-hour display e.g. "1:00 PM". */
export function formatTimeString12(time: string): string {
  const { hour, minute } = parseSlotTime(time);
  return formatHourMinute12(hour, minute);
}

export function parseSlotTime(time: string): Pick<SmartSlotConfig, 'hour' | 'minute'> {
  const [h, m] = time.split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
}
