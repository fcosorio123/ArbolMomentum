/**
 * AI Assist V2 contract + similarity + session smoke tests (node-safe; no supabase path aliases).
 * Persist orchestration with injected create fns is covered by scripts/test-ai-assist-persist.mjs (pure).
 * Run: npx tsx scripts/test-ai-assist-contracts.ts
 */

import assert from 'node:assert/strict';

async function main() {
  const sim = await import('../src/app/data/aiAssistSimilarity.ts');
  const fb = await import('../src/app/data/aiAssistClientFallback.ts');
  const sess = await import('../src/app/data/aiAssistSession.ts');

  const { normalizeTitle, isNearDuplicate, filterDistinctTitles } = sim;
  const { buildClientAssistCandidates, buildClientStarterTasks } = fb;
  const { createAiAssistSession, acceptGeneration, bumpRequest, priorTitles, resetHistoryForTypeChange } = sess;

  assert.equal(normalizeTitle('  Hello, World! '), 'hello world');
  assert.equal(isNearDuplicate('Build a fitness routine', ['Build a fitness routine']), true);
  assert.equal(
    isNearDuplicate('Improve daily energy through consistent movement', [
      'Build a sustainable weekly fitness routine',
    ]),
    false,
  );
  assert.equal(
    isNearDuplicate(
      'Call the insurance company about the denied claim',
      ['Call the insurer about the denied claim'],
    ),
    true,
  );

  const filtered = filterDistinctTitles(
    [
      'Call the insurer about the denied claim',
      'Call the insurance company about the denied claim',
      'Prepare questions for the insurance company',
      'Review the denial letter and identify the stated reason',
    ],
    [],
    3,
  );
  assert.ok(filtered.length >= 2 && filtered.length <= 3);
  assert.ok(filtered.filter(t => /call the insur/i.test(t)).length <= 1);

  const dump =
    'I need to call the insurance company about the denied claim, but I am not sure what to ask.';
  const tasks = buildClientAssistCandidates('task', dump, []);
  assert.ok(tasks.length >= 2 && tasks.length <= 3);
  assert.ok(tasks.every(c => c.type === 'task'));

  const goals = buildClientAssistCandidates(
    'goal',
    'I want to become healthier and have more energy after work, but I need something realistic for my family schedule.',
    [],
  );
  assert.ok(goals.length >= 2);
  assert.ok(goals.every(c => c.type === 'goal'));

  const regen = buildClientAssistCandidates('task', dump, tasks.map(t => t.title));
  for (const c of regen) {
    assert.equal(isNearDuplicate(c.title, tasks.map(t => t.title)), false, `regen near-dup: ${c.title}`);
  }

  let session = createAiAssistSession('tasks');
  assert.equal(session.creationType, 'task');
  session = createAiAssistSession('goals');
  assert.equal(session.creationType, 'goal');

  const reqId = 'req_test_1';
  session = bumpRequest(session, reqId);
  const accepted = acceptGeneration(session, {
    requestId: reqId,
    creationType: 'goal',
    source: 'client_fallback',
    candidates: goals as any,
  });
  assert.ok(accepted);
  assert.equal(accepted!.step, 'candidates');
  assert.deepEqual(priorTitles(accepted!), goals.map(g => g.title));

  assert.equal(
    acceptGeneration(session, {
      requestId: 'other',
      creationType: 'goal',
      source: 'llm',
      candidates: goals as any,
    }),
    null,
  );

  const switched = resetHistoryForTypeChange(accepted!, 'task');
  assert.equal(switched.creationType, 'task');
  assert.equal(switched.candidates, null);
  assert.equal(switched.history.length, 0);

  const starters = buildClientStarterTasks('Healthier weekdays', 'more energy after work', []);
  assert.ok(starters.length >= 2 && starters.length <= 5);
  assert.ok(starters.every(t => t.clientKey && t.label));

  // Planning-titled weight-loss goals must stay domain-specific (tester: Lose 10 lbs).
  const weightStarters = buildClientStarterTasks(
    'Build a simple plan for Lose lbs',
    'Lose 10 lbs',
    [],
  );
  assert.ok(weightStarters.length >= 2 && weightStarters.length <= 5);
  const weightBlob = weightStarters.map(t => t.label).join(' ').toLowerCase();
  assert.ok(
    /weight|calorie|meal|workout|grocer|food/.test(weightBlob),
    `expected weight-loss domain tasks, got: ${weightBlob}`,
  );
  assert.ok(
    !/smallest next step|concrete action toward|15 focused minutes/.test(weightBlob),
    `unexpected generic templates: ${weightBlob}`,
  );

  console.log('AI Assist contract tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
