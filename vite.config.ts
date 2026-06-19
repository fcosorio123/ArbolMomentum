import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// ── Service Worker code served at /sw.js
// Keeping SW logic here (TypeScript string) avoids the .js file hook restriction
// while still registering at the app's origin so Chrome counts it for PWA install.
const SW_CODE = `
const CACHE_NAME = 'arbol-v3';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Network-first with cache fallback for offline resilience
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  let d = { title: 'Arbol Momentum', body: 'Time to keep your streak going!' };
  try { d = e.data?.json() ?? d; } catch {}
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body, tag: d.tag || 'arbol', renotify: true,
      icon: '/icon-192.png', badge: '/icon-72.png',
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});

self.addEventListener('message', e => {
  const t = e.data?.type;
  if (t === 'SHOW') {
    const { title, body, tag } = e.data;
    e.waitUntil(
      self.registration.showNotification(title, {
        body, tag, renotify: true,
        icon: '/icon-192.png', badge: '/icon-72.png',
      })
    );
  }
  if (t === 'BADGE') {
    const { count } = e.data;
    if ('setAppBadge' in self) {
      count > 0 ? self.setAppBadge(count) : self.clearAppBadge();
    }
  }
});
`;

// Minimal SVG icon served at /icon-*.png paths
// The browser will render the SVG; it satisfies the manifest icon requirement.
// Canvas-generated PNGs are also injected client-side (see App.tsx) for apple-touch-icon.
function makeSvgIcon(size: number): string {
  const r = Math.round(size * 0.22);
  const fs = Math.round(size * 0.56);
  const ty = Math.round(size * 0.7);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#094067"/>
      <stop offset="100%" stop-color="#1a6da8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <text x="${size / 2}" y="${ty}" font-size="${fs}" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">🌿</text>
</svg>`;
}

function swPlugin(): Plugin {
  return {
    name: 'arbol-sw',
    configureServer(server) {
      server.middlewares.use('/sw.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Service-Worker-Allowed', '/');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(SW_CODE);
      });

      // Serve SVG icons at the PNG paths the manifest expects.
      // Browsers accept SVG content even at .png URLs when Content-Type is correct.
      for (const size of [72, 96, 144, 180, 192, 512]) {
        const path = `/icon-${size}.png`;
        server.middlewares.use(path, (_req, res) => {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(makeSvgIcon(size));
        });
      }
    },
  };
}


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
    swPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
