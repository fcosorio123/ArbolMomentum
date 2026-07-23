/**
 * Account invite contracts (static + template behavior).
 * Run: node scripts/test-invite-access.mjs
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

console.log('\nAccount invite access gate\n');

assert('inviteTokens module exists', existsSync(join(root, 'supabase/functions/server/inviteTokens.ts')));
assert('inviteAccess client exists', existsSync(join(root, 'src/app/data/inviteAccess.ts')));

const tokens = read('supabase/functions/server/inviteTokens.ts');
assert('mintInviteToken exported', /export async function mintInviteToken/.test(tokens));
assert('redeemInviteToken exported', /export async function redeemInviteToken/.test(tokens));
assert('buildInviteUrl uses ?invite=', /invite=\$\{encodeURIComponent\(token\)\}/.test(tokens));
assert('invite TTL is 30 days', /30 \* 24 \* 60 \* 60 \* 1000/.test(tokens));

const templates = read('supabase/functions/server/emailTemplates.ts');
assert('welcome CTA accepts inviteUrl', /ctaHtml\("Access your account", link\)/.test(templates));
assert('welcome subject is invite-focused', /You're invited to Arbol Momentum/.test(templates));

const send = read('supabase/functions/server/emailSend.ts');
assert('welcome mints invite token', /mintInviteToken/.test(send) && /inviteUrl/.test(send));

const index = read('supabase/functions/server/index.tsx');
assert('redeem-invite route registered', /\/redeem-invite/.test(index));

const app = read('src/app/App.tsx');
assert('App boots invite redeem', /redeemInviteToken/.test(app) && /inviteBoot/.test(app));
assert('invite bypasses access gate while pending', /Opening your account/.test(app));
assert('invite skips localStorage profile hydrate', /if \(readInviteTokenFromUrl\(\)\) return null/.test(app));
assert('invite boot gate is hoisted above profile chrome',
  app.lastIndexOf("if (inviteBoot === 'pending' || inviteBoot === 'error')") <
  app.lastIndexOf('if (!activeProfile) {'));

const profileScreen = read('src/app/components/ProfileScreen.tsx');
assert('email reminders input is isolated from ProfileScreen stats',
  /function EmailRemindersCard/.test(profileScreen) &&
  /<EmailRemindersCard /.test(profileScreen) &&
  !/const \[email, setEmail\]/.test(profileScreen.replace(/function EmailRemindersCard[\s\S]*?\n\}/, '')));

const profiles = read('src/app/data/profiles.ts');
assert('getEarnedBadges computes live profile once',
  /export function getEarnedBadges[\s\S]{0,180}?const live = getLiveBadgeProfile/.test(profiles));

const create = read('src/app/components/CreateProfileModal.tsx');
assert('create profile force-sends welcome invite', /forceWelcome:\s*true/.test(create));

const admin = read('src/app/components/AdminView.tsx');
assert('admin Resend invite UI', /Resend invite/.test(admin) && /resendAccountInvite/.test(admin));

const settings = read('src/app/data/emailSettings.ts');
assert('resendAccountInvite helper', /export async function resendAccountInvite/.test(settings));

const client = read('src/app/data/inviteAccess.ts');
assert('client clears invite query param', /clearInviteFromUrl/.test(client));
assert('client restores cloud profile', /restoreFromCloud/.test(client));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
