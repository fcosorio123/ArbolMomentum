/**
 * Unit checks for email schedule local-time conversion.
 * Run: npx tsx scripts/test-email-schedule-time.ts
 */

import {
  localDateTimeForScheduleClock,
  localDateTimeForTimezone,
  localDateTimeForTzOffset,
  normalizeTimezone,
  normalizeTzOffsetMinutes,
  resolveEmailScheduleClock,
} from '../supabase/functions/server/emailScheduleTime.ts';

let passed = 0;
let failed = 0;

function section(name: string) {
  console.log(`\n${name}`);
}

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` - ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

section('IANA timezone preference');
{
  const clock = resolveEmailScheduleClock({
    timezone: 'America/New_York',
    tzOffset: 480,
  });
  check('prefers IANA over offset', clock.reason === 'iana_timezone' && clock.timezone === 'America/New_York');
  check('rejects abbreviations', normalizeTimezone('EST') === undefined);
  check('rejects invalid zone', normalizeTimezone('Not/AZone') === undefined);
}

section('tzOffset fallback + legacy sign');
{
  check('legacy negative Pacific becomes 480', normalizeTzOffsetMinutes(-480) === 480);
  check('Eastern 240 stays 240', normalizeTzOffsetMinutes(240) === 240);
  const missing = resolveEmailScheduleClock({});
  check('missing timezone uses Eastern default', missing.reason === 'timezone_missing_default_applied' && missing.tzOffset === 300);
}

section('New York standard vs daylight');
{
  // 2026-01-15 13:00 UTC = 08:00 EST
  const winter = localDateTimeForTimezone('America/New_York', Date.UTC(2026, 0, 15, 13, 0, 0));
  check('standard time 8:00 AM', winter.hour === 8 && winter.minute === 0 && winter.dateKey === '2026-01-15', JSON.stringify(winter));

  // 2026-07-16 12:00 UTC = 08:00 EDT
  const summer = localDateTimeForTimezone('America/New_York', Date.UTC(2026, 6, 16, 12, 0, 0));
  check('daylight time 8:00 AM', summer.hour === 8 && summer.minute === 0 && summer.dateKey === '2026-07-16', JSON.stringify(summer));
}

section('offset fallback matches IANA for fixed offset day');
{
  // EDT offset is 240 minutes west of UTC.
  const viaOffset = localDateTimeForTzOffset(240, Date.UTC(2026, 6, 16, 12, 0, 0));
  const viaIana = localDateTimeForTimezone('America/New_York', Date.UTC(2026, 6, 16, 12, 0, 0));
  check('offset and IANA agree in summer', viaOffset.totalMinutes === viaIana.totalMinutes && viaOffset.dateKey === viaIana.dateKey);
}

section('user-adjusted slot clock resolution');
{
  const clock = resolveEmailScheduleClock({ timezone: 'America/Los_Angeles', tzOffset: -480 });
  const local = localDateTimeForScheduleClock(clock, Date.UTC(2026, 6, 16, 20, 0, 0));
  // 20:00 UTC = 13:00 PDT
  check('Los Angeles midday from UTC', local.hour === 13 && local.minute === 0, JSON.stringify(local));
}

section('midnight / next-day boundary');
{
  // 2026-07-17 03:30 UTC = 2026-07-16 23:30 EDT
  const nearMidnight = localDateTimeForTimezone('America/New_York', Date.UTC(2026, 6, 17, 3, 30, 0));
  check('stays previous local date near midnight', nearMidnight.dateKey === '2026-07-16' && nearMidnight.hour === 23, JSON.stringify(nearMidnight));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
