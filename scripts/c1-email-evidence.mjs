/**
 * C1 / WP-01 read-only production email evidence (no settings mutation).
 * Run: node scripts/c1-email-evidence.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = 'lhbvzojmtvjeauqnnmdu';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYnZ6b2ptdHZqZWF1cW5ubWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk3OTYsImV4cCI6MjA5NDY3NTc5Nn0.ZRNFRD6I2E03nmP3N8ScDQig5SeVsSbliyyw-XjkEXI';
const BASE = `https://${PROJECT}.supabase.co/functions/v1/make-server-5d90ddf5`;

function loadCronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET.trim();
  try {
    const raw = readFileSync(join(__dirname, '../supabase/.secrets.env'), 'utf8');
    const line = raw.split('\n').find((l) => l.startsWith('CRON_SECRET='));
    if (line) return line.replace('CRON_SECRET=', '').trim();
  } catch { /* ignore */ }
  return '';
}

const CRON_SECRET = loadCronSecret();
const headers = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

async function invoke(path, opts = {}) {
  const h = opts.cron
    ? { Authorization: `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' }
    : headers;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: h,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  return { status: res.status, data };
}

function redactEmail(e) {
  if (!e || typeof e !== 'string') return e;
  const [u, d] = e.split('@');
  return `${(u?.slice(0, 2) ?? '')}***@${d ?? 'redacted'}`;
}

const out = { timestamp: new Date().toISOString(), checks: {} };

const health = await invoke('/health');
out.checks.health = { status: health.status, ok: health.data?.status === 'ok' };

const es = await invoke('/email-settings');
const s = es.data?.data ?? {};
out.checks.emailSettings = {
  status: es.status,
  enabled: s.enabled,
  smartNudgeEnabled: s.smartNudgeEnabled,
  triggerMode: s.triggerMode,
  fromName: s.fromName,
  testRecipientSet: !!(s.testRecipient?.trim()),
  profileEmailCount: Object.keys(s.profileEmails ?? {}).length,
  profileIds: Object.keys(s.profileEmails ?? {}),
  smartSlots: s.smartSlots,
  updatedAt: s.updatedAt,
};

const unauth = await invoke('/run-daily-email-nudges', { method: 'POST', body: {}, cron: false });
out.checks.cronUnauth = { status: unauth.status, reason: unauth.data?.reason };

const wrongRes = await fetch(`${BASE}/run-daily-email-nudges`, {
  method: 'POST',
  headers: { Authorization: 'Bearer wrong-secret-diagnostic', 'Content-Type': 'application/json' },
  body: '{}',
});
const wrongData = await wrongRes.json().catch(() => ({}));
out.checks.cronWrongSecret = { status: wrongRes.status, reason: wrongData?.reason };

const cron = await invoke('/run-daily-email-nudges', { method: 'POST', body: {}, cron: true });
out.checks.cronAuth = {
  status: cron.status,
  ok: cron.data?.ok,
  processed: cron.data?.processed,
  sent: cron.data?.sent,
  skipped: cron.data?.skipped,
  detailCount: (cron.data?.details ?? []).length,
  details: cron.data?.details ?? [],
  globalDisabled: (cron.data?.details ?? []).some((d) => d.status === 'global_disabled'),
};

const profileIds = ['favio', 'kyle', 'john', ...Object.keys(s.profileEmails ?? {})];
const uniqueIds = [...new Set(profileIds)];
out.checks.backups = {};
for (const id of uniqueIds) {
  const b = await invoke(`/backup/${id}`);
  const d = b.data?.data;
  if (!d) {
    out.checks.backups[id] = { exists: false };
    continue;
  }
  out.checks.backups[id] = {
    exists: true,
    savedAt: d.savedAt,
    profileEmailSet: !!(d.profileEmail?.trim()),
    profileEmailRedacted: d.profileEmail ? redactEmail(d.profileEmail) : null,
    tzOffset: d.tzOffset,
    alertPrefs: d.alertPrefs,
    nudgeSnapshot: d.nudgeSnapshot
      ? {
          dateKey: d.nudgeSnapshot.dateKey,
          pending: d.nudgeSnapshot.pending,
          done: d.nudgeSnapshot.done,
          streak: d.nudgeSnapshot.streak,
          checkedIn: d.nudgeSnapshot.checkedIn,
          topTasksCount: d.nudgeSnapshot.topTasks?.length ?? 0,
          updatedAt: d.nudgeSnapshot.updatedAt,
        }
      : null,
  };
}

out.checks.localCronSecretPresent = !!CRON_SECRET;
out.checks.localCronSecretLength = CRON_SECRET ? CRON_SECRET.length : 0;

console.log(JSON.stringify(out, null, 2));
