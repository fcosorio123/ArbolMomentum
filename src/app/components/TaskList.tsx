import { useState, useEffect, useCallback } from 'react';
import { App, Button, Modal, Progress } from 'antd';
import { DeleteOutlined, CheckCircleFilled, PlayCircleOutlined, ArrowRightOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  type Profile, type Task, type TaskStatus,
  getTaskCategoriesForProfile, getTaskStatus, setTaskStatus,
  isTaskDeleted, markTaskDeleted, getTodayKey,
  getEarnedBadges, type Badge,
} from '../data/profiles';
import {
  getPersonalGoals,
  type PersonalGoal,
} from '../data/personalGoals';

import {
  getUserTasks, createUserTask, updateUserTask, deleteUserTask,
  orphanUserTasksForGoal, isTaskScheduledForDate, skipTaskOccurrence,
  recurrenceLabel, type UserTask, type Recurrence,
} from '../data/userTasks';
import { ManageTaskModal } from './ManageTaskModal';
import { C } from '../data/colors';
import { trackActivity } from '../data/feedback';
import { PageTour, PageTourButton, TOUR_KEYS } from './AppTour';
import { CongratModal } from './CongratModal';
import { LiveCheckInFeedbackCard } from './LiveCheckInFeedbackCard';
import {
  submitReportUpdate, LOADER_MESSAGES, randomProcessingDelayMs,
} from '../data/liveCheckInFeedback';
import { isLiveCheckInEnabled, fetchLiveCheckInSettings } from '../data/liveCheckInSettings';

interface Props {
  profile: Profile;
  onNavigateWeek?: () => void;
  onPerfectDay?: (newBadges: Badge[]) => void;
  onTasksChange?: (pending: number) => void;
}

type StatusMap = Record<string, TaskStatus | null>;
type DeletedMap = Record<string, boolean>;
type UserTask_ = Task & { isUserCreated?: boolean; recurrence?: Recurrence };

function isRecurringUT(task: UserTask): boolean {
  return !!task.recurrence && task.recurrence.type !== 'daily' && task.recurrence.type !== 'one-time';
}

function nextStatus(s: TaskStatus | null): TaskStatus | null {
  if (!s) return 'inprogress';
  if (s === 'inprogress') return 'done';
  return null;
}

const STATUS_META = {
  inprogress: { label: 'In Progress', dot: '◑', color: '#f5a623', bg: '#fff8ee', border: '#f5a62340' },
  done:       { label: 'Done',        dot: '●', color: C.primary,  bg: `${C.primary}12`, border: `${C.primary}40` },
};


// ── Task item
function TaskItem({
  task, catColor, status, onCycle, onDelete, onEdit,
}: {
  task: UserTask_; catColor: string; status: TaskStatus | null;
  onCycle: () => void; onDelete: () => void;
  onEdit?: () => void;
}) {
  const meta = status ? STATUS_META[status] : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: meta ? meta.bg : C.bgCard,
      borderRadius: 14, border: `1.5px solid ${meta ? meta.border : C.border}`,
      marginBottom: 8, transition: 'all 0.2s',
      boxShadow: status === 'done' ? 'none' : C.shadow,
    }}>
      <div style={{ width: 4, height: 32, borderRadius: 2, background: catColor, flexShrink: 0 }} />

      <button onClick={onCycle} style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
        background: meta ? meta.color : C.bgAlt,
        border: `1.5px solid ${meta ? meta.border : C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
      }}>
        {status === 'done'
          ? <CheckCircleFilled style={{ color: '#fff', fontSize: 16 }} />
          : status === 'inprogress'
          ? <PlayCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
          : <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.borderStrong}`, display: 'block' }} />
        }
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: status === 'done' ? C.secondary : C.headline,
          textDecoration: status === 'done' ? 'line-through' : 'none',
          lineHeight: 1.3,
        }}>
          {task.label}
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10 }}>{task.timeOfDay === 'morning' ? '☀️' : '🌙'}</span>
          {task.isUserCreated && task.recurrence && task.recurrence.type !== 'daily' && (
            <span style={{ fontSize: 10, color: C.secondary, opacity: 0.75 }}>
              {recurrenceLabel(task.recurrence)}
            </span>
          )}
          {status && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5, background: meta!.bg, color: meta!.color }}>
              {meta!.label}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
        {onEdit && (
          <button onClick={onEdit} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.secondary,
            fontSize: 13, padding: 10, borderRadius: 6, minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s, background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.background = `${C.primary}12`; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.secondary; e.currentTarget.style.background = 'none'; }}
          >
            <EditOutlined />
          </button>
        )}
        <button onClick={onDelete} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: C.secondary,
          fontSize: 15, padding: 10, borderRadius: 6, minWidth: 44, minHeight: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.15s, background 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = C.tertiary; e.currentTarget.style.background = `${C.tertiary}12`; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.secondary; e.currentTarget.style.background = 'none'; }}
        >
          <DeleteOutlined />
        </button>
      </div>
    </div>
  );
}

// ── "Other Tasks to Explore" - milestone-suggested + custom task entry
function OtherTasksSection({
  tasks, goalId, accentColor, onAdd,
}: {
  tasks: string[]; goalId: string; accentColor: string;
  onAdd: (label: string, goalId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const items = tasks.slice(0, 5);

  const handleCustomAdd = () => {
    const t = customLabel.trim();
    if (!t) return;
    onAdd(t, goalId);
    setCustomLabel('');
  };

  return (
    <div style={{
      borderLeft: `1.5px solid ${accentColor}25`,
      borderRight: `1.5px solid ${accentColor}25`,
      borderBottom: `1.5px solid ${accentColor}25`,
      borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
      background: `${accentColor}04`,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '10px 14px', margin: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Other Tasks to Explore
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: accentColor, opacity: 0.6, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>
          ⌄
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {items.map((label, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0', borderTop: `1px solid ${accentColor}15`,
            }}>
              <span style={{ fontSize: 12, color: accentColor, flexShrink: 0 }}>→</span>
              <span style={{ flex: 1, fontSize: 12, color: C.body, lineHeight: 1.4 }}>{label}</span>
              <button
                onClick={() => onAdd(label, goalId)}
                style={{
                  background: `${accentColor}15`, border: `1px solid ${accentColor}35`,
                  borderRadius: 8, width: 26, height: 26, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: accentColor, fontSize: 14, fontWeight: 700,
                }}
                title="Add as task"
              >
                +
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, borderTop: `1px solid ${accentColor}15`, paddingTop: 10 }}>
            <input
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustomAdd(); }}
              placeholder="Add your own task..."
              style={{
                flex: 1, border: `1px solid ${accentColor}35`, borderRadius: 8,
                padding: '6px 10px', fontSize: 12, color: C.body, outline: 'none',
                background: 'none',
              }}
            />
            <button
              onClick={handleCustomAdd}
              disabled={!customLabel.trim()}
              style={{
                background: customLabel.trim() ? accentColor : C.bgAlt,
                border: 'none', borderRadius: 8, width: 30, height: 30, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: customLabel.trim() ? 'pointer' : 'default',
                color: customLabel.trim() ? '#fff' : C.secondary, fontSize: 16, fontWeight: 700,
              }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const GOAL_ACCENT_COLORS = ['#3da9fc', '#2cb67d', '#7c3aed', '#ef4565', '#f5a623', '#094067', '#e85d04', '#90b4ce'];
function goalAccentColor(goalId: string) {
  return GOAL_ACCENT_COLORS[Math.abs(goalId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % GOAL_ACCENT_COLORS.length];
}

// ── Goal group: goal header + flat task list
function GoalGroup({
  goal, tasks, statuses, deleted, onCycle, onDelete, timeFilter,
  onEditTask, onAddSuggestedTask, isFirst,
}: {
  goal: PersonalGoal; tasks: UserTask_[];
  statuses: StatusMap; deleted: DeletedMap;
  onCycle: (t: Task) => void; onDelete: (t: UserTask_) => void;
  timeFilter: 'all' | 'morning' | 'evening';
  onEditTask: (t: UserTask_) => void;
  onAddSuggestedTask: (label: string, goalId: string) => void;
  isFirst?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!isFirst);
  const accentColor = goalAccentColor(goal.id);

  const allVisibleTasks = tasks.filter(t =>
    (timeFilter === 'all' || t.timeOfDay === timeFilter) && !deleted[t.id]
  );
  if (allVisibleTasks.length === 0) return null;

  const doneTasks = allVisibleTasks.filter(t => statuses[t.id] === 'done').length;
  const totalTasks = allVisibleTasks.length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const allDone = totalTasks > 0 && doneTasks === totalTasks;
  const accent = allDone ? C.primary : accentColor;

  const suggestedLabels = suggestTasksForGoal(goal).map(s => s.label);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Goal header card */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
          background: `linear-gradient(135deg, ${accent}18, ${accent}06)`,
          borderRadius: collapsed ? 16 : '16px 16px 0 0',
          borderTop: `1.5px solid ${accent}30`,
          borderLeft: `1.5px solid ${accent}30`,
          borderRight: `1.5px solid ${accent}30`,
          borderBottom: collapsed ? `1.5px solid ${accent}30` : 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <Progress
          type="circle" percent={progress} size={46}
          strokeColor={accent}
          railColor={`${accent}25`}
          format={pct => <span style={{ fontSize: 10, fontWeight: 800, color: accent }}>{pct}%</span>}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: C.headline,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {goal.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 5,
              background: `${accent}20`, color: accent,
            }}>
              {allDone ? '✓ All done' : `${doneTasks}/${totalTasks} tasks`}
            </span>
          </div>
        </div>
        <span style={{ fontSize: 16, color: C.secondary, transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          ⌄
        </span>
      </div>

      {/* Why this matters */}
      {!collapsed && goal.deepWhy && (
        <div style={{
          padding: '9px 16px 10px',
          background: `${accent}0a`,
          borderLeft: `1.5px solid ${accent}30`,
          borderRight: `1.5px solid ${accent}30`,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Why this matters
          </span>
          <div style={{ fontSize: 12, color: C.body, lineHeight: 1.45, marginTop: 2 }}>
            {goal.deepWhy}
          </div>
        </div>
      )}

      {/* Tasks directly under goal */}
      {!collapsed && (
        <div style={{
          paddingLeft: 10, paddingTop: 10,
          borderLeft: `3px solid ${accent}25`, marginLeft: 6,
          borderBottom: 'none',
          borderRight: `1.5px solid ${accent}30`,
          paddingRight: 6, paddingBottom: 4,
          background: C.bgCard,
        }}>
          {allVisibleTasks.map(task => (
            <TaskItem
              key={task.id} task={task} catColor={accent}
              status={statuses[task.id] ?? null}
              onCycle={() => onCycle(task)} onDelete={() => onDelete(task)}
              onEdit={() => onEditTask(task)}
            />
          ))}
        </div>
      )}

      {/* Other Tasks to Explore: keyword suggestions + custom entry */}
      {!collapsed && (
        <OtherTasksSection
          tasks={suggestedLabels}
          goalId={goal.id}
          accentColor={accent}
          onAdd={onAddSuggestedTask}
        />
      )}
    </div>
  );
}

// ── AI task suggestions based on goal keywords ──────────────────────
function suggestTasksForGoal(goal: PersonalGoal): Array<{ label: string; timeOfDay: 'morning' | 'evening' }> {
  const text = `${goal.title} ${goal.deepWhy ?? ''}`.toLowerCase();

  const checks: Array<{ keywords: string[]; tasks: Array<{ label: string; timeOfDay: 'morning' | 'evening' }> }> = [
    {
      keywords: ['save', 'money', 'budget', 'fund', 'financial', '₱', '$', 'peso', 'income', 'expense'],
      tasks: [
        { label: 'Review monthly budget', timeOfDay: 'morning' },
        { label: 'Track daily expenses', timeOfDay: 'evening' },
        { label: 'Transfer savings to fund', timeOfDay: 'morning' },
        { label: 'Cut one unnecessary subscription', timeOfDay: 'morning' },
        { label: 'Look for extra income opportunity', timeOfDay: 'evening' },
      ],
    },
    {
      keywords: ['health', 'exercise', 'workout', 'fit', 'gym', 'run', 'walk', 'diet', 'weight', 'lose'],
      tasks: [
        { label: 'Morning workout session', timeOfDay: 'morning' },
        { label: 'Drink 8 glasses of water', timeOfDay: 'morning' },
        { label: 'Prepare a healthy meal', timeOfDay: 'morning' },
        { label: 'Take a 30-min walk', timeOfDay: 'evening' },
        { label: 'Track calories for the day', timeOfDay: 'evening' },
      ],
    },
    {
      keywords: ['learn', 'study', 'course', 'skill', 'read', 'book', 'language', 'coding', 'certificate'],
      tasks: [
        { label: 'Complete one lesson or chapter', timeOfDay: 'morning' },
        { label: 'Practice for 30 minutes', timeOfDay: 'morning' },
        { label: 'Review notes from yesterday', timeOfDay: 'evening' },
        { label: 'Watch one tutorial video', timeOfDay: 'morning' },
        { label: 'Apply something learned today', timeOfDay: 'evening' },
      ],
    },
    {
      keywords: ['family', 'relationship', 'friend', 'connect', 'social', 'bond', 'love', 'quality time'],
      tasks: [
        { label: 'Call or message someone important', timeOfDay: 'morning' },
        { label: 'Plan a family activity', timeOfDay: 'morning' },
        { label: 'Have a device-free hour together', timeOfDay: 'evening' },
        { label: 'Write a gratitude note', timeOfDay: 'evening' },
        { label: 'Prepare a meal for family', timeOfDay: 'morning' },
      ],
    },
    {
      keywords: ['business', 'hustle', 'startup', 'client', 'project', 'freelance', 'product', 'market'],
      tasks: [
        { label: 'Reach out to one potential client', timeOfDay: 'morning' },
        { label: 'Work on product for 1 hour', timeOfDay: 'morning' },
        { label: 'Review business metrics', timeOfDay: 'evening' },
        { label: 'Post on social media', timeOfDay: 'morning' },
        { label: 'Follow up with a prospect', timeOfDay: 'morning' },
      ],
    },
    {
      keywords: ['stress', 'peace', 'mindful', 'meditat', 'sleep', 'rest', 'relax', 'mental', 'anxiety'],
      tasks: [
        { label: '10-minute morning meditation', timeOfDay: 'morning' },
        { label: 'Journal thoughts before bed', timeOfDay: 'evening' },
        { label: 'Take a tech break for 30 min', timeOfDay: 'evening' },
        { label: 'Go for a mindful walk', timeOfDay: 'morning' },
        { label: 'Practice deep breathing', timeOfDay: 'morning' },
      ],
    },
  ];

  for (const check of checks) {
    if (check.keywords.some(k => text.includes(k))) {
      return check.tasks.slice(0, 5);
    }
  }

  return [
    { label: 'Work on this goal for 30 minutes', timeOfDay: 'morning' },
    { label: 'Identify the next step forward', timeOfDay: 'morning' },
    { label: 'Reflect on today\'s progress', timeOfDay: 'evening' },
  ];
}

// ──────────────────────────────────────────────
// Main TaskList
// ──────────────────────────────────────────────

export function TaskList({ profile, onNavigateWeek, onPerfectDay, onTasksChange }: Props) {
  const { message } = App.useApp();
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'evening'>('all');
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [deleted, setDeleted] = useState<DeletedMap>({});
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  // Manage tasks
  const [manageTaskOpen, setManageTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<UserTask | null>(null);
  const [defaultTaskGoalId, setDefaultTaskGoalId] = useState<string | undefined>(undefined);
  const [deleteUserTaskTarget, setDeleteUserTaskTarget] = useState<UserTask | null>(null);
  const [deleteMode, setDeleteMode] = useState<'occurrence' | 'entire'>('occurrence');
  const [showTour, setShowTour] = useState(false);
  const [congratTask, setCongratTask] = useState<{ label: string; rows: Array<{ icon: string; label: string; value: string }> } | null>(null);
  const [editingSeedTaskId, setEditingSeedTaskId] = useState<string | null>(null);
  const [seedDeleteMode, setSeedDeleteMode] = useState<'today' | 'permanent'>('permanent');
  const [hiddenSeedIds, setHiddenSeedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`arbol-hidden-seed-${profile.id}`) || '[]')); } catch { return new Set(); }
  });
  const [liveCheckInEnabled, setLiveCheckInEnabled] = useState(() => isLiveCheckInEnabled());
  const [isReportProcessing, setIsReportProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(LOADER_MESSAGES[0]);

  const today = getTodayKey();
  // Filter out seed tasks the user has converted to user tasks (permanently hidden)
  const categories = getTaskCategoriesForProfile(profile.id).map(cat => ({
    ...cat,
    tasks: cat.tasks.filter(t => !hiddenSeedIds.has(t.id)),
  }));
  const allTasks = categories.flatMap(c => c.tasks);
  const allTasksCombined = [
    ...allTasks,
    ...userTasks
      .filter(ut => isTaskScheduledForDate(ut, today))
      .map(ut => ({ id: ut.id, label: ut.label, timeOfDay: ut.timeOfDay, type: ut.type, category: 'user' } as Task)),
  ];

  const loadState = useCallback(() => {
    const s: StatusMap = {};
    const d: DeletedMap = {};
    allTasks.forEach(task => {
      s[task.id] = getTaskStatus(profile.id, task.id, today);
      d[task.id] = isTaskDeleted(profile.id, task.id, today);
    });
    const uts = getUserTasks(profile.id);
    uts.forEach(ut => {
      s[ut.id] = getTaskStatus(profile.id, ut.id, today);
    });
    setStatuses(s);
    setDeleted(d);
    setGoals(getPersonalGoals(profile.id));
    setUserTasks(uts);
  }, [profile.id, today]);

  useEffect(() => {
    loadState();
    const handler = () => loadState();
    window.addEventListener('arbol-goals-updated', handler);
    return () => window.removeEventListener('arbol-goals-updated', handler);
  }, [loadState]);

  useEffect(() => {
    fetchLiveCheckInSettings().then(s => setLiveCheckInEnabled(s.enabled));
  }, []);

  useEffect(() => {
    if (!isReportProcessing) return;
    let idx = 0;
    setProcessingMessage(LOADER_MESSAGES[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADER_MESSAGES.length;
      setProcessingMessage(LOADER_MESSAGES[idx]);
    }, 500);
    return () => clearInterval(interval);
  }, [isReportProcessing]);

  const runLiveFeedback = useCallback((params: {
    taskId: string; taskTitle: string; status?: TaskStatus | null; note?: string;
  }) => {
    if (!liveCheckInEnabled || isReportProcessing) return;
    setIsReportProcessing(true);
    const delay = randomProcessingDelayMs();
    setTimeout(() => {
      submitReportUpdate({
        profileId: profile.id,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
        status: params.status,
        note: params.note,
      });
      loadState();
      setIsReportProcessing(false);
      document.getElementById('live-check-in-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, delay);
  }, [profile.id, liveCheckInEnabled, isReportProcessing, loadState]);

  // Auto-start tasks tour on first visit
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEYS.tasks)) {
      const t = setTimeout(() => setShowTour(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const cycleStatus = (task: Task) => {
    trackActivity(profile.id);
    const next = nextStatus(statuses[task.id]);
    setTaskStatus(profile.id, task.id, today, next);
    const newStatuses = { ...statuses, [task.id]: next };
    setStatuses(newStatuses);

    const newVisible = allTasksCombined.filter(t => !deleted[t.id]);
    const newPending = newVisible.filter(t => (t.id === task.id ? next : newStatuses[t.id]) !== 'done').length;
    onTasksChange?.(newPending);

    if (next === 'done') {
      if (task.valueType && task.estimatedValue) {
        import('../data/valueTracking').then(({ trackValue, formatValueMessage }) => {
          trackValue(profile.id, task.valueType!, task.estimatedValue!);
          const { message: valueMsg, icon } = formatValueMessage(task.valueType!, task.estimatedValue!, 'immediate');
          message.success({ content: `${icon} ${valueMsg}`, duration: 3 });
        });
      }

      const allDone = newVisible.length > 0 && newVisible.every(t =>
        (t.id === task.id ? next : newStatuses[t.id]) === 'done'
      );
      if (allDone) {
        const seenKey = `badges-seen-${profile.id}`;
        const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) || '[]'));
        const earned = getEarnedBadges(profile);
        const newBadges = earned.filter(b => !seen.has(b.id));
        earned.forEach(b => seen.add(b.id));
        localStorage.setItem(seenKey, JSON.stringify([...seen]));
        if (onPerfectDay) onPerfectDay(newBadges);
        else message.success({ content: '🎉 All tasks done! Streak extended!', duration: 3 });
      }

      if (liveCheckInEnabled) {
        runLiveFeedback({ taskId: task.id, taskTitle: task.label, status: 'done' });
      }
    }
  };

  const doDelete = () => {
    if (!pendingDelete) return;
    if (seedDeleteMode === 'permanent') {
      permanentlyHideSeedTask(pendingDelete.id);
      message.info('Task permanently removed');
    } else {
      markTaskDeleted(profile.id, pendingDelete.id, today);
      message.info('Task skipped for today');
    }
    const newDeleted = { ...deleted, [pendingDelete.id]: true };
    setDeleted(newDeleted);
    setPendingDelete(null);
    const newVisible = allTasksCombined.filter(t => !newDeleted[t.id]);
    onTasksChange?.(newVisible.filter(t => statuses[t.id] !== 'done').length);
  };

  const permanentlyHideSeedTask = (taskId: string) => {
    setHiddenSeedIds(prev => {
      const next = new Set(prev);
      next.add(taskId);
      localStorage.setItem(`arbol-hidden-seed-${profile.id}`, JSON.stringify([...next]));
      return next;
    });
  };

  // Open edit modal for ANY task (seed or user)
  const handleEditAnyTask = (task: UserTask_, currentGoalId?: string) => {
    const existingUserTask = userTasks.find(u => u.id === task.id);
    if (existingUserTask) {
      setEditingTask(existingUserTask);
      setEditingSeedTaskId(null);
    } else {
      // Seed task - build a fake UserTask to pre-populate modal
      setEditingTask({
        id: task.id, profileId: profile.id,
        label: task.label, timeOfDay: task.timeOfDay, type: task.type,
        goalId: currentGoalId, createdAt: 0,
      } as UserTask);
      setEditingSeedTaskId(task.id);
    }
    setManageTaskOpen(true);
  };

  // User task management
  const handleSaveUserTask = (data: Omit<UserTask, 'id' | 'profileId' | 'createdAt'> & { applyTo?: 'this' | 'all' }) => {
    const { applyTo, ...taskData } = data;
    const isNewTask = !editingTask && !editingSeedTaskId;
    const isSeedConversion = !!editingSeedTaskId;

    if (editingSeedTaskId) {
      createUserTask(profile.id, taskData);
      permanentlyHideSeedTask(editingSeedTaskId);
      setEditingSeedTaskId(null);
    } else if (editingTask) {
      if (applyTo === 'this') {
        createUserTask(profile.id, {
          ...taskData,
          recurrence: { type: 'one-time', specificDate: today },
        });
        skipTaskOccurrence(profile.id, editingTask.id, today);
      } else {
        updateUserTask(profile.id, editingTask.id, taskData);
      }
    } else {
      createUserTask(profile.id, taskData);
    }
    setManageTaskOpen(false);
    setEditingTask(null);
    loadState();

    // Show congrat modal for new task creation (not edits)
    if (isNewTask || isSeedConversion) {
      const linkedGoal = goals.find(g => g.id === taskData.goalId);
      setCongratTask({
        label: taskData.label,
        rows: [
          {
            icon: taskData.timeOfDay === 'morning' ? '☀️' : '🌙',
            label: 'Time of day',
            value: taskData.timeOfDay === 'morning' ? 'Morning' : 'Evening',
          },
          {
            icon: '🔁',
            label: 'Schedule',
            value: recurrenceLabel(taskData.recurrence),
          },
          ...(linkedGoal ? [{
            icon: '🎯',
            label: 'Linked to goal',
            value: linkedGoal.title,
          }] : []),
        ],
      });
    }
  };

  const handleDeleteUserTask = () => {
    if (!deleteUserTaskTarget) return;
    if (isRecurringUT(deleteUserTaskTarget) && deleteMode === 'occurrence') {
      skipTaskOccurrence(profile.id, deleteUserTaskTarget.id, today);
    } else {
      deleteUserTask(profile.id, deleteUserTaskTarget.id);
    }
    setDeleteUserTaskTarget(null);
    loadState();
  };

  const openDeleteUserTask = (task: UserTask) => {
    setDeleteMode(isRecurringUT(task) ? 'occurrence' : 'entire');
    setDeleteUserTaskTarget(task);
  };

  const handleAddSuggestedTask = (label: string, goalId: string) => {
    createUserTask(profile.id, { label, goalId, timeOfDay: 'morning', type: 'goal' });
    message.success({ content: `Task added!`, duration: 2 });
    loadState();
  };

  // Build goal → tasks map directly (no category layer)
  const goalTaskMap: Record<string, UserTask_[]> = {};
  goals.forEach(g => { goalTaskMap[g.id] = []; });
  const ungroupedTasks: UserTask_[] = [];

  // Seed tasks from categories
  categories.forEach(cat => {
    cat.tasks.forEach(t => {
      const taskObj: UserTask_ = { ...t };
      if (cat.goalId && goalTaskMap[cat.goalId] !== undefined) {
        goalTaskMap[cat.goalId].push(taskObj);
      } else {
        ungroupedTasks.push(taskObj);
      }
    });
  });

  // User tasks - only include those scheduled for today
  userTasks.filter(ut => isTaskScheduledForDate(ut, today)).forEach(ut => {
    const taskObj: UserTask_ = {
      id: ut.id, label: ut.label, timeOfDay: ut.timeOfDay, type: ut.type,
      category: 'user', isUserCreated: true, recurrence: ut.recurrence,
    };
    if (ut.goalId && goalTaskMap[ut.goalId] !== undefined) {
      goalTaskMap[ut.goalId].push(taskObj);
    } else {
      ungroupedTasks.push(taskObj);
    }
  });

  const visible = allTasksCombined.filter(t =>
    !deleted[t.id] && (timeFilter === 'all' || t.timeOfDay === timeFilter)
  );
  const done = visible.filter(t => statuses[t.id] === 'done').length;
  const overallPct = visible.length > 0 ? Math.round((done / visible.length) * 100) : 0;
  const isEmpty = categories.length === 0 && userTasks.length === 0;

  return (
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 100px', background: C.bg, minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>My Tasks</h2>
          <p style={{ margin: '4px 0 0', color: C.body, fontSize: 13 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <PageTourButton onClick={() => setShowTour(true)} />
      </div>
      <p style={{ margin: '0 0 16px', color: C.secondary, fontSize: 13, lineHeight: 1.5 }}>
        Complete the tasks that move your goals forward.
      </p>

      {/* Overall progress */}
      {!isEmpty && (
        <div data-tour-id="tasks-list" style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '14px 18px', marginBottom: 16, boxShadow: C.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: C.body, fontSize: 13 }}>Overall today</span>
            <span style={{ color: C.primary, fontWeight: 700, fontSize: 13 }}>{done}/{visible.length}</span>
          </div>
          <Progress percent={overallPct} strokeColor={{ '0%': C.primary, '100%': C.headline }}
            railColor={C.bgAlt} showInfo={false} size={['100%', 8]} />
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12 }}>
            {(['inprogress', 'done'] as TaskStatus[]).map(s => {
              const count = visible.filter(t => statuses[t.id] === s).length;
              return (
                <span key={s} style={{ color: STATUS_META[s].color, fontWeight: 600 }}>
                  {STATUS_META[s].dot} {count} {STATUS_META[s].label}
                </span>
              );
            })}
            <span style={{ color: C.secondary }}>
              ○ {visible.filter(t => !statuses[t.id]).length} Not started
            </span>
          </div>
        </div>
      )}

      {liveCheckInEnabled && !isEmpty && (
        <LiveCheckInFeedbackCard
          profileId={profile.id}
          isProcessing={isReportProcessing}
          processingMessage={processingMessage}
        />
      )}

      {/* Time filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {([
          { key: 'all',     label: 'All tasks' },
          { key: 'morning', label: '☀️ Morning' },
          { key: 'evening', label: '🌙 Evening' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTimeFilter(key)} style={{
            padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
            background: timeFilter === key ? C.primary : C.bgAlt,
            color: timeFilter === key ? '#fff' : C.secondary,
            fontWeight: timeFilter === key ? 700 : 400, fontSize: 12,
            border: `1px solid ${timeFilter === key ? C.primary : C.border}`,
            transition: 'all 0.18s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Week Plan CTA - sticky at top of content */}
      {onNavigateWeek && (
        <div
          onClick={onNavigateWeek}
          style={{
            marginBottom: 16, background: `linear-gradient(135deg, ${C.headline}, #1a6da8)`,
            borderRadius: 14, padding: '12px 16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 16px rgba(9,64,103,0.18)',
          }}
        >
          <span style={{ fontSize: 20 }}>📅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>View Weekly Plan</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Plan ahead and stay on track</div>
          </div>
          <ArrowRightOutlined style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }} />
        </div>
      )}

      {/* Goals > Tasks hierarchy */}
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: C.headline, marginBottom: 8 }}>No tasks today</div>
          <div style={{ color: C.body, fontSize: 13 }}>Enjoy your day off or check the Week Plan!</div>
        </div>
      ) : (
        <>
          {/* Goal-grouped categories */}
          {goals.map((goal, idx) => (
            <div key={goal.id} {...(idx === 0 ? { 'data-tour-id': 'tasks-goal-group' } : {})}>
              <GoalGroup
                goal={goal}
                tasks={goalTaskMap[goal.id] ?? []}
                statuses={statuses} deleted={deleted}
                onCycle={cycleStatus}
                onDelete={t => t.isUserCreated ? openDeleteUserTask(t as UserTask) : (setSeedDeleteMode('permanent'), setPendingDelete(t))}
                timeFilter={timeFilter}
                isFirst={idx === 0}
                onEditTask={t => handleEditAnyTask(t, goal.id)}
                onAddSuggestedTask={handleAddSuggestedTask}
              />
            </div>
          ))}

          {/* Routines - tasks not linked to any goal */}
          {ungroupedTasks.filter(t => (timeFilter === 'all' || t.timeOfDay === timeFilter) && !deleted[t.id]).length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Routines
                </span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              {ungroupedTasks
                .filter(t => (timeFilter === 'all' || t.timeOfDay === timeFilter) && !deleted[t.id])
                .map(task => (
                  <TaskItem
                    key={task.id} task={task} catColor={C.secondary}
                    status={statuses[task.id] ?? null}
                    onCycle={() => cycleStatus(task)}
                    onDelete={() => task.isUserCreated ? openDeleteUserTask(task as UserTask) : (setSeedDeleteMode('permanent'), setPendingDelete(task))}
                    onEdit={() => handleEditAnyTask(task, undefined)}
                  />
                ))}
            </div>
          )}
        </>
      )}

      {/* FAB - Add Task */}
      <button
        data-tour-id="tasks-add-btn"
        onClick={() => { setEditingTask(null); setManageTaskOpen(true); }}
        style={{
          position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 12px)', right: 20, zIndex: 48,
          width: 52, height: 52, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
          border: 'none', cursor: 'pointer', color: '#fff', fontSize: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 6px 24px ${C.primary}50`,
        }}
        title="Add task"
      >
        <PlusOutlined />
      </button>


      {/* ── Manage Modals ── */}

      <ManageTaskModal
        open={manageTaskOpen}
        task={editingTask}
        defaultGoalId={defaultTaskGoalId}
        goals={goals}
        currentDate={today}
        onSave={handleSaveUserTask}
        onCancel={() => { setManageTaskOpen(false); setEditingTask(null); setDefaultTaskGoalId(undefined); setEditingSeedTaskId(null); }}
      />

      {/* Delete user task confirmation */}
      <Modal
        open={!!deleteUserTaskTarget}
        onCancel={() => setDeleteUserTaskTarget(null)}
        footer={null} closable={false} centered
        width="min(360px, calc(100vw - 24px))"
        styles={{
          content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div style={{ padding: '28px 24px 24px' }}>
          <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>🗑️</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: C.headline, textAlign: 'center' }}>Delete task?</h3>
          <p style={{ color: C.body, fontSize: 13, margin: '0 0 16px', lineHeight: 1.5, textAlign: 'center' }}>
            <strong style={{ color: C.headline }}>"{deleteUserTaskTarget?.label}"</strong>
          </p>

          {/* Scope selector - only for recurring tasks */}
          {deleteUserTaskTarget && isRecurringUT(deleteUserTaskTarget) && (
            <div style={{ marginBottom: 16 }}>
              {([
                { value: 'occurrence' as const, label: 'This occurrence only', sub: 'Skips today, task continues on future dates' },
                { value: 'entire' as const, label: 'Entire recurring task', sub: 'Removes this task permanently' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDeleteMode(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
                    background: deleteMode === opt.value ? `${C.tertiary}10` : C.bgCard,
                    border: `1.5px solid ${deleteMode === opt.value ? C.tertiary + '60' : C.border}`,
                    borderRadius: 10, padding: '9px 12px', cursor: 'pointer', marginBottom: 6,
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    border: `2px solid ${deleteMode === opt.value ? C.tertiary : C.secondary}`,
                    background: deleteMode === opt.value ? C.tertiary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {deleteMode === opt.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: deleteMode === opt.value ? C.tertiary : C.headline }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: C.secondary, marginTop: 1 }}>{opt.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button block onClick={() => setDeleteUserTaskTarget(null)}
              style={{ borderRadius: 12, height: 44, border: `1px solid ${C.border}`, color: C.body, flex: 1 }}>
              Keep It
            </Button>
            <Button block type="primary" onClick={handleDeleteUserTask}
              style={{ borderRadius: 12, height: 44, background: C.tertiary, border: 'none', flex: 1 }}>
              {deleteUserTaskTarget && isRecurringUT(deleteUserTaskTarget) && deleteMode === 'occurrence' ? 'Skip Today' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete seed task confirmation */}
      <Modal
        open={!!pendingDelete} onCancel={() => setPendingDelete(null)}
        footer={null} closable={false} centered
        width="min(360px, calc(100vw - 24px))"
        styles={{
          content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div style={{ padding: '28px 24px 24px' }}>
          <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>🗑️</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: C.headline, textAlign: 'center' }}>Remove task?</h3>
          <p style={{ color: C.body, fontSize: 13, margin: '0 0 16px', lineHeight: 1.5, textAlign: 'center' }}>
            <strong style={{ color: C.headline }}>"{pendingDelete?.label}"</strong>
          </p>

          <div style={{ marginBottom: 16 }}>
            {([
              { value: 'today' as const, label: 'Skip just today', sub: 'Task will return tomorrow as usual' },
              { value: 'permanent' as const, label: 'Remove forever', sub: 'Permanently hidden from your task list' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSeedDeleteMode(opt.value)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
                  background: seedDeleteMode === opt.value ? `${C.tertiary}10` : C.bgCard,
                  border: `1.5px solid ${seedDeleteMode === opt.value ? C.tertiary + '60' : C.border}`,
                  borderRadius: 10, padding: '9px 12px', cursor: 'pointer', marginBottom: 6,
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  border: `2px solid ${seedDeleteMode === opt.value ? C.tertiary : C.secondary}`,
                  background: seedDeleteMode === opt.value ? C.tertiary : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {seedDeleteMode === opt.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: seedDeleteMode === opt.value ? C.tertiary : C.headline }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: C.secondary, marginTop: 1 }}>{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button block onClick={() => setPendingDelete(null)}
              style={{ borderRadius: 12, height: 44, border: `1px solid ${C.border}`, color: C.body, flex: 1 }}>
              Keep It
            </Button>
            <Button block type="primary" onClick={doDelete}
              style={{ borderRadius: 12, height: 44, background: C.tertiary, border: 'none', flex: 1 }}>
              {seedDeleteMode === 'today' ? 'Skip Today' : 'Remove Forever'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Task created congrat modal */}
      {congratTask && (
        <CongratModal
          open={!!congratTask}
          type="task"
          title={congratTask.label}
          rows={congratTask.rows}
          onClose={() => setCongratTask(null)}
        />
      )}

      {/* ── Tasks Page Tour */}
      <PageTour
        open={showTour}
        onClose={() => setShowTour(false)}
        storageKey={TOUR_KEYS.tasks}
        pageLabel="Tasks"
        doneEmoji="✅"
        doneMessage="You know how Tasks work. Mark tasks done as you go - every checkmark builds your streak!"
        onInteract={() => { setEditingTask(null); setManageTaskOpen(true); }}
        interactLabel="Add a task now →"
        steps={[
          {
            title: '📊 Overall Progress',
            description: 'See how many tasks you\'ve completed today and your overall percentage. Done + in-progress + not started at a glance.',
            target: () => document.querySelector('[data-tour-id="tasks-list"]') as HTMLElement | null,
            placement: 'bottom',
          },
          {
            title: '🏆 Goal Groups',
            description: 'Tasks are grouped by goal, each with a circular progress ring. Tap the group header to expand or collapse the tasks inside.',
            target: () => document.querySelector('[data-tour-id="tasks-goal-group"]') as HTMLElement | null,
            placement: 'bottom',
          },
          {
            title: '☀️ Task Items',
            description: 'Tap any task to cycle through: Not started → In Progress → Done. Each task shows morning 🌅 or evening 🌙 timing.',
            target: () => document.querySelector('[data-tour-id="tasks-goal-group"]') as HTMLElement | null,
            placement: 'bottom',
          },
          {
            title: '➕ Add a Task',
            description: 'Create daily, weekly, or one-time tasks and link them to a goal. Tap below to try adding your first task!',
            target: () => document.querySelector('[data-tour-id="tasks-add-btn"]') as HTMLElement | null,
            placement: 'left',
          },
        ]}
      />

    </div>
  );
}
