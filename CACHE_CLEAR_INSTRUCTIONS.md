# Cache Clear Instructions

## Recent Changes Made

1. ✅ **Removed all ETF goals** from all profiles (Rooty no longer has ETF investment goal)
2. ✅ **Removed goal filter** from Admin → Personal Goals tab (now shows all logs without filtering by specific goals)
3. ✅ **Removed "Suggested for Today" panel** from Personal Goals page (to avoid confusion with Task page)

## How to Clear Old Cached Data

### Option 1: Clear Browser Data (Recommended)

**On Published Site (`https://sound-press-69397091.figma.site`)**

1. Open the site in your browser
2. Press `F12` to open Developer Tools
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Click on **Local Storage** → `https://sound-press-69397091.figma.site`
5. Find and delete these keys:
   - Any keys containing `rooty-etf`
   - Any keys containing `goal-progress` (to refresh goal logs)
   - Or simply click "Clear All" to remove all localStorage data

**Alternative: Use Browser Settings**
1. Go to browser Settings
2. Privacy → Clear browsing data
3. Select "Cookies and other site data"
4. Choose time range: "All time"
5. Clear data

### Option 2: Hard Refresh

1. Open `https://sound-press-69397091.figma.site`
2. Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
3. This will force reload the page and clear cache

### Option 3: Incognito/Private Mode

1. Open the site in Incognito/Private browsing mode
2. This starts with a fresh cache
3. Use this to verify changes without affecting your main browser data

## Verify Changes

After clearing cache:

### 1. Check Personal Goals Page
- Open any profile
- Go to Personal Goals
- ✅ Should NOT see "Suggested for Today" panel
- ✅ Rooty should have ONLY "Save ₱20,000 Emergency Fund" (no ETF goal)

### 2. Check Admin Dashboard → Personal Goals Tab
- Go to Admin Dashboard
- Click Personal Goals tab
- ✅ Should see "Filter by user" (Kyle, Rafael, Rooty, Yesa, John, Jude, All)
- ✅ Should NOT see "Filter by goal" section
- ✅ Should see all goal logs from all users

### 3. Verify All Profiles

Current goals per profile:

- **Kyle**: 5 goals
  - Save ₱10,000 Before Birthday
  - Build ₱30,000 Emergency Fund by 2027
  - Graduate College by July 2, 2026
  - Get Stable Job This Year
  - Invest in Life Insurance

- **Rafael**: 1 goal
  - Save ₱20,000 Emergency Fund

- **Rooty**: 1 goal
  - Save ₱20,000 Emergency Fund ✅ (ETF goal removed)

- **Jude**: 1 goal
  - Save for Overseas Travel

- **Yesa**: 0 goals

- **John**: 0 goals

## For Developers

If you need to clear cache programmatically:

```javascript
// Open browser console (F12) and run:
// Clear all localStorage
localStorage.clear();

// Or clear specific keys
Object.keys(localStorage).forEach(key => {
  if (key.includes('rooty-etf') || key.includes('goal-progress')) {
    localStorage.removeItem(key);
  }
});

// Then refresh the page
location.reload();
```

## Supabase Data

The changes are code-only and don't affect existing Supabase data. If users have already logged progress for ETF goals in Supabase:

1. Old ETF logs will remain in `goal_progress` table
2. They will still appear in Admin dashboard (with goal title if available)
3. No new ETF logs can be created (the goal is removed from the app)
4. You can manually delete old ETF records from Supabase if needed:

```sql
-- Run in Supabase SQL Editor to remove old ETF goal logs
DELETE FROM goal_progress WHERE goal_id = 'rooty-etf-goal';
```

## Summary

**Changes are live in the code. Users just need to clear their browser cache to see the updates.**

The app now:
- ✅ Shows no ETF goals for any profile
- ✅ Personal Goals admin tab has no goal filter
- ✅ Personal Goals page has no "Suggested for Today" panel
- ✅ Simpler, more unified experience
