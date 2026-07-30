/**
 * Unit tests for check-in deep-link helpers.
 * Run: npx tsx scripts/test-checkin-deeplink-unit.ts
 */
import assert from 'node:assert/strict';
import {
  buildCheckInDeepLink,
  readCheckInIntentFromUrl,
  checkInNotificationUrl,
} from '../src/app/data/checkInDeepLink.ts';

assert.equal(
  buildCheckInDeepLink('https://fcosorio123.github.io/ArbolMomentum'),
  'https://fcosorio123.github.io/ArbolMomentum?checkin=1',
);
assert.equal(
  buildCheckInDeepLink('https://fcosorio123.github.io/ArbolMomentum/'),
  'https://fcosorio123.github.io/ArbolMomentum/?checkin=1',
);
assert.equal(
  buildCheckInDeepLink('https://fcosorio123.github.io/ArbolMomentum/?invite=abc'),
  'https://fcosorio123.github.io/ArbolMomentum/?invite=abc&checkin=1',
);
assert.equal(buildCheckInDeepLink('/ArbolMomentum/'), '/ArbolMomentum/?checkin=1');
assert.equal(checkInNotificationUrl('/ArbolMomentum/'), '/ArbolMomentum/?checkin=1');

assert.equal(readCheckInIntentFromUrl('https://x.test/ArbolMomentum/?checkin=1'), true);
assert.equal(readCheckInIntentFromUrl('https://x.test/ArbolMomentum/?checkin=true'), true);
assert.equal(readCheckInIntentFromUrl('https://x.test/ArbolMomentum/?invite=tok'), false);
assert.equal(readCheckInIntentFromUrl('https://x.test/ArbolMomentum/'), false);

console.log('test-checkin-deeplink-unit: ok');
