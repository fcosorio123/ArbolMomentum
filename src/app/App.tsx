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
import { DASHBOARD_REFRESH_EVENT, getBadgeCount } from './data/dashboardSnapshot';
import { FeedbackModal } from './components/FeedbackModal';
import { SupabaseSyncIndicator } from './components/SupabaseSyncIndicator';
import { shouldShowFeedbackNudge } from './data/feedback';
import {
  detectDevice, saveDeviceRecord, trackEvent,
} from './data/deviceAnalytics';
import { fetchAppSettings, areNotificationsEnabled } from './data/appSettings';
import { fetchEmailSettings } from './data/emailSettings';
import { fetchLiveCheckInSettings } from './data/liveCheckInSettings';
import { showNotification } from './data/notifications';
import { processDueNudges } from './data/nudgeScheduler';
import {
  ensurePushSubscription,
  requestNotificationPermission,
} from './data/pushNotifications';
import {
  PROFILES, type Profile, type Badge,
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

// ── App Badge API — main thread is authoritative; SW mirrors for background
function updateAppBadge(count: number) {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count).catch(() => {});
      else (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {});
    }
  } catch { /* ignore */ }
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
  const [summaryDataVersion, setSummaryDataVersion] = useState(0);
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

  useEffect(() => { fetchAppSettings(); fetchEmailSettings(); fetchLiveCheckInSettings(); }, []);

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

    // Manifest (static fallback; replaced below with dynamic PNG manifest)
    const appBase = import.meta.env.BASE_URL;
    setLink('manifest', `${appBase}manifest.json`);

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
      start_url: appBase,
      scope: appBase,
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

  // ── Service worker + push subscription
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const appBase = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${appBase}sw.js`, { scope: appBase })
      .then(reg => {
        setSwRegistration(reg);
        if (activeProfile && Notification.permission === 'granted') {
          ensurePushSubscription(activeProfile.id, reg);
        }
        if ('periodicSync' in reg) {
          (reg as ServiceWorkerRegistration & { periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } })
            .periodicSync.register('arbol-badge-sync', { minInterval: 60 * 60 * 1000 })
            .catch(() => { /* not supported on all platforms */ });
        }
      })
      .catch(err => console.warn('[SW] Registration failed:', err));
  }, [activeProfile?.id]);

  // SW → app messages (badge sync, notification clicks)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (!activeProfile) return;
      if (e.data?.type === 'SYNC_BADGE') {
        const count = getBadgeCount(activeProfile.id);
        updateAppBadge(count);
        swRef.current?.active?.postMessage({ type: 'BADGE', count });
      }
      if (e.data?.type === 'NOTIF_CLICKED') {
        trackEvent(activeProfile.id, 'notif_clicked', { tag: String(e.data.tag ?? '') });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [activeProfile?.id]);

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
      setSummaryDataVersion(v => v + 1);
      markSummaryShownToday(activeProfile.id);
      setShowDailySummary(true);
    }, 800);
    return () => clearTimeout(t);
  }, [activeProfile?.id]);

  // ── Keep summary modal in sync with task/goal changes
  useEffect(() => {
    const bump = () => setSummaryDataVersion(v => v + 1);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, bump);
    window.addEventListener('arbol-goals-updated', bump);
    window.addEventListener('arbol-tasks-updated', bump);
    window.addEventListener('arbol-live-feedback-updated', bump);
    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, bump);
      window.removeEventListener('arbol-goals-updated', bump);
      window.removeEventListener('arbol-tasks-updated', bump);
      window.removeEventListener('arbol-live-feedback-updated', bump);
    };
  }, []);

  // ── Feedback nudge
  useEffect(() => {
    if (!activeProfile) return;
    if (!shouldShowFeedbackNudge(activeProfile.id)) return;
    const t = setTimeout(() => {
      if (shouldShowFeedbackNudge(activeProfile.id)) setShowFeedback(true);
    }, 90_000);
    return () => clearTimeout(t);
  }, [activeProfile?.id]);

  const syncBadge = useCallback((profileId: string) => {
    const count = getBadgeCount(profileId);
    setPendingCount(count);
    updateAppBadge(count);
    swRef.current?.active?.postMessage({ type: 'BADGE', count });
    trackEvent(profileId, 'badge_updated', { count });
  }, []);

  // Update badge when profile or tab changes
  useEffect(() => {
    if (!activeProfile) return;
    syncBadge(activeProfile.id);
  }, [activeProfile?.id, activeTab, syncBadge]);

  useEffect(() => {
    if (!activeProfile) return;
    const refresh = () => syncBadge(activeProfile.id);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, refresh);
    window.addEventListener('arbol-goals-updated', refresh);
    window.addEventListener('arbol-tasks-updated', refresh);
    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, refresh);
      window.removeEventListener('arbol-goals-updated', refresh);
      window.removeEventListener('arbol-tasks-updated', refresh);
    };
  }, [activeProfile?.id, syncBadge]);

  // ── Smart nudges: 3 state-based slots/day + custom reminders (local + push when subscribed)
  const runNudgeScheduler = useCallback(async () => {
    if (!activeProfile) return;
    await processDueNudges({ profile: activeProfile, swReg: swRef.current });
  }, [activeProfile]);

  useEffect(() => {
    if (!activeProfile) return;
    runNudgeScheduler();
    const interval = setInterval(runNudgeScheduler, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') runNudgeScheduler();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeProfile?.id, runNudgeScheduler]);

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
        <AntdApp message={{ maxCount: 3, duration: 2.5 }}>
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
          <AntdApp message={{ maxCount: 3, duration: 2.5 }}>
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
        <AntdApp message={{ maxCount: 3, duration: 2.5 }}>
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
          onShowSummary={() => {
            setSummaryDataVersion(v => v + 1);
            setShowDailySummary(true);
          }}
          onShowFeedback={() => setShowFeedback(true)}
          onStartCheckIn={() => setShowCheckIn(true)}
          isActive={activeTab === 'home'}
          canStartPageTours={!showCoach && !showDailySummary}
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
            syncBadge(activeProfile.id);
          }}
          onTasksChange={() => syncBadge(activeProfile.id)}
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
      <AntdApp message={{ maxCount: 3, duration: 2.5 }}>
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
            dataVersion={summaryDataVersion}
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
                  const result = await requestNotificationPermission(
                    activeProfile.id,
                    swRegistration,
                    activeProfile.name,
                  );
                  if (result.granted && swRegistration) {
                    await showNotification(
                      swRegistration,
                      'Welcome to Arbol! 🌿',
                      `Hi ${activeProfile.name.split(' ')[0]}! You'll get up to 3 helpful funding reminders per day.`,
                      'welcome',
                    );
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
