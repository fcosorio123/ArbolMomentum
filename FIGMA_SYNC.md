# Keep Figma Make in sync (no manual code editing)

GitHub (`main`) is the source of truth. **Do not use Push to GitHub in Figma** — that overwrites newer GitHub code with stale Make code.

## Protection if you accidentally Push to GitHub from Figma

This repo has an automatic guard on `main`:

1. **`.github/workflows/protect-main.yml`** — if a push looks like Figma Make (commit message) or removes protected feature files, GitHub Actions **reverts that commit automatically** within about a minute.
2. **Deploy gate** — GitHub Pages will not deploy if protected files are missing.

Protected file list: `.github/protected-paths.txt`

Optional stronger lock (one-time, in GitHub): see **`.github/BRANCH_PROTECTION.md`**.

Production URLs:

- **GitHub Pages (always current after push):** https://fcosorio123.github.io/ArbolMomentum/
- **Figma site:** https://sound-press-69397091.figma.site (only updates when you **Publish** from Make)

This repo includes `.figma/make/` so Figma can run the Vite app when linked to GitHub.

---

## Option A — Figma Make chat (web, no code panel)

You do **not** need to paste scripts or edit files by hand.

1. Open your [Figma Make file](https://www.figma.com/design/d8cDh8DPdqXBqJbzLPlWRo/Arbol-Momentum).
2. Open the **Make chat** and paste this **once** after we push updates:

```
Sync this entire project from GitHub repository fcosorio123/ArbolMomentum branch main.
Replace all application source files to match GitHub exactly.
Do not push anything back to GitHub.
Keep vite.config, package.json, and src/ in sync with the repo.
```

3. When the chat finishes, click **Publish → Update** (top-right).
4. Open https://sound-press-69397091.figma.site and hard-refresh.

Repeat steps 2–4 whenever you want the Figma URL to match GitHub. Step 2 is one chat message — not editing code yourself.

The same prompt lives in `scripts/figma-make-sync-prompt.txt` for copy-paste.

---

## Option B — Clone repo in Figma Beta (Mac desktop)

If you use **Figma Beta for desktop (Mac)**:

1. **Make a copy → Clone repository from GitHub**
2. Repository: `fcosorio123/ArbolMomentum`, branch `main`
3. Figma reads `.figma/make/` for install, dev, and verify
4. **Publish → Update** when ready

After the first clone, pulling latest from GitHub + Publish keeps the Figma site current without rewriting files in Make.

---

## What we cannot automate

Figma has no API to **Publish** your Make site from GitHub Actions. Until the Make file is synced (Option A or B) and published, `figma.site` may lag behind GitHub Pages.

**Bookmark GitHub Pages** for the guaranteed-latest build: https://fcosorio123.github.io/ArbolMomentum/
