import { useState, useEffect, useMemo } from 'react';
import { Button } from 'antd';
import {
  FireOutlined, DownloadOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { PageTour, PageTourButton, TOUR_KEYS } from './AppTour';
import type { Profile } from '../data/profiles';
import {
  getDateKey, hasActivityOnDate, getEarnedBadges, BADGES,
} from '../data/profiles';
import { ActiveGoalsList } from './ActiveGoalsList';
import { useDashboardRefresh } from '../hooks/useDashboardRefresh';
import { pickDoNowTask } from '../data/dashboardSnapshot';
import { C } from '../data/colors';

interface Props {
  profile: Profile;
  installPrompt: any;
  onInstall: () => void;
  swRegistration: ServiceWorkerRegistration | null;
  onCoachMark: () => void;
  onNavigateTasks?: () => void;
  onNavigateGoals?: () => void;
  onShowSummary?: () => void;
  onShowFeedback?: () => void;
  onGoals?: () => void;
  onStartCheckIn?: () => void;
  isActive?: boolean;
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
  if (count === 0) return isToday ? 'rgba(9,64,103,0.10)' : 'rgba(0,0,0,0.06)';
  if (count === 1) return '#4ade80aa';
  if (count === 2) return '#22c55e';
  return '#15803d';
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
  onNavigateTasks, onNavigateGoals, onShowSummary, onShowFeedback, onGoals: _onGoals, onStartCheckIn,
  isActive = true,
}: Props) {
  const { snapshot, isLoading } = useDashboardRefresh(profile.id, isActive);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showTour, setShowTour] = useState(false);

  const {
    doneCount: todayDone,
    totalCount: todayTotal,
    progressPercent: completionPct,
    streak: displayStreak,
    bannerState,
    checkInGoalTitles: checkInGoals,
  } = snapshot;

  useEffect(() => {
    setIsPwaInstalled(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const today = snapshot.dateKey;
    const vk = `visit-${profile.id}-${today}`;
    localStorage.setItem(vk, String((parseInt(localStorage.getItem(vk) || '0') + 1)));
  }, [profile.id, isActive, snapshot.dateKey]);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEYS.home)) {
      const t = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(t);
    }
  }, []);

  const todayDate = new Date();
  const weekDots = buildWeekDots(profile.id, completionPct > 0);
  const earnedBadges = getEarnedBadges(profile);
  const doNowTask = useMemo(
    () => pickDoNowTask(profile.id, snapshot.dateKey),
    [profile.id, snapshot.dateKey, snapshot.doneCount, snapshot.totalCount],
  );

  // Two-month grids
  const now = useMemo(() => new Date(), []);
  const currentGrid = useMemo(
    () => buildMonthGrid(profile.id, now.getFullYear(), now.getMonth()),
    [profile.id, now]
  );
  const prevDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
  const prevGrid = useMemo(
    () => buildMonthGrid(profile.id, prevDate.getFullYear(), prevDate.getMonth()),
    [profile.id, prevDate]
  );
  const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const prevMonthLabel = prevDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

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
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 20px', background: C.bg, minHeight: '100dvh' }}>

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
          <PageTourButton onClick={() => setShowTour(true)} />
        </div>
      </div>

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
              background: '#ef456510', border: '1.5px solid #ef456530',
              borderRadius: 18, padding: '14px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🔴</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4565', marginBottom: 2 }}>
                  {count > 0 ? `${count} goal${count !== 1 ? 's' : ''} need check-in` : "You haven't checked in today"}
                </div>
                <div style={{ fontSize: 11, color: C.body, lineHeight: 1.4 }}>
                  Quickly update your progress and stay on track.
                </div>
              </div>
              {onStartCheckIn && (
                <button onClick={onStartCheckIn} style={{
                  background: '#ef4565', border: 'none', borderRadius: 10,
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
              background: '#f5a62310', border: '1.5px solid #f5a62330',
              borderRadius: 18, padding: '14px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🟡</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f5a623', marginBottom: 2 }}>You've checked in, but still have tasks to complete</div>
                <div style={{ fontSize: 11, color: C.body, lineHeight: 1.4 }}>Keep going to finish your remaining tasks.</div>
              </div>
              {onNavigateTasks && (
                <button onClick={onNavigateTasks} style={{
                  background: '#f5a623', border: 'none', borderRadius: 10,
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
            background: '#2cb67d0e', border: '1.5px solid #2cb67d30',
            borderRadius: 18, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🟢</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2cb67d', marginBottom: 1 }}>You're checked in and all done!</div>
              <div style={{ fontSize: 11, color: C.body }}>Great work - everything for today is complete.</div>
            </div>
            {onNavigateGoals && (
              <button onClick={onNavigateGoals} style={{
                background: 'none', border: '1px solid #2cb67d40', borderRadius: 8,
                padding: '5px 10px', color: '#2cb67d', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>View Progress</button>
            )}
          </div>
        );
      })()}

      {/* ── [1] Combined Streak + Motivation */}
      <div data-tour-id="home-streak" style={{
        ...card,
        background: `linear-gradient(135deg, ${C.headline} 0%, #1a6da8 100%)`,
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

      {/* ── [2] Active goals — horizontal swipe cards */}
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
                background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
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

      {/* ── [4] Goals quick-access */}
      {onNavigateGoals && (
        <div
          onClick={onNavigateGoals}
          style={{
            ...card, padding: '14px 18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
            border: `1.5px solid ${C.primary}25`,
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: `${C.primary}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            🏆
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>My Goals</div>
            <div style={{ fontSize: 12, color: C.body, marginTop: 2 }}>
              View, edit, and set new goals
            </div>
          </div>
          <ArrowRightOutlined style={{ color: C.secondary, fontSize: 14 }} />
        </div>
      )}

      {/* ── Divider */}
      <div style={{
        height: 1, background: C.border,
        margin: '4px 0 18px',
        borderRadius: 1,
      }} />

      {/* ── [4] Two-Month Streak Heatmap */}
      <div data-tour-id="home-heatmap" style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.headline, marginBottom: 14 }}>
          Streak History
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <MonthHeatmap grid={prevGrid} label={prevMonthLabel} />
          <div style={{ width: 1, background: C.border, flexShrink: 0 }} />
          <MonthHeatmap grid={currentGrid} label={currentMonthLabel} />
        </div>

        {/* Legend - keep green scale */}
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center' }}>
          {[
            { color: '#4ade80aa', label: '1 task' },
            { color: '#22c55e',   label: '2 tasks' },
            { color: '#15803d',   label: '3+ tasks' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 9, color: C.secondary }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── [5] Why This Matters */}
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
        storageKey={TOUR_KEYS.home}
        pageLabel="Home"
        doneEmoji="🏠"
        doneMessage="You've got the Home screen down. Check your streak every day to build momentum!"
        steps={[
          {
            title: '🔴 Goal Check-In',
            description: 'Quickly update your goal progress. Track Done, In Progress, or Skipped — takes under a minute.',
            targetId: 'home-banner',
            placement: 'bottom',
          },
          {
            title: '🔥 Your Streak',
            description: 'Consecutive days you\'ve completed tasks. Orange dots mean you showed up this week.',
            targetId: 'home-streak',
            placement: 'bottom',
          },
          {
            title: '🎯 Your Active Goals',
            description: 'Swipe through your active goals to see what\'s currently important. Progress here helps Arbol guide your next actions.',
            targetId: 'home-active-goals',
            placement: 'bottom',
          },
          {
            title: '⚡ Do This Now',
            description: 'Your most urgent task right now, based on time of day and goal priority.',
            targetId: 'home-do-now',
            placement: 'bottom',
          },
          {
            title: '📅 Streak History',
            description: 'A heatmap of every active day. Darker green = more tasks done.',
            targetId: 'home-heatmap',
            placement: 'top',
          },
        ]}
      />
    </div>
  );
}
