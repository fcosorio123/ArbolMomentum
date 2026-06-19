# Supabase Setup Instructions

## ✅ Connection Status: Connected

Your Supabase project is now connected! Follow these steps to complete the setup:

## Step 1: Create Database Tables

1. **Open your Supabase Dashboard**: Go to [app.supabase.com](https://app.supabase.com)
2. **Navigate to SQL Editor**: Click on "SQL Editor" in the left sidebar
3. **Create a new query**: Click "+ New query"
4. **Copy and paste the SQL**: Open the file `/workspaces/default/code/supabase/schema.sql` and copy ALL the SQL code
5. **Run the query**: Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

You should see success messages for all tables created.

## Step 2: Verify Tables Were Created

1. **Go to Table Editor**: Click "Table Editor" in the left sidebar
2. **Check for tables**: You should see these 6 tables:
   - `task_completions`
   - `task_deletions`
   - `goal_progress`
   - `feedback`
   - `device_records`
   - `event_logs`

## Step 3: Test the Integration

1. **Open the published site**: `https://sound-press-69397091.figma.site`
2. **Complete a task**: Mark any task as done
3. **Check the database**: Go to Table Editor → `task_completions` and you should see the entry!

## What's Centralized Now ✅

All user data is now being saved to Supabase in real-time:

- ✅ **Task completions** - Every time a user marks a task as done
- ✅ **Goal progress** - Every time a user logs progress toward their goals
- ✅ **Feedback** - User feedback submissions
- ✅ **Device records** - User device and browser information
- ✅ **Event logs** - App usage analytics

## Admin Dashboard

The admin dashboard will now show **real-time data from ALL users**:

1. Go to the published site
2. Access Admin Dashboard (three dots → Admin)
3. View data across all tabs:
   - **Goals tab**: See goal progress from Kyle, Rafael, and Rooty
   - **Feedback tab**: View feedback from all users
   - **Devices tab**: Monitor device and notification permissions
   - **Analytics tab**: Track engagement and completion rates

## How It Works

**Dual Storage System:**
- **localStorage**: Keeps data locally for offline functionality
- **Supabase**: Syncs data to the cloud for centralized access

When users are online, every action is automatically synced to Supabase. The admin dashboard pulls from Supabase to show data from all remote users.

## Data Collection Rules

- ✅ Only collects data from **published site** (`sound-press-69397091.figma.site`)
- ✅ Only collects data **from May 14, 2026 onwards**
- ❌ Does NOT collect data from development/unpublished versions
- ❌ Does NOT collect personal identifying information (PII)

## Troubleshooting

**If data is not appearing in Supabase:**

1. Check that you're on the published site (not localhost)
2. Open browser console (F12) and look for Supabase errors
3. Verify the SQL schema was run successfully
4. Check Row Level Security policies are set to "Allow all operations"

**If you see permission errors:**

The schema includes public access policies for this educational demo. If you want to restrict access later, you can modify the RLS policies in the Supabase dashboard.

## Next Steps

You're all set! Your users' activity will now be centrally collected in Supabase, and you can see real-time data from all users in the admin dashboard. 🎉
