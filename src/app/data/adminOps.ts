// Admin operational diagnostics (WP-16)

export const DATA_SOURCE_OF_TRUTH = [
  { data: 'Task completions & deletions', store: 'Supabase analytics tables', module: 'supabaseSync.ts' },
  { data: 'Profile backup (email, snapshot, prefs, archive)', store: 'Supabase KV per profile', module: 'cloudBackup.ts' },
  { data: 'Global email settings & cron', store: 'Supabase KV', module: 'emailSettings.ts' },
  { data: 'Browser notification prefs', store: 'localStorage + KV', module: 'appSettings.ts' },
  { data: 'Live check-in toggles', store: 'localStorage + KV', module: 'liveCheckInSettings.ts' },
  { data: 'Profile archive list', store: 'localStorage + profile backup field', module: 'profiles.ts' },
] as const;

export function maskEmail(email: string | null | undefined): string {
  if (!email?.trim()) return '-';
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(at)}`;
}

export function formatSyncDirection(direction: string): string {
  switch (direction) {
    case 'local_newer': return 'Local newer - push pending';
    case 'cloud_newer': return 'Cloud newer - pull may apply';
    case 'in_sync': return 'In sync';
    default: return 'Unknown';
  }
}

export type EmailRecipientSource = 'profile' | 'admin' | 'none';

export function resolveEmailRecipientSource(
  profileId: string,
  backup: Record<string, unknown> | null,
  adminProfileEmails: Record<string, string> = {},
): EmailRecipientSource {
  const backupEmail = typeof backup?.profileEmail === 'string' ? backup.profileEmail.trim() : '';
  if (backupEmail && backupEmail.includes('@')) return 'profile';
  const adminEmail = adminProfileEmails[profileId]?.trim() ?? '';
  if (adminEmail && adminEmail.includes('@')) return 'admin';
  return 'none';
}

export function summarizeBackupQualification(
  backup: Record<string, unknown> | null,
  opts?: { profileId?: string; adminProfileEmails?: Record<string, string> },
): {
  hasEmail: boolean;
  emailMasked: string;
  emailSource: EmailRecipientSource;
  emailEnabled: boolean;
  archived: boolean;
  snapshotDate: string;
  pending: number;
  savedAt: string;
} {
  if (!backup) {
    const adminOnly = opts?.profileId && opts?.adminProfileEmails?.[opts.profileId];
    return {
      hasEmail: !!adminOnly,
      emailMasked: maskEmail(adminOnly),
      emailSource: adminOnly ? 'admin' : 'none',
      emailEnabled: true,
      archived: false,
      snapshotDate: '-',
      pending: 0,
      savedAt: '-',
    };
  }
  const email = typeof backup.profileEmail === 'string' ? backup.profileEmail : '';
  const prefs = backup.alertPrefs as { emailEnabled?: boolean } | null;
  const snap = backup.nudgeSnapshot as { dateKey?: string; pending?: number } | null;
  const savedAt = typeof backup.savedAt === 'number'
    ? new Date(backup.savedAt).toLocaleString()
    : '-';
  const emailSource = opts?.profileId
    ? resolveEmailRecipientSource(opts.profileId, backup, opts.adminProfileEmails ?? {})
    : (email.trim() ? 'profile' : 'none');
  const adminFallback = opts?.adminProfileEmails?.[opts.profileId ?? ''] ?? '';
  const effectiveEmail = email.trim() || adminFallback.trim();
  return {
    hasEmail: !!effectiveEmail,
    emailMasked: maskEmail(effectiveEmail),
    emailSource,
    emailEnabled: prefs?.emailEnabled !== false,
    archived: backup.profileArchived === true,
    snapshotDate: snap?.dateKey ?? '-',
    pending: snap?.pending ?? 0,
    savedAt,
  };
}
