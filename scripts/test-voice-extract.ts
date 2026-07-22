/**
 * Voice extract contracts — form-population only; never persists.
 * Run: npx tsx scripts/test-voice-extract.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
  const {
    extractGoalDraftFromTranscript,
    extractTaskDraftFromTranscript,
    extractVoiceFormDraft,
  } = await import('../src/app/data/voiceExtract.ts');

  // Goal: title + why
  const g1 = extractGoalDraftFromTranscript(
    'I want to save twenty thousand pesos by December because financial security for my family.',
  );
  assert.equal(g1.recordType, 'goal');
  assert.ok(g1.draft.title && /save/i.test(g1.draft.title));
  assert.ok(g1.draft.deepWhy && /family|security/i.test(g1.draft.deepWhy));
  assert.deepEqual(g1.missingRequiredFields, []);

  // Goal: empty → missing title, no fabrication
  const gEmpty = extractGoalDraftFromTranscript('   ');
  assert.deepEqual(gEmpty.draft, {});
  assert.deepEqual(gEmpty.missingRequiredFields, ['title']);

  // Goal: plain sentence
  const g2 = extractGoalDraftFromTranscript('Launch the first version of our website by the end of August.');
  assert.ok(g2.draft.title);
  assert.equal(g2.missingRequiredFields.length, 0);

  // Task: label + time + weekly
  const goals = [
    {
      id: 'g1',
      profileId: 'p',
      title: 'Savings goal',
      deepWhy: '',
      targetValue: 0,
      currentValue: 0,
      unit: '',
      milestones: [],
      createdAt: 1,
    },
  ];
  const t1 = extractTaskDraftFromTranscript(
    'Review the budget every Monday morning for Savings goal.',
    goals,
  );
  assert.equal(t1.recordType, 'task');
  assert.ok(t1.draft.label && /budget/i.test(t1.draft.label));
  assert.equal(t1.draft.timeOfDay, 'morning');
  assert.equal(t1.draft.goalId, 'g1');
  assert.equal(t1.draft.recurrence?.type, 'weekly');
  assert.ok(t1.draft.recurrence && 'weekdays' in t1.draft.recurrence && t1.draft.recurrence.weekdays?.includes(0));
  assert.deepEqual(t1.missingRequiredFields, []);

  // Task: empty → missing label
  const tEmpty = extractTaskDraftFromTranscript('');
  assert.deepEqual(tEmpty.draft, {});
  assert.deepEqual(tEmpty.missingRequiredFields, ['label']);

  // Ambiguous one-time without date → uncertain recurrence, still may have label
  const tAmb = extractTaskDraftFromTranscript('Call the insurance company once.');
  assert.ok(tAmb.draft.label);
  assert.ok(tAmb.uncertainFields.includes('recurrence'));
  assert.equal(tAmb.draft.recurrence, undefined);

  // Router
  const r = extractVoiceFormDraft('goal', 'My goal is to finish the homepage.');
  assert.equal(r.recordType, 'goal');
  assert.ok(r.draft && 'title' in r.draft);

  // Architectural guard: voice modules must not call create/persist APIs
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const voiceFiles = [
    'src/app/data/voiceExtract.ts',
    'src/app/data/voiceSpeech.ts',
    'src/app/components/VoiceInputPanel.tsx',
  ];
  const forbidden = [
    'createUserGoal',
    'createUserTask',
    'updateUserGoal',
    'updateUserTask',
    'localStorage.setItem',
    'supabase',
  ];
  for (const rel of voiceFiles) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const bad of forbidden) {
      assert.equal(src.includes(bad), false, `${rel} must not reference ${bad}`);
    }
  }

  console.log('test-voice-extract: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
