import { useState, useEffect } from 'react';
import { Progress } from 'antd';
import { PageTour, PageTourButton, TOUR_KEYS } from './AppTour';
import { CheckCircleFilled, StarFilled } from '@ant-design/icons';
import {
  getWeekPlanForProfile, getAllTasksForProfile, getTaskCategoriesForProfile,
  getTaskStatus, setTaskStatus, isTaskDeleted, getTodayKey, type Profile,
} from '../data/profiles';
import { getPersonalGoals, type PersonalGoal } from '../data/personalGoals';
import { getUserTasks, isTaskScheduledForDate, type UserTask } from '../data/userTasks';
import { C } from '../data/colors';

interface Props { profile: Profile }
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCurrentDay() {
  const d = new Date().getDay();
  return d === 0 ? 'Sun' : DAYS[d - 1];
}
function getDateForDay(day: string) {
  const today = new Date();
  const ci = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const t = new Date(today);
  t.setDate(today.getDate() + (DAYS.indexOf(day) - ci));
  return t;
}
function dateKey(day: string) {
  return getDateForDay(day).toISOString().split('T')[0];
}

function getGoalTaskProgress(profileId: string, goalId: string, allUserTasks: UserTask[]) {
  const today = getTodayKey();
  const cats = getTaskCategoriesForProfile(profileId);
  let done = 0, total = 0;
  cats.forEach(cat => {
    if (cat.goalId !== goalId) return;
    cat.tasks.forEach(t => {
      if (isTaskDeleted(profileId, t.id, today)) return;
      total++;
      if (getTaskStatus(profileId, t.id, today) === 'done') done++;
    });
  });
  allUserTasks.forEach(ut => {
    if (ut.goalId !== goalId) return;
    if (isTaskDeleted(profileId, ut.id, today)) return;
    total++;
    if (getTaskStatus(profileId, ut.id, today) === 'done') done++;
  });
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function WeekPlan({ profile }: Props) {
  const [activeDay, setActiveDay] = useState(getCurrentDay());
  const [statuses, setStatuses] = useState<Record<string, Record<string, 'inprogress' | 'done' | null>>>({});
  const [deletedMap, setDeletedMap] = useState<Record<string, Record<string, boolean>>>({});
  const [personalGoals, setPersonalGoals] = useState<PersonalGoal[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [showTour, setShowTour] = useState(false);

  const weekPlan = getWeekPlanForProfile(profile.id);
  const allTasks = getAllTasksForProfile(profile.id);

  const loadState = () => {
    const s: typeof statuses = {};
    const d: typeof deletedMap = {};
    const uts = getUserTasks(profile.id);
    setUserTasks(uts);

    DAYS.forEach(day => {
      const dk = dateKey(day);
      s[day] = {};
      d[day] = {};
      (weekPlan[day] || []).forEach(tid => {
        s[day][tid] = getTaskStatus(profile.id, tid, dk);
        d[day][tid] = isTaskDeleted(profile.id, tid, dk);
      });
      // User tasks — only include if scheduled for that day
      uts.filter(ut => isTaskScheduledForDate(ut, dk)).forEach(ut => {
        s[day][ut.id] = getTaskStatus(profile.id, ut.id, dk);
        d[day][ut.id] = isTaskDeleted(profile.id, ut.id, dk);
      });
    });
    setStatuses(s);
    setDeletedMap(d);
    setPersonalGoals(getPersonalGoals(profile.id));
  };

  useEffect(() => {
    loadState();
    const handler = () => loadState();
    window.addEventListener('arbol-goals-updated', handler);
    return () => window.removeEventListener('arbol-goals-updated', handler);
  }, [profile.id]);

  // Auto-start week tour on first visit
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEYS.week)) {
      const t = setTimeout(() => setShowTour(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const toggleTask = (day: string, taskId: string) => {
    if (deletedMap[day]?.[taskId]) return;
    const dk = dateKey(day);
    const cur = statuses[day]?.[taskId];
    const next = cur === 'done' ? null : cur === 'inprogress' ? 'done' : 'inprogress';
    setTaskStatus(profile.id, taskId, dk, next);
    setStatuses(prev => ({ ...prev, [day]: { ...prev[day], [taskId]: next } }));
  };

  const todayDay = getCurrentDay();

  // Helper: all task ids for a day (seed + user tasks scheduled that day)
  const allDayIds = (day: string) => {
    const dk = dateKey(day);
    return [
      ...(weekPlan[day] || []),
      ...userTasks.filter(ut => isTaskScheduledForDate(ut, dk)).map(ut => ut.id),
    ];
  };

  // Active (non-deleted) task ids for a day
  const activeIds = (day: string) =>
    allDayIds(day).filter(id => !deletedMap[day]?.[id]);

  const dayTaskIds = allDayIds(activeDay);
  const seedTasks = dayTaskIds
    .filter(id => !userTasks.find(ut => ut.id === id))
    .map(id => allTasks.find(t => t.id === id))
    .filter(Boolean) as typeof allTasks;
  const activeDayDk = dateKey(activeDay);
  const dayUserTasks = userTasks.filter(ut => isTaskScheduledForDate(ut, activeDayDk) && !deletedMap[activeDay]?.[ut.id]);

  const activeDayIds = activeIds(activeDay);
  const activeDayDone = activeDayIds.filter(id => statuses[activeDay]?.[id] === 'done').length;
  const activePct = activeDayIds.length > 0 ? Math.round((activeDayDone / activeDayIds.length) * 100) : 0;

  const weekStats = DAYS.map(day => {
    const ids = activeIds(day);
    const done = ids.filter(id => statuses[day]?.[id] === 'done').length;
    return { day, done, total: ids.length, pct: ids.length > 0 ? Math.round((done / ids.length) * 100) : 0 };
  });
  const weekAvg = Math.round(weekStats.reduce((s, d) => s + d.pct, 0) / 7);

  const STATUS_META = {
    inprogress: { dot: '◑', color: '#f5a623' },
    done:       { dot: '●', color: C.primary },
    null:       { dot: '○', color: C.secondary },
  };

  const ACCENT_COLORS = ['#3da9fc', '#2cb67d', '#7c3aed', '#ef4565', '#f5a623', '#094067', '#e85d04', '#90b4ce'];
  const goalAccent = (goalId: string) =>
    ACCENT_COLORS[Math.abs(goalId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % ACCENT_COLORS.length];

  return (
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 16px', background: C.bg, minHeight: '100dvh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>Week Plan</h2>
          <p style={{ margin: '4px 0 0', color: C.body, fontSize: 13 }}>
            Weekly avg: <span style={{ color: C.primary, fontWeight: 600 }}>{weekAvg}%</span>
          </p>
        </div>
        <PageTourButton onClick={() => setShowTour(true)} />
      </div>

      {/* Goals Summary — task-based progress */}
      {personalGoals.length > 0 && (
        <div data-tour-id="week-goals" style={{
          background: C.bgCard, border: `1.5px solid ${C.border}`,
          borderRadius: 16, padding: '14px 16px', marginBottom: 16, boxShadow: C.shadow,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <StarFilled style={{ color: '#ef4565', fontSize: 14 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>Goals</span>
          </div>
          {personalGoals.map(goal => {
            const accent = goalAccent(goal.id);
            const prog = getGoalTaskProgress(profile.id, goal.id, userTasks);
            return (
              <div key={goal.id} style={{ marginBottom: personalGoals.indexOf(goal) < personalGoals.length - 1 ? 12 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: C.headline, fontWeight: 600 }}>{goal.title}</div>
                  <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{prog.pct}%</span>
                </div>
                <Progress
                  percent={prog.pct}
                  strokeColor={{ '0%': accent, '100%': `${accent}80` }}
                  railColor={C.bgAlt}
                  showInfo={false}
                  size={['100%', 5]}
                />
                <div style={{ fontSize: 10, color: C.secondary, marginTop: 4 }}>
                  Today's tasks: {prog.done}/{prog.total}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day selector */}
      <div data-tour-id="week-days" style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {DAYS.map(day => {
          const stat = weekStats.find(s => s.day === day)!;
          const isActive = day === activeDay;
          const isToday = day === todayDay;
          return (
            <button key={day} onClick={() => setActiveDay(day)} style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 10px 8px', minWidth: 48,
              background: isActive ? C.headline : C.bgCard,
              border: isToday && !isActive ? `1.5px solid ${C.primary}` : `1.5px solid ${isActive ? 'transparent' : C.border}`,
              borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: isActive ? '0 4px 12px rgba(9,64,103,0.2)' : C.shadow,
            }}>
              <span style={{ fontSize: 11, color: isActive ? '#fff' : (isToday ? C.primary : C.body), fontWeight: isToday ? 700 : 400 }}>{day}</span>
              <div style={{
                width: 24, height: 24, borderRadius: 8,
                background: stat.pct === 100 ? C.primary : stat.pct > 0 ? `${C.primary}${Math.round(20 + stat.pct * 1.5).toString(16)}` : C.bgAlt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {stat.pct === 100
                  ? <CheckCircleFilled style={{ color: '#fff', fontSize: 13 }} />
                  : <span style={{ fontSize: 10, color: isActive ? '#fff' : C.secondary, fontWeight: 700 }}>{stat.done}</span>
                }
              </div>
            </button>
          );
        })}
      </div>

      {/* Active day detail */}
      <div data-tour-id="week-today" style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 20, overflow: 'hidden', marginBottom: 16, boxShadow: C.shadow }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, color: C.headline }}>
                {activeDay === todayDay ? `${activeDay} - Today` : activeDay}
              </span>
              <div style={{ color: C.body, fontSize: 12, marginTop: 2 }}>
                {getDateForDay(activeDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </div>
            </div>
            <span style={{ color: C.primary, fontWeight: 700, fontSize: 16 }}>{activePct}%</span>
          </div>
          <Progress percent={activePct} strokeColor={{ '0%': C.primary, '100%': C.headline }}
            railColor={C.bgAlt} showInfo={false} size={['100%', 6]} />
        </div>

        {seedTasks.length === 0 && dayUserTasks.length === 0 && (
          <div style={{ padding: '24px 18px', textAlign: 'center', color: C.secondary, fontSize: 13 }}>
            No tasks scheduled for {activeDay}
          </div>
        )}

        {/* Seed / scheduled tasks */}
        {seedTasks.map((task, idx) => {
          const removed = deletedMap[activeDay]?.[task.id] ?? false;
          const status = removed ? null : (statuses[activeDay]?.[task.id] ?? null);
          const meta = STATUS_META[status ?? 'null'];
          const isLast = idx === seedTasks.length - 1 && dayUserTasks.length === 0;
          return (
            <div key={task.id}
              onClick={() => !removed && toggleTask(activeDay, task.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                borderBottom: !isLast ? `1px solid ${C.border}` : 'none',
                cursor: removed ? 'default' : 'pointer', transition: 'background 0.15s',
                opacity: removed ? 0.45 : 1,
                background: removed ? C.bgAlt : 'transparent',
              }}
              onMouseEnter={e => { if (!removed) e.currentTarget.style.background = C.bgAlt; }}
              onMouseLeave={e => { if (!removed) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 16, color: removed ? C.secondary : meta.color, width: 20, textAlign: 'center', flexShrink: 0 }}>
                {removed ? '✕' : meta.dot}
              </span>
              <span style={{
                fontSize: 14, flex: 1,
                color: removed ? C.secondary : (status === 'done' ? C.secondary : C.headline),
                textDecoration: status === 'done' ? 'line-through' : 'none',
              }}>
                {task.label}
              </span>
              {removed ? (
                <span style={{ fontSize: 10, background: `${C.tertiary}18`, color: C.tertiary, borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>
                  Removed
                </span>
              ) : (
                <span style={{ fontSize: 10, color: C.secondary, background: C.bgAlt, borderRadius: 5, padding: '2px 6px' }}>
                  {task.timeOfDay === 'morning' ? '☀️' : '🌙'}
                </span>
              )}
            </div>
          );
        })}

        {/* User tasks */}
        {dayUserTasks.map((ut, idx) => {
          const status = statuses[activeDay]?.[ut.id] ?? null;
          const meta = STATUS_META[status ?? 'null'];
          const isLast = idx === dayUserTasks.length - 1;
          return (
            <div key={ut.id}
              onClick={() => toggleTask(activeDay, ut.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                borderBottom: !isLast ? `1px solid ${C.border}` : 'none',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.bgAlt; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 16, color: meta.color, width: 20, textAlign: 'center', flexShrink: 0 }}>
                {meta.dot}
              </span>
              <span style={{
                fontSize: 14, flex: 1,
                color: status === 'done' ? C.secondary : C.headline,
                textDecoration: status === 'done' ? 'line-through' : 'none',
              }}>
                {ut.label}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, background: `${C.primary}12`, color: C.primary, borderRadius: 5, padding: '2px 6px', fontWeight: 600 }}>
                  My Task
                </span>
                <span style={{ fontSize: 10, color: C.secondary, background: C.bgAlt, borderRadius: 5, padding: '2px 6px' }}>
                  {ut.timeOfDay === 'morning' ? '☀️' : '🌙'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly heatmap */}
      <div style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', boxShadow: C.shadow }}>
        <div style={{ fontSize: 13, color: C.body, marginBottom: 12 }}>Weekly completion</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {weekStats.map(stat => (
            <div key={stat.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: '100%', height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: stat.pct === 0 ? C.bgAlt : `rgba(61,169,252,${0.1 + (stat.pct / 100) * 0.7})`,
                fontSize: 11, fontWeight: 700, color: stat.pct > 50 ? C.headline : C.secondary,
                border: stat.day === todayDay ? `1.5px solid ${C.primary}` : '1px solid transparent',
              }}>
                {stat.pct > 0 ? `${stat.pct}%` : '-'}
              </div>
              <span style={{ fontSize: 10, color: stat.day === todayDay ? C.primary : C.secondary, fontWeight: stat.day === todayDay ? 700 : 400 }}>
                {stat.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Week Page Tour */}
      <PageTour
        open={showTour}
        onClose={() => setShowTour(false)}
        storageKey={TOUR_KEYS.week}
        pageLabel="Week Plan"
        doneEmoji="📅"
        doneMessage="You've got the Week view! Use it to plan ahead and keep your goals on track across the entire week."
        steps={[
          {
            title: '🏆 Goals This Week',
            description: 'See how each goal is progressing today based on task completion. Aim for 100% to keep your streak alive.',
            target: () => document.querySelector('[data-tour-id="week-goals"]') as HTMLElement | null,
            placement: 'bottom',
          },
          {
            title: '📆 Day Selector',
            description: 'Tap any day to see that day\'s task list. Today is highlighted with a border. Filled circles show completed days.',
            target: () => document.querySelector('[data-tour-id="week-days"]') as HTMLElement | null,
            placement: 'bottom',
          },
          {
            title: '☑️ Today\'s Tasks',
            description: 'Tap any task to cycle its status: not started → in-progress → done. Changes here sync everywhere in the app.',
            target: () => document.querySelector('[data-tour-id="week-today"]') as HTMLElement | null,
            placement: 'top',
          },
        ]}
      />
    </div>
  );
}
