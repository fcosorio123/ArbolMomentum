// ──────────────────────────────────────────────
// Environment Detection & Data Management
// ──────────────────────────────────────────────

/** Legacy Figma Make hosted URL (may still be in use during transition) */
export const LEGACY_FIGMA_PUBLISHED_ORIGIN = 'https://sound-press-69397091.figma.site';

/** GitHub Pages production URL (deployed from main via GitHub Actions) */
export const GITHUB_PAGES_ORIGIN = 'https://fcosorio123.github.io';
export const GITHUB_PAGES_BASE_PATH = '/ArbolMomentum';

/** Primary production URL shown in admin/debug (GitHub Pages when built with VITE_PUBLISHED) */
export const PUBLISHED_URL = import.meta.env.VITE_PUBLISHED === 'true'
  ? `${GITHUB_PAGES_ORIGIN}${GITHUB_PAGES_BASE_PATH}`
  : LEGACY_FIGMA_PUBLISHED_ORIGIN;

export const DATA_COLLECTION_START_DATE = '2026-05-14'; // May 14, 2026

/**
 * Check if the app is running on a published production URL
 * (GitHub Pages from CI, legacy Figma site, or matching hostname)
 */
export function isPublishedVersion(): boolean {
  if (typeof window === 'undefined') return false;

  // Baked in at build time for GitHub Pages deploys
  if (import.meta.env.VITE_PUBLISHED === 'true') return true;

  const { origin, pathname } = window.location;

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
 * Get the environment name for logging/debugging
 */
export function getEnvironment(): 'published' | 'development' {
  return isPublishedVersion() ? 'published' : 'development';
}

/**
 * Check if data should be collected (published version only, from May 14 onwards)
 */
export function shouldCollectData(): boolean {
  if (!isPublishedVersion()) return false;

  const now = new Date();
  const collectionStart = new Date(DATA_COLLECTION_START_DATE);

  return now >= collectionStart;
}

/**
 * Get a prefixed localStorage key based on environment
 * Published data has no prefix, development data has 'dev-' prefix
 */
export function getStorageKey(baseKey: string): string {
  const env = getEnvironment();

  // Published version uses unprefixed keys for centralized data
  if (env === 'published') {
    return baseKey;
  }

  // Development uses prefixed keys to avoid pollution
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
    isPublished: isPublishedVersion(),
    shouldCollect: shouldCollectData(),
    origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
    publishedUrl: PUBLISHED_URL,
    collectionStartDate: DATA_COLLECTION_START_DATE,
  };
}
