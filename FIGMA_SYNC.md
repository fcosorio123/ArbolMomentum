# Sync GitHub → Figma Make (no Push to GitHub from Figma)

GitHub `main` is the source of truth. **Never click Push to GitHub in Figma.**

---

## ArbolMomentum Running Backup (safety net before Publish)

**Publish in Figma Make deploys to figma.site — it does not overwrite GitHub.**  
The real risk is accidentally **Push to GitHub** from Figma (already auto-reverted) or losing track of what was last good before a publish.

This repo keeps a **Running Backup** branch on GitHub:

| What | Where |
|------|--------|
| Live code | `main` |
| Snapshot mirror | `running-backup` (auto-updated after every push to `main`) |
| Pre-publish tag (optional) | `running-backup/YYYY-MM-DD-HHmm` |

### Automatic (after every Cursor push)

GitHub Actions mirrors `main` → `running-backup` within ~1 minute.

### Manual (right before Figma Publish → Update)

```bash
npm run backup:running
```

Or on Windows: `.\scripts\Update-RunningBackup.ps1`

This updates `running-backup` and adds a **dated tag** so you can restore an exact moment.

### Restore if something goes wrong

```bash
git fetch origin
git checkout running-backup
# or reset main locally: git reset --hard origin/running-backup
```

**Recommended workflow:** Cursor → push `main` → (optional) `npm run backup:running` → Figma Make pull/ZIP sync → **Publish → Update**.

---

## Method 1 — ZIP upload (recommended, always works)

No GitHub token required in Figma. Repo can be public or private.

### Step 1 — Get a ZIP of GitHub main

**Option A — From your machine (easiest if you use Cursor):**

```bash
npm run pack:figma-sync
```

Creates `figma-sync-from-github.zip` in the project root (exact current `main` code).

**Option B — From GitHub website:**

1. Log in as **fcosorio123**
2. Open https://github.com/fcosorio123/ArbolMomentum
3. **Code → Download ZIP**

### Step 2 — Upload to Figma Make chat

1. Open your [Figma Make file](https://www.figma.com/design/d8cDh8DPdqXBqJbzLPlWRo/Arbol-Momentum)
2. Open **Make chat**
3. **Attach/upload** the ZIP file
4. Paste the prompt from `scripts/figma-make-upload-prompt.txt`

### Step 3 — Publish

1. Wait for chat to finish replacing files
2. **Publish → Update** (top-right)
3. Hard-refresh https://sound-press-69397091.figma.site

Repeat whenever Cursor pushes new code to GitHub.

---

## Method 2 — GitHub PAT in chat (only if ZIP fails)

Only works if the PAT belongs to **fcosorio123** (or a collaborator with read access).

See `scripts/figma-make-sync-prompt.txt` and the troubleshooting section below.

---

## Protection

If you accidentally **Push to GitHub** from Figma, GitHub Actions auto-reverts `main` within ~1 minute.

---

## URLs

- **GitHub Pages (always latest after push):** https://fcosorio123.github.io/ArbolMomentum/
- **Figma site (after Publish):** https://sound-press-69397091.figma.site

---

## Troubleshooting PAT / "repo does not exist"

Figma’s token often belongs to a **different GitHub account** than `fcosorio123`. Use **Method 1 (ZIP)** instead.

If you insist on PAT:

1. Log in as **fcosorio123** → confirm repo opens
2. Fine-grained token → **Resource owner: fcosorio123** → only `ArbolMomentum` → Contents read-only
3. Option A in Figma chat → paste token
4. **Do not** Push to GitHub or Create repository

---

## Method 3 — Figma Beta desktop (Mac)

Clone repository from GitHub (OAuth as fcosorio123) → Publish.

Requires `.figma/make/` in repo (already included).
