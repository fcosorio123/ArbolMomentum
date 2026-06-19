// ──────────────────────────────────────────────
// Centralized Data Collection Service
// ──────────────────────────────────────────────
// NOTE: This currently uses localStorage but is structured
// to be easily migrated to Supabase for true cross-user
// centralized data collection.

import { isPublishedVersion, shouldCollectData } from './environment';

export interface DataRecord {
  id: string;
  timestamp: number;
  profileId: string;
  dataType: string;
  data: any;
  environment: 'published' | 'development';
}

// ── Centralized Data Storage (localStorage for now, Supabase-ready)

const CENTRAL_DATA_KEY = 'arbol-central-data';

/**
 * Get all centralized data records
 * NOTE: In production with Supabase, this would query the database
 */
export function getAllCentralData(): DataRecord[] {
  if (!isPublishedVersion()) {
    // Development mode - return empty to avoid seeing unpublished data
    return [];
  }

  const stored = localStorage.getItem(CENTRAL_DATA_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Save a data record to centralized storage
 * NOTE: In production with Supabase, this would insert to database
 */
export function saveCentralDataRecord(record: Omit<DataRecord, 'id' | 'timestamp' | 'environment'>): void {
  if (!shouldCollectData()) {
    // Don't collect data from development or before collection start date
    console.log('[Data Collection] Skipped - not published version or before start date');
    return;
  }

  const records = getAllCentralData();

  const newRecord: DataRecord = {
    ...record,
    id: `${record.profileId}-${record.dataType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    environment: 'published',
  };

  records.push(newRecord);

  // Keep last 10,000 records to prevent localStorage overflow
  const trimmed = records.slice(-10000);

  localStorage.setItem(CENTRAL_DATA_KEY, JSON.stringify(trimmed));
}

/**
 * Query centralized data by filters
 */
export function queryCentralData(filters: {
  profileId?: string;
  dataType?: string;
  startDate?: number;
  endDate?: number;
}): DataRecord[] {
  const allData = getAllCentralData();

  return allData.filter(record => {
    if (filters.profileId && record.profileId !== filters.profileId) return false;
    if (filters.dataType && record.dataType !== filters.dataType) return false;
    if (filters.startDate && record.timestamp < filters.startDate) return false;
    if (filters.endDate && record.timestamp > filters.endDate) return false;
    return true;
  });
}

/**
 * Get data collection stats
 */
export function getDataCollectionStats() {
  const allData = getAllCentralData();

  const byProfile: Record<string, number> = {};
  const byType: Record<string, number> = {};

  allData.forEach(record => {
    byProfile[record.profileId] = (byProfile[record.profileId] || 0) + 1;
    byType[record.dataType] = (byType[record.dataType] || 0) + 1;
  });

  return {
    totalRecords: allData.length,
    byProfile,
    byType,
    oldestRecord: allData[0]?.timestamp,
    newestRecord: allData[allData.length - 1]?.timestamp,
  };
}

/**
 * Clear all centralized data (admin only, requires confirmation)
 */
export function clearCentralData(): boolean {
  const confirmed = window.confirm(
    '⚠️ DELETE ALL CENTRALIZED DATA?\n\n' +
    'This will permanently delete all collected data from all users since May 14, 2026.\n\n' +
    'This action CANNOT be undone.\n\n' +
    'Type "DELETE" in the next prompt to confirm.'
  );

  if (!confirmed) return false;

  const confirmText = window.prompt('Type "DELETE" to confirm:');

  if (confirmText !== 'DELETE') {
    alert('Cancelled. Data was not deleted.');
    return false;
  }

  localStorage.removeItem(CENTRAL_DATA_KEY);
  alert('All centralized data has been deleted.');
  return true;
}

// ── Export centralized data as JSON (for backup/analysis)

export function exportCentralDataAsJSON(): string {
  const data = getAllCentralData();
  return JSON.stringify(data, null, 2);
}

export function downloadCentralDataBackup(): void {
  const json = exportCentralDataAsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `arbol-central-data-backup-${new Date().toISOString()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}
