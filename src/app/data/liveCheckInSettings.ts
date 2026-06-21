// ──────────────────────────────────────────────
// Live Check-In Feedback global settings
// ──────────────────────────────────────────────

import { supabase } from '/utils/supabase/client';
import { getStorageKey, isPublishedVersion } from './environment';

const FN = 'make-server-5d90ddf5';
const STORAGE_KEY = getStorageKey('arbol-live-check-in-settings');

export interface LiveCheckInSettings {
  enabled: boolean;
  voiceEnabled: boolean;
  updatedAt: number;
}

const DEFAULTS: LiveCheckInSettings = {
  enabled: true,
  voiceEnabled: true,
  updatedAt: 0,
};

function readLocal(): LiveCheckInSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

let cached: LiveCheckInSettings = readLocal();

function writeLocal(settings: LiveCheckInSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getLiveCheckInSettings(): LiveCheckInSettings {
  return cached;
}

export function isLiveCheckInEnabled(): boolean {
  return cached.enabled;
}

export function isVoicePlaybackEnabled(): boolean {
  return cached.enabled && cached.voiceEnabled;
}

export async function fetchLiveCheckInSettings(): Promise<LiveCheckInSettings> {
  cached = readLocal();

  if (!isPublishedVersion()) return cached;

  try {
    const { data, error } = await supabase.functions.invoke(`${FN}/live-check-in-settings`, {
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

export async function saveLiveCheckInSettings(
  settings: LiveCheckInSettings,
): Promise<LiveCheckInSettings> {
  const next: LiveCheckInSettings = {
    ...settings,
    updatedAt: Date.now(),
  };
  cached = next;
  writeLocal(next);

  if (isPublishedVersion()) {
    try {
      await supabase.functions.invoke(`${FN}/live-check-in-settings`, {
        method: 'POST',
        body: next,
      });
    } catch {
      // Local save succeeded; cloud sync is best-effort
    }
  }

  return next;
}
