// ──────────────────────────────────────────────
// Client email nudge requests (fire-and-forget)
// ──────────────────────────────────────────────

import { supabase } from '/utils/supabase/client';
import { getEmailSettings } from './emailSettings';

const FN = 'make-server-5d90ddf5';

export type EmailNudgeType =
  | 'welcome'
  | 'smart_nudge'
  | 'task_completion'
  | 'check_in_confirmation';

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
  force?: boolean;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function requestEmailSend(payload: EmailSendPayload): void {
  const settings = getEmailSettings();
  if (!settings.enabled && !payload.force) return;

  const body = {
    ...payload,
    date: payload.date ?? todayKey(),
  };

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
