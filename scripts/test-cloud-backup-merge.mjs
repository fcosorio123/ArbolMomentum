/**
 * Cloud backup stale-overwrite guard (WP-05).
 * Run: node scripts/test-cloud-backup-merge.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEdgeBase, ANON } from './edge-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = getEdgeBase();
const TEST_ID = 'c1-merge-test';

const headers = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

let passed = 0;
let failed = 0;

function assert(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function invoke(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

console.log('\nCloud backup merge guard test\n');

const now = Date.now();
const newerAt = now + 60_000;

// Seed newer cloud backup with email
const seed = await invoke(`/backup/${TEST_ID}`, {
  method: 'POST',
  body: {
    profileEmail: 'cloud-newer@example.com',
    nudgeSnapshot: { dateKey: '2026-07-12', pending: 1, done: 0, streak: 1, checkedIn: false },
    savedAt: newerAt,
  },
});
assert('seed newer cloud backup', seed.data?.ok === true);

// Stale client push must be rejected
const stale = await invoke(`/backup/${TEST_ID}`, {
  method: 'POST',
  body: {
    profileEmail: 'stale-local@example.com',
    savedAt: now,
  },
});
assert('reject stale local push', stale.data?.ok === false && stale.data?.reason === 'stale_backup', stale.data?.reason);

// Fresh push must succeed
const fresh = await invoke(`/backup/${TEST_ID}`, {
  method: 'POST',
  body: {
    profileEmail: 'fresh-local@example.com',
    nudgeSnapshot: { dateKey: '2026-07-12', pending: 2, done: 1, streak: 2, checkedIn: true },
    savedAt: newerAt + 1000,
  },
});
assert('accept fresh local push', fresh.data?.ok === true);

const read = await invoke(`/backup/${TEST_ID}`);
assert('fresh email persisted', read.data?.data?.profileEmail === 'fresh-local@example.com');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
