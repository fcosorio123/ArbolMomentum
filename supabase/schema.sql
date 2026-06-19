-- Arbol Momentum Centralized Database Schema
-- Run this SQL in your Supabase SQL Editor to create the tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Task Completions Table
CREATE TABLE IF NOT EXISTS task_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT CHECK (status IN ('inprogress', 'done')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, task_id, date)
);

-- Task Deletions Table
CREATE TABLE IF NOT EXISTS task_deletions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, task_id, date)
);

-- Goal Progress Table
CREATE TABLE IF NOT EXISTS goal_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  task_completed TEXT NOT NULL,
  amount_logged NUMERIC,
  notes TEXT,
  milestone_hit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  what_worked JSONB,
  what_didnt JSONB,
  suggestion TEXT,
  date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Records Table
CREATE TABLE IF NOT EXISTS device_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id TEXT NOT NULL UNIQUE,
  os TEXT,
  browser TEXT,
  is_pwa BOOLEAN DEFAULT false,
  push_supported BOOLEAN DEFAULT false,
  badge_supported BOOLEAN DEFAULT false,
  notif_permission TEXT,
  last_notif_sent BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Logs Table
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id TEXT NOT NULL,
  event TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_completions_profile_date ON task_completions(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_task_deletions_profile_date ON task_deletions(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_goal_progress_profile ON goal_progress(profile_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_feedback_profile ON feedback(profile_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_profile ON event_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

-- Public access policies (since this is an educational demo app)
-- In production, you'd want more restrictive policies
CREATE POLICY "Allow all operations on task_completions" ON task_completions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on task_deletions" ON task_deletions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on goal_progress" ON goal_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on feedback" ON feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on device_records" ON device_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on event_logs" ON event_logs FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task_completions
CREATE TRIGGER update_task_completions_updated_at
  BEFORE UPDATE ON task_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for device_records
CREATE TRIGGER update_device_records_last_updated
  BEFORE UPDATE ON device_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
