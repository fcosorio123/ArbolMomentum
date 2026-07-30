// ──────────────────────────────────────────────
// Environment Detection & Data Management
// ──────────────────────────────────────────────

/** Legacy Figma Make hosted URL (redirects to canonical production; see scripts/figma-redirect-snippet.js) */
export const LEGACY_FIGMA_PUBLISHED_ORIGIN = 'https://sound-press-69397091.figma.site';

/** GitHub Pages production URL (deployed from main via GitHub Actions) */
export const GITHUB_PAGES_ORIGIN = 'https://fcosorio123.github.io';
export const GITHUB_PAGES_BASE_PATH = '/ArbolMomentum';
export const GITHUB_PAGES_STAGING_BASE_PATH = '/ArbolMomentum/staging';

/** Canonical production URL - always GitHub Pages (auto-deploys on push to main) */
export const CANONICAL_PRODUCTION_URL = `${GITHUB_PAGES_ORIGIN}${GITHUB_PAGES_BASE_PATH}`;

/** Staging frontend URL (deployed from staging branch via GitHub Actions) */
export const CANONICAL_STAGING_URL = `${GITHUB_PAGES_ORIGIN}${GITHUB_PAGES_STAGING_BASE_PATH}`;

/** @deprecated Use CANONICAL_PRODUCTION_URL */
export const PUBLISHED_URL = CANONICAL_PRODUCTION_URL;

export type AppEnv = 'production' | 'staging' | 'development';

/**
 * Build-time / runtime app environment.
 * Staging is never treated as production for student notification routing.
 */
export function getAppEnv(): AppEnv {
  const baked = String(import.meta.env?.VITE_APP_ENV || '').toLowerCase();
  if (baked === 'staging' || baked === 'production' || baked === 'development') {
    return baked;
  }
  if (typeof window !== 'undefined') {
    const { origin, pathname } = window.location;
    if (
      origin === GITHUB_PAGES_ORIGIN &&
      (pathname === GITHUB_PAGES_STAGING_BASE_PATH ||
        pathname.startsWith(`${GITHUB_PAGES_STAGING_BASE_PATH}/`))
    ) {
      return 'staging';
    }
  }
  if (isPublishedVersion()) return 'production';
  return 'development';
}

export function isStagingVersion(): boolean {
  return getAppEnv() === 'staging';
}

export function getCanonicalProductionUrl(): string {
  return CANONICAL_PRODUCTION_URL;
}

export function getCanonicalAppUrl(): string {
  const env = getAppEnv();
  if (env === 'staging') return CANONICAL_STAGING_URL;
  if (env === 'production') return CANONICAL_PRODUCTION_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return CANONICAL_PRODUCTION_URL;
}

export const DATA_COLLECTION_START_DATE = '2026-05-14'; // May 14, 2026

/**
 * Check if the app is running on a published production URL
 * (GitHub Pages from CI, legacy Figma site, or matching hostname)
 */
export function isPublishedVersion(): boolean {
  if (typeof window === 'undefined') return false;

  // Staging builds set VITE_PUBLISHED=true for cloud sync but are NOT production.
  const bakedEnv = String(import.meta.env?.VITE_APP_ENV || '').toLowerCase();
  if (bakedEnv === 'staging') return false;

  const { origin, pathname } = window.location;
  if (
    origin === GITHUB_PAGES_ORIGIN &&
    (pathname === GITHUB_PAGES_STAGING_BASE_PATH ||
      pathname.startsWith(`${GITHUB_PAGES_STAGING_BASE_PATH}/`))
  ) {
    return false;
  }

  // Baked in at build time for GitHub Pages production deploys
  if (import.meta.env?.VITE_PUBLISHED === 'true' && bakedEnv !== 'staging') return true;

  if (origin === LEGACY_FIGMA_PUBLISHED_ORIGIN) return true;

  if (
    origin === GITHUB_PAGES_ORIGIN &&
    (pathname === GITHUB_PAGES_BASE_PATH || pathname.startsWith(`${GITHUB_PAGES_BASE_PATH}/`))
  ) {
    return true;
  }

  return false;
}

/**
 * Check if the app is running in development/unpublished mode
 */
export function isDevelopmentVersion(): boolean {
  return !isPublishedVersion();
}

/**
 * AI Assist Creation V2 gate.
 * Enabled on non-published hosts, or when VITE_ENABLE_AI_ASSIST_CREATION=true at build time.
 */
export function isAiAssistCreationEnabled(): boolean {
  if (import.meta.env?.VITE_ENABLE_AI_ASSIST_CREATION === 'true') return true;
  return isDevelopmentVersion();
}

/**
 * Get the environment name for logging/debugging
 */
export function getEnvironment(): 'published' | 'staging' | 'development' {
  const appEnv = getAppEnv();
  if (appEnv === 'staging') return 'staging';
  return isPublishedVersion() ? 'published' : 'development';
}

/**
 * Check if data should be collected (published or staging, from May 14 onwards).
 * Staging events must include app_env=staging metadata (see engagementEvents).
 */
export function shouldCollectData(): boolean {
  const env = getAppEnv();
  if (env !== 'production' && env !== 'staging') return false;

  const now = new Date();
  const collectionStart = new Date(DATA_COLLECTION_START_DATE);

  return now >= collectionStart;
}

/**
 * Get a prefixed localStorage key based on environment
 * Production: unprefixed. Staging: staging-. Development: dev-.
 */
export function getStorageKey(baseKey: string): string {
  const env = getEnvironment();

  if (env === 'published') {
    return baseKey;
  }
  if (env === 'staging') {
    return `staging-${baseKey}`;
  }

  return `dev-${baseKey}`;
}

/**
 * Confirm before clearing production data
 */
export function confirmDataReset(action: string): boolean {
  if (!isPublishedVersion()) {
    // Development mode - allow without confirmation
    return true;
  }

  // Published mode - require confirmation
  const confirmed = window.confirm(
    `⚠️ PRODUCTION DATA RESET\n\n` +
    `You are about to ${action} on the published version.\n\n` +
    `This will affect real user data collected since ${DATA_COLLECTION_START_DATE}.\n\n` +
    `Are you absolutely sure you want to continue?`
  );

  return confirmed;
}

/**
 * Check if data migration from old keys is needed
 */
export function needsDataMigration(): boolean {
  if (!isPublishedVersion()) return false;

  const migrationKey = 'arbol-data-migrated-v1';
  return !localStorage.getItem(migrationKey);
}

/**
 * Mark data migration as complete
 */
export function markDataMigrated(): void {
  localStorage.setItem('arbol-data-migrated-v1', 'true');
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    environment: getEnvironment(),
    appEnv: getAppEnv(),
    isPublished: isPublishedVersion(),
    isStaging: isStagingVersion(),
    shouldCollect: shouldCollectData(),
    origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
    publishedUrl: PUBLISHED_URL,
    stagingUrl: CANONICAL_STAGING_URL,
    collectionStartDate: DATA_COLLECTION_START_DATE,
  };
}
