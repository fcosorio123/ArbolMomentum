# Optional: extra GitHub branch protection for `main`

The repo already auto-reverts accidental Figma Make pushes (see `protect-main.yml`). These GitHub settings add another layer.

## Recommended (2 minutes, keeps Cursor push workflow)

Open: https://github.com/fcosorio123/ArbolMomentum/settings/rules

1. **New branch ruleset** → name: `Protect main`
2. **Enforcement status:** Active
3. **Target branches:** `main`
4. Enable:
   - **Block force pushes**
   - **Require linear history** (optional)
5. Save

This stops force-push accidents. Figma’s normal “Push to GitHub” is still blocked by the auto-revert workflow if it overwrites code.

## Strongest (changes how you push from Cursor)

If you want **zero direct pushes** to `main`:

1. Same ruleset, also enable **Require a pull request before merging**
2. Push from Cursor to a branch (e.g. `cursor-updates`), open a PR, merge

Figma Make direct push to `main` will then **fail at GitHub** before it can overwrite anything.

## What runs automatically (no setup)

After every push to `main`, GitHub Actions:

- Detects commit messages like `Update files from Figma Make`
- Checks that files in `.github/protected-paths.txt` still exist
- Reverts the commit if either check fails
- Fails deploy to GitHub Pages if protected files are missing

You do **not** need to enable branch protection for the auto-revert to work — it is already in the repo.
