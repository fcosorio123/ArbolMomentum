/**
 * Automated tests for Simplify detail-assist (sufficiency, merge, suggestions).
 */
import assert from 'node:assert/strict';
import {
  evaluateAnswerSufficiency,
  mergeAnswerWithAddition,
  buildPrevalidatedSuggestions,
  buildRuleBasedDetailCandidates,
} from '../src/app/data/simplifyDetailAssist.ts';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

// ── Sufficiency ──────────────────────────────────────────────────────
section('sufficient answers proceed without needs_detail');
{
  const r = evaluateAnswerSufficiency(
    'hard_part',
    'I do not know which app to use on my iPhone.',
    'Set a phone-down reminder 30 minutes before bed',
  );
  assert.equal(r.status, 'sufficient');
}

section('short relevant blocker needs detail');
{
  const r = evaluateAnswerSufficiency(
    'hard_part',
    'I forget.',
    'Set a phone-down reminder 30 minutes before bed',
  );
  assert.equal(r.status, 'needs_detail');
  assert.equal(r.missingDetailType, 'specific_blocker');
}

section('optional blank is empty, not mandatory');
{
  const r = evaluateAnswerSufficiency('what_would_help', '', 'Call insurance');
  assert.equal(r.status, 'empty');
}

section('time constraint short answer needs detail');
{
  const r = evaluateAnswerSufficiency(
    'constraints',
    'I do not have much time.',
    'Organize the documents needed for my tax appointment',
  );
  assert.equal(r.status, 'needs_detail');
}

// ── Merge ────────────────────────────────────────────────────────────
section('merge appends with punctuation');
{
  assert.equal(
    mergeAnswerWithAddition('I forget', 'My bedtime changes from night to night.'),
    'I forget. My bedtime changes from night to night.',
  );
  assert.equal(
    mergeAnswerWithAddition('I forget.', 'My bedtime changes from night to night.'),
    'I forget. My bedtime changes from night to night.',
  );
  assert.ok(!mergeAnswerWithAddition('I forget.', 'My bedtime changes.').includes('..'));
}

section('deselect-friendly: merge does not duplicate existing phrase');
{
  const once = mergeAnswerWithAddition('I forget.', 'My bedtime changes from night to night.');
  const twice = mergeAnswerWithAddition(once, 'My bedtime changes from night to night.');
  assert.equal(once, twice);
}

// ── Suggestions + prevalidation ──────────────────────────────────────
section('short answer yields 2–4 prevalidated suggestions');
{
  const res = buildPrevalidatedSuggestions({
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    questionId: 'hard_part',
    currentAnswer: 'I forget.',
    taskId: 't1',
    requestId: 'r1',
  });
  assert.equal(res.status, 'needs_detail');
  assert.ok(res.suggestions.length >= 2 && res.suggestions.length <= 4, `got ${res.suggestions.length}`);
  for (const s of res.suggestions) {
    const check = evaluateAnswerSufficiency('hard_part', s.validatedCombinedAnswer, 'Set a phone-down reminder 30 minutes before bed');
    assert.equal(check.status, 'sufficient', `failed for: ${s.appendText}`);
    assert.ok(!s.appendText.toLowerCase().includes('i forget'), 'should not repeat answer');
  }
}

section('selected suggestion does not need another clarification');
{
  const res = buildPrevalidatedSuggestions({
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    questionId: 'hard_part',
    currentAnswer: 'I forget.',
  });
  const picked = res.suggestions[0];
  const again = evaluateAnswerSufficiency('hard_part', picked.validatedCombinedAnswer, 'Set a phone-down reminder 30 minutes before bed');
  assert.equal(again.status, 'sufficient');
  const noLoop = buildPrevalidatedSuggestions({
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    questionId: 'hard_part',
    currentAnswer: picked.validatedCombinedAnswer,
  });
  assert.equal(noLoop.status, 'sufficient');
  assert.equal(noLoop.suggestions.length, 0);
}

section('insurance knowledge suggestions are question-specific');
{
  const res = buildPrevalidatedSuggestions({
    taskLabel: 'Call the insurance company about the denied claim',
    questionId: 'hard_part',
    currentAnswer: 'I do not know what to do.',
  });
  assert.ok(res.suggestions.length >= 2);
  const blob = res.suggestions.map(s => s.appendText.toLowerCase()).join(' | ');
  assert.ok(/claim|denial|question|letter|nervous/.test(blob), blob);
  assert.ok(!/bedtime|phone-down/.test(blob));
}

section('constraint suggestions include time/device detail');
{
  const res = buildPrevalidatedSuggestions({
    taskLabel: 'Organize the documents needed for my tax appointment',
    questionId: 'constraints',
    currentAnswer: 'I do not have much time.',
  });
  assert.ok(res.suggestions.some(s => /ten minutes|lunch|phone/i.test(s.appendText)));
  for (const s of res.suggestions) {
    assert.equal(
      evaluateAnswerSufficiency('constraints', s.validatedCombinedAnswer, 'Organize the documents needed for my tax appointment').status,
      'sufficient',
    );
  }
}

section('already sufficient returns no suggestions');
{
  const res = buildPrevalidatedSuggestions({
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    questionId: 'hard_part',
    currentAnswer: 'I usually ignore reminders once they appear on my iPhone.',
  });
  assert.equal(res.status, 'sufficient');
  assert.equal(res.suggestions.length, 0);
}

section('refresh nonce rotates candidate order');
{
  const a = buildRuleBasedDetailCandidates('hard_part', 'Set a phone-down reminder 30 minutes before bed', 'I forget.');
  const s0 = buildPrevalidatedSuggestions({
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    questionId: 'hard_part',
    currentAnswer: 'I forget.',
    refreshNonce: 0,
  });
  const s1 = buildPrevalidatedSuggestions({
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    questionId: 'hard_part',
    currentAnswer: 'I forget.',
    refreshNonce: 2,
  });
  assert.ok(a.length >= 4);
  // Different nonce should change first suggestion when bank is large enough
  assert.ok(
    s0.suggestions[0]?.appendText !== s1.suggestions[0]?.appendText
    || s0.suggestions.map(x => x.appendText).join() !== s1.suggestions.map(x => x.appendText).join(),
  );
}

section('help suggestions stay practical');
{
  const res = buildPrevalidatedSuggestions({
    taskLabel: 'Call the insurance company about the denied claim',
    questionId: 'what_would_help',
    currentAnswer: 'Some direction would help.',
  });
  assert.ok(res.suggestions.length >= 2);
  const blob = res.suggestions.map(s => s.appendText.toLowerCase()).join(' ');
  assert.ok(/script|checklist|beside me|reminder/.test(blob), blob);
}

section('irrelevant pizza answer flagged');
{
  const r = evaluateAnswerSufficiency(
    'hard_part',
    'My favorite food is pizza.',
    'Set a phone-down reminder 30 minutes before bed',
  );
  assert.equal(r.status, 'irrelevant');
}

console.log('\nAll simplify detail-assist tests passed.');
