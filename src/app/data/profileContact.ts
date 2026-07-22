// ──────────────────────────────────────────────
// Profile contact email (localStorage + backup)
// ──────────────────────────────────────────────

import { getStorageKey } from './environment';
import { scheduleSave, saveToCloud } from './cloudBackup';
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

export function isValidProfileEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function saveProfileEmail(
  profileId: string,
  email: string,
  opts?: { profileName?: string; sendWelcome?: boolean; forceWelcome?: boolean },
): { ok: boolean; error?: string } {
  const trimmed = email.trim();
  if (trimmed && !isValidProfileEmail(trimmed)) {
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
  void saveToCloud(profileId);

  if (trimmed && !hadEmail && opts?.sendWelcome !== false) {
    const force = opts?.forceWelcome === true;
    if (force || isEmailTypeEnabled('welcomeEnabled')) {
      requestEmailSend({
        profileId,
        type: 'welcome',
        recipient: trimmed,
        profileName: opts?.profileName,
        force,
      });
    }
  }

  return { ok: true };
}
