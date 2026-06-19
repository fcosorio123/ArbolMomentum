import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey);

// Database types
export interface TaskCompletion {
  id?: string;
  profile_id: string;
  task_id: string;
  date: string;
  status: 'inprogress' | 'done' | null;
  created_at?: string;
  updated_at?: string;
}

export interface GoalProgress {
  id?: string;
  profile_id: string;
  goal_id: string;
  task_completed: string;
  amount_logged?: number;
  notes?: string;
  milestone_hit?: string;
  created_at?: string;
}

export interface FeedbackEntry {
  id?: string;
  profile_id: string;
  rating: number;
  what_worked?: string[];
  what_didnt?: string[];
  suggestion?: string;
  date: string;
  created_at?: string;
}

export interface DeviceRecord {
  id?: string;
  profile_id: string;
  os: string;
  browser: string;
  is_pwa: boolean;
  push_supported: boolean;
  badge_supported: boolean;
  notif_permission: string;
  last_notif_sent?: number;
  last_updated?: string;
}

export interface EventLog {
  id?: string;
  profile_id: string;
  event: string;
  metadata?: any;
  created_at?: string;
}

export interface TaskDeleted {
  id?: string;
  profile_id: string;
  task_id: string;
  date: string;
  created_at?: string;
}
