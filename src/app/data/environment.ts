// ──────────────────────────────────────────────
// Environment Detection & Data Management
// ──────────────────────────────────────────────

export const PUBLISHED_URL = 'https://sound-press-69397091.figma.site';
export const DATA_COLLECTION_START_DATE = '2026-05-14'; // May 14, 2026

/**
 * Check if the app is running on the published production URL
 */
export function isPublishedVersion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.origin === PUBLISHED_URL;
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
    collectionStartDate: DATA_COLLECTION_START_DATE,
  };
}
