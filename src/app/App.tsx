import { useState, useEffect, useCallback, useRef } from 'react';
import { App as AntdApp, ConfigProvider, theme as antTheme } from 'antd';
import { ProfileSelector } from './components/ProfileSelector';
import { AccessCodeGate } from './components/AccessCodeGate';
import { Dashboard } from './components/Dashboard';
import { GoalsPage } from './components/GoalsPage';
import { TaskList } from './components/TaskList';
import { WeekPlan } from './components/WeekPlan';
import { RemindersScreen } from './components/RemindersScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AdminView } from './components/AdminView';
import { CheckInPage } from './components/CheckInPage';

import { BottomNav } from './components/BottomNav';
import { CoachMarks } from './components/CoachMarks';
import { AddToHomeScreen } from './components/AddToHomeScreen';
import { CelebrationModal } from './components/CelebrationModal';
import { DailySummaryModal, isSummaryEnabled, markSummaryShownToday, wasSummaryShownToday } from './components/DailySummaryModal';
import { FeedbackModal } from './components/FeedbackModal';
import { SupabaseSyncIndicator } from './components/SupabaseSyncIndicator';
import { shouldShowFeedbackNudge } from './data/feedback';
import {
  detectDevice, saveDeviceRecord, trackEvent,
  saveSchedule, getSchedule, markScheduleFired,
  type ScheduledNotif,
} from './data/deviceAnalytics';
import { fetchAppSettings, areNotificationsEnabled } from './data/appSettings';
import { fetchEmailSettings, getEmailSettings } from './data/emailSettings';
import { requestEmailSend } from './data/emailNudges';
import { getProfileEmail } from './data/profileContact';
import { showNotification } from './data/notifications';
import {
  PROFILES, type Profile, type Badge,
  getTaskCategoriesForProfile, getTaskStatus, isTaskDeleted, getTodayKey,
} from './data/profiles';
import { C } from './data/colors';

type Tab = 'home' | 'goals' | 'tasks' | 'week' | 'reminders' | 'profile';

const arbolTheme = {
  algorithm: antTheme.defaultAlgorithm,
  token: {
    colorPrimary: C.primary,
    colorSuccess: C.primary,
    colorWarning: C.streak,
    colorError: C.tertiary,
    colorBgBase: C.bg,
    colorBgContainer: C.bgCard,
    colorBgElevated: C.bgAlt,
    colorBorder: C.border,
    colorText: C.headline,
    colorTextSecondary: C.body,
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 15,
  },
  components: {
    Button: { colorPrimaryHover: C.primaryDark, colorPrimaryActive: '#1076cc' },
    Switch: { colorPrimary: C.primary },
    Progress: { colorSuccess: C.primary },
    Modal: { colorBgElevated: C.bg },
    Input: {
      colorBgContainer: C.bgAlt, colorBorder: C.border,
      colorText: C.headline, colorTextPlaceholder: C.secondary,
      activeBorderColor: C.primary, hoverBorderColor: C.secondary,
    },
    Message: { colorBgElevated: C.bgCard, colorText: C.headline },
  },
};

// ── App Badge API
// Always call from the main thread - more reliable on Android than via SW.
// The SW also tries to set the badge (for background updates) but the main
// thread call is the authoritative one.
function updateAppBadge(pending: number) {
  try {
    if ('setAppBadge' in navigator) {
      if (pending > 0) (navigator as any).setAppBadge(pending).catch(() => {});
      else (navigator as any).clearAppBadge().catch(() => {});
    }
  } catch {}
}

// ── Smart notification copy
function buildNudge(pending: number, streak: number, firstName: string): { title: string; body: string; tag: string } | null {
  if (pending === 0) return null;
  if (pending === 1) return {
    title: `You're almost there, ${firstName}! 🔥`,
    body: '1 task left - finish strong and keep your streak going.',
    tag: 'nudge-close',
  };
  if (streak > 0 && pending <= 3) return {
    title: `${streak}-day streak on the line, ${firstName}!`,
    body: `Just ${pending} tasks left. Don't let it slip now 💪`,
    tag: 'nudge-streak',
  };
  return {
    title: `${pending} tasks waiting, ${firstName} 📋`,
    body: "Your daily momentum is calling. Let's get it done!",
    tag: 'nudge-general',
  };
}

export default function App() {
  const [activeProfile, setActiveProfile] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem('arbol-active-profile');
      if (saved) return PROFILES.find(p => p.id === saved) ?? null;
    } catch {}
    return null;
  });
  const [profileSelectorUnlocked, setProfileSelectorUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showAdmin, setShowAdmin] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [showInstallTutorial, setShowInstallTutorial] = useState(false);
  const [showPostInstallNotif, setShowPostInstallNotif] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationBadges, setCelebrationBadges] = useState<Badge[]>([]);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [badgeSupported] = useState(() => 'setAppBadge' in navigator);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  swRef.current = swRegistration;

  // ── Desktop breakpoint listener
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => { fetchAppSettings(); fetchEmailSettings(); }, []);

  // ── PWA setup: meta tags + manifest link + canvas icon injection
  useEffect(() => {
    document.title = 'Arbol Momentum';

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
      let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
      el.href = href;
      if (extra) Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
    };

    // Manifest
    setLink('manifest', '/manifest.json');

    // Universal PWA meta
    setMeta('theme-color', '#094067');
    setMeta('color-scheme', 'light');
    setMeta('application-name', 'Momentum');

    // Android / Chrome
    setMeta('mobile-web-app-capable', 'yes');

    // iOS Safari
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-title', 'Momentum');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');

    // Viewport (ensure no zoom on install)
    setMeta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');

    // Canvas icon generation - produces real PNG data URLs for apple-touch-icon
    // and a re-injected manifest with PNG icons (required for Chrome Android install badge)
    function drawIcon(size: number): string {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d')!;

      // Gradient background
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#094067');
      grad.addColorStop(1, '#1a6da8');
      ctx.fillStyle = grad;

      // Rounded rectangle (22% radius)
      const r = size * 0.22;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(size - r, 0); ctx.quadraticCurveTo(size, 0, size, r);
      ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size);
      ctx.lineTo(r, size); ctx.quadraticCurveTo(0, size, 0, size - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();

      // White tree silhouette
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const cx = size / 2;

      // Three tiers (triangles, bottom to top)
      const tiers = [
        { yt: size * 0.34, yb: size * 0.58, hw: size * 0.24 },
        { yt: size * 0.22, yb: size * 0.45, hw: size * 0.18 },
        { yt: size * 0.12, yb: size * 0.33, hw: size * 0.12 },
      ];
      for (const t of tiers) {
        ctx.beginPath();
        ctx.moveTo(cx, t.yt);
        ctx.lineTo(cx - t.hw, t.yb);
        ctx.lineTo(cx + t.hw, t.yb);
        ctx.closePath();
        ctx.fill();
      }

      // Trunk
      ctx.fillRect(cx - size * 0.04, size * 0.57, size * 0.08, size * 0.22);

      return c.toDataURL('image/png');
    }

    const icon180 = drawIcon(180);
    const icon192 = drawIcon(192);
    const icon512 = drawIcon(512);

    // apple-touch-icon (iOS home screen icon)
    setLink('apple-touch-icon', icon180, { sizes: '180x180' });

    // Inject a dynamic manifest with real PNG icon data URLs so Chrome Android
    // shows the install prompt correctly
    const dynamicManifest = {
      name: 'Arbol Momentum',
      short_name: 'Momentum',
      description: 'Track habits, streaks, and daily tasks.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#f0f4f8',
      theme_color: '#094067',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };
    const blob = new Blob([JSON.stringify(dynamicManifest)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(blob);
    setLink('manifest', manifestUrl);

    // iOS splash screens (key sizes)
    const splashSizes = [
      { w: 1170, h: 2532, media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
      { w: 1284, h: 2778, media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' },
      { w: 828,  h: 1792, media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)' },
      { w: 750,  h: 1334, media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
    ];
    for (const s of splashSizes) {
      if (!document.querySelector(`link[media="${s.media}"]`)) {
        const sc = document.createElement('canvas');
        sc.width = s.w; sc.height = s.h;
        const sctx = sc.getContext('2d')!;
        sctx.fillStyle = '#f0f4f8';
        sctx.fillRect(0, 0, s.w, s.h);
        // Center icon at ~25% of screen height
        const iconSize = Math.round(s.w * 0.28);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = iconSize; tempCanvas.height = iconSize;
        const tmpCtx = tempCanvas.getContext('2d')!;
        const img = new Image();
        img.src = icon512;
        // Draw synchronously after icon loads
        const lnk = document.createElement('link');
        lnk.rel = 'apple-touch-startup-image';
        lnk.setAttribute('media', s.media);
        img.onload = () => {
          tmpCtx.drawImage(img, 0, 0, iconSize, iconSize);
          sctx.drawImage(tempCanvas, (s.w - iconSize) / 2, (s.h - iconSize) / 2 - s.h * 0.05, iconSize, iconSize);
          lnk.href = sc.toDataURL('image/png');
        };
        document.head.appendChild(lnk);
      }
    }

    return () => URL.revokeObjectURL(manifestUrl);
  }, []);

  // ── Service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => setSwRegistration(reg))
      .catch(err => console.warn('[SW] Registration failed:', err));
  }, []);

  // ── Install prompt
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstallPrompt(null);
      setTimeout(() => setShowPostInstallNotif(true), 1500);
      if (activeProfile) {
        trackEvent(activeProfile.id, 'app_installed');
        saveDeviceRecord(activeProfile.id, { isPwa: true });
      }
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [activeProfile]);

  // ── Device record: save/refresh on profile load
  useEffect(() => {
    if (!activeProfile) return;
    const detected = detectDevice();
    saveDeviceRecord(activeProfile.id, detected);
    trackEvent(activeProfile.id, 'app_opened');
  }, [activeProfile?.id]);

  // ── Cloud restore: if local data is absent, pull from cloud backup ──
  // Runs once per session per profile. Reloads the page after a successful
  // restore so all components read the recovered localStorage data.
  useEffect(() => {
    if (!activeProfile) return;
    const sessionKey = `arbol-restore-attempted-${activeProfile.id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    // Check whether this profile has any local activity data
    let hasLocal = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(`streak-${activeProfile.id}-`) || k.startsWith(`task-${activeProfile.id}-`)) {
        hasLocal = true;
        break;
      }
    }
    if (hasLocal) return;

    // Mark attempted so we don't loop on failed restores
    sessionStorage.setItem(sessionKey, 'true');

    import('./data/cloudBackup').then(({ restoreFromCloud }) => {
      restoreFromCloud(activeProfile.id).then(restored => {
        if (restored) window.location.reload();
      });
    });
  }, [activeProfile?.id]);

  // ── Coach marks for first-time users
  useEffect(() => {
    if (activeProfile && !localStorage.getItem('arbol-coach-done')) {
      setTimeout(() => setShowCoach(true), 600);
    }
  }, [activeProfile]);


  // ── Daily summary: auto-show on launch
  useEffect(() => {
    if (!activeProfile) return;
    if (!isSummaryEnabled(activeProfile.id)) return;
    if (wasSummaryShownToday(activeProfile.id)) return;
    const t = setTimeout(() => {
      markSummaryShownToday(activeProfile.id);
      setShowDailySummary(true);
    }, 800);
    return () => clearTimeout(t);
  }, [activeProfile?.id]);

  // ── Feedback nudge
  useEffect(() => {
    if (!activeProfile) return;
    if (!shouldShowFeedbackNudge(activeProfile.id)) return;
    const t = setTimeout(() => {
      if (shouldShowFeedbackNudge(activeProfile.id)) setShowFeedback(true);
    }, 90_000);
    return () => clearTimeout(t);
  }, [activeProfile?.id]);

  // ── Compute pending tasks
  const computePending = useCallback((profile: Profile): number => {
    const today = getTodayKey();
    const tasks = getTaskCategoriesForProfile(profile.id).flatMap(c => c.tasks);
    return tasks.filter(t =>
      !isTaskDeleted(profile.id, t.id, today) &&
      getTaskStatus(profile.id, t.id, today) !== 'done'
    ).length;
  }, []);

  const syncBadge = useCallback((pending: number) => {
    setPendingCount(pending);
    updateAppBadge(pending);
    swRef.current?.active?.postMessage({ type: 'BADGE', count: pending });
    if (activeProfile) trackEvent(activeProfile.id, 'badge_updated', { count: pending });
  }, [activeProfile]);

  // Update badge when profile or tab changes
  useEffect(() => {
    if (!activeProfile) return;
    syncBadge(computePending(activeProfile));
  }, [activeProfile?.id, activeTab, syncBadge, computePending]);

  // ── Smart push notifications (main-thread scheduling - reliable on all platforms)
  // Replaces setTimeout-in-SW approach which fails when SW is killed by Android OS.
  // Strategy: store schedule in localStorage, check every 60s + on visibilitychange.
  const scheduleNotifications = useCallback(async () => {
    if (!activeProfile) return;
    if (!areNotificationsEnabled()) return;
    if (Notification?.permission !== 'granted') return;

    const today = getTodayKey();
    const pending = computePending(activeProfile);
    const firstName = activeProfile.name.split(' ')[0];

    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const nowMs = now.getTime();

    const toMs = (atH: number, atM: number) => {
      const d = new Date();
      d.setHours(atH, atM, 0, 0);
      return d.getTime();
    };

    // Build today's schedule
    const existing = getSchedule(activeProfile.id);
    const existingTags = new Set(existing.map(n => n.tag));
    const schedule: ScheduledNotif[] = [...existing];

    const addIfNew = (tag: string, title: string, body: string, atH: number, atM: number) => {
      if (!existingTags.has(tag)) {
        schedule.push({ tag, title, body, atMs: toMs(atH, atM) });
        existingTags.add(tag);
      }
    };

    if (pending > 0) {
      addIfNew('morning', `Good morning, ${firstName}! ☀️`,
        `You have ${pending} task${pending > 1 ? 's' : ''} to tackle today. Let's build that momentum!`, 8, 0);
      addIfNew('midday', 'Midday check-in 📋',
        pending === 1 ? 'Just 1 task left - you\'re almost done!' : `${pending} tasks remaining. A little focus goes a long way.`, 13, 0);
      const nudge = buildNudge(pending, activeProfile.streak, firstName);
      if (nudge) addIfNew(nudge.tag + '-eve', nudge.title, nudge.body, 19, 30);
    }

    saveSchedule(activeProfile.id, schedule);

    // Fire any notifications whose time has come
    for (const notif of schedule) {
      if (nowMs >= notif.atMs) {
        await showNotification(swRef.current, notif.title, notif.body, notif.tag);
        trackEvent(activeProfile.id, 'notif_sent', { tag: notif.tag });
        saveDeviceRecord(activeProfile.id, { lastNotifSent: Date.now() });
        markScheduleFired(activeProfile.id, notif.tag);

        const emailCfg = getEmailSettings();
        if (emailCfg.enabled && emailCfg.smartNudgeEnabled && emailCfg.triggerMode !== 'manual') {
          requestEmailSend({
            profileId: activeProfile.id,
            type: 'smart_nudge',
            tag: notif.tag,
            date: today,
            profileName: activeProfile.name,
            title: notif.title,
            body: notif.body,
            pendingCount: pending,
            recipient: getProfileEmail(activeProfile.id) || undefined,
          });
        }
      }
    }
  }, [activeProfile, computePending]);

  // Set up interval + visibility catch-up
  useEffect(() => {
    if (!activeProfile) return;
    scheduleNotifications();
    const interval = setInterval(scheduleNotifications, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleNotifications(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeProfile?.id, scheduleNotifications]);

  // Track notification permission changes
  useEffect(() => {
    if (!activeProfile || !('Notification' in window)) return;
    const perm = Notification.permission;
    saveDeviceRecord(activeProfile.id, { notifPermission: perm as any });
  }, [activeProfile?.id, swRegistration]);

  const handleSelectProfile = (profile: Profile) => {
    try { localStorage.setItem('arbol-active-profile', profile.id); } catch {}
    setActiveProfile(profile);
    setActiveTab('home');
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const handleCoachDone = () => {
    setShowCoach(false);
    localStorage.setItem('arbol-coach-done', 'true');
  };

  if (showAdmin) {
    return (
      <ConfigProvider theme={arbolTheme}>
        <AntdApp>
          {isDesktop ? (
            <div style={{ minHeight: '100dvh', background: C.bgAlt, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px' }}>
              <div style={{ width: '100%', maxWidth: 900, background: C.bg, borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 48px rgba(9,64,103,0.13)', minHeight: 'calc(100vh - 64px)' }}>
                <AdminView onBack={() => setShowAdmin(false)} />
              </div>
            </div>
          ) : (
            <AdminView onBack={() => setShowAdmin(false)} />
          )}
        </AntdApp>
      </ConfigProvider>
    );
  }


  if (!activeProfile) {
    if (!profileSelectorUnlocked) {
      return (
        <ConfigProvider theme={arbolTheme}>
          <AntdApp>
            {isDesktop ? (
              <div style={{ minHeight: '100dvh', background: C.bgAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 480, background: C.bg, borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 48px rgba(9,64,103,0.13)' }}>
                  <AccessCodeGate onUnlock={() => setProfileSelectorUnlocked(true)} />
                </div>
              </div>
            ) : (
              <AccessCodeGate onUnlock={() => setProfileSelectorUnlocked(true)} />
            )}
          </AntdApp>
        </ConfigProvider>
      );
    }
    return (
      <ConfigProvider theme={arbolTheme}>
        <AntdApp>
          {isDesktop ? (
            <div style={{ minHeight: '100dvh', background: C.bgAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 480, background: C.bg, borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 48px rgba(9,64,103,0.13)' }}>
                <ProfileSelector onSelect={handleSelectProfile} onAdmin={() => setShowAdmin(true)} />
              </div>
            </div>
          ) : (
            <ProfileSelector onSelect={handleSelectProfile} onAdmin={() => setShowAdmin(true)} />
          )}
        </AntdApp>
      </ConfigProvider>
    );
  }

  // Shared tab content (same on both mobile and desktop)
  const tabContent = (
    <>
      {activeTab === 'home' && (
        <Dashboard
          profile={activeProfile}
          installPrompt={installPrompt}
          onInstall={handleInstall}
          swRegistration={swRegistration}
          onCoachMark={() => setShowCoach(true)}
          onNavigateTasks={() => setActiveTab('tasks')}
          onNavigateGoals={() => setActiveTab('goals')}
          onShowSummary={() => setShowDailySummary(true)}
          onShowFeedback={() => setShowFeedback(true)}
          onStartCheckIn={() => setShowCheckIn(true)}
        />
      )}
      {activeTab === 'goals' && (
        <GoalsPage
          profile={activeProfile}
          onNavigateTasks={() => setActiveTab('tasks')}
        />
      )}
      {activeTab === 'tasks' && (
        <TaskList
          profile={activeProfile}
          onNavigateWeek={() => setActiveTab('week')}
          onPerfectDay={(newBadges) => {
            setCelebrationBadges(newBadges);
            setShowCelebration(true);
            syncBadge(0);
          }}
          onTasksChange={(pending) => syncBadge(pending)}
        />
      )}
      {activeTab === 'week' && <WeekPlan profile={activeProfile} />}
      {activeTab === 'reminders' && (
        <RemindersScreen
          profile={activeProfile}
          swRegistration={swRegistration}
          onShowInstallTutorial={() => setShowInstallTutorial(true)}
        />
      )}
      {activeTab === 'profile' && (
        <ProfileScreen
          profile={activeProfile}
          onSwitch={() => {
            try { localStorage.removeItem('arbol-active-profile'); } catch {}
            setActiveProfile(null);
            setProfileSelectorUnlocked(false);
          }}
          onAdmin={() => setShowAdmin(true)}
          onAlerts={() => setActiveTab('reminders')}
        />
      )}
    </>
  );

  return (
    <ConfigProvider theme={arbolTheme}>
      <AntdApp>
        {isDesktop ? (
          // ── Desktop: sidebar nav + centered content card
          <div style={{ display: 'flex', minHeight: '100dvh', background: C.bgAlt, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <BottomNav
              activeTab={activeTab}
              onChange={(t) => setActiveTab(t as Tab)}
              pendingCount={badgeSupported ? 0 : pendingCount}
              isDesktop={true}
            />
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{
                width: '100%', maxWidth: 520,
                background: C.bg, borderRadius: 24, overflow: 'hidden',
                boxShadow: '0 8px 48px rgba(9,64,103,0.12)',
                minHeight: 'calc(100vh - 64px)',
              }}>
                {tabContent}
              </div>
            </div>
          </div>
        ) : (
          // ── Mobile: existing single-column layout (unchanged)
          <div style={{
            background: C.bg, minHeight: '100dvh', maxWidth: 430,
            margin: '0 auto', position: 'relative',
            paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            overflowX: 'hidden',
          }}>
            {tabContent}
            <BottomNav
              activeTab={activeTab}
              onChange={(t) => setActiveTab(t as Tab)}
              pendingCount={badgeSupported ? 0 : pendingCount}
            />
          </div>
        )}

          {/* Check-in page overlay */}
          {showCheckIn && activeProfile && (
            <CheckInPage
              profile={activeProfile}
              onClose={() => {
                setShowCheckIn(false);
                try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
              }}
            />
          )}

          {/* Supabase sync indicator */}
          <SupabaseSyncIndicator />

          {/* Daily summary modal */}
          <DailySummaryModal
            open={showDailySummary}
            profile={activeProfile}
            onClose={() => setShowDailySummary(false)}
            onStartTasks={() => { setShowDailySummary(false); setActiveTab('tasks'); }}
          />

          {/* Feedback modal */}
          <FeedbackModal
            open={showFeedback}
            profileId={activeProfile.id}
            onSubmit={() => setShowFeedback(false)}
            onLater={() => setShowFeedback(false)}
          />

          {/* Celebration modal */}
          <CelebrationModal
            open={showCelebration}
            streak={activeProfile.streak}
            newBadges={celebrationBadges}
            onClose={() => setShowCelebration(false)}
            onViewWeek={() => { setActiveTab('week'); setShowCelebration(false); }}
          />

          {/* Coach marks */}
          {showCoach && <CoachMarks onDone={handleCoachDone} />}

          {/* Add to Home Screen tutorial */}
          <AddToHomeScreen
            open={showInstallTutorial}
            onClose={() => setShowInstallTutorial(false)}
            installPrompt={installPrompt}
            onInstall={() => { handleInstall(); setShowInstallTutorial(false); }}
          />

          {/* Post-install push notification prompt */}
          {showPostInstallNotif && areNotificationsEnabled() && (
            <div style={{
              position: 'fixed', bottom: isDesktop ? 24 : 'calc(72px + env(safe-area-inset-bottom, 0px) + 8px)', left: isDesktop ? 'auto' : 16, right: isDesktop ? 24 : 16, zIndex: 200, maxWidth: isDesktop ? 380 : undefined,
              background: C.bgCard, border: `1.5px solid ${C.primary}40`,
              borderRadius: 18, padding: '16px 18px',
              boxShadow: '0 8px 32px rgba(9,64,103,0.15)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 28 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>Enable push notifications</div>
                <div style={{ color: C.body, fontSize: 12, marginTop: 2 }}>Get smart daily nudges to keep your streak</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button onClick={async () => {
                  setShowPostInstallNotif(false);
                  if ('Notification' in window) {
                    const r = await Notification.requestPermission();
                    if (r === 'granted') {
                      trackEvent(activeProfile.id, 'notif_permission_granted');
                      saveDeviceRecord(activeProfile.id, { notifPermission: 'granted' });
                      if (swRegistration) {
                        await showNotification(
                          swRegistration,
                          'Welcome to Arbol Momentum! 🌿',
                          `Hi ${activeProfile.name.split(' ')[0]}! Reminders are set. Keep that streak going! 🔥`,
                          'welcome',
                        );
                      }
                    } else {
                      trackEvent(activeProfile.id, 'notif_permission_denied');
                      saveDeviceRecord(activeProfile.id, { notifPermission: r as any });
                    }
                  }
                }} style={{
                  background: C.primary, color: '#fff', border: 'none',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                  Enable
                </button>
                <button onClick={() => setShowPostInstallNotif(false)} style={{
                  background: 'none', border: 'none', color: C.secondary, cursor: 'pointer', fontSize: 12,
                }}>
                  Later
                </button>
              </div>
            </div>
          )}
      </AntdApp>
    </ConfigProvider>
  );
}
