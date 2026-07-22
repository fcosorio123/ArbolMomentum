import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from 'antd';
import {
  FireOutlined, DownloadOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { PageTour, TOUR_KEYS, tourStorageKey, areToursDismissedForProfile, resetLiveToursForProfile } from './AppTour';
import { HelpTourMenu } from './HelpTourMenu';
import { trackEvent } from '../data/deviceAnalytics';
import { ONBOARDING_TOUR_VERSION, getProfileContentState } from '../data/productOnboarding';
import type { Profile } from '../data/profiles';
import {
  getDateKey, hasActivityOnDate, getEarnedBadges, BADGES,
} from '../data/profiles';
import { ActiveGoalsList } from './ActiveGoalsList';
import { TasksMonthView } from './TasksMonthView';
import { useDashboardRefresh } from '../hooks/useDashboardRefresh';
import { pickDoNowTask } from '../data/dashboardSnapshot';
import { C } from '../data/colors';
import { MIN_TOUCH, touchPrimaryButton } from '../styles/touchTargets';

interface Props {
  profile: Profile;
  installPrompt: any;
  onInstall: () => void;
  swRegistration: ServiceWorkerRegistration | null;
  onCoachMark: () => void;
  onNavigateTasks?: () => void;
  onNavigateAllTasks?: () => void;
  onNavigateGoals?: () => void;
  onNavigateMonth?: () => void;
  onNavigateReminders?: () => void;
  onShowSummary?: () => void;
  onShowFeedback?: () => void;
  onGoals?: () => void;
  onStartCheckIn?: () => void;
  isActive?: boolean;
  /** False while Welcome coach or Today's Summary modal is open */
  canStartPageTours?: boolean;
  /** One-shot: start Home page tour (e.g. from getting-started). */
  requestPageTour?: boolean;
  onPageTourRequestConsumed?: () => void;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDailyTaskCount(profileId: string, dateKey: string): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      key.startsWith(`task-${profileId}-`) &&
      key.endsWith(`-${dateKey}`) &&
      localStorage.getItem(key) === 'done'
    ) count++;
  }
  return count;
}

// Mon-Sun ISO week dots (PRD 5.4)
function buildWeekDots(profileId: string, todayHasActivity: boolean) {
  const now = new Date();
  const todayKey = getDateKey(now);
  const dayOfWeek = (now.getDay() + 6) % 7;
  const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOfWeek + i);
    const dk = getDateKey(d);
    const isFuture = dk > todayKey;
    const isToday = dk === todayKey;
    const active = isToday
      ? (todayHasActivity || hasActivityOnDate(profileId, dk))
      : !isFuture && hasActivityOnDate(profileId, dk);
    return { label: DOW_LABELS[i], active, isToday, isFuture };
  });
}

function buildMonthGrid(profileId: string, year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = getDateKey(new Date());
  const startOffset = firstDay.getDay(); // 0 = Sun
  let activeDays = 0;

  const days = Array.from({ length: daysInMonth }, (_, idx) => {
    const date = new Date(year, month, idx + 1);
    const dk = getDateKey(date);
    const isFuture = dk > todayKey;
    const count = isFuture ? 0 : getDailyTaskCount(profileId, dk);
    if (count > 0) activeDays++;
    return { dateKey: dk, count, isFuture, isToday: dk === todayKey };
  });

  return { days, startOffset, activeDays, daysInMonth };
}

function streakMotivation(streak: number, completionPct: number): string {
  if (completionPct === 100) return "Perfect day. Every task done. Your streak is safe.";
  if (streak === 0) return "Complete one task today to start your streak.";
  if (streak <= 2) return "Great start. Complete today's tasks to keep your momentum.";
  if (streak <= 6) return "You're building a habit. Keep showing up every day.";
  if (streak <= 13) return "Impressive consistency. You're in the habit zone.";
  return "Two weeks strong. This is what commitment looks like.";
}

function heatColor(count: number, isFuture: boolean, isToday: boolean): string {
  if (isFuture) return 'rgba(0,0,0,0.04)';
  if (count === 0) return isToday ? 'rgba(39,39,42,0.10)' : 'rgba(0,0,0,0.06)';
  if (count === 1) return '#73C982aa';
  if (count === 2) return '#29823B';
  return '#1E612A';
}

function DashboardSkeleton() {
  const pulse = (w: string | number, h: number, mb = 12, radius = 14) => (
    <div style={{
      width: w, height: h, marginBottom: mb, borderRadius: radius,
      background: `linear-gradient(90deg, ${C.bgAlt} 25%, ${C.border} 50%, ${C.bgAlt} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'arbolDashSkel 1.2s ease-in-out infinite',
    }} />
  );
  return (
    <>
      <style>{`
        @keyframes arbolDashSkel {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
      {pulse('55%', 14, 8)}
      {pulse('75%', 28, 20)}
      {pulse('100%', 72, 16, 18)}
      {pulse('100%', 120, 16, 20)}
      {pulse('100%', 88, 16, 20)}
      {pulse('100%', 100, 0, 20)}
    </>
  );
}

export function Dashboard({
  profile, installPrompt, onInstall, onCoachMark,
  onNavigateTasks, onNavigateAllTasks, onNavigateGoals, onNavigateMonth, onNavigateReminders: _onNavigateReminders, onShowSummary, onShowFeedback, onGoals: _onGoals, onStartCheckIn,
  isActive = true,
  canStartPageTours = true,
  requestPageTour = false,
  onPageTourRequestConsumed,
}: Props) {
  const { snapshot, isLoading } = useDashboardRefresh(profile.id, isActive);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showCheckInTour, setShowCheckInTour] = useState(false);
  const homeTourAutoStarted = useRef(false);
  const checkInTourAutoStarted = useRef(false);
  const contentState = getProfileContentState(profile.id);
  const [emptyTick, setEmptyTick] = useState(0);
  useEffect(() => {
    const bump = () => setEmptyTick(n => n + 1);
    window.addEventListener('arbol-goals-updated', bump);
    window.addEventListener('arbol-tasks-updated', bump);
    return () => {
      window.removeEventListener('arbol-goals-updated', bump);
      window.removeEventListener('arbol-tasks-updated', bump);
    };
  }, []);
  const liveContentState = emptyTick >= 0 ? getProfileContentState(profile.id) : contentState;
  const [streakCursor, setStreakCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month0: n.getMonth() };
  });

  const {
    doneCount: todayDone,
    totalCount: todayTotal,
    progressPercent: completionPct,
    streak: displayStreak,
    bannerState,
    checkInGoalTitles: checkInGoals,
    checkedIn,
  } = snapshot;

  useEffect(() => {
    setIsPwaInstalled(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  useEffect(() => {
    homeTourAutoStarted.current = false;
    checkInTourAutoStarted.current = false;
  }, [profile.id]);

  useEffect(() => {
    if (!isActive) return;
    const today = snapshot.dateKey;
    const vk = `visit-${profile.id}-${today}`;
    const count = parseInt(localStorage.getItem(vk) || '0', 10) + 1;
    import('../data/supabaseSync').then(({ syncProfileVisit }) => {
      syncProfileVisit(profile.id, today, count);
    });
  }, [profile.id, isActive, snapshot.dateKey]);

  useEffect(() => {
    if (!isActive || !canStartPageTours || isLoading) return;
    if (homeTourAutoStarted.current) return;
    if (areToursDismissedForProfile(profile.id)) return;
    if (localStorage.getItem(tourStorageKey(TOUR_KEYS.home, profile.id))) return;
    const t = setTimeout(() => {
      homeTourAutoStarted.current = true;
      setShowTour(true);
    }, 600);
    return () => clearTimeout(t);
  }, [isActive, canStartPageTours, isLoading, profile.id]);

  useEffect(() => {
    if (!requestPageTour || !isActive) return;
    setShowTour(true);
    onPageTourRequestConsumed?.();
  }, [requestPageTour, isActive, onPageTourRequestConsumed]);

  // Goal Check-In tour - after Welcome, Summary, Home tour, and Tasks tour
  useEffect(() => {
    if (!isActive || !canStartPageTours || isLoading) return;
    if (checkInTourAutoStarted.current) return;
    if (areToursDismissedForProfile(profile.id)) return;
    if (localStorage.getItem(tourStorageKey(TOUR_KEYS.checkIn, profile.id))) return;
    if (!localStorage.getItem(tourStorageKey(TOUR_KEYS.home, profile.id))) return;
    if (!localStorage.getItem(tourStorageKey(TOUR_KEYS.tasks, profile.id))) return;
    const t = setTimeout(() => {
      checkInTourAutoStarted.current = true;
      setShowCheckInTour(true);
    }, 600);
    return () => clearTimeout(t);
  }, [isActive, canStartPageTours, isLoading, profile.id]);

  const todayDate = new Date();
  const weekDots = buildWeekDots(profile.id, completionPct > 0);
  const earnedBadges = getEarnedBadges(profile);
  const doNowTask = useMemo(
    () => pickDoNowTask(profile.id, snapshot.dateKey),
    [profile.id, snapshot.dateKey, snapshot.doneCount, snapshot.totalCount],
  );

  // Streak heatmap: navigate a two-month window (left = cursor-1, right = cursor)
  const todayMonth = useMemo(() => {
    const n = new Date();
    return { year: n.getFullYear(), month0: n.getMonth() };
  }, [snapshot.dateKey]);

  const leftMonth = useMemo(() => {
    const d = new Date(streakCursor.year, streakCursor.month0 - 1, 1);
    return { year: d.getFullYear(), month0: d.getMonth() };
  }, [streakCursor]);

  const leftGrid = useMemo(
    () => buildMonthGrid(profile.id, leftMonth.year, leftMonth.month0),
    [profile.id, leftMonth, snapshot.doneCount, snapshot.dateKey],
  );
  const rightGrid = useMemo(
    () => buildMonthGrid(profile.id, streakCursor.year, streakCursor.month0),
    [profile.id, streakCursor, snapshot.doneCount, snapshot.dateKey],
  );
  const leftMonthLabel = useMemo(
    () => new Date(leftMonth.year, leftMonth.month0, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    [leftMonth],
  );
  const rightMonthLabel = useMemo(
    () => new Date(streakCursor.year, streakCursor.month0, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    [streakCursor],
  );

  const canStreakForward =
    streakCursor.year < todayMonth.year
    || (streakCursor.year === todayMonth.year && streakCursor.month0 < todayMonth.month0);

  const shiftStreakMonth = (delta: number) => {
    setStreakCursor(prev => {
      const d = new Date(prev.year, prev.month0 + delta, 1);
      const next = { year: d.getFullYear(), month0: d.getMonth() };
      // Don't navigate past the current calendar month
      if (
        next.year > todayMonth.year
        || (next.year === todayMonth.year && next.month0 > todayMonth.month0)
      ) {
        return { ...todayMonth };
      }
      return next;
    });
  };

  const card: React.CSSProperties = {
    background: C.bgCard, border: `1.5px solid ${C.border}`,
    borderRadius: 20, padding: 20, marginBottom: 14, boxShadow: C.shadow,
  };

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  function MonthHeatmap({ grid, label }: {
    grid: ReturnType<typeof buildMonthGrid>;
    label: string;
  }) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.headline }}>{label}</span>
          <span style={{ fontSize: 10, color: C.secondary }}>
            {grid.activeDays} / {grid.daysInMonth} days
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
          {DAY_LABELS.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 7, color: C.secondary, fontWeight: 600 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {Array.from({ length: grid.startOffset }, (_, i) => <div key={`e${i}`} />)}
          {grid.days.map(({ dateKey, count, isFuture, isToday }) => (
            <div
              key={dateKey}
              title={isFuture ? '' : `${count} task${count !== 1 ? 's' : ''}`}
              style={{
                aspectRatio: '1', borderRadius: 3,
                background: heatColor(count, isFuture, isToday),
                border: isToday ? `1.5px solid ${C.primary}` : '1px solid transparent',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px calc(100px + env(safe-area-inset-bottom, 0px))', background: C.bg, minHeight: '100dvh' }}>

      {/* ── Header */}
      <div data-tour-id="home-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ color: C.secondary, fontSize: 13, marginBottom: 4 }}>{getGreeting()},</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: C.headline }}>{profile.name} {profile.avatar}</h1>
          <div style={{ color: C.body, fontSize: 13, marginTop: 4 }}>
            {todayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {onShowSummary && (
            <button onClick={onShowSummary} style={{
              background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '6px 10px', cursor: 'pointer', color: C.primary, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600,
            }}>📋 Today</button>
          )}
          {onShowFeedback && (
            <button onClick={onShowFeedback} style={{
              background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '6px 10px', cursor: 'pointer', color: C.body, fontSize: 13,
            }}>💬</button>
          )}
          <HelpTourMenu
            onPageTour={() => {
              trackEvent(profile.id, 'onboarding_tour_started', {
                tourVersion: ONBOARDING_TOUR_VERSION,
                entryPage: 'home',
              });
              setShowTour(true);
            }}
            onProductTour={onCoachMark}
            onRestartTours={() => {
              trackEvent(profile.id, 'onboarding_tour_restarted', {
                tourVersion: ONBOARDING_TOUR_VERSION,
                entryPage: 'home',
              });
              resetLiveToursForProfile(profile.id);
              setShowTour(true);
            }}
          />
        </div>
      </div>

      {liveContentState.isEmpty && (
        <div style={{
          marginBottom: 16, padding: '14px 16px', borderRadius: 14,
          background: `${C.primary}08`, border: `1.5px dashed ${C.primary}35`,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.headline, marginBottom: 4 }}>
            Add your first goal or task to get started
          </div>
          <div style={{ fontSize: 12, color: C.body, marginBottom: 10, lineHeight: 1.45 }}>
            Create manually or use AI Assist - nothing saves until you confirm.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onNavigateGoals && (
              <button type="button" onClick={onNavigateGoals} style={{
                ...touchPrimaryButton, padding: '8px 14px', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryPressed})`, color: '#fff',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                Create a goal
              </button>
            )}
            {onNavigateTasks && (
              <button type="button" onClick={onNavigateTasks} style={{
                ...touchPrimaryButton, padding: '8px 14px', borderRadius: 10,
                border: `1.5px solid ${C.border}`, background: C.bgCard, color: C.headline,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                Create a task
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
      <>
      {/* ── Check-in Banner - red / yellow / green */}
      {(() => {
        if (bannerState === 'red') {
          const count = checkInGoals.length;
          return (
            <div data-tour-id="home-banner" style={{
              background: '#A72D1A10', border: '1.5px solid #A72D1A30',
              borderRadius: 18, padding: '14px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🔴</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#A72D1A', marginBottom: 2 }}>
                  {count > 0 ? `${count} goal${count !== 1 ? 's' : ''} need check-in` : "You haven't checked in today"}
                </div>
                <div style={{ fontSize: 11, color: C.body, lineHeight: 1.4 }}>
                  Quickly update your progress and stay on track.
                </div>
              </div>
              {onStartCheckIn && (
                <button onClick={onStartCheckIn} style={{
                  background: '#A72D1A', border: 'none', borderRadius: 10,
                  padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}>Start Check-in</button>
              )}
            </div>
          );
        }
        if (bannerState === 'yellow') {
          return (
            <div data-tour-id="home-banner" style={{
              background: C.warningBg, border: `1.5px solid ${C.streak}55`,
              borderRadius: 18, padding: '14px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🟡</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.streakText, marginBottom: 2 }}>
                  {checkedIn
                    ? "You've checked in, but still have tasks to complete"
                    : 'Progress saved - keep going on your remaining tasks'}
                </div>
                <div style={{ fontSize: 11, color: C.body, lineHeight: 1.4 }}>
                  {checkedIn
                    ? 'Keep going to finish your remaining tasks.'
                    : 'Task updates from Today count toward your day. Optional check-in is still available.'}
                </div>
              </div>
              {onNavigateTasks && (
                <button onClick={onNavigateTasks} style={{
                  background: C.streakText, border: 'none', borderRadius: 10,
                  padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}>View Tasks</button>
              )}
            </div>
          );
        }
        // green - all done
        return (
          <div data-tour-id="home-banner" style={{
            background: '#29823B0e', border: '1.5px solid #29823B30',
            borderRadius: 18, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🟢</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#29823B', marginBottom: 1 }}>You're checked in and all done!</div>
              <div style={{ fontSize: 11, color: C.body }}>Great work - everything for today is complete.</div>
            </div>
            {onNavigateGoals && (
              <button onClick={onNavigateGoals} style={{
                background: 'none', border: '1px solid #29823B40', borderRadius: 8,
                padding: '5px 10px', color: '#29823B', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>View Progress</button>
            )}
          </div>
        );
      })()}

      {/* ── [1] Combined Streak + Motivation */}
      <div data-tour-id="home-streak" style={{
        ...card,
        background: `linear-gradient(135deg, ${C.headline} 0%, ${C.primaryPressed} 100%)`,
        border: 'none', padding: '18px 20px',
      }}>
        {/* Top row: streak count + milestone count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FireOutlined style={{ color: C.streak, fontSize: 22 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{displayStreak}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                  {displayStreak === 1 ? 'day streak' : 'day streak'}
                </span>
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '5px 10px',
          }}>
            <span style={{ fontSize: 14 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: todayDone === todayTotal && todayTotal > 0 ? C.streak : '#fff' }}>
              {todayDone}/{todayTotal}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>tasks</span>
          </div>
        </div>

        {/* Mon-Sun weekly dots */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {weekDots.map((dot, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', aspectRatio: '1', borderRadius: '50%', maxWidth: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: dot.active ? C.streak : dot.isToday ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)',
                border: dot.isToday
                  ? `2px solid ${dot.active ? C.streak : 'rgba(255,255,255,0.45)'}`
                  : '2px solid transparent',
                fontSize: 10, fontWeight: 700,
                color: dot.active ? '#fff' : dot.isToday ? '#fff' : 'rgba(255,255,255,0.35)',
              }}>
                {dot.active ? '✓' : dot.label.charAt(0)}
              </div>
              <span style={{
                fontSize: 8, letterSpacing: 0.2,
                color: dot.isToday ? C.streak : 'rgba(255,255,255,0.4)',
                fontWeight: dot.isToday ? 700 : 400,
              }}>{dot.label}</span>
            </div>
          ))}
        </div>

        {/* Motivational copy */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 10,
          fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5,
        }}>
          {streakMotivation(displayStreak, completionPct)}
        </div>
      </div>

      {/* ── [2] My Goals - header + swipe cards (before Do This Now) */}
      <ActiveGoalsList
        profileId={profile.id}
        onNavigateGoals={onNavigateGoals}
      />

      {/* ── [3] Do Now - single most urgent task */}
      {doNowTask && completionPct < 100 && onNavigateTasks && (
        <div data-tour-id="home-do-now" style={{ ...card, padding: 0, overflow: 'hidden', border: `1.5px solid ${C.primary}30` }}>
          <div style={{
            background: `linear-gradient(90deg, ${C.primary}18, transparent)`,
            padding: '10px 16px 8px',
            borderBottom: `1px solid ${C.primary}20`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>⚡</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: 0.7 }}>
              Do This Now
            </span>
            <span style={{ fontSize: 10, color: C.secondary, marginLeft: 4 }}>
              {new Date().getHours() >= 17 ? '🌙 Evening' : '☀️ Morning'} priority
            </span>
          </div>
          <div style={{ padding: '12px 16px 14px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.headline, lineHeight: 1.4, marginBottom: 6 }}>
              {doNowTask.label}
            </div>
            {doNowTask.goalTitle && (
              <div style={{ fontSize: 12, color: C.primary, fontWeight: 500, marginBottom: 10 }}>
                🎯 {doNowTask.goalTitle}
              </div>
            )}
            <button
              onClick={onNavigateTasks}
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryPressed})`,
                border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
                color: '#fff', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Start task <ArrowRightOutlined style={{ fontSize: 11 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Divider */}
      <div style={{
        height: 1, background: C.border,
        margin: '4px 0 18px',
        borderRadius: 1,
      }} />

      {/* ── Monthly tasks calendar (same as Tasks → Month) */}
      <div data-tour-id="home-heatmap" style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.headline }}>
            Month overview
          </div>
          {onNavigateMonth && (
            <button
              type="button"
              onClick={onNavigateMonth}
              style={{
                border: 'none', background: 'none', color: C.primary,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
              }}
            >
              Open Month →
            </button>
          )}
        </div>
        <TasksMonthView
          profileId={profile.id}
          previewLimit={3}
          onManageTask={() => {
            if (onNavigateAllTasks) onNavigateAllTasks();
            else onNavigateTasks?.();
          }}
          onGoAllTasks={() => {
            if (onNavigateAllTasks) onNavigateAllTasks();
            else onNavigateTasks?.();
          }}
        />
      </div>

      {/* ── Streak History (completion heatmap) */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, gap: 8,
        }}>
          <button
            type="button"
            onClick={() => shiftStreakMonth(-1)}
            aria-label="Previous months"
            style={{
              ...touchPrimaryButton,
              minWidth: MIN_TOUCH,
              border: `1.5px solid ${C.border}`,
              background: C.bgCard,
              color: C.headline,
              fontWeight: 700,
            }}
          >
            ←
          </button>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.headline }}>Streak History</div>
            <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>
              {leftMonthLabel} – {rightMonthLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => shiftStreakMonth(1)}
            disabled={!canStreakForward}
            aria-label="Next months"
            style={{
              ...touchPrimaryButton,
              minWidth: MIN_TOUCH,
              border: `1.5px solid ${C.border}`,
              background: C.bgCard,
              color: canStreakForward ? C.headline : C.secondary,
              fontWeight: 700,
              opacity: canStreakForward ? 1 : 0.45,
              cursor: canStreakForward ? 'pointer' : 'default',
            }}
          >
            →
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <MonthHeatmap grid={leftGrid} label={leftMonthLabel} />
          <div style={{ width: 1, background: C.border, flexShrink: 0 }} />
          <MonthHeatmap grid={rightGrid} label={rightMonthLabel} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { color: '#73C982aa', label: '1 task' },
            { color: '#29823B',   label: '2 tasks' },
            { color: '#1E612A',   label: '3+ tasks' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 9, color: C.secondary }}>{label}</span>
            </div>
          ))}
          {(streakCursor.year !== todayMonth.year || streakCursor.month0 !== todayMonth.month0) && (
            <button
              type="button"
              onClick={() => setStreakCursor({ ...todayMonth })}
              style={{
                marginLeft: 'auto', border: 'none', background: 'none',
                color: C.primary, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0,
              }}
            >
              Jump to current
            </button>
          )}
        </div>
      </div>

      {/* ── Why This Matters */}
      <div style={{
        ...card,
        borderLeft: `4px solid ${C.primary}`,
        padding: '14px 16px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.headline, marginBottom: 6 }}>
          Why consistency matters
        </div>
        <div style={{ fontSize: 12, color: C.body, lineHeight: 1.6 }}>
          Small daily actions compound over time. Research shows that showing up consistently - even briefly - builds neural pathways that make habits automatic. Your streak is evidence of that process in motion.
        </div>
      </div>

      {/* ── [6] Badges Earned */}
      <div data-tour-id="home-badges" style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.headline }}>Badges Earned</span>
          <span style={{ fontSize: 12, color: C.secondary }}>
            {earnedBadges.length} of {BADGES.length}
          </span>
        </div>
        {earnedBadges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🌱</div>
            <div style={{ fontSize: 13, color: C.secondary }}>Complete tasks to earn your first badge</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {earnedBadges.map(badge => (
              <div key={badge.id} style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '10px 12px', borderRadius: 14,
                background: `${C.primary}0c`, border: `1.5px solid ${C.primary}25`,
                minWidth: 64, textAlign: 'center',
              }}>
                <span style={{ fontSize: 26 }}>{badge.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.primary, lineHeight: 1.2 }}>{badge.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Install prompt */}
      {installPrompt && !isPwaInstalled && (
        <div style={{
          background: `linear-gradient(135deg, ${C.bgAlt}, ${C.bgAlt2})`,
          border: `1.5px solid ${C.primary}40`, borderRadius: 16,
          padding: '14px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12, boxShadow: C.shadow,
        }}>
          <DownloadOutlined style={{ color: C.primary, fontSize: 20 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>Install Arbol Momentum</div>
            <div style={{ color: C.body, fontSize: 12 }}>Add to home screen for the best experience</div>
          </div>
          <Button type="primary" size="small" onClick={onInstall}
            style={{ background: C.primary, border: 'none', borderRadius: 8, fontSize: 12 }}>
            Install
          </Button>
        </div>
      )}

      </>
      )}

      {/* ── Home Page Tour */}
      <PageTour
        open={showTour}
        onClose={() => setShowTour(false)}
        storageKey={tourStorageKey(TOUR_KEYS.home, profile.id)}
        profileId={profile.id}
        pageLabel="Home"
        doneEmoji="🏠"
        doneMessage="You've got the Home screen down. Check your streak every day to build momentum!"
        steps={[
          {
            title: 'Your streak',
            description: 'Track consecutive days you take action. Showing up daily builds momentum.',
            targetId: 'home-streak',
            placement: 'bottom',
          },
          {
            title: 'Your goals',
            description: 'Goals are outcomes you want to reach. Open this section to review progress or add a new goal.',
            targetId: 'home-active-goals',
            placement: 'bottom',
          },
          {
            title: 'Do this now',
            description: 'Your most useful next task, based on time of day and what is still open.',
            targetId: 'home-do-now',
            placement: 'bottom',
          },
          {
            title: 'Activity calendar',
            description: 'See which days you completed work this month so consistency stays visible.',
            targetId: 'home-heatmap',
            placement: 'top',
          },
        ]}
      />

      {/* Goal Check-In tour - separate sequence, after Home + Tasks tours */}
      <PageTour
        open={showCheckInTour}
        onClose={() => setShowCheckInTour(false)}
        storageKey={tourStorageKey(TOUR_KEYS.checkIn, profile.id)}
        profileId={profile.id}
        pageLabel="Goal Check-In"
        doneEmoji="🔴"
        doneMessage="Use Start Check-in on the banner whenever you need to reflect on today's progress."
        steps={[
          {
            title: '🔴 Goal Check-In',
            description: 'Quickly update your goal progress. Track Done, In Progress, or Skipped. Takes under a minute.',
            targetId: 'home-banner',
            placement: 'bottom',
          },
        ]}
      />
    </div>
  );
}
