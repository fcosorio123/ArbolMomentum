/**
 * Runtime email test for Favio profile → favio.c.osorio@gmail.com
 * Run: node scripts/test-email-favio.mjs
 */

const PROJECT = 'lhbvzojmtvjeauqnnmdu';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYnZ6b2ptdHZqZWF1cW5ubWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk3OTYsImV4cCI6MjA5NDY3NTc5Nn0.ZRNFRD6I2E03nmP3N8ScDQig5SeVsSbliyyw-XjkEXI';
const BASE = `https://${PROJECT}.supabase.co/functions/v1/make-server-5d90ddf5`;
const FAVIO_EMAIL = 'favio.c.osorio@gmail.com';
const FAVIO_ID = 'favio';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ANON}`,
};

async function invoke(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

async function getSettings() {
  const res = await fetch(`${BASE}/email-settings`, { headers });
  const data = await res.json();
  return data;
}

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

console.log('\nEmail runtime test (Favio profile)\n');

// 1. Read current settings
const current = await getSettings();
assert('GET email-settings', current?.ok !== false, JSON.stringify(current?.data?.enabled ?? current));

// 2. Enable global email + set Favio recipient in admin map
const settings = {
  ...(current?.data ?? {}),
  enabled: true,
  welcomeEnabled: true,
  smartNudgeEnabled: true,
  checkInConfirmationEnabled: true,
  testRecipient: FAVIO_EMAIL,
  profileEmails: {
    ...(current?.data?.profileEmails ?? {}),
    [FAVIO_ID]: FAVIO_EMAIL,
  },
  updatedAt: Date.now(),
};
const saved = await invoke('/email-settings', settings);
assert('POST email-settings (enable + favio email)', saved.data?.ok === true, saved.data?.reason ?? `status ${saved.status}`);

// 3. Send test email
const test = await invoke('/send-test-email', { recipient: FAVIO_EMAIL });
assert(
  'POST send-test-email',
  test.data?.ok === true,
  test.data?.resendId ? `resendId=${test.data.resendId}` : (test.data?.reason ?? `status ${test.status}`),
);

// 4. Send welcome nudge for Favio (force)
const welcome = await invoke('/send-email', {
  profileId: FAVIO_ID,
  type: 'welcome',
  profileName: 'Favio',
  recipient: FAVIO_EMAIL,
  force: true,
});
assert(
  'POST send-email welcome (Favio)',
  welcome.data?.ok === true,
  welcome.data?.resendId ? `resendId=${welcome.data.resendId}` : (welcome.data?.reason ?? `status ${welcome.status}`),
);

// 5. Send check-in confirmation (force) — simulates post-check-in flow
const checkIn = await invoke('/send-email', {
  profileId: FAVIO_ID,
  type: 'check_in_confirmation',
  profileName: 'Favio',
  recipient: FAVIO_EMAIL,
  date: new Date().toISOString().slice(0, 10),
  force: true,
});
assert(
  'POST send-email check_in_confirmation (Favio)',
  checkIn.data?.ok === true,
  checkIn.data?.resendId ? `resendId=${checkIn.data.resendId}` : (checkIn.data?.reason ?? `status ${checkIn.status}`),
);

console.log(`\n${passed} passed, ${failed} failed`);
console.log(`\nCheck inbox: ${FAVIO_EMAIL}\n`);
process.exit(failed > 0 ? 1 : 0);
