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
  if (!email?.trim()) return '—';
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(at)}`;
}

export function formatSyncDirection(direction: string): string {
  switch (direction) {
    case 'local_newer': return 'Local newer — push pending';
    case 'cloud_newer': return 'Cloud newer — pull may apply';
    case 'in_sync': return 'In sync';
    default: return 'Unknown';
  }
}

export function summarizeBackupQualification(backup: Record<string, unknown> | null): {
  hasEmail: boolean;
  emailMasked: string;
  emailEnabled: boolean;
  archived: boolean;
  snapshotDate: string;
  pending: number;
  savedAt: string;
} {
  if (!backup) {
    return {
      hasEmail: false,
      emailMasked: '—',
      emailEnabled: true,
      archived: false,
      snapshotDate: '—',
      pending: 0,
      savedAt: '—',
    };
  }
  const email = typeof backup.profileEmail === 'string' ? backup.profileEmail : '';
  const prefs = backup.alertPrefs as { emailEnabled?: boolean } | null;
  const snap = backup.nudgeSnapshot as { dateKey?: string; pending?: number } | null;
  const savedAt = typeof backup.savedAt === 'number'
    ? new Date(backup.savedAt).toLocaleString()
    : '—';
  return {
    hasEmail: !!email.trim(),
    emailMasked: maskEmail(email),
    emailEnabled: prefs?.emailEnabled !== false,
    archived: backup.profileArchived === true,
    snapshotDate: snap?.dateKey ?? '—',
    pending: snap?.pending ?? 0,
    savedAt,
  };
}
