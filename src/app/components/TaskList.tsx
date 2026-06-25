import { useState, useEffect, useCallback } from 'react';
import { App, Button, Progress } from 'antd';
import { DeleteOutlined, CheckCircleFilled, PlayCircleOutlined, ArrowRightOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  type Profile, type Task, type TaskStatus,
  getTaskCategoriesForProfile, getTaskStatus, setTaskStatus,
  isTaskSkippedForDate, markTaskDeleted, permanentlyHideSeedTask, getTodayKey,
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
import { DeleteTaskModal, type DeleteTaskChoice } from './DeleteTaskModal';
import { C } from '../data/colors';
import { trackActivity } from '../data/feedback';
import { PageTour, PageTourButton, TOUR_KEYS } from './AppTour';
import { CongratModal } from './CongratModal';
import { MomentumUpdateModal } from './MomentumUpdateModal';
import { TaskUpdateModal, type TaskUpdateContext } from './TaskUpdateModal';
import { TASK_STATUS_DISPLAY } from './TaskStatusSelector';
import { LiveCheckInFeedbackCard } from './LiveCheckInFeedbackCard';
import {
  submitReportUpdate, saveTaskNote, dispatchFeedbackUpdated, type ReportEntry,
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

const STATUS_META: Record<TaskStatus, { label: string; dot: string; color: string }> = {
  inprogress: { label: 'In Progress', dot: '◑', color: '#f5a623' },
  done:       { label: 'Done',        dot: '●', color: '#2cb67d' },
};


function taskDurationLabel(task: UserTask_): string {
  return task.timeOfDay === 'morning' ? '☀️ Morning' : '🌙 Evening';
}

// ── Task item
function TaskItem({
  task, catColor, status, onOpenUpdate, onDelete, onEdit,
}: {
  task: UserTask_; catColor: string; status: TaskStatus | null;
  onOpenUpdate: () => void; onDelete: () => void;
  onEdit?: () => void;
}) {
  const display = status ? TASK_STATUS_DISPLAY[status] : TASK_STATUS_DISPLAY.null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenUpdate}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenUpdate(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
        background: display.bg,
        borderRadius: 14, border: `1.5px solid ${status ? display.color + '35' : C.border}`,
        marginBottom: 8, transition: 'all 0.2s', cursor: 'pointer',
        boxShadow: status === 'done' ? 'none' : C.shadow,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: status === 'done' ? display.color : status === 'inprogress' ? display.color : '#fff',
        border: status ? 'none' : `2px solid ${C.borderStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {status === 'done'
          ? <CheckCircleFilled style={{ color: '#fff', fontSize: 18 }} />
          : status === 'inprogress'
          ? <PlayCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
          : null
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: status === 'done' ? C.secondary : C.headline,
          textDecoration: status === 'done' ? 'line-through' : 'none',
          lineHeight: 1.3,
        }}>
          {task.label}
        </div>
        <div style={{ fontSize: 11, color: C.secondary, marginTop: 3 }}>
          {taskDurationLabel(task)}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, marginTop: 4,
          color: display.color,
        }}>
          {display.label}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        {onEdit && (
          <button onClick={onEdit} type="button" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.secondary,
            fontSize: 13, padding: 10, borderRadius: 8, minWidth: 40, minHeight: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.background = `${C.primary}12`; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.secondary; e.currentTarget.style.background = 'none'; }}
          >
            <EditOutlined />
          </button>
        )}
        <button onClick={onDelete} type="button" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: C.secondary,
          fontSize: 15, padding: 10, borderRadius: 8, minWidth: 40, minHeight: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
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
  goal, tasks, statuses, deleted, onOpenUpdate, onDelete, timeFilter,
  onEditTask, onAddSuggestedTask, isFirst,
}: {
  goal: PersonalGoal; tasks: UserTask_[];
  statuses: StatusMap; deleted: DeletedMap;
  onOpenUpdate: (t: Task, goal: PersonalGoal, doneCount: number, totalCount: number) => void;
  onDelete: (t: UserTask_) => void;
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
              onOpenUpdate={() => onOpenUpdate(task, goal, doneTasks, totalTasks)}
              onDelete={() => onDelete(task)}
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; isUserCreated: boolean } | null>(null);
  const [deleteChoice, setDeleteChoice] = useState<DeleteTaskChoice>('today');
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  // Manage tasks
  const [manageTaskOpen, setManageTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<UserTask | null>(null);
  const [defaultTaskGoalId, setDefaultTaskGoalId] = useState<string | undefined>(undefined);
  const [showTour, setShowTour] = useState(false);
  const [congratTask, setCongratTask] = useState<{ label: string; rows: Array<{ icon: string; label: string; value: string }> } | null>(null);
  const [editingSeedTaskId, setEditingSeedTaskId] = useState<string | null>(null);
  const [liveCheckInEnabled, setLiveCheckInEnabled] = useState(() => isLiveCheckInEnabled());
  const [momentumEntry, setMomentumEntry] = useState<ReportEntry | null>(null);
  const [taskUpdateContext, setTaskUpdateContext] = useState<TaskUpdateContext | null>(null);

  const today = getTodayKey();
  const categories = getTaskCategoriesForProfile(profile.id);
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
      d[task.id] = isTaskSkippedForDate(profile.id, task.id, today);
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
    window.addEventListener('arbol-tasks-updated', handler);
    return () => {
      window.removeEventListener('arbol-goals-updated', handler);
      window.removeEventListener('arbol-tasks-updated', handler);
    };
  }, [loadState]);

  useEffect(() => {
    fetchLiveCheckInSettings().then(s => setLiveCheckInEnabled(s.enabled));
  }, []);

  const handleMomentumContinue = useCallback(() => {
    setMomentumEntry(null);
  }, []);

  const handleViewFeedback = useCallback(() => {
    setMomentumEntry(null);
    requestAnimationFrame(() => {
      document.getElementById('live-check-in-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  // Auto-start tasks tour on first visit
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEYS.tasks)) {
      const t = setTimeout(() => setShowTour(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { id, label, isUserCreated } = deleteTarget;
    const userTask = isUserCreated ? userTasks.find(u => u.id === id) : undefined;

    if (deleteChoice === 'today') {
      if (isUserCreated && userTask && isRecurringUT(userTask)) {
        skipTaskOccurrence(profile.id, id, today);
        message.info('Task skipped for today');
      } else {
        markTaskDeleted(profile.id, id, today);
        message.info('Task skipped for today');
      }
    } else if (isUserCreated) {
      deleteUserTask(profile.id, id);
      message.info(`"${label}" permanently removed`);
    } else {
      permanentlyHideSeedTask(profile.id, id);
      message.info('Task permanently removed');
    }

    const newDeleted = { ...deleted, [id]: deleteChoice === 'today' };
    setDeleted(newDeleted);
    setDeleteTarget(null);
    loadState();
    const newVisible = allTasksCombined.filter(t => !newDeleted[t.id]);
    onTasksChange?.(newVisible.filter(t => statuses[t.id] !== 'done').length);
  };

  const openDeleteTask = (task: UserTask_) => {
    setDeleteChoice('today');
    setDeleteTarget({
      id: task.id,
      label: task.label,
      isUserCreated: !!task.isUserCreated,
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
      permanentlyHideSeedTask(profile.id, editingSeedTaskId);
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

  const openTaskUpdate = (
    task: Task,
    goal?: PersonalGoal,
    doneCount = 0,
    totalCount = 0,
  ) => {
    setTaskUpdateContext({
      taskId: task.id,
      taskLabel: task.label,
      timeOfDay: task.timeOfDay,
      goalTitle: goal?.title,
      goalWhy: goal?.deepWhy,
      goalProgressPct: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : undefined,
      goalDoneCount: doneCount,
      goalTotalCount: totalCount,
    });
  };

  const handleTaskUpdateSubmit = (status: TaskStatus | null, note: string) => {
    if (!taskUpdateContext) return;
    trackActivity(profile.id);
    const { taskId, taskLabel } = taskUpdateContext;
    const prevStatus = statuses[taskId] ?? null;

    let entry: ReportEntry | null = null;
    if (liveCheckInEnabled) {
      entry = submitReportUpdate({
        profileId: profile.id,
        taskId,
        taskTitle: taskLabel,
        status,
        note,
        previousStatus: prevStatus,
      });
    } else {
      setTaskStatus(profile.id, taskId, today, status);
      saveTaskNote(profile.id, taskId, today, note);
      try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
      dispatchFeedbackUpdated();
    }

    const newStatuses = { ...statuses, [taskId]: status };
    setStatuses(newStatuses);
    setTaskUpdateContext(null);
    loadState();

    const newVisible = allTasksCombined.filter(t => !deleted[t.id]);
    const newPending = newVisible.filter(t => (newStatuses[t.id] ?? null) !== 'done').length;
    onTasksChange?.(newPending);
    message.success({ content: 'Progress saved!', duration: 2 });

    if (status === 'done') {
      const task = allTasksCombined.find(t => t.id === taskId);
      if (task?.valueType && task.estimatedValue) {
        import('../data/valueTracking').then(({ trackValue, formatValueMessage }) => {
          trackValue(profile.id, task.valueType!, task.estimatedValue!);
          const { message: valueMsg, icon } = formatValueMessage(task.valueType!, task.estimatedValue!, 'immediate');
          message.success({ content: `${icon} ${valueMsg}`, duration: 3 });
        });
      }

      const allDone = newVisible.length > 0 && newVisible.every(t =>
        (newStatuses[t.id] ?? null) === 'done',
      );
      const isPerfectDay = allDone && !!onPerfectDay;
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

      if (liveCheckInEnabled && entry) {
        setMomentumEntry(entry);
        if (isPerfectDay) setMomentumEntry(null);
      }
    } else if (liveCheckInEnabled && entry) {
      setMomentumEntry(entry);
    }
  };

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
        <LiveCheckInFeedbackCard profileId={profile.id} />
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
                onOpenUpdate={openTaskUpdate}
                onDelete={t => openDeleteTask(t)}
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
                    onOpenUpdate={() => openTaskUpdate(task)}
                    onDelete={() => openDeleteTask(task)}
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

      <DeleteTaskModal
        open={!!deleteTarget}
        taskLabel={deleteTarget?.label ?? ''}
        choice={deleteChoice}
        onChoiceChange={setDeleteChoice}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <TaskUpdateModal
        open={!!taskUpdateContext}
        context={taskUpdateContext}
        profileId={profile.id}
        dateKey={today}
        initialStatus={taskUpdateContext ? (statuses[taskUpdateContext.taskId] ?? null) : null}
        onClose={() => setTaskUpdateContext(null)}
        onSubmit={handleTaskUpdateSubmit}
      />

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

      <MomentumUpdateModal
        open={!!momentumEntry}
        entry={momentumEntry}
        profileId={profile.id}
        onContinue={handleMomentumContinue}
        onViewFeedback={handleViewFeedback}
      />

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
            description: 'See how many tasks you\'ve completed today at a glance.',
            targetId: 'tasks-list',
            placement: 'bottom',
          },
          {
            title: '💬 Your Progress Coach',
            description: 'This updates as you complete tasks and goals. Use it to understand your momentum and what to focus on next.',
            targetId: 'tasks-live-checkin',
            placement: 'bottom',
          },
          {
            title: '🏆 Goal Groups',
            description: 'Tasks are grouped by goal. Tap a group header to expand or collapse.',
            targetId: 'tasks-goal-group',
            placement: 'bottom',
          },
          {
            title: '➕ Add a Task',
            description: 'Create daily, weekly, or one-time tasks and link them to a goal.',
            targetId: 'tasks-add-btn',
            placement: 'left',
          },
        ]}
      />

    </div>
  );
}
