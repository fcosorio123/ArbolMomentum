import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Progress, Switch, Input, Select } from 'antd';
import { ArrowLeftOutlined, FireOutlined, ReloadOutlined, DownloadOutlined, InfoCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { DataMigration } from './DataMigration';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { PROFILES, getTaskCategoriesForProfile, isTaskDeleted, getTaskStatus, computeLiveStreak, getTodayKey, getDateKey } from '../data/profiles';
import {
  getAllFeedbackAll, getActivityChartData, getWeeklyEngagement,
  generateInsight, RATING_EMOJIS, type FeedbackEntry,
} from '../data/feedback';
import {
  getAllDeviceRecords, getAllEventLogs,
  type DeviceRecord, type EventType,
} from '../data/deviceAnalytics';
import {
  getAllProgressLogs, getPersonalGoals, MILESTONE_CONFIG,
  type GoalProgressLog, type PersonalGoal,
} from '../data/personalGoals';
import { isPublishedVersion, getEnvironmentInfo } from '../data/environment';
import { getDataCollectionStats, downloadCentralDataBackup } from '../data/centralizedData';
import {
  fetchAllTaskCompletions, fetchAllGoalProgress, fetchAllFeedback,
  fetchAllDeviceRecords, fetchAllEventLogs, fetchAllTaskDeletions,
} from '../data/supabaseSync';
import { getUserTasks, type UserTask } from '../data/userTasks';
import { C } from '../data/colors';
import {
  fetchAppSettings, saveAppSettings, getAppNotificationSettings,
  type AppNotificationSettings, type NotificationChannel,
} from '../data/appSettings';
import {
  fetchEmailSettings, saveEmailSettings, getEmailSettings,
  sendTestEmail, sendManualNudge,
  type EmailSettings, type EmailTriggerMode,
} from '../data/emailSettings';

interface Props { onBack: () => void }

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_DAYS_INDEXED = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDateForOffset(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return getDateKey(d);
}

function getDateForWeekday(dayName: string) {
  const today = new Date();
  const ci = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const t = new Date(today);
  t.setDate(today.getDate() + (DAYS_SHORT.indexOf(dayName) - ci));
  return getDateKey(t);
}

function computeCompletion(profileId: string, date: string): number {
  const cats = getTaskCategoriesForProfile(profileId);
  const tasks = cats.flatMap(c => c.tasks);
  const visible = tasks.filter(t => !isTaskDeleted(profileId, t.id, date));
  if (visible.length === 0) return 0;
  const done = visible.filter(t => getTaskStatus(profileId, t.id, date) === 'done').length;
  return Math.round((done / visible.length) * 100);
}

function computeDayDetail(profileId: string, date: string) {
  const cats = getTaskCategoriesForProfile(profileId);
  const tasks = cats.flatMap(c => c.tasks);
  const visible = tasks.filter(t => !isTaskDeleted(profileId, t.id, date));
  const deleted = tasks.length - visible.length;
  const done = visible.filter(t => getTaskStatus(profileId, t.id, date) === 'done').length;
  const inprog = visible.filter(t => getTaskStatus(profileId, t.id, date) === 'inprogress').length;
  const notStarted = visible.length - done - inprog;
  const pct = visible.length > 0 ? Math.round((done / visible.length) * 100) : 0;
  return { done, inprog, notStarted, deleted, total: visible.length, pct };
}

// ── Sub-components ────────────────────────────

function TabBar({ tab, onChange }: { tab: string; onChange: (t: string) => void }) {
  const tabs = [
    { id: 'overview', label: '📊' },
    { id: 'analytics', label: '📈' },
    { id: 'feedback', label: '💬' },
    { id: 'goals', label: '🌟' },
    { id: 'devices', label: '📱' },
    { id: 'settings', label: '⚙️' },
  ];
  return (
    <div style={{ display: 'flex', background: C.bgAlt, borderRadius: 14, padding: 4, margin: '0 16px 16px', border: `1px solid ${C.border}`, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, padding: '9px 4px', borderRadius: 11, border: 'none', cursor: 'pointer',
          background: tab === t.id ? C.bgCard : 'transparent',
          color: tab === t.id ? C.headline : C.secondary,
          fontWeight: tab === t.id ? 700 : 400, fontSize: 12,
          boxShadow: tab === t.id ? C.shadow : 'none', transition: 'all 0.2s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────
function OverviewTab() {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'comparison'>('daily');
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const today = getTodayKey();

    // If published, fetch from Supabase for accurate cross-user data
    if (isPublishedVersion()) {
      try {
        const completions = await fetchAllTaskCompletions();
        const deletions = await fetchAllTaskDeletions();

        const profileStats = PROFILES.map(p => {
          const todayVisits = parseInt(localStorage.getItem(`visit-${p.id}-${today}`) || '0');

          // Helper function to calculate stats for a given date
          const calculateDayStats = (date: string) => {
            // Get the full task list for this profile/date
            const cats = getTaskCategoriesForProfile(p.id);
            const allTasks = cats.flatMap(c => c.tasks);

            // Get deletions for this date
            const dayDeletions = deletions.filter(d => d.profile_id === p.id && d.date === date);
            const deletedTaskIds = new Set(dayDeletions.map(d => d.task_id));

            // Filter out deleted tasks
            const visibleTasks = allTasks.filter(t => !deletedTaskIds.has(t.id));

            // Get completions for this date
            const dayCompletions = completions.filter(c => c.profile_id === p.id && c.date === date);
            const completionMap = new Map(dayCompletions.map(c => [c.task_id, c.status]));

            // Count statuses
            let done = 0;
            let inprog = 0;
            let notStarted = 0;

            visibleTasks.forEach(task => {
              const status = completionMap.get(task.id);
              if (status === 'done') done++;
              else if (status === 'inprogress') inprog++;
              else notStarted++;
            });

            const total = visibleTasks.length;
            const deleted = deletedTaskIds.size;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return { done, inprog, notStarted, deleted, total, pct };
          };

          // Calculate today's detail
          const todayDetail = calculateDayStats(today);

          // Calculate week stats
          const weekDays = DAYS_SHORT.map(day => {
            const date = getDateForWeekday(day);
            const stats = calculateDayStats(date);
            return { day, date, ...stats };
          });

          const weekAvg = weekDays.length > 0
            ? Math.round(weekDays.reduce((s, d) => s + d.pct, 0) / weekDays.length)
            : 0;

          // Calculate previous week for comparison
          const prevWeekDays = DAYS_SHORT.map((day, idx) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - idx) - 7); // Go back 7 more days
            const date = getDateKey(d);
            const stats = calculateDayStats(date);
            return { day, date, done: stats.done, total: stats.total, pct: stats.pct };
          });

          const prevWeekAvg = prevWeekDays.length > 0
            ? Math.round(prevWeekDays.reduce((s, d) => s + d.pct, 0) / prevWeekDays.length)
            : 0;

          return { ...p, todayVisits, todayDetail, weekDays, weekAvg, prevWeekDays, prevWeekAvg };
        });

        setStats(profileStats);
      } catch (error) {
        console.error('Failed to fetch Supabase data:', error);
        // Fallback to localStorage
        loadFromLocalStorage();
      }
    } else {
      loadFromLocalStorage();
    }

    setLoading(false);
  };

  const loadFromLocalStorage = () => {
    const today = getTodayKey();
    setStats(PROFILES.map(p => {
      const todayVisits = parseInt(localStorage.getItem(`visit-${p.id}-${today}`) || '0');
      const todayDetail = computeDayDetail(p.id, today);

      const weekDays = DAYS_SHORT.map(day => {
        const date = getDateForWeekday(day);
        const detail = computeDayDetail(p.id, date);
        return { day, date, ...detail };
      });
      const weekAvg = Math.round(weekDays.reduce((s, d) => s + d.pct, 0) / weekDays.length);

      // Previous week
      const prevWeekDays = DAYS_SHORT.map((day, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - idx) - 7);
        const date = getDateKey(d);
        const detail = computeDayDetail(p.id, date);
        return { day, date, ...detail };
      });
      const prevWeekAvg = Math.round(prevWeekDays.reduce((s, d) => s + d.pct, 0) / prevWeekDays.length);

      return { ...p, todayVisits, todayDetail, weekDays, weekAvg, prevWeekDays, prevWeekAvg };
    }));
  };

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, []);

  const today = getTodayKey();
  const totalVisits = stats.reduce((s, p) => s + p.todayVisits, 0);
  const avgCompletion = stats.length > 0 ? Math.round(stats.reduce((s, p) => s + p.todayDetail.pct, 0) / stats.length) : 0;

  const card: React.CSSProperties = { background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadow };

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Summary cards */}
      <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        📊 Today's Snapshot
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total visits', value: totalVisits, sub: `${stats.filter(p => p.todayVisits > 0).length} of ${PROFILES.length} active`, color: C.primary },
          { label: 'Avg completion', value: `${avgCompletion}%`, sub: 'across all users', color: C.primary },
          { label: 'In progress', value: stats.filter(p => p.todayDetail.inprog > 0).length, sub: 'users mid-way', color: C.streak },
          { label: 'Fully done', value: stats.filter(p => p.todayDetail.pct === 100).length, sub: '100% today', color: C.tertiary },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.headline }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.body, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: C.secondary, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Daily / Weekly / Comparison toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          🏆 User Performance
        </p>
        <div style={{ display: 'flex', background: C.bgAlt, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
          {(['daily', 'weekly', 'comparison'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11,
              background: viewMode === m ? C.bgCard : 'transparent',
              color: viewMode === m ? C.headline : C.secondary,
              fontWeight: viewMode === m ? 700 : 400, transition: 'all 0.15s',
            }}>
              {m === 'daily' ? 'Today' : m === 'weekly' ? 'This Week' : 'Comparison'}
            </button>
          ))}
        </div>
      </div>

      {stats.map(p => (
        <div key={p.id} style={{ ...card, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 22 }}>{p.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>{p.name}</div>
              <div style={{ fontSize: 11, color: C.secondary }}>{p.role}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <FireOutlined style={{ color: C.streak, fontSize: 13 }} />
              <span style={{ color: C.streak, fontWeight: 800, fontSize: 16 }}>{p.streak}</span>
            </div>
          </div>

          {viewMode === 'daily' ? (
            <>
              <Progress percent={p.todayDetail.pct}
                strokeColor={{ '0%': C.primary, '100%': C.headline }}
                railColor={C.bgAlt} showInfo={false} size={['100%', 5]} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'Done', count: p.todayDetail.done, color: C.primary },
                  { label: 'In progress', count: p.todayDetail.inprog, color: C.streak },
                  { label: 'Not started', count: p.todayDetail.notStarted, color: C.secondary },
                  { label: 'Removed', count: p.todayDetail.deleted, color: C.tertiary },
                ].filter(s => s.count > 0).map(s => (
                  <span key={s.label} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: `${s.color}15`, color: s.color, fontWeight: 600,
                  }}>
                    {s.count} {s.label}
                  </span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: C.primary, fontWeight: 700 }}>
                  {p.todayDetail.pct}%
                </span>
              </div>
            </>
          ) : viewMode === 'weekly' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
                {p.weekDays.map((d: any) => {
                  const isToday = d.date === today;
                  return (
                    <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{
                        width: '100%', aspectRatio: '1', borderRadius: 6,
                        background: d.pct === 100 ? C.primary : d.pct > 0 ? `${C.primary}${Math.round(20 + d.pct * 1.6).toString(16)}` : C.bgAlt,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: d.pct > 40 ? '#fff' : C.secondary,
                        border: isToday ? `1.5px solid ${C.primary}` : 'none',
                      }}>
                        {d.pct > 0 ? `${d.pct}%` : '-'}
                      </div>
                      <span style={{ fontSize: 9, color: isToday ? C.primary : C.secondary, fontWeight: isToday ? 700 : 400 }}>{d.day}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: C.primary, fontWeight: 700 }}>
                Avg {p.weekAvg}% this week
              </div>
            </div>
          ) : (
            <div>
              {/* Weekly Comparison View */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.secondary, marginBottom: 6 }}>This Week vs Last Week</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.secondary, marginBottom: 4 }}>Current Week</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{p.weekAvg}</span>
                      <span style={{ fontSize: 14, color: C.secondary }}>%</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.secondary, marginBottom: 4 }}>Previous Week</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: C.secondary }}>{p.prevWeekAvg}</span>
                      <span style={{ fontSize: 14, color: C.secondary }}>%</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    {(() => {
                      const diff = p.weekAvg - p.prevWeekAvg;
                      const isPositive = diff > 0;
                      const isNeutral = diff === 0;
                      return (
                        <>
                          <div style={{ fontSize: 20 }}>{isNeutral ? '➡️' : isPositive ? '📈' : '📉'}</div>
                          <div style={{
                            fontSize: 16, fontWeight: 700,
                            color: isNeutral ? C.secondary : isPositive ? '#22c55e' : C.tertiary
                          }}>
                            {isPositive ? '+' : ''}{diff}%
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Week-by-week bars */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.secondary, marginBottom: 4 }}>Current Week</div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {p.weekDays.map((d: any) => (
                      <div key={d.day} style={{ flex: 1, height: 40, background: C.bgAlt, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', bottom: 0, width: '100%',
                          height: `${d.pct}%`, background: C.primary,
                          transition: 'height 0.3s ease',
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.secondary, marginBottom: 4 }}>Previous Week</div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {p.prevWeekDays?.map((d: any) => (
                      <div key={d.day} style={{ flex: 1, height: 40, background: C.bgAlt, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', bottom: 0, width: '100%',
                          height: `${d.pct}%`, background: C.secondary,
                          transition: 'height 0.3s ease',
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────
type TimePeriod = 'week' | 'month' | '3months' | '6months' | 'year' | 'all' | 'custom';

interface EngagementData {
  date: string;
  label: string;
  pct: number;
  done: number;
  total: number;
}

function AnalyticsTab() {
  const [selectedId, setSelectedId] = useState(PROFILES[0].id);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [loading, setLoading] = useState(false);

  const profile = PROFILES.find(p => p.id === selectedId)!;
  const today = getTodayKey();

  const hourlyData = getActivityChartData(selectedId, today);
  const todayDetail = computeDayDetail(selectedId, today);
  const todayVisits = parseInt(localStorage.getItem(`visit-${selectedId}-${today}`) || '0');
  const liveStreak = computeLiveStreak(selectedId, todayDetail.pct > 0);

  // Peak hour
  const allHours: number[] = JSON.parse(localStorage.getItem(`arbol-activity-${selectedId}-${today}`) || '[]') || [];
  const peakHour = allHours.length > 0 ? allHours.indexOf(Math.max(...allHours)) : -1;
  const peakLabel = peakHour >= 0
    ? peakHour === 0 ? '12AM' : peakHour < 12 ? `${peakHour}AM` : peakHour === 12 ? '12PM' : `${peakHour - 12}PM`
    : null;

  const insight = generateInsight({
    completionRate: profile.completionRate,
    streak: liveStreak,
    todayPct: todayDetail.pct,
    peakHour: peakHour >= 0 ? peakHour : 14,
    visitCount: todayVisits,
  });

  const card: React.CSSProperties = { background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadow };

  // Get date range based on selected time period
  const getDateRange = (): { startDate: string; endDate: string; days: number } => {
    const end = new Date();
    const endDate = getDateKey(end);
    let startDate: string;
    let days: number;

    switch (timePeriod) {
      case 'week':
        days = 7;
        break;
      case 'month':
        days = 30;
        break;
      case '3months':
        days = 90;
        break;
      case '6months':
        days = 180;
        break;
      case 'year':
        days = 365;
        break;
      case 'all':
        days = 730; // 2 years max
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const endCustom = new Date(customEndDate);
          days = Math.floor((endCustom.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return { startDate: customStartDate, endDate: customEndDate, days };
        }
        days = 7; // Fallback
        break;
      default:
        days = 7;
    }

    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    startDate = getDateKey(start);

    return { startDate, endDate, days };
  };

  // Load engagement data for selected time period
  const loadEngagementData = async () => {
    setLoading(true);
    const { startDate, endDate, days } = getDateRange();

    try {
      let data: EngagementData[] = [];

      // Determine aggregation level based on date range
      const shouldAggregate = days > 90; // Aggregate by week if > 90 days

      if (isPublishedVersion()) {
        // Fetch from Supabase
        const completions = await fetchAllTaskCompletions({ profileId: selectedId });
        const deletions = await fetchAllTaskDeletions({ profileId: selectedId });

        if (shouldAggregate) {
          // Aggregate by week
          data = getWeeklyAggregatedData(startDate, endDate, completions, deletions);
        } else {
          // Daily data
          data = getDailyEngagementData(startDate, endDate, completions, deletions);
        }
      } else {
        // Development mode - use localStorage
        if (shouldAggregate) {
          data = getWeeklyAggregatedDataLocal(startDate, endDate);
        } else {
          data = getDailyEngagementDataLocal(startDate, endDate);
        }
      }

      setEngagementData(data);
    } catch (error) {
      console.error('Failed to load engagement data:', error);
      // Fallback to local data
      const { startDate, endDate } = getDateRange();
      const data = getDailyEngagementDataLocal(startDate, endDate);
      setEngagementData(data);
    }

    setLoading(false);
  };

  // Helper: Get daily engagement data from Supabase
  const getDailyEngagementData = (startDate: string, endDate: string, completions: any[], deletions: any[]): EngagementData[] => {
    const data: EngagementData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = getDateKey(d);
      const cats = getTaskCategoriesForProfile(selectedId);
      const allTasks = cats.flatMap(c => c.tasks);

      const dayDeletions = deletions.filter(del => del.date === dateStr);
      const deletedIds = new Set(dayDeletions.map(del => del.task_id));
      const visibleTasks = allTasks.filter(t => !deletedIds.has(t.id));

      const dayCompletions = completions.filter(c => c.date === dateStr);
      const doneCount = dayCompletions.filter(c => c.status === 'done').length;

      const total = visibleTasks.length;
      const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      data.push({
        date: dateStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pct,
        done: doneCount,
        total,
      });
    }

    return data;
  };

  // Helper: Get weekly aggregated data from Supabase
  const getWeeklyAggregatedData = (startDate: string, endDate: string, completions: any[], deletions: any[]): EngagementData[] => {
    const data: EngagementData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Group by weeks (Monday-Sunday)
    let weekStart = new Date(start);
    while (weekStart <= end) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartStr = getDateKey(weekStart);
      const weekEndStr = getDateKey(weekEnd <= end ? weekEnd : end);

      // Calculate average completion for the week
      let totalPct = 0;
      let dayCount = 0;
      let weekDone = 0;
      let weekTotal = 0;

      for (let d = new Date(weekStart); d <= new Date(weekEndStr); d.setDate(d.getDate() + 1)) {
        const dateStr = getDateKey(d);
        const cats = getTaskCategoriesForProfile(selectedId);
        const allTasks = cats.flatMap(c => c.tasks);

        const dayDeletions = deletions.filter(del => del.date === dateStr);
        const deletedIds = new Set(dayDeletions.map(del => del.task_id));
        const visibleTasks = allTasks.filter(t => !deletedIds.has(t.id));

        const dayCompletions = completions.filter(c => c.date === dateStr);
        const doneCount = dayCompletions.filter(c => c.status === 'done').length;

        const total = visibleTasks.length;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

        totalPct += pct;
        weekDone += doneCount;
        weekTotal += total;
        dayCount++;
      }

      const avgPct = dayCount > 0 ? Math.round(totalPct / dayCount) : 0;

      data.push({
        date: weekStartStr,
        label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pct: avgPct,
        done: weekDone,
        total: weekTotal,
      });

      weekStart.setDate(weekStart.getDate() + 7);
    }

    return data;
  };

  // Helper: Get daily engagement data from localStorage
  const getDailyEngagementDataLocal = (startDate: string, endDate: string): EngagementData[] => {
    const data: EngagementData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = getDateKey(d);
      const detail = computeDayDetail(selectedId, dateStr);

      data.push({
        date: dateStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pct: detail.pct,
        done: detail.done,
        total: detail.total,
      });
    }

    return data;
  };

  // Helper: Get weekly aggregated data from localStorage
  const getWeeklyAggregatedDataLocal = (startDate: string, endDate: string): EngagementData[] => {
    const data: EngagementData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    let weekStart = new Date(start);
    while (weekStart <= end) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekEndStr = getDateKey(weekEnd <= end ? weekEnd : end);

      let totalPct = 0;
      let dayCount = 0;
      let weekDone = 0;
      let weekTotal = 0;

      for (let d = new Date(weekStart); d <= new Date(weekEndStr); d.setDate(d.getDate() + 1)) {
        const dateStr = getDateKey(d);
        const detail = computeDayDetail(selectedId, dateStr);

        totalPct += detail.pct;
        weekDone += detail.done;
        weekTotal += detail.total;
        dayCount++;
      }

      const avgPct = dayCount > 0 ? Math.round(totalPct / dayCount) : 0;

      data.push({
        date: getDateKey(weekStart),
        label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pct: avgPct,
        done: weekDone,
        total: weekTotal,
      });

      weekStart.setDate(weekStart.getDate() + 7);
    }

    return data;
  };

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (engagementData.length === 0) return { avgCompletion: 0, totalCompletions: 0, activeDays: 0, peakDay: null, trend: 0 };

    const avgCompletion = Math.round(engagementData.reduce((sum, d) => sum + d.pct, 0) / engagementData.length);
    const totalCompletions = engagementData.reduce((sum, d) => sum + d.done, 0);
    const activeDays = engagementData.filter(d => d.done > 0).length;
    const peakDay = engagementData.reduce((max, d) => d.pct > max.pct ? d : max, engagementData[0]);

    // Calculate trend (comparing first half vs second half)
    const midpoint = Math.floor(engagementData.length / 2);
    const firstHalf = engagementData.slice(0, midpoint);
    const secondHalf = engagementData.slice(midpoint);

    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, d) => sum + d.pct, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, d) => sum + d.pct, 0) / secondHalf.length : 0;

    const trend = secondAvg - firstAvg;

    return { avgCompletion, totalCompletions, activeDays, peakDay, trend };
  }, [engagementData]);

  // Load data when period or profile changes
  useEffect(() => {
    loadEngagementData();
  }, [selectedId, timePeriod, customStartDate, customEndDate]);

  const timePeriods: { id: TimePeriod; label: string }[] = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: '3months', label: '3 Months' },
    { id: '6months', label: '6 Months' },
    { id: 'year', label: 'Year' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* User selector */}
      <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        Select User
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {PROFILES.map(p => (
          <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: selectedId === p.id ? C.headline : C.bgCard,
            color: selectedId === p.id ? '#fff' : C.body,
            fontWeight: selectedId === p.id ? 700 : 400, fontSize: 13,
            boxShadow: C.shadow, transition: 'all 0.2s',
          }}>
            <span>{p.avatar}</span> {p.name}
          </button>
        ))}
      </div>

      {/* Insight card */}
      <div style={{ ...card, padding: '14px 16px', marginBottom: 14, background: `${C.primary}08`, border: `1.5px solid ${C.primary}25` }}>
        <div style={{ fontSize: 11, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          🤖 Auto Insight
        </div>
        <div style={{ fontSize: 14, color: C.headline, lineHeight: 1.5 }}>{insight}</div>
        {peakLabel && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.body }}>
            Peak activity today: <strong style={{ color: C.primary }}>{peakLabel}</strong>
          </div>
        )}
      </div>

      {/* Today stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Visits', val: todayVisits },
          { label: 'Done', val: todayDetail.done },
          { label: 'In prog.', val: todayDetail.inprog },
          { label: 'Rate', val: `${todayDetail.pct}%` },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.headline }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.secondary, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Time-of-day bar chart */}
      <div style={{ ...card, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.headline, marginBottom: 4 }}>
          ⏰ Time-of-Day Activity
        </div>
        <div style={{ fontSize: 11, color: C.secondary, marginBottom: 12 }}>
          Task interactions today by hour
        </div>
        {hourlyData.some(d => d.count > 0) ? (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={hourlyData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid key="bar-grid" strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis key="bar-xaxis" dataKey="h" tickFormatter={(h) => hourlyData.find(d => d.h === h)?.hour ?? ''} tick={{ fontSize: 9, fill: C.secondary }} />
              <YAxis key="bar-yaxis" tick={{ fontSize: 9, fill: C.secondary }} allowDecimals={false} />
              <Tooltip
                key="bar-tooltip"
                contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v} interactions`, 'Activity']}
              />
              <Bar key="bar-count" dataKey="count" fill={C.primary} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.secondary, fontSize: 13 }}>
            No activity recorded yet today
          </div>
        )}
      </div>

      {/* Enhanced Engagement Analytics */}
      <div style={{ ...card, padding: '14px 16px', marginBottom: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.headline, marginBottom: 2 }}>
              📊 Engagement Analytics
            </div>
            <div style={{ fontSize: 11, color: C.secondary }}>
              Task completion trends
            </div>
          </div>
          {!loading && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => {
                // Export data as CSV
                const csv = [
                  ['Date', 'Completion %', 'Tasks Done', 'Total Tasks'],
                  ...engagementData.map(d => [d.date, d.pct, d.done, d.total])
                ].map(row => row.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `engagement-${selectedId}-${timePeriod}-${getTodayKey()}.csv`;
                a.click();
              }}
              style={{ fontSize: 11 }}
            >
              Export
            </Button>
          )}
        </div>

        {/* Time Period Filter */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {timePeriods.map(tp => (
              <button
                key={tp.id}
                onClick={() => setTimePeriod(tp.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: timePeriod === tp.id ? C.primary : C.bgAlt,
                  color: timePeriod === tp.id ? '#fff' : C.body,
                  fontWeight: timePeriod === tp.id ? 600 : 400,
                  fontSize: 11,
                  transition: 'all 0.2s',
                }}
              >
                {tp.label}
              </button>
            ))}
          </div>

          {/* Custom Date Picker */}
          {timePeriod === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
              <span style={{ color: C.secondary }}>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                max={customEndDate || today}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.bgCard,
                  color: C.headline,
                  fontSize: 11,
                }}
              />
              <span style={{ color: C.secondary }}>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                max={today}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.bgCard,
                  color: C.headline,
                  fontSize: 11,
                }}
              />
            </div>
          )}
        </div>

        {/* Summary Metrics */}
        {!loading && engagementData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            <div style={{ background: C.bgAlt, padding: '8px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>{summaryMetrics.avgCompletion}%</div>
              <div style={{ fontSize: 9, color: C.secondary, marginTop: 2 }}>Avg. Completion</div>
            </div>
            <div style={{ background: C.bgAlt, padding: '8px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.headline }}>{summaryMetrics.totalCompletions}</div>
              <div style={{ fontSize: 9, color: C.secondary, marginTop: 2 }}>Total Done</div>
            </div>
            <div style={{ background: C.bgAlt, padding: '8px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.headline }}>{summaryMetrics.activeDays}</div>
              <div style={{ fontSize: 9, color: C.secondary, marginTop: 2 }}>Active Days</div>
            </div>
            <div style={{ background: C.bgAlt, padding: '8px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: summaryMetrics.trend >= 0 ? '#10b981' : '#ef4444' }}>
                {summaryMetrics.trend >= 0 ? '↑' : '↓'} {Math.abs(Math.round(summaryMetrics.trend))}%
              </div>
              <div style={{ fontSize: 9, color: C.secondary, marginTop: 2 }}>Trend</div>
            </div>
          </div>
        )}

        {/* Chart */}
        {loading ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.secondary, fontSize: 13 }}>
            Loading data...
          </div>
        ) : engagementData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={engagementData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid key="line-grid" strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis
                key="line-xaxis"
                dataKey="date"
                tickFormatter={(date) => engagementData.find(d => d.date === date)?.label ?? ''}
                tick={{ fontSize: 10, fill: C.secondary }}
                interval={engagementData.length > 30 ? 'preserveStartEnd' : 0}
              />
              <YAxis key="line-yaxis" domain={[0, 100]} tick={{ fontSize: 9, fill: C.secondary }} />
              <Tooltip
                key="line-tooltip"
                contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, name: string) => {
                  if (name === 'pct') return [`${v}%`, 'Completion'];
                  return [v, name];
                }}
                labelFormatter={(date) => {
                  const entry = engagementData.find(d => d.date === date);
                  return entry ? `${entry.label} - ${entry.done}/${entry.total} tasks` : date;
                }}
              />
              <Line
                key="line-pct"
                type="monotone"
                dataKey="pct"
                stroke={C.primary}
                strokeWidth={2.5}
                dot={{ r: engagementData.length > 30 ? 0 : 4, fill: C.primary, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
                fill="url(#colorPct)"
                fillOpacity={1}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.secondary, fontSize: 13 }}>
            No engagement data available for this period
          </div>
        )}

        {/* Peak Day Info */}
        {!loading && summaryMetrics.peakDay && (
          <div style={{ marginTop: 12, fontSize: 11, color: C.body, textAlign: 'center' }}>
            Peak day: <strong style={{ color: C.primary }}>{summaryMetrics.peakDay.label}</strong> at <strong>{summaryMetrics.peakDay.pct}%</strong> completion
          </div>
        )}
      </div>

      {/* Streak progress */}
      <div style={{ ...card, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.headline, marginBottom: 10 }}>
          🔥 Streak Status
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: C.body }}>Current streak</span>
          <span style={{ color: C.streak, fontWeight: 700 }}>{liveStreak} days</span>
        </div>
        <Progress percent={Math.min(100, Math.round((liveStreak / profile.bestStreak) * 100))}
          strokeColor={{ '0%': C.streak, '100%': '#f5d020' }}
          railColor={C.bgAlt} showInfo={false} size={['100%', 6]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: C.secondary }}>
          <span>0</span>
          <span>Best: {profile.bestStreak} days</span>
        </div>
      </div>
    </div>
  );
}

// ── Feedback Tab ─────────────────────────────
function FeedbackTab() {
  const [filterUser, setFilterUser] = useState<string>('all');
  const [allFeedback, setAllFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      if (isPublishedVersion()) {
        try {
          const supabaseFeedback = await fetchAllFeedback();
          const formattedFeedback: FeedbackEntry[] = supabaseFeedback.map(f => ({
            profileId: f.profile_id || '',
            rating: f.rating || 3,
            whatWorked: f.what_worked || [],
            whatDidnt: f.what_didnt || [],
            suggestion: f.suggestion || '',
            date: f.date || '',
            timestamp: new Date(f.created_at || Date.now()).getTime(),
          }));
          setAllFeedback(formattedFeedback);
        } catch (error) {
          console.error('Failed to fetch feedback from Supabase:', error);
          setAllFeedback(getAllFeedbackAll());
        }
      } else {
        setAllFeedback(getAllFeedbackAll());
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const filtered = useMemo(
    () => filterUser === 'all' ? allFeedback : allFeedback.filter(f => f.profileId === filterUser),
    [allFeedback, filterUser],
  );

  const grouped = useMemo(
    () => filtered.reduce<Record<string, FeedbackEntry[]>>((acc, f) => {
      acc[f.date] = [...(acc[f.date] || []), f];
      return acc;
    }, {}),
    [filtered],
  );

  const card: React.CSSProperties = { background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadow };

  const profileMap = useMemo(() => Object.fromEntries(PROFILES.map(p => [p.id, p])), []);

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* User filter */}
      <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        Filter by user
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        <button onClick={() => setFilterUser('all')} style={{
          flexShrink: 0, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: filterUser === 'all' ? C.headline : C.bgCard,
          color: filterUser === 'all' ? '#fff' : C.body,
          fontWeight: filterUser === 'all' ? 700 : 400, fontSize: 13, boxShadow: C.shadow,
        }}>All</button>
        {PROFILES.map(p => (
          <button key={p.id} onClick={() => setFilterUser(p.id)} style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: filterUser === p.id ? C.headline : C.bgCard,
            color: filterUser === p.id ? '#fff' : C.body,
            fontWeight: filterUser === p.id ? 700 : 400, fontSize: 13, boxShadow: C.shadow,
          }}>
            {p.avatar} {p.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: C.headline, marginBottom: 8 }}>No feedback yet</div>
          <div style={{ color: C.body, fontSize: 13 }}>Feedback from users will appear here once submitted.</div>
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, entries]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.secondary, fontWeight: 600, marginBottom: 8 }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            {entries.map((entry, idx) => {
              const p = profileMap[entry.profileId];
              return (
                <div key={`${entry.profileId}-${entry.timestamp}-${idx}`} style={{ ...card, padding: '14px 16px', marginBottom: 10 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{p?.avatar ?? '👤'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>{p?.name ?? entry.profileId}</div>
                      <div style={{ fontSize: 11, color: C.secondary }}>
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    {/* Rating */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28 }}>{RATING_EMOJIS[entry.rating - 1]}</div>
                      <div style={{ fontSize: 10, color: C.secondary }}>{entry.rating}/5</div>
                    </div>
                  </div>

                  {/* What worked */}
                  {entry.whatWorked?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: C.secondary, marginBottom: 5 }}>✅ What worked</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {entry.whatWorked.map((w, wIdx) => (
                          <span key={`${w}-${wIdx}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${C.primary}12`, color: C.primary }}>
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* What didn't */}
                  {entry.whatDidnt?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: C.secondary, marginBottom: 5 }}>❌ What didn't work</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {entry.whatDidnt.map((w, wIdx) => (
                          <span key={`${w}-${wIdx}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${C.tertiary}10`, color: C.tertiary }}>
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestion */}
                  {entry.suggestion && (
                    <div style={{
                      marginTop: 8, padding: '10px 12px', borderRadius: 10,
                      background: C.bgAlt, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ fontSize: 11, color: C.secondary, marginBottom: 4 }}>💡 Suggestion</div>
                      <div style={{ fontSize: 13, color: C.headline, lineHeight: 1.5 }}>{entry.suggestion}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

// ── Devices Tab ───────────────────────────────

const OS_ICONS: Record<string, string> = {
  Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '💻', Linux: '🐧', Other: '🖥️',
};
const BROWSER_ICONS: Record<string, string> = {
  Chrome: '🌐', Samsung: '🌐', Safari: '🧭', Firefox: '🦊', Edge: '🔵', Opera: '🔴', Other: '🌐',
};

type NotifFilter = 'all' | 'granted' | 'denied' | 'default';
type OSFilter = 'all' | 'Android' | 'iOS' | 'Desktop';
type InstallFilter = 'all' | 'installed' | 'browser';

function notifStatus(record: DeviceRecord): { label: string; icon: string; color: string } {
  if (record.notifPermission === 'granted') return { label: 'Enabled', icon: '✅', color: '#22c55e' };
  if (record.notifPermission === 'denied') return { label: 'Blocked', icon: '❌', color: C.tertiary };
  if (record.notifPermission === 'unsupported') return { label: 'No support', icon: '🚫', color: C.secondary };
  return { label: 'Not set', icon: '⚠️', color: C.streak };
}

function DevicesTab() {
  const [records, setRecords] = useState<Record<string, DeviceRecord>>({});
  const [recentEvents, setRecentEvents] = useState<ReturnType<typeof getAllEventLogs>>([]);
  const [osFilter, setOsFilter] = useState<OSFilter>('all');
  const [notifFilter, setNotifFilter] = useState<NotifFilter>('all');
  const [installFilter, setInstallFilter] = useState<InstallFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      if (isPublishedVersion()) {
        try {
          // Fetch device records from Supabase
          const supabaseRecords = await fetchAllDeviceRecords();
          const recordsMap: Record<string, DeviceRecord> = {};
          supabaseRecords.forEach(r => {
            recordsMap[r.profile_id || ''] = {
              profileId: r.profile_id || '',
              os: r.os || 'Unknown',
              browser: r.browser || 'Unknown',
              isPwa: r.is_pwa || false,
              pushSupported: r.push_supported || false,
              badgeSupported: r.badge_supported || false,
              notifPermission: r.notif_permission || 'default',
              lastNotifSent: r.last_notif_sent,
              lastUpdated: new Date(r.last_updated || Date.now()).getTime(),
            };
          });
          setRecords(recordsMap);

          // Fetch event logs from Supabase
          const supabaseEvents = await fetchAllEventLogs(100);
          const events = supabaseEvents.map(e => ({
            profileId: e.profile_id || '',
            event: e.event as any,
            timestamp: new Date(e.created_at || Date.now()).getTime(),
            data: e.metadata,
          }));
          setRecentEvents(events);
        } catch (error) {
          console.error('Failed to fetch devices/events from Supabase:', error);
          setRecords(getAllDeviceRecords());
          setRecentEvents(getAllEventLogs());
        }
      } else {
        setRecords(getAllDeviceRecords());
        setRecentEvents(getAllEventLogs());
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const EVENT_LABELS: Record<EventType, string> = {
    app_opened: 'App opened',
    app_installed: 'App installed (PWA)',
    notif_permission_granted: 'Notification allowed',
    notif_permission_denied: 'Notification denied',
    notif_sent: 'Notification sent',
    notif_received: 'Notification received',
    notif_clicked: 'Notification clicked',
    badge_updated: 'Badge updated',
  };
  const EVENT_ICONS: Record<EventType, string> = {
    app_opened: '👁️', app_installed: '📲', notif_permission_granted: '✅',
    notif_permission_denied: '❌', notif_sent: '📤', notif_received: '📥',
    notif_clicked: '👆', badge_updated: '🔴',
  };

  const allProfiles = PROFILES;
  const recordList = allProfiles.map(p => ({
    profile: p,
    record: records[p.id] ?? null,
  }));

  const filtered = recordList.filter(({ record }) => {
    if (!record) return osFilter === 'all' && notifFilter === 'all' && installFilter === 'all';
    if (osFilter !== 'all') {
      const isDesktop = record.os === 'Windows' || record.os === 'macOS' || record.os === 'Linux';
      if (osFilter === 'Android' && record.os !== 'Android') return false;
      if (osFilter === 'iOS' && record.os !== 'iOS') return false;
      if (osFilter === 'Desktop' && !isDesktop) return false;
    }
    if (notifFilter !== 'all' && record.notifPermission !== notifFilter) return false;
    if (installFilter === 'installed' && !record.isPwa) return false;
    if (installFilter === 'browser' && record.isPwa) return false;
    return true;
  });

  const card: React.CSSProperties = {
    background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, boxShadow: C.shadow,
  };

  // Summary counts
  const allRecords = Object.values(records);
  const totalProfiles = PROFILES.length;
  const withRecord = allRecords.length;
  const pwaCount = allRecords.filter(r => r.isPwa).length;
  const notifGranted = allRecords.filter(r => r.notifPermission === 'granted').length;
  const notifDenied = allRecords.filter(r => r.notifPermission === 'denied').length;

  // Deduplicate events by tag for display
  const eventLogEntries = recentEvents.slice(0, 30);

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Profiles', val: `${withRecord}/${totalProfiles}`, sub: 'tracked' },
          { label: 'Installed', val: pwaCount, sub: 'PWA' },
          { label: 'Notifs ✅', val: notifGranted, sub: 'granted' },
          { label: 'Notifs ❌', val: notifDenied, sub: 'blocked' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.headline }}>{s.val}</div>
            <div style={{ fontSize: 9, color: C.secondary, marginTop: 2, lineHeight: 1.2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 10, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>OS</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {(['all', 'Android', 'iOS', 'Desktop'] as const).map(f => (
            <button key={f} onClick={() => setOsFilter(f)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: 'none',
              background: osFilter === f ? C.headline : C.bgAlt,
              color: osFilter === f ? '#fff' : C.body,
              fontWeight: osFilter === f ? 700 : 400,
            }}>{f === 'all' ? 'All OS' : f}</button>
          ))}
        </div>
        <p style={{ fontSize: 10, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Notifications</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {(['all', 'granted', 'denied', 'default'] as const).map(f => (
            <button key={f} onClick={() => setNotifFilter(f)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: 'none',
              background: notifFilter === f ? C.primary : C.bgAlt,
              color: notifFilter === f ? '#fff' : C.body,
              fontWeight: notifFilter === f ? 700 : 400,
            }}>
              {f === 'all' ? 'All' : f === 'granted' ? '✅ Allowed' : f === 'denied' ? '❌ Blocked' : '⚠️ Not set'}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 10, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Installation</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['all', 'installed', 'browser'] as const).map(f => (
            <button key={f} onClick={() => setInstallFilter(f)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: 'none',
              background: installFilter === f ? C.primary : C.bgAlt,
              color: installFilter === f ? '#fff' : C.body,
              fontWeight: installFilter === f ? 700 : 400,
            }}>
              {f === 'all' ? 'All' : f === 'installed' ? '📲 Installed' : '🌐 Browser only'}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      <p style={{ fontSize: 10, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        Users ({filtered.length})
      </p>
      {filtered.map(({ profile, record }) => {
        const ns = record ? notifStatus(record) : null;
        const isExpanded = expanded === profile.id;
        return (
          <div key={profile.id} style={{ ...card, marginBottom: 10, overflow: 'hidden' }}>
            <div
              onClick={() => setExpanded(isExpanded ? null : profile.id)}
              style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <span style={{ fontSize: 26 }}>{profile.avatar}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>{profile.name}</div>
                {record ? (
                  <div style={{ fontSize: 11, color: C.body, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{OS_ICONS[record.os] ?? '🖥️'} {record.os}</span>
                    <span>{BROWSER_ICONS[record.browser] ?? '🌐'} {record.browser}</span>
                    <span>{record.isPwa ? '📲 Installed' : '🌐 Browser'}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>No data yet</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {ns ? (
                  <>
                    <div style={{ fontSize: 18 }}>{ns.icon}</div>
                    <div style={{ fontSize: 9, color: ns.color, fontWeight: 600 }}>{ns.label}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: C.secondary }}>-</div>
                )}
              </div>
            </div>

            {isExpanded && record && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', background: C.bgAlt }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'OS', val: `${OS_ICONS[record.os] ?? ''} ${record.os}` },
                    { label: 'Browser', val: `${BROWSER_ICONS[record.browser] ?? ''} ${record.browser}` },
                    { label: 'PWA Installed', val: record.isPwa ? '✅ Yes' : '❌ No' },
                    { label: 'Push API', val: record.pushSupported ? '✅ Supported' : '❌ No support' },
                    { label: 'Badge API', val: record.badgeSupported ? '✅ Supported' : '❌ No support' },
                    { label: 'Notifications', val: `${ns?.icon ?? ''} ${ns?.label ?? '-'}` },
                  ].map(r => (
                    <div key={r.label} style={{ background: C.bgCard, borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{r.label}</div>
                      <div style={{ fontSize: 12, color: C.headline, fontWeight: 600 }}>{r.val}</div>
                    </div>
                  ))}
                </div>
                {record.lastNotifSent && (
                  <div style={{ fontSize: 11, color: C.body }}>
                    Last notif sent: <strong style={{ color: C.headline }}>{new Date(record.lastNotifSent).toLocaleString()}</strong>
                  </div>
                )}
                {record.lastUpdated && (
                  <div style={{ fontSize: 11, color: C.secondary, marginTop: 4 }}>
                    Updated: {new Date(record.lastUpdated).toLocaleString()}
                  </div>
                )}
                {/* Per-user recent events */}
                {(() => {
                  const userEvents = recentEvents.filter(e => e.profileId === profile.id).slice(0, 5);
                  if (userEvents.length === 0) return null;
                  return (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Recent events</div>
                      {userEvents.map((ev, evIdx) => (
                        <div key={`${ev.event}-${ev.timestamp}-${evIdx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 14 }}>{EVENT_ICONS[ev.event] ?? '•'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: C.headline }}>{EVENT_LABELS[ev.event] ?? ev.event}</div>
                            <div style={{ fontSize: 10, color: C.secondary }}>{new Date(ev.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.secondary, fontSize: 13 }}>
          No profiles match the selected filters
        </div>
      )}

      {/* Global event log */}
      {eventLogEntries.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 10, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Recent Activity Log
          </p>
          <div style={{ ...card, overflow: 'hidden' }}>
            {eventLogEntries.map((ev, idx) => {
              const profile = PROFILES.find(p => p.id === ev.profileId);
              return (
                <div key={`${ev.profileId}-${ev.event}-${ev.timestamp}-${idx}`} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 16 }}>{EVENT_ICONS[ev.event] ?? '•'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.headline, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>{profile?.avatar ?? '?'}</span>
                      <span style={{ fontWeight: 600 }}>{profile?.name.split(' ')[0] ?? ev.profileId}</span>
                      <span style={{ color: C.body, fontWeight: 400 }}>- {EVENT_LABELS[ev.event] ?? ev.event}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.secondary, marginTop: 1 }}>
                      {new Date(ev.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Personal Goals Tab ────────────────────────
function PersonalGoalsTab() {
  const [logs, setLogs] = useState<GoalProgressLog[]>([]);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [allGoals, setAllGoals] = useState<Record<string, PersonalGoal>>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);

    // Fetch from Supabase if published, otherwise localStorage
    if (isPublishedVersion()) {
      try {
        const supabaseLogs = await fetchAllGoalProgress();
        console.log('[Admin PersonalGoals] Fetched from Supabase:', supabaseLogs.length, 'logs');
        const formattedLogs: GoalProgressLog[] = supabaseLogs.map(log => ({
          id: log.id || '',
          goalId: log.goal_id,
          profileId: log.profile_id,
          timestamp: new Date(log.created_at || Date.now()).getTime(),
          taskCompleted: log.task_completed,
          amountLogged: log.amount_logged,
          notes: log.notes,
          milestoneHit: log.milestone_hit,
        }));
        console.log('[Admin PersonalGoals] Formatted logs:', formattedLogs.length);
        setLogs(formattedLogs);
      } catch (error) {
        console.error('[Admin PersonalGoals] Failed to fetch goal progress from Supabase:', error);
        const localLogs = getAllProgressLogs();
        console.log('[Admin PersonalGoals] Fallback to localStorage:', localLogs.length, 'logs');
        setLogs(localLogs);
      }
    } else {
      const localLogs = getAllProgressLogs();
      console.log('[Admin PersonalGoals] Development mode - localStorage:', localLogs.length, 'logs');
      setLogs(localLogs);
    }

    // Load all goals from all profiles
    const goalMap: Record<string, PersonalGoal> = {};
    PROFILES.forEach(profile => {
      const goals = getPersonalGoals(profile.id);
      goals.forEach(goal => {
        goalMap[goal.id] = goal;
      });
    });
    setAllGoals(goalMap);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter by user only
  const filtered = filterUser === 'all' ? logs : logs.filter(l => l.profileId === filterUser);

  const card: React.CSSProperties = {
    background: C.bgCard,
    border: `1.5px solid ${C.border}`,
    borderRadius: 16,
    boxShadow: C.shadow,
  };

  // Group by date
  const grouped = filtered.reduce<Record<string, GoalProgressLog[]>>((acc, log) => {
    const date = getDateKey(new Date(log.timestamp));
    acc[date] = [...(acc[date] || []), log];
    return acc;
  }, {});

  // Summary stats
  const totalLogs = logs.length;
  const usersWithGoals = new Set(logs.map(l => l.profileId)).size;
  const uniqueGoals = new Set(logs.map(l => l.goalId)).size;
  const logsWithAmount = logs.filter(l => l.amountLogged).length;
  const totalSaved = logs.reduce((sum, l) => sum + (l.amountLogged || 0), 0);
  const milestonesHit = logs.filter(l => l.milestoneHit).length;

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Summary cards */}
      <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        🌟 Goals Summary
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total logs', value: totalLogs, sub: 'all activity' },
          { label: 'Active users', value: usersWithGoals, sub: 'with goals' },
          { label: 'Active goals', value: uniqueGoals, sub: `${Object.keys(allGoals).length} total goals` },
          { label: 'Total saved', value: `₱${totalSaved.toLocaleString()}`, sub: `${logsWithAmount} entries` },
          { label: 'Milestones', value: milestonesHit, sub: 'completed' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.headline }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.body, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: C.secondary, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* User filter with Refresh button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
          Filter by user
        </p>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => {
            setLoading(true);
            loadData();
          }}
          style={{ fontSize: 11 }}
        >
          Refresh
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        <button onClick={() => setFilterUser('all')} style={{
          flexShrink: 0, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: filterUser === 'all' ? C.headline : C.bgCard,
          color: filterUser === 'all' ? '#fff' : C.body,
          fontWeight: filterUser === 'all' ? 700 : 400, fontSize: 13, boxShadow: C.shadow,
        }}>All</button>
        {PROFILES.map(p => (
          <button key={p.id} onClick={() => setFilterUser(p.id)} style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: filterUser === p.id ? C.headline : C.bgCard,
            color: filterUser === p.id ? '#fff' : C.body,
            fontWeight: filterUser === p.id ? 700 : 400, fontSize: 13, boxShadow: C.shadow,
          }}>
            {p.avatar} {p.name}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: C.headline, marginBottom: 8 }}>Loading goal logs...</div>
        </div>
      )}

      {/* Activity log */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌟</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: C.headline, marginBottom: 8 }}>
            {logs.length === 0 ? 'No goal logs found' : 'No logs match filter'}
          </div>
          <div style={{ color: C.body, fontSize: 13, marginBottom: 12 }}>
            {logs.length === 0
              ? 'Goal logs will appear here once users complete goal-linked tasks on the published site.'
              : 'Try selecting "All" to see all logs, or choose a different user.'}
          </div>
          <div style={{
            background: C.bgAlt, padding: '12px', borderRadius: 10,
            border: `1px solid ${C.border}`, fontSize: 11, color: C.secondary,
          }}>
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: C.body }}>Total logs in database:</strong> {logs.length}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: C.body }}>Data source:</strong> {isPublishedVersion() ? 'Supabase (cloud)' : 'localStorage (local)'}
            </div>
            <div>
              <strong style={{ color: C.body }}>Filter:</strong> {filterUser === 'all' ? 'All users' : PROFILES.find(p => p.id === filterUser)?.name || filterUser}
            </div>
          </div>
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, entries]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.secondary, fontWeight: 600, marginBottom: 8 }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            {entries.map((log) => {
              const profile = PROFILES.find(p => p.id === log.profileId);
              const goal = allGoals[log.goalId];
              return (
                <div key={log.id} style={{ ...card, padding: '14px 16px', marginBottom: 10 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>{profile?.avatar ?? '👤'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>{profile?.name ?? log.profileId}</div>
                      <div style={{ fontSize: 11, color: C.secondary }}>
                        {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    {log.milestoneHit && (
                      <div style={{ fontSize: 20 }}>🎉</div>
                    )}
                  </div>

                  {/* Goal title */}
                  {goal && (
                    <div style={{
                      marginBottom: 10, padding: '8px 12px', borderRadius: 10,
                      background: '#ef456508', border: '1.5px solid #ef456525',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 16 }}>⭐</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.secondary, marginBottom: 2 }}>Goal</div>
                        <div style={{ fontSize: 14, color: '#ef4565', fontWeight: 700 }}>{goal.title}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: C.secondary }}>Progress</div>
                        <div style={{ fontSize: 13, color: C.primary, fontWeight: 700 }}>
                          {Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task completed */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: C.secondary, marginBottom: 3 }}>✅ Task completed</div>
                    <div style={{ fontSize: 13, color: C.headline, fontWeight: 600 }}>{log.taskCompleted}</div>
                  </div>

                  {/* Amount logged */}
                  {log.amountLogged && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: C.secondary, marginBottom: 3 }}>💰 Amount</div>
                      <div style={{ fontSize: 15, color: C.primary, fontWeight: 700 }}>₱{log.amountLogged.toLocaleString()}</div>
                    </div>
                  )}

                  {/* Notes */}
                  {log.notes && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: C.secondary, marginBottom: 3 }}>📝 Notes</div>
                      <div style={{ fontSize: 12, color: C.body }}>{log.notes}</div>
                    </div>
                  )}

                  {/* Milestone hit */}
                  {log.milestoneHit && (
                    <div style={{
                      marginTop: 8, padding: '8px 10px', borderRadius: 8,
                      background: '#22c55e15', border: '1px solid #22c55e',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>
                        🏆 Milestone completed!
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

      {/* User-Created Tasks section */}
      {(() => {
        const userTaskRows: { profile: string; task: UserTask; goalTitle?: string }[] = [];
        PROFILES.forEach(p => {
          const uts = getUserTasks(p.id);
          const goals = getPersonalGoals(p.id);
          uts.forEach(t => {
            const goal = goals.find(g => g.id === t.goalId);
            userTaskRows.push({ profile: p.name, task: t, goalTitle: goal?.title });
          });
        });
        if (userTaskRows.length === 0) return null;
        return (
          <div style={{ marginTop: 24 }}>
            <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingLeft: 2 }}>
              User-Created Tasks ({userTaskRows.length})
            </p>
            {userTaskRows.map(({ profile, task, goalTitle }) => (
              <div key={task.id} style={{
                background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 12,
                padding: '11px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.headline, marginBottom: 2 }}>{task.label}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: C.secondary }}>{profile}</span>
                    <span style={{ fontSize: 10, color: C.secondary }}>·</span>
                    <span style={{ fontSize: 10, color: C.secondary }}>{task.timeOfDay}</span>
                    {goalTitle && <>
                      <span style={{ fontSize: 10, color: C.secondary }}>·</span>
                      <span style={{ fontSize: 10, color: C.primary, fontWeight: 600 }}>↗ {goalTitle}</span>
                    </>}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: `${C.primary}15`, color: C.primary,
                }}>
                  User-created
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── Settings Tab ────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<AppNotificationSettings>(() => getAppNotificationSettings());
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => getEmailSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [manualProfileId, setManualProfileId] = useState(PROFILES[0]?.id ?? '');
  const [manualType, setManualType] = useState<'smart_nudge' | 'welcome' | 'check_in_confirmation'>('smart_nudge');
  const [manualSending, setManualSending] = useState(false);
  const [manualResult, setManualResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAppSettings(), fetchEmailSettings()]).then(([s, e]) => {
      setSettings(s);
      setEmailSettings(e);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const next = await saveAppSettings(settings);
    setSettings(next);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleEmailSave = async () => {
    setEmailSaving(true);
    setEmailSaved(false);
    const next = await saveEmailSettings(emailSettings);
    setEmailSettings(next);
    setEmailSaving(false);
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2500);
  };

  const handleTestEmail = async () => {
    setTestSending(true);
    setTestResult(null);
    const result = await sendTestEmail(emailSettings.testRecipient || undefined);
    setTestSending(false);
    setTestResult(result.ok ? 'Test email sent ✓' : `Failed: ${result.reason ?? 'unknown'}`);
  };

  const handleManualNudge = async () => {
    const profile = PROFILES.find(p => p.id === manualProfileId);
    setManualSending(true);
    setManualResult(null);
    const result = await sendManualNudge({
      profileId: manualProfileId,
      type: manualType,
      profileName: profile?.name,
      tag: manualType === 'smart_nudge' ? 'manual-nudge' : undefined,
      title: manualType === 'smart_nudge' ? 'Manual nudge from admin' : undefined,
      body: manualType === 'smart_nudge' ? 'This is a manual email nudge triggered from admin settings.' : undefined,
    });
    setManualSending(false);
    setManualResult(result.ok ? 'Email sent ✓' : `Skipped/failed: ${result.reason ?? 'unknown'}`);
  };

  const updateProfileEmail = (profileId: string, email: string) => {
    setEmailSettings(s => ({
      ...s,
      profileEmails: { ...s.profileEmails, [profileId]: email },
    }));
  };

  const cardStyle = { background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', marginBottom: 14, boxShadow: C.shadow };
  const inputStyle = { borderRadius: 10, marginTop: 6 };
  const labelStyle = { color: C.secondary, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 };

  if (loading) {
    return <div style={{ padding: '0 16px 24px', color: C.secondary, fontSize: 13 }}>Loading settings...</div>;
  }

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>Browser notifications</div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>Global notifications</div>
            <div style={{ color: C.body, fontSize: 12, marginTop: 4 }}>
              When off, the app will not request permission or send notifications.
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onChange={enabled => setSettings(s => ({ ...s, enabled }))}
            style={{ background: settings.enabled ? C.primary : undefined }}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Channel</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['browser'] as NotificationChannel[]).map(ch => (
            <button key={ch} onClick={() => setSettings(s => ({ ...s, channel: ch }))} style={{
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
              border: `1.5px solid ${settings.channel === ch ? C.primary : C.border}`,
              background: settings.channel === ch ? `${C.primary}15` : C.bgAlt,
              color: settings.channel === ch ? C.primary : C.body,
              fontWeight: settings.channel === ch ? 700 : 400,
            }}>
              Browser notifications
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...cardStyle, background: C.bgAlt }}>
        <div style={{ fontSize: 12, color: C.body }}>
          Current: <strong style={{ color: C.headline }}>{settings.enabled ? 'Enabled' : 'Disabled'}</strong>
          {' · '}Channel: <strong style={{ color: C.headline }}>{settings.channel}</strong>
          {settings.updatedAt ? <> · Saved {new Date(settings.updatedAt).toLocaleString()}</> : null}
        </div>
      </div>

      <Button type="primary" loading={saving} onClick={handleSave}
        style={{ width: '100%', background: C.primary, border: 'none', borderRadius: 12, height: 44, fontWeight: 600, marginBottom: 24 }}>
        {saved ? 'Browser settings saved ✓' : 'Save browser settings'}
      </Button>

      <div style={{ ...labelStyle, marginBottom: 10 }}>Email notifications (Resend)</div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>Global email</div>
            <div style={{ color: C.body, fontSize: 12, marginTop: 4 }}>
              Independent from browser notifications. Requires Resend API key on server.
            </div>
          </div>
          <Switch
            checked={emailSettings.enabled}
            onChange={enabled => setEmailSettings(s => ({ ...s, enabled }))}
            style={{ background: emailSettings.enabled ? C.primary : undefined }}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Email types</div>
        {([
          ['welcomeEnabled', 'Welcome email'],
          ['smartNudgeEnabled', 'Smart nudge (morning/midday/evening)'],
          ['taskCompletionEnabled', 'Task completion (default off)'],
          ['checkInConfirmationEnabled', 'Check-in confirmation'],
        ] as const).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 13, color: C.headline }}>{label}</span>
            <Switch
              checked={emailSettings[key]}
              onChange={v => setEmailSettings(s => ({ ...s, [key]: v }))}
              style={{ background: emailSettings[key] ? C.primary : undefined }}
            />
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Trigger mode</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {([
            ['browser_aligned', 'Browser-aligned + events'],
            ['event_only', 'Events only'],
            ['manual', 'Manual only'],
          ] as [EmailTriggerMode, string][]).map(([mode, label]) => (
            <button key={mode} onClick={() => setEmailSettings(s => ({ ...s, triggerMode: mode }))} style={{
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
              border: `1.5px solid ${emailSettings.triggerMode === mode ? C.primary : C.border}`,
              background: emailSettings.triggerMode === mode ? `${C.primary}15` : C.bgAlt,
              color: emailSettings.triggerMode === mode ? C.primary : C.body,
              fontWeight: emailSettings.triggerMode === mode ? 700 : 400,
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Sender &amp; test</div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: C.body, marginBottom: 4 }}>From name</div>
          <Input value={emailSettings.fromName} onChange={e => setEmailSettings(s => ({ ...s, fromName: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: C.body, marginBottom: 4 }}>Reply-to</div>
          <Input value={emailSettings.replyTo} onChange={e => setEmailSettings(s => ({ ...s, replyTo: e.target.value }))} placeholder="optional@example.com" style={inputStyle} />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: C.body, marginBottom: 4 }}>Test recipient</div>
          <Input value={emailSettings.testRecipient} onChange={e => setEmailSettings(s => ({ ...s, testRecipient: e.target.value }))} placeholder="admin@example.com" style={inputStyle} />
        </div>
        <Button loading={testSending} onClick={handleTestEmail} style={{ marginTop: 12, borderRadius: 10 }}>
          Send test email
        </Button>
        {testResult && <div style={{ fontSize: 12, color: C.body, marginTop: 8 }}>{testResult}</div>}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Profile emails (admin override)</div>
        {PROFILES.map(p => (
          <div key={p.id} style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: C.body, marginBottom: 4 }}>{p.name} ({p.id})</div>
            <Input
              value={emailSettings.profileEmails[p.id] ?? ''}
              onChange={e => updateProfileEmail(p.id, e.target.value)}
              placeholder="email@example.com"
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Send nudge now (manual)</div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: C.body, marginBottom: 4 }}>Profile</div>
          <Select
            value={manualProfileId}
            onChange={setManualProfileId}
            style={{ width: '100%' }}
            options={PROFILES.map(p => ({ value: p.id, label: p.name }))}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: C.body, marginBottom: 4 }}>Type</div>
          <Select
            value={manualType}
            onChange={setManualType}
            style={{ width: '100%' }}
            options={[
              { value: 'smart_nudge', label: 'Smart nudge' },
              { value: 'welcome', label: 'Welcome' },
              { value: 'check_in_confirmation', label: 'Check-in confirmation' },
            ]}
          />
        </div>
        <Button loading={manualSending} onClick={handleManualNudge} style={{ marginTop: 12, borderRadius: 10 }}>
          Send nudge now
        </Button>
        {manualResult && <div style={{ fontSize: 12, color: C.body, marginTop: 8 }}>{manualResult}</div>}
      </div>

      <Button type="primary" loading={emailSaving} onClick={handleEmailSave}
        style={{ width: '100%', background: C.primary, border: 'none', borderRadius: 12, height: 44, fontWeight: 600 }}>
        {emailSaved ? 'Email settings saved ✓' : 'Save email settings'}
      </Button>
    </div>
  );
}


export function AdminView({ onBack }: Props) {
  const [tab, setTab] = useState('overview');
  const [showMigration, setShowMigration] = useState(false);
  const envInfo = getEnvironmentInfo();
  const dataStats = isPublishedVersion() ? getDataCollectionStats() : null;

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, maxWidth: 430, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${C.headline} 0%, #1a6da8 100%)`, padding: 'max(52px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}
            style={{ color: 'rgba(255,255,255,0.8)', paddingLeft: 0 }}>
            Back
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              icon={<UploadOutlined />}
              type="text"
              onClick={() => setShowMigration(true)}
              style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}
            >
              Import Data
            </Button>
            {isPublishedVersion() && (
              <Button
                icon={<DownloadOutlined />}
                type="text"
                onClick={downloadCentralDataBackup}
                style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}
              >
                Export Data
              </Button>
            )}
          </div>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Admin Dashboard</h1>
        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Environment Banner */}
      {isPublishedVersion() ? (
        <div style={{
          background: '#22c55e15', border: '1.5px solid #22c55e',
          padding: '12px 16px', margin: '16px 16px 0',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <InfoCircleOutlined style={{ color: '#22c55e', fontSize: 16 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 2 }}>
              📊 Published Version - Data Collection Active
            </div>
            <div style={{ fontSize: 11, color: C.body }}>
              Collecting data since May 14, 2026 · {dataStats?.totalRecords || 0} records
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: `${C.streak}15`, border: `1.5px solid ${C.streak}`,
          padding: '12px 16px', margin: '16px 16px 0',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <InfoCircleOutlined style={{ color: C.streak, fontSize: 16 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.streak, marginBottom: 2 }}>
              🔧 Development Mode
            </div>
            <div style={{ fontSize: 11, color: C.body }}>
              Data is local only and not collected centrally
            </div>
          </div>
        </div>
      )}

      <div style={{ paddingTop: 16 }}>
        <TabBar tab={tab} onChange={setTab} />
        {tab === 'overview' && <OverviewTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'goals' && <PersonalGoalsTab />}
        {tab === 'devices' && <DevicesTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>

      {/* Data Migration Modal */}
      {showMigration && <DataMigration onClose={() => setShowMigration(false)} />}
    </div>
  );
}
