/**
 * Profile roster merge / discovery tests.
 */
import assert from 'node:assert/strict';
import {
  isCustomProfileId,
  mergeRosterProfiles,
  normalizeRosterMeta,
  rosterMetaFromBackup,
} from '../src/app/data/profileRoster.ts';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

section('custom id detection');
{
  assert.equal(isCustomProfileId('custom-alex-1'), true);
  assert.equal(isCustomProfileId('favio'), false);
  assert.equal(isCustomProfileId('eu'), false);
}

section('normalize rejects builtins and empty');
{
  assert.equal(normalizeRosterMeta({ id: 'favio', name: 'Favio' }), null);
  assert.equal(normalizeRosterMeta(null), null);
  const meta = normalizeRosterMeta({
    id: 'custom-test-1',
    name: 'Test',
    avatar: '🧪',
    profileType: 'fresh',
    createdAt: 100,
  });
  assert.ok(meta);
  assert.equal(meta!.id, 'custom-test-1');
  assert.equal(meta!.name, 'Test');
  assert.equal(meta!.avatar, '🧪');
}

section('merge prefers newer createdAt across devices');
{
  const a = normalizeRosterMeta({
    id: 'custom-a-1', name: 'A', avatar: '🌱', createdAt: 100, profileType: 'fresh',
  })!;
  const b = normalizeRosterMeta({
    id: 'custom-a-1', name: 'A Updated', avatar: '🚀', createdAt: 200, profileType: 'fresh',
  })!;
  const c = normalizeRosterMeta({
    id: 'custom-b-2', name: 'B', avatar: '⭐', createdAt: 150, profileType: 'seeded',
  })!;
  const merged = mergeRosterProfiles([a], [b, c]);
  assert.equal(merged.length, 2);
  const aRow = merged.find(p => p.id === 'custom-a-1')!;
  assert.equal(aRow.name, 'A Updated');
  assert.equal(aRow.avatar, '🚀');
  assert.ok(merged.some(p => p.id === 'custom-b-2'));
}

section('backup backfill reconstructs orphan custom profiles');
{
  const meta = rosterMetaFromBackup('custom-jordan-177000', {
    savedAt: 177000,
    nudgeSnapshot: { profileName: 'Jordan' },
  });
  assert.ok(meta);
  assert.equal(meta!.id, 'custom-jordan-177000');
  assert.equal(meta!.name, 'Jordan');
  assert.equal(meta!.profileType, 'fresh');
}

section('explicit customProfileMeta wins over nudgeSnapshot');
{
  const meta = rosterMetaFromBackup('custom-x-1', {
    savedAt: 1,
    customProfileMeta: {
      id: 'custom-x-1',
      name: 'Exact',
      avatar: '🎯',
      profileType: 'seeded',
      createdAt: 50,
    },
    nudgeSnapshot: { profileName: 'Wrong' },
  });
  assert.ok(meta);
  assert.equal(meta!.name, 'Exact');
  assert.equal(meta!.avatar, '🎯');
  assert.equal(meta!.profileType, 'seeded');
}

console.log('\nAll profile roster tests passed.\n');
