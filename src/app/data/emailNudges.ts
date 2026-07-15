// ──────────────────────────────────────────────
// Client email nudge requests (fire-and-forget)
// ──────────────────────────────────────────────

import { supabase } from '/utils/supabase/client';
import { getEmailSettings } from './emailSettings';
import { getProfileEmail } from './profileContact';

const FN = 'make-server-5d90ddf5';

export type EmailNudgeType =
  | 'welcome'
  | 'smart_nudge'
  | 'task_completion'
  | 'check_in_confirmation'
  | 'task_created'
  | 'goal_updated'
  | 'profile_archived';

export interface EmailSendPayload {
  profileId: string;
  type: EmailNudgeType;
  tag?: string;
  taskId?: string;
  date?: string;
  recipient?: string;
  profileName?: string;
  title?: string;
  body?: string;
  taskLabel?: string;
  pendingCount?: number;
  streak?: number;
  topTasks?: Array<{ label: string; goalTitle?: string }>;
  force?: boolean;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Fire-and-forget email for ONE profile. Always attaches that profile's saved email
 * so the server never falls back to a shared test inbox.
 */
export function requestEmailSend(payload: EmailSendPayload): void {
  const settings = getEmailSettings();
  if (!settings.enabled && !payload.force) return;

  const recipient = (payload.recipient?.trim() || getProfileEmail(payload.profileId) || '').trim();

  const body = {
    ...payload,
    date: payload.date ?? todayKey(),
    recipient: recipient || undefined,
  };

  // Do not send if we have no address for this profile — avoids silent mis-routing.
  if (!body.recipient) {
    console.warn('[EmailNudges] Skip send: no email for profile', payload.profileId);
    return;
  }

  supabase.functions.invoke(`${FN}/send-email`, {
    method: 'POST',
    body,
  }).then(({ data, error }) => {
    if (error) console.warn('[EmailNudges] Send failed:', error);
    else if (data && !data.ok && !data.skipped) console.warn('[EmailNudges] Send rejected:', data.reason);
  }).catch(err => {
    console.warn('[EmailNudges] Request error:', err);
  });
}
