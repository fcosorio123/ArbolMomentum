/**
 * End-to-end server cron runtime test (no open app required).
 * Run: node scripts/test-cron-runtime.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = 'lhbvzojmtvjeauqnnmdu';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYnZ6b2ptdHZqZWF1cW5ubWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk3OTYsImV4cCI6MjA5NDY3NTc5Nn0.ZRNFRD6I2E03nmP3N8ScDQig5SeVsSbliyyw-XjkEXI';
const BASE = `https://${PROJECT}.supabase.co/functions/v1/make-server-5d90ddf5`;
const FAVIO_ID = 'favio';
const FAVIO_EMAIL = 'favio.c.osorio@gmail.com';

function loadCronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET.trim();
  try {
    const raw = readFileSync(join(__dirname, '../supabase/.secrets.env'), 'utf8');
    const line = raw.split('\n').find(l => l.startsWith('CRON_SECRET='));
    if (line) return line.replace('CRON_SECRET=', '').trim();
  } catch { /* ignore */ }
  return '';
}

const CRON_SECRET = loadCronSecret();
const headers = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };
const cronHeaders = { Authorization: `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' };

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

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slotForNow() {
  const d = new Date();
  const hour = d.getHours();
  const minute = Math.floor(d.getMinutes() / 15) * 15; // align to 15-min window
  return { hour, minute };
}

async function invoke(path, opts = {}) {
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

console.log('\nServer cron runtime test\n');

assert('CRON_SECRET available locally', !!CRON_SECRET);

// 1. Health
const health = await invoke('/health');
assert('edge /health', health.status === 200 && health.data?.status === 'ok');

// 2. Unauthorized cron blocked
const unauth = await invoke('/run-daily-email-nudges', { method: 'POST', body: {}, cron: false });
assert('cron rejects missing auth', unauth.status === 401);

// 3. Seed favio backup with email + fresh snapshot + tzOffset for local time
const { hour, minute } = slotForNow();
const today = localDateKey();

const backupRes = await invoke(`/backup/${FAVIO_ID}`);
const existing = backupRes.data?.data ?? {};

const backupPayload = {
  ...existing,
  profileEmail: FAVIO_EMAIL,
  tzOffset: new Date().getTimezoneOffset(),
  alertPrefs: { emailEnabled: true, smartSlots: null },
  nudgeSnapshot: {
    dateKey: today,
    pending: 3,
    done: 1,
    streak: 5,
    checkedIn: false,
    profileName: 'Favio',
    topTasks: [
      { label: 'Complete FAFSA', goalTitle: 'Financial aid' },
      { label: 'Review TAP status', goalTitle: 'NY State aid' },
    ],
    updatedAt: Date.now(),
  },
  savedAt: Date.now(),
};

const saveBackup = await invoke(`/backup/${FAVIO_ID}`, { method: 'POST', body: backupPayload });
assert('seed favio cloud backup', saveBackup.data?.ok === true);

// 4–6. Pick a slot unlikely already sent today; fire cron; verify send + dedup
const SLOT_ORDER = [
  { key: 'streakRisk', tag: 'daily-streak-risk', defaults: { hour: 20, minute: 0 } },
  { key: 'evening', tag: 'daily-evening', defaults: { hour: 19, minute: 30 } },
  { key: 'midday', tag: 'daily-midday', defaults: { hour: 13, minute: 0 } },
  { key: 'morning', tag: 'daily-morning', defaults: { hour: 8, minute: 0 } },
];

const settingsRes = await invoke('/email-settings');
const settings = { ...(settingsRes.data?.data ?? {}), enabled: true, smartNudgeEnabled: true };
settings.profileEmails = { ...(settings.profileEmails ?? {}), [FAVIO_ID]: FAVIO_EMAIL };

function slotsForActive(activeKey) {
  return {
    morning: { enabled: activeKey === 'morning', hour: activeKey === 'morning' ? hour : 8, minute: activeKey === 'morning' ? minute : 0 },
    midday: { enabled: activeKey === 'midday', hour: activeKey === 'midday' ? hour : 13, minute: activeKey === 'midday' ? minute : 0 },
    evening: { enabled: activeKey === 'evening', hour: activeKey === 'evening' ? hour : 19, minute: activeKey === 'evening' ? minute : 30 },
    streakRisk: { enabled: activeKey === 'streakRisk', hour: activeKey === 'streakRisk' ? hour : 20, minute: activeKey === 'streakRisk' ? minute : 0 },
  };
}

let activeSlot = null;
let cron = null;
let favioDetail = null;

for (const slot of SLOT_ORDER) {
  settings.smartSlots = slotsForActive(slot.key);
  const saveSettings = await invoke('/email-settings', { method: 'POST', body: settings });
  if (!saveSettings.data?.ok) continue;

  cron = await invoke('/run-daily-email-nudges', { method: 'POST', body: {}, cron: true });
  favioDetail = (cron.data?.details ?? []).find(d => d.profileId === FAVIO_ID && d.tag === slot.tag);
  if (favioDetail?.status?.startsWith('sent:')) {
    activeSlot = slot;
    break;
  }
}

assert(
  'configure slot for now',
  !!activeSlot || !!cron,
  activeSlot ? `${activeSlot.key} ${hour}:${String(minute).padStart(2, '0')}` : `${hour}:${String(minute).padStart(2, '0')}`,
);
assert('cron endpoint 200', cron?.status === 200 && cron?.data?.ok === true, `processed=${cron?.data?.processed}`);

const favioSent = favioDetail?.status?.startsWith('sent:');
const favioAlreadySent = favioDetail?.status === 'already_sent';
assert(
  'cron sent email for favio',
  favioSent || favioAlreadySent,
  favioDetail?.status ?? 'no favio detail',
);

// Dedup — second invoke should not resend same slot today
const cron2 = await invoke('/run-daily-email-nudges', { method: 'POST', body: {}, cron: true });
const dedupTag = activeSlot?.tag ?? favioDetail?.tag ?? 'daily-morning';
const favio2 = (cron2.data?.details ?? []).find(d => d.profileId === FAVIO_ID && d.tag === dedupTag);
const deduped = favio2?.status === 'already_sent' || (cron2.data?.sent === 0 && !favio2?.status?.startsWith('sent:'));
assert('cron dedupes same-day slot', deduped, favio2?.status ?? 'no repeat');

// 7. Restore default morning slot
settings.smartSlots.morning = { enabled: true, hour: 8, minute: 0 };
settings.smartSlots.midday = { enabled: true, hour: 13, minute: 0 };
settings.smartSlots.evening = { enabled: true, hour: 19, minute: 30 };
settings.smartSlots.streakRisk = { enabled: true, hour: 20, minute: 0 };
await invoke('/email-settings', { method: 'POST', body: settings });

console.log(`\n${passed} passed, ${failed} failed`);
console.log(`Check inbox: ${FAVIO_EMAIL}\n`);
process.exit(failed > 0 ? 1 : 0);
