import { useState, useEffect, useCallback } from 'react';
import { Button, Progress, Modal, InputNumber, Input, App } from 'antd';
import { ArrowLeftOutlined, CheckCircleFilled, ReloadOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import {
  getPersonalGoals, logGoalProgress, getCurrentMilestone,
  MILESTONE_CONFIG, resetGoalProgress, isMonetaryGoal,
  toggleGoalTask, getChecklistProgress, isGoalTaskChecked,
  type PersonalGoal, type Milestone, type GoalProgressLog,
} from '../data/personalGoals';
import {
  getTaskCategoriesForProfile, getTaskStatus, setTaskStatus,
  isTaskActiveForDate, getTodayKey, type TaskStatus,
} from '../data/profiles';
import { getUserTasks, type UserTask } from '../data/userTasks';

interface Props {
  profileId: string;
  onBack: () => void;
  onNavigateTasks?: () => void;
}

export function PersonalGoals({ profileId, onBack, onNavigateTasks }: Props) {
  const { message } = App.useApp();
  const today = getTodayKey();
  const categories = getTaskCategoriesForProfile(profileId);
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus | null>>({});
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logAmount, setLogAmount] = useState<number | null>(null);
  const [logNotes, setLogNotes] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [selectedGoalForLog, setSelectedGoalForLog] = useState<PersonalGoal | null>(null);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [goalToReset, setGoalToReset] = useState<PersonalGoal | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [completedMilestone, setCompletedMilestone] = useState<{ milestone: Milestone; goal: PersonalGoal } | null>(null);

  const loadGoals = useCallback(() => {
    setGoals(getPersonalGoals(profileId));
    // Load user-created tasks (same source as TaskList)
    const uts = getUserTasks(profileId);
    setUserTasks(uts);
    // Load today's task statuses for seeded tasks AND user tasks (same keys TaskList reads/writes)
    const s: Record<string, TaskStatus | null> = {};
    categories.forEach(cat => {
      cat.tasks.forEach(task => {
        s[task.id] = getTaskStatus(profileId, task.id, today);
      });
    });
    uts.forEach(ut => {
      s[ut.id] = getTaskStatus(profileId, ut.id, today);
    });
    setTaskStatuses(s);
  }, [profileId, today]);

  const cycleTaskStatus = (taskId: string) => {
    const cur = taskStatuses[taskId];
    const next: TaskStatus | null = cur === 'done' ? null : cur === 'inprogress' ? 'done' : 'inprogress';
    setTaskStatus(profileId, taskId, today, next);
    setTaskStatuses(prev => ({ ...prev, [taskId]: next }));
  };

  useEffect(() => {
    loadGoals();
    const handler = () => loadGoals();
    window.addEventListener('arbol-goals-updated', handler);
    return () => window.removeEventListener('arbol-goals-updated', handler);
  }, [loadGoals]);

  // ── Monetary: log amount
  const handleLogProgress = () => {
    if (!selectedGoalForLog || !selectedTask) return;
    const log: Omit<GoalProgressLog, 'id'> = {
      goalId: selectedGoalForLog.id,
      profileId,
      timestamp: Date.now(),
      taskCompleted: selectedTask,
      amountLogged: logAmount || undefined,
      notes: logNotes || undefined,
    };
    const result = logGoalProgress(log);
    if (result.milestoneHit) {
      const updated = getPersonalGoals(profileId);
      const updatedGoal = updated.find(g => g.id === selectedGoalForLog.id);
      const milestone = updatedGoal?.milestones.find(m => m.id === result.milestoneHit);
      if (milestone && updatedGoal) {
        setCompletedMilestone({ milestone, goal: updatedGoal });
        setCelebrationVisible(true);
      }
    }
    loadGoals();
    setLogModalVisible(false);
    setLogAmount(null);
    setLogNotes('');
    setSelectedTask('');
    setSelectedGoalForLog(null);
    if (!result.milestoneHit) {
      message.success('Progress logged!');
      onNavigateTasks?.();
    }
  };

  // ── Non-monetary: toggle a checklist task
  const handleToggleTask = (goal: PersonalGoal, milestoneId: string, taskIdx: number) => {
    const wasChecked = isGoalTaskChecked(profileId, goal.id, milestoneId, taskIdx);
    toggleGoalTask(profileId, goal, milestoneId, taskIdx);
    loadGoals();
    if (!wasChecked) {
      message.success({ content: '✅ Task checked - goal updated!', duration: 1.5 });
    }
  };

  const handleReset = () => {
    if (!goalToReset) return;
    resetGoalProgress(profileId, goalToReset.id);
    if (!isMonetaryGoal(goalToReset)) {
      goalToReset.milestones.forEach(m => {
        m.tasks.forEach((_, idx) => {
          localStorage.removeItem(`arbol-gtask-${profileId}-${goalToReset.id}-${m.id}-${idx}`);
        });
      });
    }
    loadGoals();
    setResetModalVisible(false);
    setGoalToReset(null);
    message.success('Goal progress reset');
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
  };

  const card: React.CSSProperties = {
    background: C.bgCard,
    border: `1.5px solid ${C.border}`,
    borderRadius: 18,
    boxShadow: C.shadow,
  };

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, maxWidth: 430, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, #ef4565 0%, #f5a623 100%)`, padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 20px' }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}
          style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 12, paddingLeft: 0 }}>
          Back
        </Button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Goals 🌟</h1>
        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          Your dreams, one task at a time
        </p>
      </div>

      <div style={{ padding: '16px' }}>
        {goals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: C.headline, marginBottom: 8 }}>No Goals Yet</div>
            <div style={{ color: C.body, fontSize: 13 }}>Goals will appear here once configured.</div>
          </div>
        )}

        {goals.map(goal => {
          const monetary = isMonetaryGoal(goal);
          const checklist = monetary ? null : getChecklistProgress(profileId, goal);

          // Build the full list of today's tasks for this goal: seeded + user-created
          const goalCats = categories.filter(c => c.goalId === goal.id);
          const goalUserTasks = userTasks.filter(ut => ut.goalId === goal.id);
          const allGoalTasks: { id: string; label: string; timeOfDay: string }[] = [
            ...goalCats.flatMap(cat =>
              cat.tasks.filter(t => isTaskActiveForDate(profileId, t.id, today))
            ),
            ...goalUserTasks.filter(ut => isTaskActiveForDate(profileId, ut.id, today)),
          ];
          const todayDoneCount = allGoalTasks.filter(t => taskStatuses[t.id] === 'done').length;
          const hasTodayTasks = allGoalTasks.length > 0;
          const todayPct = hasTodayTasks
            ? Math.round((todayDoneCount / allGoalTasks.length) * 100)
            : null;

          // pct: for non-monetary goals prefer today's live task pct; fall back to checklist
          const pct = monetary
            ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
            : todayPct !== null ? todayPct : checklist!.pct;

          const currentMilestone = getCurrentMilestone(goal);
          const completedMilestones = goal.milestones.filter(m => m.completed).length;

          return (
            <div key={goal.id} style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>

              {/* ── Goal header */}
              <div style={{ padding: '18px 18px 14px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.headline, lineHeight: 1.25 }}>
                      {goal.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: C.body, fontStyle: 'italic', lineHeight: 1.45, opacity: 0.85 }}>
                      "{goal.deepWhy}"
                    </p>
                  </div>
                  {/* Progress ring */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <Progress
                      type="circle" percent={pct} size={58} strokeWidth={9}
                      strokeColor={{ '0%': '#ef4565', '100%': '#f5a623' }}
                      railColor={C.bgAlt}
                      format={p => (
                        <span style={{ fontSize: 11, fontWeight: 800, color: C.headline }}>
                          {p === 100 ? '✓' : `${p}%`}
                        </span>
                      )}
                    />
                    <span style={{ fontSize: 9, color: C.secondary }}>
                      {completedMilestones}/{goal.milestones.length} done
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 14 }}>
                  <Progress
                    percent={pct}
                    strokeColor={{ '0%': '#ef4565', '100%': '#f5a623' }}
                    railColor={C.bgAlt}
                    showInfo={false}
                    size={['100%', 7]}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11 }}>
                    {monetary ? (
                      <>
                        <span style={{ color: C.secondary }}>
                          {goal.unit}{goal.currentValue.toLocaleString()} saved
                        </span>
                        <span style={{ color: C.body, fontWeight: 600 }}>
                          goal: {goal.unit}{goal.targetValue.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: C.secondary }}>
                          {hasTodayTasks
                            ? `${todayDoneCount} of ${allGoalTasks.length} tasks done today`
                            : `${checklist!.checked} of ${checklist!.total} tasks complete`}
                        </span>
                        <span style={{ color: C.body, fontWeight: 600 }}>{pct}% done</span>
                      </>
                    )}
                  </div>
                </div>

                {goal.targetDate && (
                  <div style={{ fontSize: 11, color: C.secondary, marginTop: 8 }}>
                    🎯 Target: {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: C.border }} />

              {/* ── NON-MONETARY: equal-weight checklist across all milestones */}
              {!monetary && (
                <div style={{ padding: '14px 18px 16px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 11, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600 }}>
                      Checklist
                    </span>
                    <span style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>
                      {checklist!.total > 0 ? `+${Math.round(100 / checklist!.total)}% per task` : ''}
                    </span>
                  </div>

                  {goal.milestones.map((milestone, mIdx) => {
                    const mc = MILESTONE_CONFIG[milestone.level];
                    const milestoneTasksDone = milestone.tasks.filter((_, tIdx) =>
                      isGoalTaskChecked(profileId, goal.id, milestone.id, tIdx)
                    ).length;
                    const milestoneComplete = milestoneTasksDone === milestone.tasks.length && milestone.tasks.length > 0;

                    return (
                      <div key={milestone.id} style={{ marginBottom: mIdx < goal.milestones.length - 1 ? 14 : 0 }}>
                        {/* Milestone header */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7,
                          padding: '7px 10px', borderRadius: 10,
                          background: milestoneComplete ? `${mc.color}15` : C.bgAlt,
                          border: `1px solid ${milestoneComplete ? mc.color : C.border}`,
                        }}>
                          <span style={{ fontSize: 14 }}>
                            {milestoneComplete
                              ? <CheckCircleFilled style={{ color: mc.color, fontSize: 14 }} />
                              : mc.icon}
                          </span>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: milestoneComplete ? mc.color : C.headline }}>
                            {milestone.title}
                          </span>
                          <span style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 6,
                            background: milestoneComplete ? mc.color : `${mc.color}30`,
                            color: milestoneComplete ? '#fff' : mc.color, fontWeight: 700,
                          }}>
                            {milestoneTasksDone}/{milestone.tasks.length}
                          </span>
                        </div>

                        {/* Task checkboxes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {milestone.tasks.map((task, tIdx) => {
                            const checked = isGoalTaskChecked(profileId, goal.id, milestone.id, tIdx);
                            return (
                              <button
                                key={tIdx}
                                onClick={() => handleToggleTask(goal, milestone.id, tIdx)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '9px 12px', borderRadius: 10,
                                  background: checked ? `${mc.color}0d` : C.bgCard,
                                  border: `1.5px solid ${checked ? mc.color : C.border}`,
                                  cursor: 'pointer', textAlign: 'left', width: '100%',
                                  transition: 'all 0.18s',
                                }}
                              >
                                <div style={{
                                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                  background: checked ? mc.color : 'transparent',
                                  border: `2px solid ${checked ? mc.color : C.borderStrong}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.18s',
                                }}>
                                  {checked && (
                                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                      <path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span style={{
                                  fontSize: 13, color: checked ? C.secondary : C.headline,
                                  textDecoration: checked ? 'line-through' : 'none',
                                  fontWeight: checked ? 400 : 500, lineHeight: 1.35, flex: 1,
                                }}>
                                  {task}
                                </span>
                                <span style={{ fontSize: 10, color: checked ? mc.color : C.secondary, fontWeight: checked ? 700 : 400, flexShrink: 0 }}>
                                  {checked ? '✓' : `+${checklist!.total > 0 ? Math.round(100 / checklist!.total) : 0}%`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── MONETARY: milestone ladder + log progress */}
              {monetary && (
                <div style={{ padding: '14px 18px 16px' }}>
                  <div style={{ fontSize: 11, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, fontWeight: 600 }}>
                    Milestones ({completedMilestones}/{goal.milestones.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {goal.milestones.map(milestone => {
                      const mc = MILESTONE_CONFIG[milestone.level];
                      const isCurrent = currentMilestone?.id === milestone.id;
                      return (
                        <div key={milestone.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 10,
                          background: milestone.completed ? `${mc.color}15` : isCurrent ? `${mc.color}08` : C.bgAlt,
                          border: `1px solid ${milestone.completed ? mc.color : isCurrent ? `${mc.color}50` : C.border}`,
                        }}>
                          <span style={{ fontSize: 16 }}>
                            {milestone.completed
                              ? <CheckCircleFilled style={{ color: mc.color }} />
                              : mc.icon}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: milestone.completed ? mc.color : C.headline }}>
                              {milestone.title}
                            </div>
                            {milestone.targetValue && (
                              <div style={{ fontSize: 10, color: C.secondary, marginTop: 1 }}>
                                Target: {goal.unit}{milestone.targetValue.toLocaleString()}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: mc.color, color: '#fff', fontWeight: 600 }}>
                            {mc.label.toUpperCase()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {currentMilestone && (
                    <>
                      <div style={{ padding: '12px', borderRadius: 12, background: C.bgAlt, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: C.secondary, marginBottom: 8 }}>
                          📋 Suggested actions ({MILESTONE_CONFIG[currentMilestone.level].label})
                        </div>
                        {currentMilestone.tasks.map((task, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: C.body, marginBottom: 4, display: 'flex', gap: 6 }}>
                            <span style={{ fontSize: 10 }}>•</span>
                            <span>{task}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="primary" size="middle"
                        onClick={() => {
                          setSelectedGoalForLog(goal);
                          setSelectedTask(currentMilestone.tasks[0] ?? '');
                          setLogModalVisible(true);
                        }}
                        style={{
                          width: '100%', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          background: `linear-gradient(135deg, #ef4565, #f5a623)`,
                          border: 'none', height: 40,
                        }}
                      >
                        Log Progress →
                      </Button>
                    </>
                  )}

                  {!currentMilestone && (
                    <div style={{ padding: '12px', borderRadius: 10, textAlign: 'center', background: '#22c55e15', border: '1px solid #22c55e' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>All milestones completed!</div>
                    </div>
                  )}
                </div>
              )}

              {/* Today's Tasks - shared with Tasks page, same localStorage keys.
                  allGoalTasks already computed above (seeded + user-created). */}
              {(() => {
                return (
                  <div style={{ padding: '0 18px 14px' }}>
                    <div style={{ height: 1, background: C.border, marginBottom: 14 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600 }}>
                        Today's Tasks
                      </span>
                      {allGoalTasks.length > 0 && (
                        <span style={{ fontSize: 11, color: todayDoneCount === allGoalTasks.length ? '#22c55e' : C.secondary, fontWeight: 600 }}>
                          {todayDoneCount}/{allGoalTasks.length} done
                        </span>
                      )}
                    </div>

                    {allGoalTasks.length === 0 ? (
                      <div style={{
                        padding: '14px 12px', borderRadius: 10, textAlign: 'center',
                        background: C.bgAlt, border: `1px dashed ${C.border}`,
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 6 }}>📋</div>
                        <div style={{ fontSize: 12, color: C.body, fontWeight: 500, marginBottom: 4 }}>
                          No tasks linked to this goal yet
                        </div>
                        <div style={{ fontSize: 11, color: C.secondary, lineHeight: 1.5 }}>
                          Go to the Tasks tab and assign a task to this goal so your daily actions show up here.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allGoalTasks.map(task => {
                          const status = taskStatuses[task.id];
                          const isDone = status === 'done';
                          const isInProgress = status === 'inprogress';
                          return (
                            <button
                              key={task.id}
                              onClick={() => cycleTaskStatus(task.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                                background: isDone ? `${C.primary}0d` : isInProgress ? `${C.streak}0d` : C.bgCard,
                                border: `1.5px solid ${isDone ? C.primary : isInProgress ? C.streak : C.border}`,
                                textAlign: 'left', width: '100%', transition: 'all 0.18s',
                              }}
                            >
                              <div style={{
                                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                background: isDone ? C.primary : isInProgress ? C.streak : 'transparent',
                                border: `2px solid ${isDone ? C.primary : isInProgress ? C.streak : C.secondary}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.18s',
                              }}>
                                {isDone && (
                                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                    <path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                                {isInProgress && (
                                  <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fff' }} />
                                )}
                              </div>
                              <span style={{
                                fontSize: 13, flex: 1, lineHeight: 1.35, fontWeight: isDone ? 400 : 500,
                                color: isDone ? C.secondary : C.headline,
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}>
                                {task.label}
                              </span>
                              <span style={{ fontSize: 10, color: C.secondary, flexShrink: 0 }}>
                                {task.timeOfDay === 'morning' ? '☀️' : '🌙'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Reset */}
              {(monetary ? goal.currentValue > 0 : checklist!.checked > 0) && (
                <div style={{ padding: '0 18px 16px' }}>
                  <div style={{ height: 1, background: C.border, marginBottom: 12 }} />
                  <Button
                    block icon={<ReloadOutlined />}
                    onClick={() => { setGoalToReset(goal); setResetModalVisible(true); }}
                    style={{
                      borderRadius: 10, height: 36,
                      background: `${C.tertiary}08`, border: `1px solid ${C.tertiary}30`,
                      color: C.tertiary, fontSize: 12,
                    }}
                  >
                    Reset Progress
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Log Progress Modal (monetary) */}
      <Modal
        open={logModalVisible}
        title="Log Progress"
        onCancel={() => { setLogModalVisible(false); setLogAmount(null); setLogNotes(''); }}
        onOk={handleLogProgress}
        okText="Save"
        centered
      >
        {selectedGoalForLog && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: C.secondary, marginBottom: 4 }}>Goal</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.headline }}>{selectedGoalForLog.title}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: C.secondary, marginBottom: 4 }}>Task Completed</div>
              <Input value={selectedTask} onChange={e => setSelectedTask(e.target.value)} placeholder="What did you do?" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: C.secondary, marginBottom: 4 }}>
                Amount ({selectedGoalForLog.unit}) <span style={{ fontSize: 11, fontStyle: 'italic' }}>optional</span>
              </div>
              <InputNumber value={logAmount} onChange={setLogAmount} placeholder="0" style={{ width: '100%' }} min={0} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: C.secondary, marginBottom: 4 }}>
                Notes <span style={{ fontSize: 11, fontStyle: 'italic' }}>optional</span>
              </div>
              <Input.TextArea value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="Any additional details..." rows={3} />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reset Confirmation */}
      <Modal
        open={resetModalVisible}
        onCancel={() => { setResetModalVisible(false); setGoalToReset(null); }}
        footer={null} closable={false} centered
        styles={{
          content: { borderRadius: 20, padding: 0, overflow: 'hidden', maxWidth: 360, margin: '0 auto' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: C.headline }}>Reset Goal Progress?</h3>
          <p style={{ color: C.body, fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
            This will reset <strong style={{ color: C.headline }}>"{goalToReset?.title}"</strong> back to zero and cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button block onClick={() => { setResetModalVisible(false); setGoalToReset(null); }}
              style={{ borderRadius: 12, height: 44, border: `1px solid ${C.border}`, color: C.body }}>
              Cancel
            </Button>
            <Button block type="primary" onClick={handleReset}
              style={{ borderRadius: 12, height: 44, background: C.tertiary, border: 'none' }}>
              Reset
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Milestone Celebration */}
      <Modal
        open={celebrationVisible}
        onCancel={() => { setCelebrationVisible(false); setCompletedMilestone(null); }}
        footer={null} closable={false} centered
        styles={{
          content: { borderRadius: 24, padding: 0, overflow: 'hidden', maxWidth: 380, margin: '0 auto' },
          mask: { backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.6)' },
        }}
      >
        {completedMilestone && (() => {
          const mc = MILESTONE_CONFIG[completedMilestone.milestone.level];
          return (
            <div style={{ padding: '32px 24px 24px', textAlign: 'center', background: `linear-gradient(135deg, ${mc.color}15, ${mc.color}08)` }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: C.headline }}>Milestone Achieved!</h3>
              <p style={{ color: C.body, fontSize: 15, margin: '0 0 20px', lineHeight: 1.5 }}>
                You completed <strong style={{ color: mc.color }}>{completedMilestone.milestone.title}</strong>
              </p>
              <div style={{ background: C.bgCard, borderRadius: 16, padding: '16px', marginBottom: 20, border: `2px solid ${mc.color}30` }}>
                <div style={{ fontSize: 12, color: C.secondary, marginBottom: 8 }}>Goal Progress</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.headline, marginBottom: 8 }}>{completedMilestone.goal.title}</div>
                <Progress
                  percent={Math.min(100, Math.round((completedMilestone.goal.currentValue / completedMilestone.goal.targetValue) * 100))}
                  strokeColor={{ '0%': '#ef4565', '100%': '#f5a623' }}
                  railColor={C.bgAlt} showInfo={false} size={['100%', 8]}
                />
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, background: mc.color, color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 20 }}>
                <span style={{ fontSize: 18 }}>{mc.icon}</span>
                {mc.label} Milestone
              </div>
              <Button
                block type="primary" size="large"
                onClick={() => { setCelebrationVisible(false); setCompletedMilestone(null); onNavigateTasks?.(); }}
                style={{ borderRadius: 12, height: 48, fontSize: 15, fontWeight: 600, background: `linear-gradient(135deg, #ef4565, #f5a623)`, border: 'none' }}
              >
                Continue Journey →
              </Button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
