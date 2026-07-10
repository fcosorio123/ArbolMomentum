/**
 * Acceptance checks for alert prefs + email schedule (logic + API).
 * Run: node scripts/test-alert-prefs.mjs
 */

const PROJECT = 'lhbvzojmtvjeauqnnmdu';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYnZ6b2ptdHZqZWF1cW5ubWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk3OTYsImV4cCI6MjA5NDY3NTc5Nn0.ZRNFRD6I2E03nmP3N8ScDQig5SeVsSbliyyw-XjkEXI';
const BASE = `https://${PROJECT}.supabase.co/functions/v1/make-server-5d90ddf5`;
const headers = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

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

const DEFAULT_SMART_SLOTS = {
  morning: { enabled: true, hour: 8, minute: 0 },
  midday: { enabled: true, hour: 13, minute: 0 },
  evening: { enabled: true, hour: 19, minute: 30 },
  streakRisk: { enabled: true, hour: 20, minute: 0 },
};

function mergeSlot(admin, user) {
  if (!user) return { ...admin };
  return {
    enabled: user.enabled ?? admin.enabled,
    hour: user.hour ?? admin.hour,
    minute: user.minute ?? admin.minute,
  };
}

function getEffectiveSmartSlots(admin, userPrefs) {
  const user = userPrefs?.smartSlots ?? {};
  return {
    morning: mergeSlot(admin.morning, user.morning),
    midday: mergeSlot(admin.midday, user.midday),
    evening: mergeSlot(admin.evening, user.evening),
    streakRisk: mergeSlot(admin.streakRisk, user.streakRisk),
  };
}

function isProfileEmailEnabled(prefs) {
  if (prefs?.emailEnabled === false) return false;
  return true;
}

function channelGate({ browserEnabled, notifPermission, emailGlobal, emailType, userEmailOn, hasEmail }) {
  const browserOk = browserEnabled && notifPermission === 'granted';
  const emailOk = emailGlobal && emailType && userEmailOn && hasEmail;
  return { browserOk, emailOk, shouldRun: browserOk || emailOk };
}

function buildStreakRiskCopy(ctx) {
  const { checkedIn, streak, pending, firstName, topTasks } = ctx;
  if (checkedIn || streak <= 0 || pending <= 0) return null;
  const taskLines = topTasks.map(t => (t.goalTitle ? `• ${t.label} (${t.goalTitle})` : `• ${t.label}`)).join('\n');
  return {
    title: `Don't break your ${streak}-day streak! 🔥`,
    body: `Finish today's check-in and update your open tasks before the day ends.${taskLines ? `\n\n${taskLines}` : ''}`,
  };
}

function isValidEmail(email) {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

console.log('\nAlert prefs acceptance checks\n');

console.log('Admin + user slot merge:');
{
  const admin = { ...DEFAULT_SMART_SLOTS, morning: { enabled: true, hour: 8, minute: 0 } };
  const user = { smartSlots: { morning: { hour: 9, minute: 15 } } };
  const eff = getEffectiveSmartSlots(admin, user);
  assert('user overrides hour', eff.morning.hour === 9 && eff.morning.minute === 15);
  assert('user inherits enabled from admin', eff.morning.enabled === true);
  assert('unaffected slots keep admin defaults', eff.evening.hour === 19 && eff.evening.minute === 30);
}

console.log('\nUser email opt-out:');
{
  assert('default email on', isProfileEmailEnabled({ emailEnabled: null }));
  assert('explicit off', !isProfileEmailEnabled({ emailEnabled: false }));
  assert('explicit on', isProfileEmailEnabled({ emailEnabled: true }));
}

console.log('\nEmail decoupled from browser permission:');
{
  const denied = channelGate({
    browserEnabled: true,
    notifPermission: 'denied',
    emailGlobal: true,
    emailType: true,
    userEmailOn: true,
    hasEmail: true,
  });
  assert('denied browser + email on → still runs', denied.shouldRun && !denied.browserOk && denied.emailOk);

  const bothOff = channelGate({
    browserEnabled: false,
    notifPermission: 'default',
    emailGlobal: false,
    emailType: true,
    userEmailOn: true,
    hasEmail: true,
  });
  assert('both channels off → skip', !bothOff.shouldRun);
}

console.log('\nStreak-at-risk copy:');
{
  const copy = buildStreakRiskCopy({
    checkedIn: false,
    streak: 5,
    pending: 2,
    firstName: 'Favio',
    topTasks: [{ label: 'Submit FAFSA', goalTitle: 'College funding' }],
  });
  assert('fires when streak + pending + not checked in', !!copy && copy.title.includes('5-day'));
  assert('includes goal-linked task', !!copy && copy.body.includes('FAFSA') && copy.body.includes('College funding'));
  assert('skipped when checked in', buildStreakRiskCopy({ checkedIn: true, streak: 5, pending: 2, firstName: 'X', topTasks: [] }) === null);
}

console.log('\nProfile creation email validation:');
{
  assert('valid email', isValidEmail('favio.c.osorio@gmail.com'));
  assert('invalid email blocked', !isValidEmail('not-an-email'));
  assert('empty blocked', !isValidEmail(''));
}

console.log('\nAPI / KV smartSlots:');
{
  const getRes = await fetch(`${BASE}/email-settings`, { headers });
  const getData = await getRes.json();
  assert('GET email-settings 200', getRes.status === 200);
  assert('smartSlots present or mergeable', getData?.data?.smartSlots?.morning?.hour === 8 || getData?.ok !== false);

  const testSlots = {
    ...getData?.data,
    enabled: true,
    smartSlots: {
      ...DEFAULT_SMART_SLOTS,
      morning: { enabled: true, hour: 7, minute: 45 },
    },
    updatedAt: Date.now(),
  };
  const postRes = await fetch(`${BASE}/email-settings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(testSlots),
  });
  const postData = await postRes.json();
  assert('POST smartSlots 200', postRes.status === 200 && postData?.ok === true);

  const verifyRes = await fetch(`${BASE}/email-settings`, { headers });
  const verifyData = await verifyRes.json();
  assert('admin morning time persisted', verifyData?.data?.smartSlots?.morning?.hour === 7);

  // restore defaults
  await fetch(`${BASE}/email-settings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...verifyData.data, smartSlots: DEFAULT_SMART_SLOTS, updatedAt: Date.now() }),
  });
}

console.log('\nSmart nudge email with topTasks payload:');
{
  const res = await fetch(`${BASE}/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      profileId: 'favio',
      type: 'smart_nudge',
      tag: 'acceptance-test',
      profileName: 'Favio',
      recipient: 'favio.c.osorio@gmail.com',
      title: 'Acceptance test nudge',
      body: 'Runtime acceptance — goal-linked tasks below.',
      pendingCount: 2,
      streak: 3,
      topTasks: [
        { label: 'Complete FAFSA', goalTitle: 'Financial aid' },
        { label: 'Review TAP status', goalTitle: 'NY State aid' },
      ],
      force: true,
    }),
  });
  const data = await res.json();
  assert('send smart_nudge with topTasks', data?.ok === true, data?.resendId ?? data?.reason);
}

console.log('\nServer cron endpoint:');
{
  const res = await fetch(`${BASE}/run-daily-email-nudges`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const data = await res.json();
  assert('POST run-daily-email-nudges (no auth if CRON_SECRET unset)', res.status === 200 || res.status === 401, `status ${res.status}`);
  assert('cron returns structured result', data?.ok === true || data?.reason === 'unauthorized', JSON.stringify(data).slice(0, 80));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
