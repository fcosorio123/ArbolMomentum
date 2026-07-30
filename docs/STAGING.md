# Staging Environment — Arbol Momentum

## URLs

| Env | URL |
|-----|-----|
| **Production** | https://fcosorio123.github.io/ArbolMomentum/ |
| **Staging** | https://fcosorio123.github.io/ArbolMomentum/staging/ |

## Deploy staging frontend

```bash
git push -u origin feat/adaptive-engagement-r1:staging
```

Workflow: `.github/workflows/deploy-staging.yml` builds with:

- `VITE_APP_ENV=staging`
- `VITE_BASE_PATH=/ArbolMomentum-staging/`
- `VITE_PUBLISHED=true` (cloud sync on) but `isPublishedVersion()` is false for staging paths

## Data isolation (client)

- localStorage keys use `staging-` prefix (`getStorageKey`)
- Events include `app_env: staging` metadata
- Admin funnel can filter by `app_env`

## Email safety

Edge `emailSend` when `APP_ENV=staging` or `STAGING_EMAIL_MODE=1`:

- Blocks sends unless recipient is in `testRecipient` or `STAGING_EMAIL_ALLOWLIST`
- Returns `staging_recipient_blocked` otherwise

Set Supabase Edge secrets for staging deploys of the function:

- `APP_ENV=staging` (only on a staging-dedicated function if available)
- Or keep production edge without `APP_ENV=staging` and rely on frontend staging + feature controls off in prod

**Note:** Full separate Supabase project is preferred for backend isolation. Until that exists, staging frontend + allowlisted email + feature controls (defaults off in production) form the minimum safe boundary. Do not enable student-facing deferral/attribution on production until staging matrix passes.

## Test profiles

Create profiles with ids/names clearly marked for QA (e.g. `staging-qa-1`). Prefer not to use real student emails on staging.

## Feature controls (Admin → Settings)

Defaults in production: all engagement controls **off**.

Staging QA defaults (first load only): attribution, admin funnel, deferral UI, deferral reminders **on**; reason capture **off** (privacy).

## Reset / cleanup

- Clear `staging-*` localStorage keys in the browser
- Filter/ignore `app_env=staging` events in production reporting
- Do not delete production `event_logs`

## Staging acceptance matrix (minimum)

1. Open staging URL — see STAGING banner
2. Unlock + select QA profile
3. Open `/?checkin=1&nid=n_test12345678&cta=cta.open_checkin` — check-in opens; destination event fires when attribution on
4. Task overflow → Work on this later — status unchanged
5. Admin funnel visible when control on — Entry / Recovery / Execution separate; filter labeled **Profile**
6. No email to non-allowlisted addresses when staging email mode on
