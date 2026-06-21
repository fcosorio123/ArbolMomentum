import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const manifestPath = join(process.cwd(), '.github', 'protected-paths.txt');
const lines = readFileSync(manifestPath, 'utf8').split(/\r?\n/);
const missing = [];

for (const line of lines) {
  const path = line.trim();
  if (!path || path.startsWith('#')) continue;
  if (!existsSync(join(process.cwd(), path))) missing.push(path);
}

if (missing.length > 0) {
  console.error('Protected paths missing on main:');
  for (const path of missing) console.error(`  - ${path}`);
  process.exit(1);
}

console.log(`Protected paths OK (${lines.filter(l => l.trim() && !l.trim().startsWith('#')).length} files).`);
