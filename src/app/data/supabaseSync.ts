// ──────────────────────────────────────────────
// Supabase Data Synchronization Service
// ──────────────────────────────────────────────
// Writes to both localStorage (offline) and Supabase (centralized)

import { supabase } from '/utils/supabase/client';
import { isPublishedVersion, shouldCollectData } from './environment';
import type {
  TaskCompletion, GoalProgress, FeedbackEntry,
  DeviceRecord, EventLog, TaskDeleted
} from '/utils/supabase/client';

// Helper to dispatch sync event for UI indicator
function notifySynced() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase-sync'));
  }
}

// ── Task Completions ──────────────────────────

export async function syncTaskStatus(
  profileId: string,
  taskId: string,
  date: string,
  status: 'inprogress' | 'done' | null
): Promise<void> {
  // NOTE: localStorage is handled by profiles.ts - we only sync to Supabase here

  // Sync to Supabase if published
  if (!shouldCollectData()) return;

  try {
    if (status === null) {
      // Delete from Supabase
      await supabase
        .from('task_completions')
        .delete()
        .eq('profile_id', profileId)
        .eq('task_id', taskId)
        .eq('date', date);
    } else {
      // Upsert to Supabase
      await supabase
        .from('task_completions')
        .upsert({
          profile_id: profileId,
          task_id: taskId,
          date,
          status,
        }, {
          onConflict: 'profile_id,task_id,date'
        });
    }
    notifySynced();
  } catch (error) {
    console.error('[Supabase Sync] Failed to sync task status:', error);
  }
}

export async function syncTaskDeletion(
  profileId: string,
  taskId: string,
  date: string
): Promise<void> {
  // NOTE: localStorage is handled by profiles.ts - we only sync to Supabase here

  // Sync to Supabase if published
  if (!shouldCollectData()) return;

  try {
    await supabase
      .from('task_deletions')
      .upsert({
        profile_id: profileId,
        task_id: taskId,
        date,
      }, {
        onConflict: 'profile_id,task_id,date'
      });
    notifySynced();
  } catch (error) {
    console.error('[Supabase Sync] Failed to sync task deletion:', error);
  }
}

// ── Goal Progress ──────────────────────────────

export async function syncGoalProgress(log: {
  goalId: string;
  profileId: string;
  timestamp: number;
  taskCompleted: string;
  amountLogged?: number;
  notes?: string;
  milestoneHit?: string;
}): Promise<string> {
  // Generate ID
  const logId = `${log.profileId}-${log.goalId}-${log.timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  // Save to localStorage
  const localKey = `arbol-goal-logs-${log.profileId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  existing.push({ id: logId, ...log });
  localStorage.setItem(localKey, JSON.stringify(existing));

  // Sync to Supabase if published
  if (!shouldCollectData()) return logId;

  try {
    await supabase
      .from('goal_progress')
      .insert({
        id: logId,
        profile_id: log.profileId,
        goal_id: log.goalId,
        task_completed: log.taskCompleted,
        amount_logged: log.amountLogged,
        notes: log.notes,
        milestone_hit: log.milestoneHit,
      });
  } catch (error) {
    console.error('[Supabase Sync] Failed to sync goal progress:', error);
  }

  return logId;
}

// ── Feedback ──────────────────────────────────

export async function syncFeedback(entry: {
  profileId: string;
  rating: number;
  whatWorked?: string[];
  whatDidnt?: string[];
  suggestion?: string;
  date: string;
  timestamp: number;
}): Promise<void> {
  // Save to localStorage
  const localKey = `arbol-feedback-${entry.profileId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  existing.push(entry);
  localStorage.setItem(localKey, JSON.stringify(existing));

  // Sync to Supabase if published
  if (!shouldCollectData()) return;

  try {
    await supabase
      .from('feedback')
      .insert({
        profile_id: entry.profileId,
        rating: entry.rating,
        what_worked: entry.whatWorked,
        what_didnt: entry.whatDidnt,
        suggestion: entry.suggestion,
        date: entry.date,
      });
  } catch (error) {
    console.error('[Supabase Sync] Failed to sync feedback:', error);
  }
}

// ── Device Records ──────────────────────────────

export async function syncDeviceRecord(
  profileId: string,
  record: Partial<DeviceRecord>
): Promise<void> {
  // Save to localStorage
  const localKey = `arbol-device-${profileId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '{}');
  const updated = { ...existing, ...record, lastUpdated: Date.now() };
  localStorage.setItem(localKey, JSON.stringify(updated));

  // Sync to Supabase if published
  if (!shouldCollectData()) return;

  try {
    await supabase
      .from('device_records')
      .upsert({
        profile_id: profileId,
        os: record.os,
        browser: record.browser,
        is_pwa: record.is_pwa,
        push_supported: record.push_supported,
        badge_supported: record.badge_supported,
        notif_permission: record.notif_permission,
        last_notif_sent: record.last_notif_sent,
      }, {
        onConflict: 'profile_id'
      });
  } catch (error) {
    console.error('[Supabase Sync] Failed to sync device record:', error);
  }
}

// ── Event Logs ──────────────────────────────────

export async function syncEventLog(
  profileId: string,
  event: string,
  metadata?: any
): Promise<void> {
  // Save to localStorage
  const localKey = `arbol-events-${profileId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const entry = { profileId, event, timestamp: Date.now(), metadata };
  existing.push(entry);
  // Keep last 100 events in localStorage
  const trimmed = existing.slice(-100);
  localStorage.setItem(localKey, JSON.stringify(trimmed));

  // Sync to Supabase if published
  if (!shouldCollectData()) return;

  try {
    await supabase
      .from('event_logs')
      .insert({
        profile_id: profileId,
        event,
        metadata,
      });
  } catch (error) {
    console.error('[Supabase Sync] Failed to sync event log:', error);
  }
}

// ── Admin Data Fetching ──────────────────────────

/**
 * Fetch all task completions from Supabase (admin view)
 */
export async function fetchAllTaskCompletions(
  filters?: { profileId?: string; date?: string }
): Promise<TaskCompletion[]> {
  if (!isPublishedVersion()) {
    // Development mode - return empty
    return [];
  }

  try {
    let query = supabase.from('task_completions').select('*');

    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId);
    }
    if (filters?.date) {
      query = query.eq('date', filters.date);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase Fetch] Failed to fetch task completions:', error);
    return [];
  }
}

/**
 * Fetch all task deletions from Supabase (admin view)
 */
export async function fetchAllTaskDeletions(
  filters?: { profileId?: string; date?: string }
): Promise<TaskDeleted[]> {
  if (!isPublishedVersion()) {
    return [];
  }

  try {
    let query = supabase.from('task_deletions').select('*');

    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId);
    }
    if (filters?.date) {
      query = query.eq('date', filters.date);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase Fetch] Failed to fetch task deletions:', error);
    return [];
  }
}

/**
 * Fetch all goal progress logs from Supabase (admin view)
 */
export async function fetchAllGoalProgress(
  filters?: { profileId?: string; goalId?: string }
): Promise<GoalProgress[]> {
  if (!isPublishedVersion()) {
    return [];
  }

  try {
    let query = supabase.from('goal_progress').select('*');

    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId);
    }
    if (filters?.goalId) {
      query = query.eq('goal_id', filters.goalId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase Fetch] Failed to fetch goal progress:', error);
    return [];
  }
}

/**
 * Fetch all feedback from Supabase (admin view)
 */
export async function fetchAllFeedback(
  profileId?: string
): Promise<FeedbackEntry[]> {
  if (!isPublishedVersion()) {
    return [];
  }

  try {
    let query = supabase.from('feedback').select('*');

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase Fetch] Failed to fetch feedback:', error);
    return [];
  }
}

/**
 * Fetch all device records from Supabase (admin view)
 */
export async function fetchAllDeviceRecords(): Promise<DeviceRecord[]> {
  if (!isPublishedVersion()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('device_records')
      .select('*')
      .order('last_updated', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase Fetch] Failed to fetch device records:', error);
    return [];
  }
}

/**
 * Fetch all event logs from Supabase (admin view)
 */
export async function fetchAllEventLogs(
  limit: number = 100
): Promise<EventLog[]> {
  if (!isPublishedVersion()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('event_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Supabase Fetch] Failed to fetch event logs:', error);
    return [];
  }
}
