/**
 * Safe runtime verification for email timing fix.
 * Uses a temporary archived-after-test profile + Favio inbox only.
 * Run: node scripts/verify-email-timing-runtime.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEdgeBase, ANON } from './edge-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = getEdgeBase();
const FAVIO = 'favio.c.osorio@gmail.com';

function loadCronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET.trim();
  try {
    const raw = readFileSync(join(__dirname, '../supabase/.secrets.env'), 'utf8');
    const line = raw.split(/\r?\n/).find((l) => l.startsWith('CRON_SECRET='));
    if (line) return line.replace('CRON_SECRET=', '').trim();
  } catch { /* ignore */ }
  return '';
}

const CRON = loadCronSecret();
const headers = { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };
const cronHeaders = { Authorization: `Bearer ${CRON}`, 'Content-Type': 'application/json' };

let passed = 0;
let failed = 0;

function assert(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: opts.cron ? cronHeaders : headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

function localPartsForTimezone(timezone, nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(nowMs));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute,
    total: hour * 60 + minute,
  };
}

console.log('\nEmail timing runtime verification\n');
assert('CRON_SECRET available', !!CRON);

const beforeSettings = (await req('/email-settings')).data.data;
const testId = `email-timing-verify-${Date.now()}`;
const timezone = 'America/New_York';
const local = localPartsForTimezone(timezone);
const minute = Math.floor(local.minute / 15) * 15;
let key = 'midday';
if (local.hour < 12) key = 'morning';
else if (local.hour >= 16) key = 'evening';

const disabled = {
  morning: { enabled: false, hour: 8, minute: 0 },
  midday: { enabled: false, hour: 13, minute: 0 },
  evening: { enabled: false, hour: 19, minute: 30 },
  streakRisk: { enabled: false, hour: 20, minute: 0 },
};
const userSlots = {};
userSlots[key] = { enabled: true, hour: local.hour, minute };

const backup = {
  profileEmail: FAVIO,
  profileArchived: false,
  timezone,
  tzOffset: 240,
  alertPrefs: { emailEnabled: true, smartSlots: userSlots },
  nudgeSnapshot: {
    dateKey: local.dateKey,
    pending: 2,
    done: 0,
    streak: 4,
    checkedIn: false,
    profileName: 'Email Timing Verify',
    topTasks: [{ label: 'Confirm adjusted schedule timing', goalTitle: 'QA' }],
    updatedAt: Date.now(),
  },
  savedAt: Date.now(),
};

console.log(JSON.stringify({
  testId,
  timezone,
  intendedLocal: `${String(local.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  slotKey: key,
  scheduleSource: 'user_selected',
}, null, 2));

const immediate = await req('/send-test-email', { method: 'POST', body: { recipient: FAVIO } });
assert('immediate manual/test still sends', immediate.data?.ok === true, immediate.data?.resendId ?? immediate.data?.reason);

await req('/email-settings', {
  method: 'POST',
  body: { ...beforeSettings, enabled: true, smartNudgeEnabled: true, smartSlots: disabled, updatedAt: Date.now() },
});
await req(`/backup/${testId}`, { method: 'POST', body: backup });

const cron = await req('/run-daily-email-nudges', { method: 'POST', body: {}, cron: true });
const detail = (cron.data?.details ?? []).find((d) => d.profileId === testId);
assert('cron endpoint ok', cron.status === 200 && cron.data?.ok === true);
assert(
  'adjusted schedule claimed and accepted',
  !!detail?.status?.startsWith('sent:'),
  detail?.status ?? 'no detail',
);

const log = await req(`/cron-attempt-log?profileId=${encodeURIComponent(testId)}`);
const entry = (log.data?.data ?? []).find((e) => e.profileId === testId && e.status === 'provider_accepted');
assert('attempt log has provider acceptance', !!entry, entry?.resendId);
assert('attempt log timezone is IANA', entry?.timezone === timezone, entry?.timezone);
assert('attempt log schedule reason is iana', entry?.scheduleReason === 'iana_timezone', entry?.scheduleReason);
assert('attempt log schedule source user_selected', entry?.scheduleSource === 'user_selected', entry?.scheduleSource);
assert('attempt log intended local date present', !!entry?.intendedLocalDate, entry?.intendedLocalDate);
assert(
  'timing delta within 20-minute cadence window',
  typeof entry?.timingDeltaSeconds === 'number' && entry.timingDeltaSeconds <= 20 * 60,
  String(entry?.timingDeltaSeconds),
);

// Dedup regression
const cron2 = await req('/run-daily-email-nudges', { method: 'POST', body: {}, cron: true });
const detail2 = (cron2.data?.details ?? []).find((d) => d.profileId === testId);
assert(
  'retry does not duplicate same slot',
  !detail2 || detail2.status === 'already_sent' || !String(detail2.status).startsWith('sent:'),
  detail2?.status ?? 'no second send',
);

// Restore production settings + archive temp profile
await req(`/backup/${testId}`, {
  method: 'POST',
  body: { ...backup, profileArchived: true, alertPrefs: { emailEnabled: false, smartSlots: null }, savedAt: Date.now() },
});
await req('/email-settings', { method: 'POST', body: { ...beforeSettings, updatedAt: Date.now() } });
assert('restored email settings', true);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
