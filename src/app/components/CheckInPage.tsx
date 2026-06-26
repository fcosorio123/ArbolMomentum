import { useState, useEffect, useMemo } from 'react';
import { Progress } from 'antd';
import { CloseOutlined, CheckOutlined, RightOutlined, LeftOutlined } from '@ant-design/icons';
import { getPersonalGoals, type PersonalGoal } from '../data/personalGoals';
import {
  getTaskCategoriesForProfile, getTaskStatus, setTaskStatus,
  isTaskActiveForDate, getTodayKey, getEarnedBadges,
  type TaskStatus,
} from '../data/profiles';
import { getActiveUserTasksForDate } from '../data/userTasks';
import { C } from '../data/colors';
import type { Profile } from '../data/profiles';

// ── Helpers ──────────────────────────────────────────────────────────
const ACCENT_COLORS = ['#3da9fc', '#2cb67d', '#7c3aed', '#ef4565', '#f5a623', '#094067', '#e85d04', '#90b4ce'];
function goalAccent(id: string) {
  return ACCENT_COLORS[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % ACCENT_COLORS.length];
}

function taskQuestion(label: string): string {
  const l = label.toLowerCase();
  const verbStarters = [
    'submit', 'complete', 'finish', 'review', 'track', 'call', 'reach',
    'take', 'make', 'prepare', 'plan', 'work', 'go', 'attend', 'practice',
    'write', 'read', 'meet', 'apply', 'post', 'follow', 'transfer', 'cut',
    'drink', 'journal', 'meditat', 'identify', 'reflect',
  ];
  if (verbStarters.some(v => l.startsWith(v))) return `Did you ${l}?`;
  return `Did you complete:\n"${label}"?`;
}

interface FlatTask {
  id: string;
  label: string;
  timeOfDay: 'morning' | 'evening';
  goalId: string;
  goalTitle: string;
  accentColor: string;
  preExisting: TaskStatus | null;
}

type Screen = 'landing' | 'task' | 'processing' | 'success';

const PROCESSING_STEPS = [
  { icon: '⏳', text: 'Updating real-time task and goal statuses…' },
  { icon: '💾', text: 'Saving changes…' },
  { icon: '🌱', text: 'Refreshing your personalized roadmap…' },
];

function ConfettiBlast() {
  const pieces = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.8}s`,
    color: ACCENT_COLORS[i % ACCENT_COLORS.length],
    size: 6 + Math.random() * 8,
    duration: `${1.2 + Math.random() * 0.8}s`,
  })), []);
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`@keyframes cf { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(150px) rotate(720deg);opacity:0} }`}</style>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: p.left, top: 0,
          width: p.size, height: p.size, borderRadius: 2,
          background: p.color, opacity: 0,
          animation: `cf ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export function CheckInPage({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const today = getTodayKey();
  const [startTime] = useState(Date.now());
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshTick(n => n + 1);
    window.addEventListener('arbol-tasks-updated', handler);
    window.addEventListener('arbol-goals-updated', handler);
    return () => {
      window.removeEventListener('arbol-tasks-updated', handler);
      window.removeEventListener('arbol-goals-updated', handler);
    };
  }, []);

  // Build a flat ordered list of tasks that need answering
  const { allTasks, goalMeta } = useMemo(() => {
    const goals = getPersonalGoals(profile.id);
    const cats = getTaskCategoriesForProfile(profile.id);
    const uts = getActiveUserTasksForDate(profile.id, today);

    const goalMeta: Record<string, { title: string; deepWhy?: string; accentColor: string }> = {};
    goals.forEach(g => {
      goalMeta[g.id] = { title: g.title, deepWhy: g.deepWhy, accentColor: goalAccent(g.id) };
    });

    const flat: FlatTask[] = [];
    goals.forEach(goal => {
      const ac = goalAccent(goal.id);
      cats.forEach(cat => {
        if (cat.goalId !== goal.id) return;
        cat.tasks.forEach(t => {
          if (!isTaskActiveForDate(profile.id, t.id, today)) return;
          flat.push({ id: t.id, label: t.label, timeOfDay: t.timeOfDay, goalId: goal.id, goalTitle: goal.title, accentColor: ac, preExisting: getTaskStatus(profile.id, t.id, today) });
        });
      });
      uts.forEach(ut => {
        if (ut.goalId !== goal.id) return;
        if (!isTaskActiveForDate(profile.id, ut.id, today)) return;
        flat.push({ id: ut.id, label: ut.label, timeOfDay: ut.timeOfDay, goalId: goal.id, goalTitle: goal.title, accentColor: ac, preExisting: getTaskStatus(profile.id, ut.id, today) });
      });
    });

    // Tasks that need check-in (no status yet) come first; already-answered ones trail
    const needs = flat.filter(t => t.preExisting === null);
    const done = flat.filter(t => t.preExisting !== null);
    return { allTasks: [...needs, ...done], goalMeta };
  }, [profile.id, today, refreshTick]);

  const needsCheckIn = allTasks.filter(t => t.preExisting === null);
  const totalTasks = allTasks.length;
  const needsCount = needsCheckIn.length;

  // Selections: live status overrides for this session
  const [selections, setSelections] = useState<Record<string, TaskStatus | null>>(() => {
    const init: Record<string, TaskStatus | null> = {};
    allTasks.forEach(t => { if (t.preExisting !== null) init[t.id] = t.preExisting; });
    return init;
  });

  const [screen, setScreen] = useState<Screen>('landing');
  const [taskIdx, setTaskIdx] = useState(0); // current task index in allTasks
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set(
    allTasks.filter(t => t.preExisting !== null).map(t => t.id)
  ));
  const [processingStep, setProcessingStep] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');

  const currentTask = allTasks[taskIdx];
  const answeredCount = answeredIds.size;
  const overallPct = totalTasks > 0 ? Math.round((answeredCount / totalTasks) * 100) : 100;

  const selectStatus = (taskId: string, status: TaskStatus | null) => {
    setSelections(prev => ({ ...prev, [taskId]: status }));
    setTaskStatus(profile.id, taskId, today, status);
    setAnsweredIds(prev => new Set([...prev, taskId]));
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
  };

  const markDoneToday = () => {
    localStorage.setItem(`arbol-checkin-${profile.id}-${today}`, 'true');
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
    import('../data/dashboardSnapshot').then(({ dispatchDashboardRefresh }) => dispatchDashboardRefresh());

    import('../data/emailSettings').then(({ isEmailTypeEnabled }) => {
      if (!isEmailTypeEnabled('checkInConfirmationEnabled')) return;
      import('../data/profileContact').then(({ getProfileEmail }) => {
        import('../data/emailNudges').then(({ requestEmailSend }) => {
          requestEmailSend({
            profileId: profile.id,
            type: 'check_in_confirmation',
            date: today,
            profileName: profile.name,
            recipient: getProfileEmail(profile.id) || undefined,
          });
        });
      });
    });
  };

  const goNext = () => {
    setSlideDir('forward');
    if (taskIdx < allTasks.length - 1) {
      setTaskIdx(i => i + 1);
    } else {
      markDoneToday();
      setScreen('processing');
      setProcessingStep(0);
    }
  };

  const goPrev = () => {
    if (taskIdx > 0) {
      setSlideDir('back');
      setTaskIdx(i => i - 1);
    }
  };

  const skipToProcessing = () => {
    markDoneToday();
    setScreen('processing');
    setProcessingStep(0);
  };

  // Processing auto-advance
  useEffect(() => {
    if (screen !== 'processing') return;
    if (processingStep >= PROCESSING_STEPS.length) { setScreen('success'); return; }
    const t = setTimeout(() => setProcessingStep(s => s + 1), 1100);
    return () => clearTimeout(t);
  }, [screen, processingStep]);

  // Success stats
  const successStats = useMemo(() => {
    const tasksDone = Object.values(selections).filter(s => s === 'done').length;
    const tasksReviewed = answeredIds.size;
    const goals = getPersonalGoals(profile.id);
    const goalProgress = goals.map(g => {
      const tasks = allTasks.filter(t => t.goalId === g.id);
      const done = tasks.filter(t => selections[t.id] === 'done').length;
      return { title: g.title, pct: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0, accent: goalAccent(g.id) };
    });
    return { tasksDone, tasksReviewed, goalProgress };
  }, [selections, answeredIds, allTasks, profile.id]);

  const earnedBadges = useMemo(() => screen === 'success' ? getEarnedBadges(profile) : [], [screen, profile]);
  const minutesTaken = Math.max(1, Math.round((Date.now() - startTime) / 60000));

  // ── Landing ─────────────────────────────────────────────────────────
  const renderLanding = () => {
    const onTrack = allTasks.filter(t => t.preExisting !== null);
    const goalsNeedingCount = new Set(needsCheckIn.map(t => t.goalId)).size;
    return (
      <div style={{ padding: '24px 20px 100px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Daily Check-in
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: C.headline }}>
            How's your progress today?
          </h2>
          <p style={{ margin: 0, color: C.body, fontSize: 13, lineHeight: 1.5 }}>
            We'll go through your tasks one by one. It only takes a minute.
          </p>
        </div>

        {/* Overall progress */}
        <div style={{
          background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16,
          padding: '14px 18px', marginBottom: 22, boxShadow: C.shadow,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.body }}>{answeredCount} of {totalTasks} tasks reviewed</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{overallPct}%</span>
          </div>
          <Progress percent={overallPct} showInfo={false} size={['100%', 8]}
            strokeColor={{ '0%': C.primary, '100%': '#2cb67d' }} railColor={C.bgAlt} />
        </div>

        {/* Needs check-in */}
        {needsCount > 0 ? (
          <div style={{
            background: '#f5a62310', border: '1.5px solid #f5a62330',
            borderRadius: 16, padding: '16px 18px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⏰</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#f5a623', flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                {needsCount} task{needsCount !== 1 ? 's' : ''} across {goalsNeedingCount} goal{goalsNeedingCount !== 1 ? 's' : ''} need your input
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.body, lineHeight: 1.5, marginLeft: 26 }}>
              We'll ask you one question at a time - quick and easy.
            </div>
          </div>
        ) : (
          <div style={{
            background: '#2cb67d0e', border: '1.5px solid #2cb67d30',
            borderRadius: 16, padding: '16px 18px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2cb67d' }}>All caught up!</div>
              <div style={{ fontSize: 12, color: C.body, marginTop: 2 }}>All your tasks have been reviewed.</div>
            </div>
          </div>
        )}

        {/* On track preview */}
        {onTrack.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Already answered
            </div>
            {onTrack.slice(0, 3).map(t => {
              const s = selections[t.id] ?? t.preExisting;
              const dot = s === 'done' ? '🟢' : s === 'inprogress' ? '🟡' : '⚪';
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10, background: C.bgAlt,
                  marginBottom: 6, border: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{dot}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: t.accentColor, marginTop: 1 }}>{t.goalTitle}</div>
                  </div>
                </div>
              );
            })}
            {onTrack.length > 3 && (
              <div style={{ fontSize: 11, color: C.secondary, textAlign: 'center', marginTop: 4 }}>
                +{onTrack.length - 3} more already answered
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => {
            if (allTasks.length === 0) return;
            // Start from first unanswered task
            const firstUnanswered = allTasks.findIndex(t => !answeredIds.has(t.id));
            setTaskIdx(firstUnanswered === -1 ? 0 : firstUnanswered);
            setScreen('task');
          }}
          style={{
            position: 'fixed', bottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 12px))', left: '50%', transform: 'translateX(-50%)',
            width: 'calc(100% - 40px)', maxWidth: 390,
            background: needsCount > 0
              ? `linear-gradient(135deg, ${C.primary}, #1a6da8)`
              : '#2cb67d',
            border: 'none', borderRadius: 16, padding: '16px',
            color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            boxShadow: `0 8px 28px ${C.primary}45`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {needsCount > 0 ? <>Start Check-in <RightOutlined /></> : <>Review All Tasks <RightOutlined /></>}
        </button>
      </div>
    );
  };

  // ── Task Card (1 task per page) ──────────────────────────────────────
  const renderTaskCard = () => {
    if (!currentTask) return null;
    const { id, label, timeOfDay, goalTitle, accentColor, preExisting } = currentTask;
    const status = selections[id] ?? null;
    const isFirst = taskIdx === 0;
    const isLast = taskIdx === allTasks.length - 1;
    const isAutoDetected = preExisting === 'done';
    const remainingUnanswered = allTasks.slice(taskIdx + 1).filter(t => !answeredIds.has(t.id)).length;

    const STATUS_OPTIONS: Array<{
      value: TaskStatus; label: string; sub: string; dot: string;
      color: string; bg: string; border: string;
    }> = [
      { value: 'done',       label: 'Yes, Done!',      sub: 'I completed this task',      dot: '🟢', color: '#2cb67d', bg: '#2cb67d12', border: '#2cb67d45' },
      { value: 'inprogress', label: 'Working On It',   sub: "I've started but not done",  dot: '🟡', color: '#f5a623', bg: '#f5a62312', border: '#f5a62345' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px 20px 24px', minHeight: 0 }}>

        {/* Goal context chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
          background: `${accentColor}15`, border: `1px solid ${accentColor}35`,
          borderRadius: 20, padding: '5px 12px', alignSelf: 'flex-start',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
            {goalTitle}
          </span>
        </div>

        {/* Question card - takes remaining height */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {isAutoDetected && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.primary,
              background: `${C.primary}12`, borderRadius: 8, padding: '4px 10px',
              display: 'inline-block', marginBottom: 14, alignSelf: 'flex-start',
            }}>
              ✅ Auto-detected from your records
            </div>
          )}

          <div style={{ fontSize: 11, color: C.secondary, marginBottom: 14 }}>
            {timeOfDay === 'morning' ? '☀️ Morning task' : '🌙 Evening task'}
          </div>

          <div style={{
            fontSize: 22, fontWeight: 800, color: C.headline,
            lineHeight: 1.35, marginBottom: 32, whiteSpace: 'pre-line',
          }}>
            {taskQuestion(label)}
          </div>

          {/* Status options - big tap targets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STATUS_OPTIONS.map(opt => {
              const active = status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    selectStatus(id, opt.value);
                    // Auto-advance after a short delay so user sees the selection
                    setTimeout(goNext, 380);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
                    background: active ? opt.bg : C.bgCard,
                    border: `2px solid ${active ? opt.border : C.border}`,
                    transition: 'all 0.15s', textAlign: 'left',
                    transform: active ? 'scale(1.01)' : 'scale(1)',
                    boxShadow: active ? `0 4px 16px ${opt.color}25` : C.shadow,
                  }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.dot}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: active ? opt.color : C.headline }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: C.secondary, marginTop: 2 }}>{opt.sub}</div>
                  </div>
                  {active && <CheckOutlined style={{ color: opt.color, fontSize: 16, flexShrink: 0 }} />}
                </button>
              );
            })}

            {/* Not started - smaller, less prominent */}
            <button
              onClick={() => {
                selectStatus(id, null);
                setTimeout(goNext, 380);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                background: status === null && answeredIds.has(id) ? C.bgAlt : 'transparent',
                border: `1.5px solid ${status === null && answeredIds.has(id) ? C.border : 'transparent'}`,
                transition: 'all 0.15s', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>⚪</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.secondary }}>Not Started Yet</div>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom navigation */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {!isFirst && (
            <button onClick={goPrev} style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: C.bgAlt, border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: C.secondary,
            }}>
              <LeftOutlined />
            </button>
          )}
          <button
            onClick={isLast ? skipToProcessing : goNext}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              background: status !== null
                ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`
                : C.bgAlt,
              border: `1px solid ${status !== null ? 'transparent' : C.border}`,
              color: status !== null ? '#fff' : C.secondary,
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            {isLast
              ? 'Finish Check-in'
              : status !== null
              ? <>Next <RightOutlined /></>
              : 'Skip this task'}
            {!isLast && remainingUnanswered > 0 && status !== null && (
              <span style={{ fontSize: 11, opacity: 0.75 }}>({remainingUnanswered} left)</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ── Processing ───────────────────────────────────────────────────────
  const renderProcessing = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, padding: '40px 24px',
    }}>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      <div style={{ fontSize: 52, marginBottom: 28, animation: 'spin 2s linear infinite' }}>🌀</div>
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PROCESSING_STEPS.map((step, i) => {
          const isDone = processingStep > i;
          const isCurrent = processingStep === i;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: isDone ? `${C.primary}10` : isCurrent ? C.bgCard : C.bgAlt,
              border: `1.5px solid ${isDone ? C.primary + '40' : isCurrent ? C.border : 'transparent'}`,
              borderRadius: 14, transition: 'all 0.4s',
              opacity: isCurrent ? 1 : isDone ? 0.85 : 0.3,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{isDone ? '✅' : step.icon}</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: isCurrent ? 700 : 400, color: isDone ? C.primary : C.body, lineHeight: 1.4 }}>
                {step.text}
              </div>
              {isCurrent && <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.primary}`, borderTopColor: 'transparent', flexShrink: 0, animation: 'spin 0.7s linear infinite' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Success ──────────────────────────────────────────────────────────
  const renderSuccess = () => (
    <div style={{ padding: '24px 20px 100px', position: 'relative', overflow: 'hidden' }}>
      <ConfettiBlast />
      <div style={{ textAlign: 'center', marginBottom: 28, paddingTop: 16 }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: C.headline }}>Checked in for today!</h2>
        <p style={{ margin: 0, color: C.body, fontSize: 13, lineHeight: 1.5 }}>
          Your goals, tasks, and recommendations have been refreshed.
        </p>
      </div>

      {/* Summary */}
      <div style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '18px', marginBottom: 16, boxShadow: C.shadow }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Today's Updates</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Tasks Reviewed', value: successStats.tasksReviewed, color: '#7c3aed', icon: '📋' },
            { label: 'Tasks Completed', value: successStats.tasksDone, color: '#2cb67d', icon: '✅' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: `${stat.color}08`, border: `1px solid ${stat.color}25`,
              borderRadius: 12, padding: '14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Goal progress */}
      <div style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: '18px', marginBottom: 16, boxShadow: C.shadow }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Updated Progress</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {successStats.goalProgress.map(gp => (
            <div key={gp.title}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: C.body, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{gp.title}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: gp.accent, flexShrink: 0 }}>{gp.pct}%</span>
              </div>
              <Progress percent={gp.pct} showInfo={false} size={['100%', 6]} strokeColor={gp.accent} railColor={C.bgAlt} />
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      {earnedBadges.length > 0 && (
        <div style={{ background: '#f5a62310', border: '1.5px solid #f5a62330', borderRadius: 18, padding: '18px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f5a623', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            🏅 Achievement{earnedBadges.length > 1 ? 's' : ''} Earned
          </div>
          {earnedBadges.slice(0, 3).map(badge => (
            <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.bgCard, borderRadius: 12, padding: '10px 12px', marginBottom: 8, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{badge.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.headline }}>{badge.label}</div>
                <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>{badge.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', color: C.secondary, fontSize: 12, marginBottom: 20 }}>
        Check-in completed in {minutesTaken} min
      </div>

      <button onClick={onClose} style={{
        width: '100%', padding: '16px', borderRadius: 16,
        background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
        border: 'none', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
        boxShadow: `0 8px 28px ${C.primary}40`,
      }}>
        Done - Back to Dashboard
      </button>
    </div>
  );

  // ── Shell ─────────────────────────────────────────────────────────────
  const topBarTitle =
    screen === 'landing' ? 'Check-in' :
    screen === 'task' ? `${taskIdx + 1} / ${totalTasks}` :
    screen === 'processing' ? 'Saving…' : '✓ Complete';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: C.bg,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>

      {/* Top bar */}
      <div style={{
        zIndex: 10, background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
        flexShrink: 0,
      }}>
        {screen === 'task' && (
          <button onClick={() => setScreen('landing')} style={{
            background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 10,
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.body, fontSize: 14, flexShrink: 0,
          }}>←</button>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.headline }}>{topBarTitle}</div>
          {screen === 'task' && (
            <div style={{ marginTop: 6 }}>
              <Progress
                percent={Math.round(((taskIdx + 1) / totalTasks) * 100)}
                showInfo={false} size={['100%', 4]}
                strokeColor={currentTask?.accentColor ?? C.primary} railColor={C.bgAlt}
              />
            </div>
          )}
        </div>

        {screen !== 'processing' && (
          <button onClick={onClose} style={{
            background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 10,
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.secondary, fontSize: 13, flexShrink: 0,
          }} title="Close"><CloseOutlined /></button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {screen === 'landing' && renderLanding()}
        {screen === 'task' && renderTaskCard()}
        {screen === 'processing' && renderProcessing()}
        {screen === 'success' && renderSuccess()}
      </div>
    </div>
  );
}
