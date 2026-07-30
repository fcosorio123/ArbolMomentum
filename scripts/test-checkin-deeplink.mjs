/**
 * Check-in deep-link contracts (email CTA + browser notification).
 * Run: node scripts/test-checkin-deeplink.mjs
 *      npx tsx scripts/test-checkin-deeplink-unit.ts
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('\nCheck-in deep-link gate\n');

assert('checkInDeepLink module exists', existsSync(join(root, 'src/app/data/checkInDeepLink.ts')));

const deeplink = read('src/app/data/checkInDeepLink.ts');
assert('reads checkin query param', /CHECKIN_QUERY_PARAM\s*=\s*'checkin'/.test(deeplink));
assert('stashes intent in sessionStorage', /CHECKIN_INTENT_KEY/.test(deeplink) && /stashCheckInIntent/.test(deeplink));
assert('buildCheckInDeepLink sets checkin=1', /searchParams\.set\(CHECKIN_QUERY_PARAM,\s*'1'\)/.test(deeplink));

const templates = read('supabase/functions/server/emailTemplates.ts');
assert('smart_nudge CTA uses check-in link', /Open today's check-in[\s\S]{0,80}checkInLink/.test(templates) || /ctaHtml\("Open today's check-in", checkInLink\)/.test(templates));
assert('withCheckIn helper exists', /function withCheckIn/.test(templates));
assert('welcome CTA includes check-in', /Access your account[\s\S]{0,40}checkInLink/.test(templates) || /ctaHtml\("Access your account", checkInLink\)/.test(templates));

const app = read('src/app/App.tsx');
assert('App imports check-in deep-link helpers', /checkInDeepLink/.test(app));
assert('App opens CheckInPage from pending intent', /setShowCheckIn\(true\)/.test(app) && /peekCheckInIntent|consumeStashedCheckInIntent/.test(app));
assert('App suppresses boot modals for check-in', /skipBootModalsRef/.test(app));
assert('NOTIF_CLICKED can open check-in', /NOTIF_CLICKED[\s\S]{0,400}openCheckIn/.test(app));

const sw = read('public/sw.js');
assert('SW default check-in entry URL', /\?checkin=1/.test(sw));
assert('SW posts openCheckIn on click', /openCheckIn/.test(sw));
assert('SW cache bumped for update', /arbol-v[789]|arbol-v1[0-9]/.test(sw));

const nudge = read('src/app/data/nudgeScheduler.ts');
assert('browser nudges pass check-in URL', /checkInNotificationUrl/.test(nudge));

const push = read('supabase/functions/server/pushSend.ts');
assert('push default URL is check-in', /\.\/\?checkin=1/.test(push));

const checkInPage = read('src/app/components/CheckInPage.tsx');
assert('CheckInPage sits above Ant modals', /zIndex:\s*1100/.test(checkInPage));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
