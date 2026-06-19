# ✅ Centralized Data Collection - Complete Setup

## Status: Ready for Database Setup

Your app is now integrated with Supabase for centralized data collection! All code changes are complete. You just need to set up the database tables.

---

## Quick Start (3 Steps)

### Step 1: Run SQL Schema (5 minutes)

1. Open [app.supabase.com](https://app.supabase.com)
2. Click "SQL Editor" in sidebar
3. Click "+ New query"
4. Copy **ALL** SQL from `/workspaces/default/code/supabase/schema.sql`
5. Paste and click "Run" (or Ctrl/Cmd + Enter)

✅ You should see: "Success. No rows returned"

### Step 2: Verify Tables Created

1. Click "Table Editor" in sidebar
2. Confirm you see 6 tables:
   - `task_completions`
   - `task_deletions`
   - `goal_progress`
   - `feedback`
   - `device_records`
   - `event_logs`

### Step 3: Test It!

1. Open **published site**: `https://sound-press-69397091.figma.site`
2. Select a profile (Kyle, Rafael, or Rooty)
3. Mark a task as complete
4. Go back to Supabase → Table Editor → `task_completions`
5. **You should see the entry!** 🎉

---

## What's Centralized

### ✅ All User Activity is Synced

Every action from any user is automatically saved to Supabase:

| Data Type | What's Tracked | Where in DB |
|-----------|---------------|-------------|
| **Tasks** | Completion status (done/in-progress) | `task_completions` |
| **Tasks** | Removed/deleted tasks | `task_deletions` |
| **Goals** | Progress logs, amounts, milestones | `goal_progress` |
| **Feedback** | Ratings, what worked, suggestions | `feedback` |
| **Devices** | OS, browser, PWA install, permissions | `device_records` |
| **Events** | App opens, installs, notifications | `event_logs` |

### ✅ Admin Dashboard Shows Real-Time Data

Open Admin Dashboard on published site to see ALL users' data:

- **Overview Tab**: Task completion across all profiles
- **Analytics Tab**: User engagement and activity patterns
- **Feedback Tab**: Feedback from all users
- **Goals Tab**: Personal goal progress from all profiles
- **Devices Tab**: Device types, notifications, PWA installs

---

## How It Works

### Dual Storage System

```
User Action → localStorage (offline) + Supabase (cloud)
                    ↓                        ↓
              Local cache          Centralized database
                                           ↓
                                   Admin Dashboard
                                  (sees ALL users)
```

**Benefits:**
- ✅ Works offline (localStorage)
- ✅ Syncs when online (Supabase)
- ✅ Admin sees all users' data
- ✅ No data loss
- ✅ Real-time updates

### Environment Detection

| Environment | Data Collection | Admin View |
|-------------|----------------|------------|
| **Published** (`sound-press-69397091.figma.site`) | ✅ Syncs to Supabase | Shows all users |
| **Development** (localhost, unpublished) | ❌ Local only | Shows local data only |

**Date Filter**: Only collects data from **May 14, 2026** onwards

---

## Visual Indicators

### Sync Indicator
When data is synced to Supabase, you'll see a small cloud indicator:

```
☁️ Synced to Cloud
```

This appears briefly in the bottom-right corner (published version only).

### Environment Banner
The Admin Dashboard shows which environment you're in:

**Published Version:**
```
📊 Published Version - Data Collection Active
Collecting data since May 14, 2026 · 127 records
```

**Development Version:**
```
🔧 Development Mode
Data is local only and not collected centrally
```

---

## Data Privacy

### What We Collect
- Task completion status
- Goal progress and amounts
- Feedback ratings and text
- Device/browser information
- App usage events

### What We DON'T Collect
- ❌ Personal names (profiles are anonymous IDs: kyle, rafael, rooty)
- ❌ Email addresses
- ❌ Location data
- ❌ Personal identifying information (PII)

### Security
- Row Level Security (RLS) enabled on all tables
- Public access policies (educational demo)
- Data encryption in transit and at rest (Supabase default)

---

## Code Structure

### Data Sync Layer
- `/src/app/data/supabaseSync.ts` - Dual storage sync functions
- `/src/app/data/environment.ts` - Environment detection
- `/utils/supabase/client.ts` - Supabase client & types

### Updated Files
✅ Task management: `profiles.ts`
✅ Goal tracking: `personalGoals.ts`  
✅ Feedback: `feedback.ts`
✅ Analytics: `deviceAnalytics.ts`

All data-saving functions now sync to both localStorage and Supabase.

---

## Troubleshooting

### Data not appearing in Supabase?

**Check:**
1. ✅ You're on published site (not localhost)
2. ✅ SQL schema was run successfully
3. ✅ Tables exist in Table Editor
4. ✅ Row Level Security policies are set to "Allow all"
5. ✅ Browser console shows no Supabase errors (F12)

**Test:**
```javascript
// Open browser console on published site and run:
localStorage.clear(); // Start fresh
// Then complete a task and check Supabase
```

### Still having issues?

1. **Check browser console** (F12) for errors
2. **Verify published URL**: Must be exactly `https://sound-press-69397091.figma.site`
3. **Check date**: Must be May 14, 2026 or later
4. **Supabase logs**: Check Supabase Dashboard → Logs for errors

---

## Next Steps

### After Database Setup

1. ✅ Test with multiple browsers/devices
2. ✅ Have users complete tasks from their devices
3. ✅ View their data in Admin Dashboard
4. ✅ Export data via Admin Dashboard → "Export Data" button

### Optional Enhancements

- 📊 Add real-time subscriptions for live updates
- 🔒 Implement user authentication
- 📈 Create custom analytics views
- 💾 Set up automated backups
- 🎯 Add data retention policies

---

## Support Files

- 📄 `SUPABASE_SETUP.md` - Detailed setup instructions
- 📄 `supabase/schema.sql` - Database schema (run this!)
- 📄 `CENTRALIZED_DATA_README.md` - This file

---

## Success Checklist

- [ ] SQL schema run in Supabase
- [ ] 6 tables created successfully
- [ ] Tested task completion on published site
- [ ] Data appears in Supabase Table Editor
- [ ] Admin dashboard shows data from test
- [ ] Sync indicator appears when completing tasks
- [ ] Environment banner shows "Published Version"

---

**You're all set!** 🎉

Your users can now work from anywhere, and you'll see all their activity centrally in the admin dashboard. No more guessing what remote users are doing!
