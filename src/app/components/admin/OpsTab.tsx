import { useEffect, useState } from 'react';
import { Button, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { C } from '../../data/colors';
import { getActiveProfiles, isProfileArchived } from '../../data/profiles';
import {
  fetchProfileBackupForAdmin,
  getProfileSyncStatus,
  type ProfileSyncStatus,
} from '../../data/cloudBackup';
import {
  DATA_SOURCE_OF_TRUTH,
  formatSyncDirection,
  summarizeBackupQualification,
} from '../../data/adminOps';
import {
  fetchCronAttemptLog,
  fetchCronLastRun,
  fetchEmailSettings,
  type CronAttemptLogEntry,
  type CronLastRun,
} from '../../data/emailSettings';
import { isPublishedVersion } from '../../data/environment';

const card: React.CSSProperties = {
  background: C.bgCard,
  border: `1.5px solid ${C.border}`,
  borderRadius: 16,
  padding: '16px 18px',
  marginBottom: 14,
  boxShadow: C.shadow,
};

const labelStyle = { color: C.secondary, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 };

function SyncStatusCard({ status }: { status: ProfileSyncStatus }) {
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.headline, marginBottom: 6 }}>
        Sync status
      </div>
      <div style={{ fontSize: 11, color: C.body, lineHeight: 1.5 }}>
        Cloud backup: {status.hasCloudBackup ? 'yes' : 'none'}
        <br />
        Local saved: {status.localSavedAt ? new Date(status.localSavedAt).toLocaleString() : 'never'}
        <br />
        Cloud saved: {status.cloudSavedAt ? new Date(status.cloudSavedAt).toLocaleString() : '—'}
        <br />
        {formatSyncDirection(status.lastSyncDirection)}
      </div>
    </div>
  );
}

export function OpsTab() {
  const profiles = getActiveProfiles(true);
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [backup, setBackup] = useState<Record<string, unknown> | null>(null);
  const [syncStatus, setSyncStatus] = useState<ProfileSyncStatus | null>(null);
  const [attempts, setAttempts] = useState<CronAttemptLogEntry[]>([]);
  const [cronLastRun, setCronLastRun] = useState<CronLastRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [adminProfileEmails, setAdminProfileEmails] = useState<Record<string, string>>({});

  const load = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const [b, s, a, c, emailSettings] = await Promise.all([
        fetchProfileBackupForAdmin(profileId),
        getProfileSyncStatus(profileId),
        isPublishedVersion() ? fetchCronAttemptLog(profileId) : Promise.resolve([]),
        isPublishedVersion() ? fetchCronLastRun() : Promise.resolve(null),
        fetchEmailSettings().catch(() => null),
      ]);
      setBackup(b);
      setSyncStatus(s);
      setAttempts(a);
      setCronLastRun(c);
      setAdminProfileEmails(emailSettings?.profileEmails ?? {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profileId]);

  const qual = summarizeBackupQualification(backup, { profileId, adminProfileEmails });
  const emailSourceLabel = qual.emailSource === 'profile'
    ? 'profile backup (user)'
    : qual.emailSource === 'admin'
      ? 'admin settings'
      : 'none';
  const cronStale = cronLastRun?.ranAt
    ? Date.now() - cronLastRun.ranAt > 2 * 60 * 60 * 1000
    : false;

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <p style={labelStyle}>Data source of truth</p>
      <div style={card}>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: C.secondary, textAlign: 'left' }}>
              <th style={{ padding: '4px 6px' }}>Data</th>
              <th style={{ padding: '4px 6px' }}>Store</th>
              <th style={{ padding: '4px 6px' }}>Module</th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCE_OF_TRUTH.map(row => (
              <tr key={row.data} style={{ color: C.body, borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '6px' }}>{row.data}</td>
                <td style={{ padding: '6px' }}>{row.store}</td>
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 10 }}>{row.module}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 }}>
        <p style={{ ...labelStyle, margin: 0 }}>Profile diagnostics</p>
        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
          Refresh
        </Button>
      </div>

      <Select
        value={profileId}
        onChange={setProfileId}
        style={{ width: '100%', marginBottom: 12 }}
        options={profiles.map(p => ({
          value: p.id,
          label: `${p.name}${isProfileArchived(p.id) ? ' (archived)' : ''}`,
        }))}
      />

      {syncStatus && <SyncStatusCard status={syncStatus} />}

      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 14, color: C.headline, marginBottom: 8 }}>
          Email qualification (from KV backup)
        </div>
        <div style={{ fontSize: 12, color: C.body, lineHeight: 1.6 }}>
          Email: {qual.emailMasked} {qual.hasEmail ? '' : '(missing — cron will skip)'}
          <br />
          Email source: {emailSourceLabel}
          <br />
          User email enabled: {qual.emailEnabled ? 'yes' : 'no'}
          <br />
          Archived: {qual.archived ? 'yes — cron skips' : 'no'}
          <br />
          Snapshot date: {qual.snapshotDate} · Pending: {qual.pending}
          <br />
          Backup saved: {qual.savedAt}
        </div>
        <button
          type="button"
          onClick={() => setInspectorOpen(v => !v)}
          style={{
            marginTop: 10, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.bgAlt, fontSize: 12, cursor: 'pointer', color: C.primary,
          }}
        >
          {inspectorOpen ? 'Hide backup JSON' : 'Show backup inspector'}
        </button>
        {inspectorOpen && (
          <pre style={{
            marginTop: 10, maxHeight: 200, overflow: 'auto', fontSize: 10,
            background: C.bgAlt, padding: 10, borderRadius: 8, color: C.body,
          }}>
            {backup ? JSON.stringify(backup, null, 2) : 'No cloud backup found'}
          </pre>
        )}
      </div>

      {isPublishedVersion() && (
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.headline, marginBottom: 8 }}>
            Cron attempt log (this profile, 7 days)
          </div>
          {cronLastRun && (
            <div style={{ fontSize: 11, color: C.body, marginBottom: 8, lineHeight: 1.5 }}>
              Last cron: {cronLastRun.ranAt ? new Date(cronLastRun.ranAt).toLocaleString() : 'unknown'}
              {' · '}Sent {cronLastRun.sent ?? 0} / Skipped {cronLastRun.skipped ?? 0}
              {cronStale && (
                <span style={{ color: C.streak, fontWeight: 600 }}> · Stale (&gt;2h ago)</span>
              )}
            </div>
          )}
          {attempts.length === 0 ? (
            <div style={{ fontSize: 12, color: C.secondary }}>No attempts logged for this profile yet.</div>
          ) : (
            <div style={{ maxHeight: 180, overflow: 'auto', fontSize: 11, fontFamily: 'monospace' }}>
              {attempts.slice().reverse().map((a, i) => (
                <div key={`${a.attemptAt}-${i}`} style={{ padding: '3px 0', color: C.body, borderBottom: `1px solid ${C.border}` }}>
                  {new Date(a.attemptAt).toLocaleString()} · {a.tag} · {a.status}
                  {a.skipReason ? ` (${a.skipReason})` : ''}
                  {a.resendId ? ` · ${a.resendId}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
