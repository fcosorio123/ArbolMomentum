#!/usr/bin/env node
/**
 * ArbolMomentum Running Backup — cross-platform manual snapshot before Figma Publish.
 * Usage: npm run backup:running
 */
import { execSync } from 'node:child_process';

const branch = 'running-backup';
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2');
const tag = `running-backup/${stamp}`;

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

console.log('\nArbolMomentum Running Backup\n');

try {
  run('git fetch origin');
  run(`git push origin HEAD:refs/heads/${branch} --force-with-lease`);
  run(`git tag -a ${tag} -m "ArbolMomentum Running Backup ${stamp} (pre-Figma publish snapshot)"`);
  run(`git push origin ${tag}`);
  console.log(`\nDone. Branch: running-backup  Tag: ${tag}\n`);
} catch {
  process.exit(1);
}
