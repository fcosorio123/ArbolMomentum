/**
 * Post-build step for GitHub Pages: SPA fallback + optional manifest base patch.
 */
import fs from 'fs';
import path from 'path';

const dist = path.resolve('dist');
const index = path.join(dist, 'index.html');
const fallback = path.join(dist, '404.html');

if (!fs.existsSync(index)) {
  console.error('prepare-pages-dist: dist/index.html not found');
  process.exit(1);
}

fs.copyFileSync(index, fallback);
console.log('prepare-pages-dist: copied index.html -> 404.html');

const base = process.env.VITE_BASE_PATH || '/ArbolMomentum/';
const manifestPath = path.join(dist, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(raw);
  manifest.start_url = base;
  manifest.scope = base;
  const prefix = base.endsWith('/') ? base : `${base}/`;
  manifest.icons = (manifest.icons ?? []).map(icon => ({
    ...icon,
    src: icon.src.startsWith('http') ? icon.src : `${prefix}${icon.src.replace(/^\.\//, '')}`,
  }));
  if (manifest.shortcuts) {
    manifest.shortcuts = manifest.shortcuts.map(s => ({
      ...s,
      url: s.url.startsWith('http') ? s.url : `${prefix}${s.url.replace(/^\.\//, '')}`,
    }));
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`prepare-pages-dist: patched manifest.json for base ${base}`);
}
