/**
 * Simplify-for-Me core regression checks (no test runner required).
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

// --- Complexity classification ---
assert(classifyTaskComplexity('Set a reminder') === 'atomic', 'Set a reminder → atomic');
assert(classifyTaskComplexity(PHONE) === 'atomic', 'phone-down → atomic');
assert(
  classifyTaskComplexity('Organize documents for my tax appointment') === 'decomposable',
  'tax docs → decomposable',
);
assert(
  classifyTaskComplexity('Get my finances under control') === 'broad',
  'finances under control → broad',
);

// --- Unrelated goal excluded ---
assert(!isGoalRelevantToTask(PHONE, ART), 'artwork goal irrelevant to phone-down');

// --- Atomic fragmentation: max 2, no interface clicks ---
{
  const steps = ruleBasedSimplifyCore({
    taskLabel: PHONE,
    goalTitle: ART,
    blocker: 'I keep forgetting',
    motivation: 'I need my evenings back',
    constraint: '',
  });
  assert(steps.length === 2, `phone-down yields exactly 2 steps (got ${steps.length})`);
  assert(steps.length <= 2, 'phone-down never exceeds 2');
  for (const s of steps) {
    assert(!isSemanticRestatement(PHONE, s.label), `not restatement: ${s.label}`);
    assert(!isProceduralFragment(s.label), `not procedural fragment: ${s.label}`);
    assert(!/lights low|tomorrow.?s top|get in bed|journal|sleep routine/i.test(s.label), `no sleep pad: ${s.label}`);
    assert(!/artwork|living room/i.test(s.label), `no goal drift: ${s.label}`);
  }
  assert(steps.some(s => /app|clock|remind/i.test(s.label)), 'includes opening reminder tool');
  assert(
    !steps.some(s => /name it|and save|choose the time|tap add/i.test(s.label)),
    'does not split name/save/choose-time into tracked tasks',
  );
  console.log('phone-down steps:', steps.map(s => s.label));
}

// --- Answer differentiation (same task, different answers) ---
{
  const caseA = ruleBasedSimplifyCore({
    taskLabel: PHONE,
    blocker: 'My bedtime changes every night.',
    motivation: '',
    constraint: '',
  });
  const caseB = ruleBasedSimplifyCore({
    taskLabel: PHONE,
    blocker: 'I always forget to turn on repeat.',
    motivation: '',
    constraint: '',
  });
  const caseC = ruleBasedSimplifyCore({
    taskLabel: PHONE,
    blocker: 'I do not know how to set reminders on my phone.',
    motivation: '',
    constraint: '',
  });

  assert(caseA.length === 2 && caseB.length === 2 && caseC.length === 2, 'all cases return exactly 2');
  const blobA = caseA.map(s => s.label).join(' | ').toLowerCase();
  const blobB = caseB.map(s => s.label).join(' | ').toLowerCase();
  const blobC = caseC.map(s => s.label).join(' | ').toLowerCase();

  assert(/common bedtime|late night|adjust/i.test(blobA), `Case A varies bedtime: ${blobA}`);
  assert(/repeat|notif/i.test(blobB), `Case B emphasizes repeat/notifications: ${blobB}`);
  assert(/clock|reminders/i.test(blobC), `Case C opens how-to path: ${blobC}`);
  assert(blobA !== blobB, 'Case A ≠ Case B');
  assert(blobB !== blobC, 'Case B ≠ Case C');
  assert(blobA !== blobC, 'Case A ≠ Case C');
  console.log('Case A:', caseA.map(s => s.label));
  console.log('Case B:', caseB.map(s => s.label));
  console.log('Case C:', caseC.map(s => s.label));
}

// --- Time constraint stays compact ---
{
  const short = ruleBasedSimplifyCore({
    taskLabel: PHONE,
    blocker: 'only a minute',
    constraint: 'I only have 1 minute right now',
  });
  assert(short.length === 2, `1-minute session still exactly 2 (got ${short.length})`);
  console.log('1-minute steps:', short.map(s => s.label));
}

// --- Decomposable can exceed 2 ---
{
  const docs = ruleBasedSimplifyCore({
    taskLabel: 'Organize the documents needed for my tax appointment',
    blocker: 'I do not have the checklist',
    motivation: '',
    constraint: '',
  });
  assert(docs.length >= 2 && docs.length <= 5, `docs decomposes 2-5 (got ${docs.length})`);
  assert(docs.length > 2, 'docs can exceed 2 when meaningfully multi-part');
  console.log('docs steps:', docs.map(s => s.label));
}

// --- Insurance blocker adds prerequisites ---
{
  const call = ruleBasedSimplifyCore({
    taskLabel: 'Call the insurance company about the denied claim',
    blocker: 'I do not know why it was denied or what I should ask',
    motivation: '',
    constraint: 'I can only call during lunch',
  });
  assert(call.some(s => /denial|reason|notice|claim number/i.test(s.label)), 'includes denial prep');
  assert(call.some(s => /question|call|number on the notice/i.test(s.label)), 'includes questions or call');
  assert(call.length >= 2 && call.length <= 5, `insurance not forced to 2 when prep needed (got ${call.length})`);
  assert(!call.some(s => /artwork|relationship/i.test(s.label)), 'no unrelated advice');
  console.log('insurance steps:', call.map(s => s.label));
}

// --- Validator rejects original + sleep pads + procedural ---
{
  const r1 = validateSimplifiedLabel(PHONE, PHONE);
  assert(!r1.ok && (r1.reason === 'duplicate_original' || r1.reason === 'semantic_restatement'), 'reject exact original');
  const r2 = validateSimplifiedLabel(PHONE, "Write tomorrow's top 1 task so your brain can settle");
  assert(!r2.ok, 'reject tomorrow top task');
  const r3 = validateSimplifiedLabel(PHONE, 'Lights low and screens off for the last 15 minutes tonight');
  assert(!r3.ok, 'reject lights/screens sleep tip');
  const r4 = validateSimplifiedLabel(PHONE, 'Name it Phone down and save');
  assert(!r4.ok && r4.reason === 'procedural_fragment', 'reject name/save fragment');
  const r5 = validateSimplifiedLabel(PHONE, 'Choose the time');
  assert(!r5.ok, 'reject choose-the-time fragment');
}

// --- filterCandidateSteps caps atomic at 2 and strips fragments ---
{
  const { kept, rejected } = filterCandidateSteps(PHONE, [
    { label: PHONE, timeOfDay: 'morning' },
    { label: "Write tomorrow's top 1 task", timeOfDay: 'evening' },
    { label: "Open your phone's Clock app", timeOfDay: 'morning' },
    { label: 'Set reminder for 30 minutes before bedtime', timeOfDay: 'evening' },
    { label: 'Name it Phone down and save', timeOfDay: 'evening' },
    { label: 'Choose the bedtime time', timeOfDay: 'evening' },
    { label: 'Turn on repeat', timeOfDay: 'evening' },
  ], {
    goalTitle: ART,
    answers: { blocker: 'I keep forgetting', motivation: '', constraint: '' },
  });
  assert(kept.length <= 2, `filter caps atomic at 2 (got ${kept.length})`);
  assert(!kept.some(k => isSemanticRestatement(PHONE, k.label)), 'filter removes restatement');
  assert(!kept.some(k => /tomorrow/i.test(k.label)), 'filter removes tomorrow tip');
  assert(!kept.some(k => /name it|choose the|turn on repeat/i.test(k.label)), 'filter removes procedural fragments');
  assert(rejected.length >= 2, 'rejected bad candidates');
  assert(kept.length >= 1, 'kept valid setup steps');
}

// --- Facts extracted without echo ---
{
  const facts = buildTaskContextFromAnswers({
    blocker: 'I do not understand the purple giraffe denial code ZX-99',
    motivation: 'A short message template would help',
    constraint: 'Only 10 minutes and phone only',
  });
  assert(facts.some(f => f.category === 'missing_information'), 'missing info fact');
  assert(facts.some(f => f.category === 'timing'), 'timing fact');
  assert(facts.some(f => /Phone-only|phone/i.test(f.fact)), 'phone tool fact');
  const steps = ruleBasedSimplifyCore({
    taskLabel: 'Call the insurance company about the denied claim',
    blocker: 'I do not understand the purple giraffe denial code ZX-99',
    motivation: 'A short message template would help',
    constraint: 'Only 10 minutes and phone only',
  });
  assert(!steps.some(s => /purple giraffe|ZX-99/i.test(s.label)), 'no answer echo of distinctive phrase');
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll simplify core checks passed');
