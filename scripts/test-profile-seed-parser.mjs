// Quick smoke test for profile seed parser frequency detection
import assert from 'node:assert/strict';

function detectRecurrence(line) {
  const lower = line.toLowerCase();
  if (/\b(mwf|mon(?:day)?[\/\s,&-]+wed(?:nesday)?[\/\s,&-]+fri(?:day)?)\b/i.test(lower)) {
    return { type: 'weekly', weekdays: [0, 2, 4] };
  }
  if (/\bweekly\b/i.test(lower)) return { type: 'weekly', weekdays: [6] };
  return { type: 'daily' };
}

assert.deepEqual(detectRecurrence('exercise MWF').weekdays, [0, 2, 4]);
assert.equal(detectRecurrence('track expenses daily').type, 'daily');
assert.equal(detectRecurrence('budget check weekly').type, 'weekly');

console.log('profile seed parser tests: all passed');
