/**
 * Simplify-for-Me acceptance + personalization matrix.
 * Run: npx tsx scripts/test-simplify-core.ts
 */
import {
  ruleBasedSimplifyCore,
  validateSimplifiedLabel,
  isGoalRelevantToTask,
  isSemanticRestatement,
  filterCandidateSteps,
  buildTaskContextFromAnswers,
  classifyTaskComplexity,
  isProceduralFragment,
  buildSimplifyPackage,
  suggestionsDiffer,
  detectDevicePlatform,
} from '../src/app/data/simplifyTaskCore';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

const PHONE = 'Set a phone-down reminder 30 minutes before bed';
const ART = 'Renew Living Room Artwork';

// --- Complexity ---
assert(classifyTaskComplexity('Set a reminder') === 'atomic', 'Set a reminder → atomic');
assert(classifyTaskComplexity(PHONE) === 'atomic', 'phone-down → atomic');
assert(classifyTaskComplexity('Organize documents for my tax appointment') === 'decomposable', 'tax docs → decomposable');
assert(classifyTaskComplexity('Get my finances under control') === 'broad', 'finances → broad');
assert(!isGoalRelevantToTask(PHONE, ART), 'artwork goal irrelevant');

// ========== Test matrix A / B / C / D ==========
const testA = buildSimplifyPackage({
  taskLabel: PHONE,
  goalTitle: ART,
  blocker: 'I do not know which app to use.',
  motivation: 'Simple directions.',
  constraint: 'I have an iPhone.',
});
const testB = buildSimplifyPackage({
  taskLabel: PHONE,
  blocker: 'My bedtime changes every night.',
  motivation: 'Something I can adjust quickly.',
  constraint: 'I use an Android phone.',
});
const testC = buildSimplifyPackage({
  taskLabel: PHONE,
  blocker: 'I keep putting this off.',
  motivation: 'The fastest possible option.',
  constraint: 'I only have one minute.',
});
const testD = buildSimplifyPackage({
  taskLabel: PHONE,
  blocker: 'My favorite food is pizza.',
  motivation: '',
  constraint: '',
});

console.log('\n--- Test A suggestions ---');
testA.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}`));
console.log('--- Test B suggestions ---');
testB.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}`));
console.log('--- Test C suggestions ---');
testC.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}`));
console.log('--- Test D suggestions ---');
testD.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}`));

// A: iPhone + answers displayed + Apple link
assert(testA.suggestions.length === 2, `A: exactly 2 (got ${testA.suggestions.length})`);
assert(testA.suggestions.every(s => /iphone|reminder/i.test(s.label)), 'A: iPhone/reminder in labels');
assert(testA.suggestions.some(s => /iphone/i.test(s.label)), 'A: iPhone named in at least one label');
assert(testA.answers.every(a => a.rawAnswer.length > 0), 'A: all 3 answers preserved raw');
assert(testA.answers[0].rawAnswer === 'I do not know which app to use.', 'A: exact hard_part text');
assert(testA.answers[1].rawAnswer === 'Simple directions.', 'A: exact help text');
assert(testA.answers[2].rawAnswer === 'I have an iPhone.', 'A: exact constraint text');
assert(
  testA.answers.filter(a => a.usageStatus === 'used' || a.usageStatus === 'partially_used').length >= 2,
  'A: at least 2 answers marked used/partial',
);
assert(testA.suggestions.every(s => s.howTo.length >= 2), 'A: how-to steps present');
assert(
  testA.suggestions.every(s => /apple\.com|iphone/i.test(s.resourceLink.url + s.resourceLink.label)),
  'A: Apple resource link',
);
assert(detectDevicePlatform({
  blocker: testA.answers[0].rawAnswer,
  motivation: testA.answers[1].rawAnswer,
  constraint: testA.answers[2].rawAnswer,
}) === 'iphone', 'A: platform iphone');

// B: Android + different from A + variable bedtime
assert(testB.suggestions.length === 2, 'B: exactly 2');
assert(testB.suggestions.some(s => /android/i.test(s.label)), 'B: Android in labels');
assert(testB.suggestions.some(s => /adjust|common bedtime|late/i.test(s.label)), 'B: adjustable/variable bedtime');
assert(suggestionsDiffer(testA.suggestions, testB.suggestions), 'A ≠ B suggestions');
assert(testB.answers[2].rawAnswer === 'I use an Android phone.', 'B: exact Android constraint');
assert(
  testB.suggestions.every(s => /android|google\.com|alarm/i.test(s.resourceLink.url + s.resourceLink.label + s.howTo.join(' '))),
  'B: Android-oriented how-to/link',
);

// C: one minute - faster wording, still ≤2, differs from A
assert(testC.suggestions.length === 2, 'C: exactly 2');
assert(
  testC.suggestions.some(s => /tonight|under a minute|now|save one/i.test(s.label)),
  `C: fast path wording (got ${testC.suggestions.map(s => s.label).join(' | ')})`,
);
assert(suggestionsDiffer(testA.suggestions, testC.suggestions), 'A ≠ C');
assert(suggestionsDiffer(testB.suggestions, testC.suggestions), 'B ≠ C');
assert(!testC.suggestions.every(s => /quickly/i.test(s.label) && /iphone/i.test(s.label)), 'C: not just "quickly" appended to A');

// D: pizza irrelevant - shown, not used, does not force into labels
assert(testD.answers[0].rawAnswer === 'My favorite food is pizza.', 'D: pizza answer preserved');
assert(testD.answers[0].usageStatus === 'irrelevant', `D: pizza marked irrelevant (got ${testD.answers[0].usageStatus})`);
assert(testD.answers[0].influenceTypes.length === 0, 'D: pizza has no influence types');
assert(!testD.suggestions.some(s => /pizza/i.test(s.label)), 'D: pizza not in task labels');

// Atomic fragmentation
assert(!testA.suggestions.some(s => /name it|and save|choose the time|tap add/i.test(s.label)), 'no procedural fragments as tasks');
assert(isProceduralFragment('Name it Phone down and save'), 'procedural detector');

// Integration-style: request fields → package → answer echo round-trip
{
  const payload = {
    taskLabel: PHONE,
    taskId: 'task-abc',
    requestId: 'req-xyz',
    blocker: 'I do not know which app to use.',
    motivation: 'Simple directions for my iPhone.',
    constraint: 'I only have one minute.',
  };
  const pkg = buildSimplifyPackage(payload);
  assert(pkg.answers[0].rawAnswer === payload.blocker, 'payload blocker unchanged');
  assert(pkg.answers[1].rawAnswer === payload.motivation, 'payload motivation unchanged');
  assert(pkg.answers[2].rawAnswer === payload.constraint, 'payload constraint unchanged');
  assert(pkg.suggestions.every(s => s.resourceLink.url.startsWith('http')), 'all links valid http(s)');
  assert(pkg.suggestions.every(s => s.howTo.length > 0), 'every suggestion has how-to');
  console.log('integration package answers:', pkg.answers.map(a => `${a.questionId}:${a.usageStatus}`));
}

// Stale-state simulation: Task A answers must not equal Task B labels
{
  const other = buildSimplifyPackage({
    taskLabel: 'Call the insurance company about the denied claim',
    blocker: 'I received two letters and do not know which claim number to use.',
    motivation: '',
    constraint: '',
  });
  assert(!other.suggestions.some(s => /iphone|android|phone-down|pizza/i.test(s.label)), 'insurance not contaminated by phone-down');
  assert(other.suggestions.some(s => /letter|claim/i.test(s.label)), 'insurance uses letter/claim answer');
  assert(other.answers[0].rawAnswer.includes('two letters'), 'insurance answer echoed');
}

// Filter still caps atomic + rejects bad pads
{
  const { kept } = filterCandidateSteps(PHONE, [
    { label: PHONE, timeOfDay: 'morning' },
    { label: "Write tomorrow's top 1 task", timeOfDay: 'evening' },
    { label: 'Open the Reminders app on your iPhone', timeOfDay: 'morning' },
    { label: 'Create a repeating Phone-down reminder for 30 minutes before bed', timeOfDay: 'evening' },
    { label: 'Name it Phone down and save', timeOfDay: 'evening' },
  ], { goalTitle: ART, answers: { blocker: 'x', motivation: '', constraint: 'iPhone' } });
  assert(kept.length <= 2, `filter caps atomic at 2 (got ${kept.length})`);
  assert(!kept.some(k => isSemanticRestatement(PHONE, k.label)), 'filter removes restatement');
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll simplify core checks passed');
