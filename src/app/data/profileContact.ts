// ──────────────────────────────────────────────
// Profile contact email (localStorage + backup)
// ──────────────────────────────────────────────

import { getStorageKey } from './environment';
import { scheduleSave } from './cloudBackup';
import { requestEmailSend } from './emailNudges';
import { isEmailTypeEnabled } from './emailSettings';

function storageKey(profileId: string): string {
  return getStorageKey(`arbol-email-${profileId}`);
}

export function getProfileEmail(profileId: string): string {
  try {
    return localStorage.getItem(storageKey(profileId))?.trim() ?? '';
  } catch {
    return '';
  }
}

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function saveProfileEmail(
  profileId: string,
  email: string,
  opts?: { profileName?: string; sendWelcome?: boolean },
): { ok: boolean; error?: string } {
  const trimmed = email.trim();
  if (trimmed && !isValidEmail(trimmed)) {
    return { ok: false, error: 'Enter a valid email address' };
  }

  const hadEmail = !!getProfileEmail(profileId);
  const key = storageKey(profileId);

  if (trimmed) {
    localStorage.setItem(key, trimmed);
  } else {
    localStorage.removeItem(key);
  }

  scheduleSave(profileId);

  if (trimmed && !hadEmail && opts?.sendWelcome !== false && isEmailTypeEnabled('welcomeEnabled')) {
    requestEmailSend({
      profileId,
      type: 'welcome',
      recipient: trimmed,
      profileName: opts?.profileName,
    });
  }

  return { ok: true };
}
