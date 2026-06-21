/**
 * Post-build for Figma Make publish bundle (root base path, SPA fallback).
 */
import fs from 'fs';
import path from 'path';

const dist = path.resolve('dist');
const index = path.join(dist, 'index.html');
const fallback = path.join(dist, '404.html');

if (!fs.existsSync(index)) {
  console.error('prepare-figma-dist: dist/index.html not found');
  process.exit(1);
}

fs.copyFileSync(index, fallback);
console.log('prepare-figma-dist: copied index.html -> 404.html');

const manifestPath = path.join(dist, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(raw);
  manifest.start_url = '/';
  manifest.scope = '/';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('prepare-figma-dist: patched manifest.json for root base');
}
