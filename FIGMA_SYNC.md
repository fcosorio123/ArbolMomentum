# Production URLs and Figma Make sync

## Canonical production (auto-updates)

**https://fcosorio123.github.io/ArbolMomentum/**

Every push to `main` deploys here via GitHub Actions (`.github/workflows/deploy-frontend.yml`).

## Legacy Figma Make URL

**https://sound-press-69397091.figma.site**

Figma Make publishes to `*.figma.site` from the Figma editor only. There is **no API or GitHub Action** that can push builds to Figma Make hosting.

### What we did instead

1. **Redirect** — The app includes a small script (`public/scripts/figma-redirect-snippet.js`) that sends visitors from the Figma URL to GitHub Pages. After this is live on Figma, the old link always shows the latest build.

2. **`npm run build:figma`** — Builds a root-path bundle (`VITE_BASE_PATH=/`) suitable for a one-time Figma Make republish.

3. **GitHub Actions artifact** — Each deploy also uploads a `figma-publish-bundle` you can download if needed.

## One-time: activate redirect on Figma Make

Do this once so `sound-press-69397091.figma.site` forwards to GitHub Pages:

1. Open your [Figma Make file](https://www.figma.com/design/d8cDh8DPdqXBqJbzLPlWRo/Arbol-Momentum).
2. **Sync code from GitHub** (recommended):
   - Connect the Make file to `fcosorio123/ArbolMomentum` if not already linked, **or**
   - Pull / merge latest `main` into the Make project.
3. Click **Publish** (upper-right) and republish to the same `figma.site` URL.

After that, anyone using the Figma link is redirected to GitHub Pages, which stays in sync with `main`.

### Alternative: download CI artifact

1. Open **Actions** → latest **Deploy frontend to GitHub Pages** run.
2. Download **figma-publish-bundle**.
3. In Figma Make, update code from the bundle and **Publish**.

## Debug

- Append `?stay=1` to the Figma URL to skip redirect (e.g. testing the old host).
- Use GitHub Pages directly for day-to-day testing and sharing.

## Email / Supabase

Set `APP_BASE_URL` to `https://fcosorio123.github.io/ArbolMomentum` (see `supabase/.secrets.env.example`).
