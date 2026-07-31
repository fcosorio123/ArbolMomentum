/**
 * Unit tests: notification identity, funnel categories, deferral LWW.
 * Run: npx tsx scripts/test-adaptive-engagement-r1.ts
 */
import assert from 'node:assert/strict';
import {
  mintNotificationId,
  isValidNid,
  withAttributionParams,
  buildAttributedCheckInLink,
  CTA_IDS,
} from '../src/app/data/notificationIdentity.ts';
import {
  aggregateNotificationFunnel,
  categoryOfEvent,
  scrubSensitiveMeta,
} from '../src/app/data/notificationFunnel.ts';
import { mergeDeferralMaps, computeResumeAt, getDeferralSuccessMessage, type TaskDeferral } from '../src/app/data/taskDeferral.ts';
import { withAttribution } from '../supabase/functions/server/emailTemplates.ts';

// ── Identity
const nid = mintNotificationId();
assert.ok(isValidNid(nid), 'minted nid valid');
assert.equal(isValidNid('bad'), false);
assert.equal(isValidNid('n_short'), false);

const linked = buildAttributedCheckInLink('https://example.test/ArbolMomentum/', { nid, cta: CTA_IDS.open_checkin });
assert.match(linked, /checkin=1/);
assert.match(linked, new RegExp(`nid=${nid}`));
assert.match(linked, /cta=cta\.open_checkin/);
assert.match(linked, /dest=checkin/);
assert.doesNotMatch(linked, /@|email=/i);

const rel = withAttributionParams('/ArbolMomentum/?checkin=1', { nid, cta: CTA_IDS.open_checkin, dest: 'checkin' });
assert.match(rel, /nid=/);

// ── Email template attribution (server)
const emailHref = withAttribution('https://example.test/app/?checkin=1', {
  nid: 'n_abcdef1234567890',
  cta: 'cta.open_checkin',
  dest: 'checkin',
});
assert.match(emailHref, /nid=n_abcdef1234567890/);

// ── Funnel categories
assert.equal(categoryOfEvent('notification_cta_clicked'), 'entry');
assert.equal(categoryOfEvent('task_deferred'), 'recovery');
assert.equal(categoryOfEvent('checkin_completed_from_notification'), 'execution');
assert.equal(categoryOfEvent('meaningful_action', { category: 'recovery' }), 'recovery');

const scrubbed = scrubSensitiveMeta({ reason: 'secret', reasonCode: 'overwhelmed', nid: 'n_x' });
assert.equal(scrubbed.reason, undefined);
assert.equal(scrubbed.reasonCode, undefined);
assert.equal(scrubbed.nid, 'n_x');

const totals = aggregateNotificationFunnel([
  { event: 'notification_sent', profile_id: 'p1', metadata: { nid: 'n_1', category: 'entry' } },
  { event: 'notification_cta_clicked', profile_id: 'p1', metadata: { nid: 'n_1', category: 'entry' } },
  { event: 'task_deferred', profile_id: 'p1', metadata: { nid: 'n_1', category: 'recovery' } },
  { event: 'checkin_completed_from_notification', profile_id: 'p1', metadata: { nid: 'n_1', category: 'execution' } },
  { event: 'task_deferred', profile_id: 'p2', metadata: { category: 'recovery' } },
]);
assert.equal(totals.entry.notification_sent, 1);
assert.equal(totals.recovery.task_deferred, 2);
assert.equal(totals.execution.checkin_completed_from_notification, 1);
assert.equal(totals.uniqueProfilesClicked, 1);
assert.ok(totals.uniqueNids >= 1);
// Recovery must not be counted as execution
assert.equal(totals.execution.task_deferred, undefined);

// ── Deferral LWW
const older: TaskDeferral = {
  taskId: 't1', profileId: 'p1', deferredAt: 1, updatedAt: 10,
  resumeAt: 100, resumePreset: 'tomorrow', deferCountInWindow: 1,
  windowStartedAt: 1, status: 'active',
};
const newer: TaskDeferral = { ...older, updatedAt: 20, resumePreset: 'weekend', resumeAt: 200 };
const merged = mergeDeferralMaps({ t1: older }, { t1: newer });
assert.equal(merged.t1.resumePreset, 'weekend');
assert.equal(mergeDeferralMaps({ t1: newer }, { t1: older }).t1.resumePreset, 'weekend');

assert.equal(computeResumeAt('unsure'), null);
assert.ok((computeResumeAt('tomorrow') ?? 0) > Date.now());

assert.equal(
  getDeferralSuccessMessage({ resumeAt: null, reminderScheduled: false }),
  'Task moved to later.',
);
assert.equal(
  getDeferralSuccessMessage({ resumeAt: Date.now() + 1000, reminderScheduled: true }),
  'Task moved to later and reminder added.',
);
assert.equal(
  getDeferralSuccessMessage({ resumeAt: Date.now() + 1000, reminderScheduled: false }),
  'Task moved to later.',
);

console.log('test-adaptive-engagement-r1: ok');
