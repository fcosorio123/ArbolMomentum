import { useState, useCallback, useMemo } from 'react';
import { Modal, Progress } from 'antd';
import { ArrowRightOutlined, FireOutlined, StarFilled } from '@ant-design/icons';
import { type Profile, getTodayKey } from '../data/profiles';
import { getDashboardSnapshot, type TodayTaskRow } from '../data/dashboardSnapshot';
import { C } from '../data/colors';

interface Props {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onStartTasks: () => void;
  /** Bump when tasks/goals change so modal re-reads latest data */
  dataVersion?: number;
}

const SUPPRESS_KEY = (profileId: string) => `arbol-summary-off-${profileId}`;
const TODAY_SHOWN_KEY = (profileId: string, date: string) => `arbol-summary-shown-${profileId}-${date}`;

export function isSummaryEnabled(profileId: string) {
  return localStorage.getItem(SUPPRESS_KEY(profileId)) !== 'true';
}

export function markSummaryShownToday(profileId: string) {
  localStorage.setItem(TODAY_SHOWN_KEY(profileId, getTodayKey()), 'true');
}

export function wasSummaryShownToday(profileId: string) {
  return localStorage.getItem(TODAY_SHOWN_KEY(profileId, getTodayKey())) === 'true';
}

const ACCENT_COLORS = ['#3da9fc', '#2cb67d', '#7c3aed', '#ef4565', '#f5a623', '#094067', '#e85d04', '#90b4ce'];
function goalAccent(goalId: string) {
  return ACCENT_COLORS[Math.abs(goalId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % ACCENT_COLORS.length];
}

function TaskSummaryRow({ task }: { task: TodayTaskRow }) {
  const isRemoved = task.disposition === 'removed';
  const isSkipped = task.disposition === 'skipped';
  const isDone = !isRemoved && !isSkipped && task.status === 'done';
  const isIP = !isRemoved && !isSkipped && task.status === 'inprogress';
  const disabled = isRemoved || isSkipped;

  const dotColor = isRemoved ? '#ef4565' : isSkipped ? '#ef4565' : isDone ? '#22c55e' : isIP ? '#f5a623' : C.borderStrong;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        opacity: disabled ? 0.65 : 1,
        pointerEvents: 'none',
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        background: isDone ? '#22c55e' : isIP ? '#f5a623' : isRemoved || isSkipped ? '#ef456520' : 'none',
        border: `2px solid ${dotColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isDone && <span style={{ color: '#fff', fontSize: 8, lineHeight: 1 }}>✓</span>}
        {isIP && <span style={{ color: '#fff', fontSize: 7, lineHeight: 1 }}>◑</span>}
        {(isSkipped || isRemoved) && <span style={{ color: '#ef4565', fontSize: 8, lineHeight: 1 }}>✕</span>}
      </span>
      <span style={{
        fontSize: 12,
        color: disabled ? C.secondary : isDone ? C.secondary : C.body,
        textDecoration: isDone || disabled ? 'line-through' : 'none',
        lineHeight: 1.4, flex: 1,
      }}>
        {task.label}
      </span>
      {(isSkipped || isRemoved) && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#ef4565',
          background: '#ef456512', border: '1px solid #ef456530',
          borderRadius: 4, padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase',
        }}>
          {isRemoved ? 'Removed' : 'Skipped'}
        </span>
      )}
      <span style={{ fontSize: 10, color: C.secondary, flexShrink: 0 }}>
        {task.timeOfDay === 'morning' ? '☀️' : '🌙'}
      </span>
    </div>
  );
}

function statusSummary(snapshot: ReturnType<typeof getDashboardSnapshot>) {
  const parts: string[] = [];
  if (snapshot.inProgressCount > 0) parts.push(`${snapshot.inProgressCount} in progress`);
  if (snapshot.notStartedCount > 0) parts.push(`${snapshot.notStartedCount} not started`);
  if (snapshot.skippedCount > 0) parts.push(`${snapshot.skippedCount} skipped`);
  if (snapshot.removedCount > 0) parts.push(`${snapshot.removedCount} removed`);
  return parts.join(' · ') || '0 not started';
}

export function DailySummaryModal({ open, profile, onClose, onStartTasks, dataVersion = 0 }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const snapshot = useMemo(
    () => getDashboardSnapshot(profile.id),
    [profile.id, dataVersion, open],
  );

  const toggleGoal = useCallback((id: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const {
    countableTasks,
    doneCount: done,
    progressPercent: pct,
    streak: displayStreak,
    goalTaskGroups,
    ungroupedTasks,
    checkedIn,
  } = snapshot;

  const hour = new Date().getHours();
  const preferredTime = hour >= 17 ? 'evening' : 'morning';
  const whatNext: TodayTaskRow | undefined =
    countableTasks.find(t => t.status === 'inprogress' && t.timeOfDay === preferredTime)
    ?? countableTasks.find(t => t.status === null && t.timeOfDay === preferredTime)
    ?? countableTasks.find(t => t.status !== 'done');

  const whatNextGoal = whatNext?.goalId
    ? snapshot.personalGoals.find(g => g.id === whatNext.goalId)
    : undefined;

  const remaining = countableTasks.filter(t => t.status !== 'done').length;

  const handleClose = () => {
    if (dontShowAgain) localStorage.setItem(SUPPRESS_KEY(profile.id), 'true');
    onClose();
  };

  const greeting = (() => {
    if (pct === 100) return `All done, ${profile.name.split(' ')[0]}! 🎉`;
    if (pct === 0) return `Ready to start, ${profile.name.split(' ')[0]}? 🌱`;
    return `Keep going, ${profile.name.split(' ')[0]}! 💪`;
  })();

  const goalGroupsForDisplay = goalTaskGroups.map(({ goal, tasks }) => ({ goal, tasks }));

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      centered
      closable={false}
      width="min(400px, calc(100vw - 16px))"
      styles={{
        content: {
          borderRadius: 24, padding: 0, overflow: 'hidden',
          maxWidth: 'min(400px, calc(100vw - 16px))',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        },
        body: { padding: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        mask: { backdropFilter: 'blur(6px)', background: 'rgba(9,64,103,0.3)' },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Header band */}
        <div style={{
          background: `linear-gradient(135deg, ${C.headline} 0%, #1a6da8 100%)`,
          padding: '20px 16px 18px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 4 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                {greeting}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <FireOutlined style={{ color: C.streak, fontSize: 16 }} />
                <span style={{ color: C.streak, fontWeight: 800, fontSize: 20 }}>{displayStreak}</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>day streak</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <Progress
              type="circle" percent={pct} size={64} strokeWidth={7}
              strokeColor={{ '0%': C.primary, '100%': '#90d7ff' }}
              railColor="rgba(255,255,255,0.2)"
              format={p => <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>{p}%</span>}
            />
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                {done} of {snapshot.totalCount} tasks done
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
                {statusSummary(snapshot)}
              </div>
              {!checkedIn && (
                <div style={{ color: '#ffc9c9', fontSize: 11, marginTop: 6, fontWeight: 600 }}>
                  Daily check-in pending
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0', minHeight: 0 }}>

          {whatNext && pct < 100 && (
            <div style={{
              background: `${C.primary}10`, border: `1.5px solid ${C.primary}25`,
              borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Do this now
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.headline, lineHeight: 1.4 }}>
                {whatNext.label}
              </div>
              {whatNextGoal && (
                <div style={{ fontSize: 11, color: C.primary, marginTop: 5, fontWeight: 500 }}>
                  For: {whatNextGoal.title}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: C.bgAlt, color: C.secondary }}>
                  {whatNext.timeOfDay === 'morning' ? '☀️ Morning' : '🌙 Evening'}
                </span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: C.bgAlt, color: C.body, textTransform: 'capitalize' }}>
                  {whatNext.type}
                </span>
              </div>
              {remaining > 1 && (
                <div style={{ fontSize: 11, color: C.secondary, marginTop: 10 }}>
                  {remaining - 1} more task{remaining - 1 !== 1 ? 's' : ''} left today - one at a time, you've got this.
                </div>
              )}
              <button
                onClick={() => { handleClose(); onStartTasks(); }}
                style={{
                  marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
                  color: C.primary, fontSize: 12, fontWeight: 600, padding: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                See full task list <ArrowRightOutlined style={{ fontSize: 10 }} />
              </button>
            </div>
          )}

          {pct === 100 && (
            <div style={{
              background: `${C.primary}10`, border: `1.5px solid ${C.primary}25`,
              borderRadius: 14, padding: '16px', marginBottom: 16, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.headline }}>Perfect day complete!</div>
              <div style={{ color: C.body, fontSize: 12, marginTop: 4 }}>You've finished all your tasks today.</div>
            </div>
          )}

          {(goalGroupsForDisplay.length > 0 || ungroupedTasks.length > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
                <StarFilled style={{ color: C.tertiary, fontSize: 11 }} />
                <span style={{ fontSize: 11, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                  Goals &amp; Progress
                </span>
              </div>

              {goalGroupsForDisplay.map(({ goal, tasks }) => {
                const accentColor = goalAccent(goal.id);
                const countable = tasks.filter(t => t.disposition === 'active');
                const tasksDone = countable.filter(t => t.status === 'done').length;
                const goalPct = countable.length > 0 ? Math.round((tasksDone / countable.length) * 100) : 0;
                const isExpanded = expandedGoals.has(goal.id);
                const allDone = countable.length > 0 && tasksDone === countable.length;

                return (
                  <div key={goal.id} style={{
                    marginBottom: 10,
                    background: `${accentColor}06`,
                    border: `1px solid ${accentColor}20`,
                    borderRadius: 12, overflow: 'hidden',
                  }}>
                    <div style={{ padding: '12px 14px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `${accentColor}18`, border: `1px solid ${accentColor}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, flexShrink: 0,
                        }}>
                          🎯
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: C.headline,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {goal.title}
                            </span>
                            <span style={{ fontSize: 11, color: accentColor, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                              {goalPct}%
                            </span>
                          </div>
                          <div style={{ height: 4, background: C.bgAlt, borderRadius: 2 }}>
                            <div style={{
                              height: '100%', width: `${goalPct}%`,
                              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`,
                              borderRadius: 2, transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleGoal(goal.id)}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        padding: '7px 14px', borderTop: `1px solid ${accentColor}15`,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 10, color: C.secondary, fontWeight: 500 }}>Today:</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: allDone ? '#22c55e' : accentColor }}>
                        {tasksDone}/{countable.length} tasks
                      </span>
                      {allDone && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>✓ Done!</span>}
                      <span style={{ flex: 1 }} />
                      <span style={{
                        fontSize: 12, color: C.secondary,
                        transition: 'transform 0.2s', display: 'inline-block',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      }}>⌄</span>
                    </button>

                    {isExpanded && (
                      <div style={{
                        borderTop: `1px solid ${accentColor}15`,
                        padding: '8px 14px 10px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        {tasks.map(task => <TaskSummaryRow key={task.id} task={task} />)}
                      </div>
                    )}
                  </div>
                );
              })}

              {ungroupedTasks.length > 0 && (
                <div style={{ marginTop: goalGroupsForDisplay.length > 0 ? 6 : 0 }}>
                  {goalGroupsForDisplay.length > 0 && (
                    <div style={{ fontSize: 10, color: C.secondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Other
                    </div>
                  )}
                  <div style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleGoal('__ungrouped__')}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 10, color: C.secondary, fontWeight: 500 }}>Routines:</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.primary }}>
                        {ungroupedTasks.filter(t => t.disposition === 'active' && t.status === 'done').length}/
                        {ungroupedTasks.filter(t => t.disposition === 'active').length} tasks
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{
                        fontSize: 12, color: C.secondary, transition: 'transform 0.2s', display: 'inline-block',
                        transform: expandedGoals.has('__ungrouped__') ? 'rotate(0deg)' : 'rotate(-90deg)',
                      }}>⌄</span>
                    </button>
                    {expandedGoals.has('__ungrouped__') && (
                      <div style={{
                        borderTop: `1px solid ${C.border}`, padding: '8px 14px 10px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        {ungroupedTasks.map(task => <TaskSummaryRow key={task.id} task={task} />)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned footer — always reachable on small screens */}
        <div style={{
          flexShrink: 0, padding: '12px 16px 16px',
          borderTop: `1px solid ${C.border}`, background: C.bg,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.primary, cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: C.secondary }}>Don't show this again</span>
          </label>

          <button
            onClick={() => { handleClose(); onStartTasks(); }}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.headline}, #1a6da8)`,
              color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {pct === 100 ? 'View Progress' : pct > 0 ? 'Continue Tasks' : 'Start Tasks'}
            <ArrowRightOutlined />
          </button>
          <button
            onClick={handleClose}
            style={{
              width: '100%', padding: '12px', borderRadius: 14,
              border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer',
              color: C.body, fontSize: 14,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
