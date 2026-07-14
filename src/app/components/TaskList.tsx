import { useState, useEffect, useCallback } from 'react';
import { App, Button, Progress } from 'antd';
import { DeleteOutlined, CheckCircleFilled, PlayCircleOutlined, EditOutlined, PlusOutlined, CloseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  type Profile, type Task, type TaskStatus,
  getTaskCategoriesForProfile, getTaskStatus,
  skipTaskForToday, permanentlyHideSeedTask, permanentlyHideSeedTasksByLabel, getTodayKey, getPermanentlyHiddenSeedTaskIds,
  getEarnedBadges, type Badge, isFreshProfile,
} from '../data/profiles';
import { isUserDefinedProfile } from '../data/customProfiles';
import {
  getPersonalGoals,
  createUserGoal,
  type PersonalGoal,
} from '../data/personalGoals';

import {
  getUserTasks, createUserTask, updateUserTask, deleteUserTask,
  orphanUserTasksForGoal, isTaskScheduledForDate, skipTaskOccurrence,
  recurrenceLabel, isOverdueUserTask, archiveUserTask, restoreUserTask,
  type UserTask, type Recurrence,
} from '../data/userTasks';
import {
  buildAllTasksInventory,
  filterInventoryTasks,
  type TaskStatusFilter,
  type InventoryTask,
} from '../data/tasksInventory';
import { ManageTaskModal } from './ManageTaskModal';
import { ContextAssistModal } from './ContextAssistModal';
import { SimplifyTaskModal } from './SimplifyTaskModal';
import { DeleteTaskModal, type DeleteTaskChoice } from './DeleteTaskModal';
import { TasksMonthView } from './TasksMonthView';
import { C } from '../data/colors';
import { getDisplayPotentialValue } from '../data/potentialValue';
import {
  mergeSeedForProfile,
  seedAsEditableUserTask,
  setSeedOverride,
  setSeedOverrideForSameLabel,
  getSeedOverride,
  applySeedOverride,
  clearSeedOverride,
  type SeedTaskOverride,
} from '../data/seedOverrides';
import { touchIconButton, touchPrimaryButton, MIN_TOUCH } from '../styles/touchTargets';
import type { SeedSuggestionGroup } from '../data/profileSeedParser';
import { trackActivity } from '../data/feedback';
import { PageTour, PageTourButton, TOUR_KEYS, tourStorageKey, areToursDismissedForProfile } from './AppTour';
import { CongratModal } from './CongratModal';
import { MomentumUpdateModal } from './MomentumUpdateModal';
import { TaskUpdateModal, type TaskUpdateContext } from './TaskUpdateModal';
import { TASK_STATUS_DISPLAY } from './TaskStatusSelector';
import { LiveCheckInFeedbackCard } from './LiveCheckInFeedbackCard';
import { getTaskNote, type ReportEntry } from '../data/liveCheckInFeedback';
import { applyTaskStatusUpdate } from '../data/taskStatusPipeline';
import { isLiveCheckInEnabled, fetchLiveCheckInSettings } from '../data/liveCheckInSettings';
import { useScrollPositionLock } from '../hooks/useScrollPositionLock';
import { truncateRemark, SKIPPED_BADGE, shouldShowRemark } from './taskCardDisplay';
import { TaskCalendarButton } from './TaskCalendarButton';
import { getEffectiveDaySyncDateKey } from '../data/calendarExport';
import {
  getPrimaryGoalIdForTask,
  setPrimaryGoalLinkForTask,
  clearUserGoalLinksForTask,
} from '../data/taskGoalLinks';

interface Props {
  profile: Profile;
  onNavigateWeek?: () => void;
  onPerfectDay?: (newBadges: Badge[]) => void;
  onTasksChange?: (pending: number) => void;
}

type StatusMap = Record<string, TaskStatus | null>;
type NotesMap = Record<string, string>;
type UserTask_ = Task & {
  isUserCreated?: boolean;
  recurrence?: Recurrence;
  potentialValue?: UserTask['potentialValue'];
  description?: string;
  archivedAt?: number;
  scheduleLabel?: string;
  goalId?: string;
};

type TaskViewMode = 'all' | 'today' | 'month';

function taskViewStorageKey(profileId: string) {
  return `arbol-task-view-${profileId}`;
}

function loadTaskView(profileId: string): TaskViewMode {
  const v = localStorage.getItem(taskViewStorageKey(profileId));
  if (v === 'all' || v === 'today' || v === 'month') return v;
  return 'all';
}

function isRecurringUT(task: UserTask): boolean {
  return !!task.recurrence && task.recurrence.type !== 'daily' && task.recurrence.type !== 'one-time';
}

function pvEqual(
  a?: UserTask['potentialValue'] | null,
  b?: UserTask['potentialValue'] | null,
): boolean {
  const da = a ? getDisplayPotentialValue(a) : null;
  const db = b ? getDisplayPotentialValue(b) : null;
  if (!da && !db) return true;
  if (!da || !db) return false;
  return da.score === db.score;
}

function recurrenceEqual(a?: Recurrence, b?: Recurrence): boolean {
  const na = !a || a.type === 'daily' ? undefined : a;
  const nb = !b || b.type === 'daily' ? undefined : b;
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  return JSON.stringify(na) === JSON.stringify(nb);
}

const STATUS_META: Record<TaskStatus, { label: string; dot: string; color: string }> = {
  inprogress: { label: 'In Progress', dot: '◑', color: '#f5a623' },
  done:       { label: 'Done',        dot: '●', color: '#2cb67d' },
  skipped:    { label: 'Skipped',     dot: '✕', color: '#90b4ce' },
};


function taskDurationLabel(task: UserTask_): string {
  return task.timeOfDay === 'morning' ? '☀️ Morning' : '🌙 Evening';
}

// ── Task item
function TaskItem({
  task, catColor, status, remark, onOpenUpdate, onDelete, onEdit, onSimplify, onArchive, onRestore, statusLocked,
  profileId, profileName, calendarDateKey, statusHint,
  selectionMode, selected, onToggleSelect,
}: {
  task: UserTask_; catColor: string; status: TaskStatus | null; remark?: string;
  onOpenUpdate: () => void; onDelete: () => void;
  onEdit?: () => void;
  onSimplify?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  statusLocked?: boolean;
  profileId: string;
  profileName: string;
  calendarDateKey: string;
  statusHint?: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const isSkipped = status === 'skipped';
  const display = status ? TASK_STATUS_DISPLAY[status] : TASK_STATUS_DISPLAY.null;
  const remarkText = remark ? truncateRemark(remark) : '';
  const showRemark = shouldShowRemark(status, remarkText);
  const scheduleText = task.scheduleLabel
    || (task.recurrence ? recurrenceLabel(task.recurrence) : null);

  const handleActivate = () => {
    if (selectionMode) {
      onToggleSelect?.();
      return;
    }
    if (statusLocked) {
      onEdit?.();
      return;
    }
    onOpenUpdate();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
        background: isSkipped ? display.bg : display.bg,
        borderRadius: 14,
        border: `1.5px solid ${isSkipped ? `${C.tertiary}25` : status ? display.color + '35' : C.border}`,
        marginBottom: 8, transition: 'all 0.2s', cursor: statusLocked ? 'default' : 'pointer',
        boxShadow: status === 'done' || isSkipped ? 'none' : C.shadow,
        opacity: isSkipped ? 0.58 : 1,
      }}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          onClick={e => e.stopPropagation()}
          style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }}
        />
      )}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: isSkipped ? C.bgAlt : status === 'done' ? display.color : status === 'inprogress' ? display.color : '#fff',
        border: isSkipped ? `2px solid ${C.border}` : status ? 'none' : `2px solid ${C.borderStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isSkipped
          ? <CloseOutlined style={{ color: C.secondary, fontSize: 14 }} />
          : status === 'done'
          ? <CheckCircleFilled style={{ color: '#fff', fontSize: 18 }} />
          : status === 'inprogress'
          ? <PlayCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
          : null
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 0.45, textTransform: 'uppercase',
          color: catColor, marginBottom: 2,
        }}>
          Task
        </div>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: isSkipped ? C.secondary : status === 'done' ? C.secondary : C.headline,
          textDecoration: status === 'done' ? 'line-through' : 'none',
          lineHeight: 1.3,
          overflowWrap: 'anywhere',
        }}>
          {task.label}
        </div>
        <div style={{ fontSize: 11, color: C.secondary, marginTop: 3, lineHeight: 1.4 }}>
          {taskDurationLabel(task)}
          {scheduleText && (
            <span style={{ marginLeft: 8 }}>· {scheduleText}</span>
          )}
          {(() => {
            const pv = getDisplayPotentialValue(task.potentialValue);
            return (
              <span
                style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                  background: `${C.primary}15`, color: C.primary,
                }}
                title={`Potential Value: ${pv.label}`}
                aria-label={`Potential Value: ${pv.label}`}
              >
                PV: {pv.label}
              </span>
            );
          })()}
        </div>
        {statusLocked && (
          <div style={{ fontSize: 10, color: C.tertiary, marginTop: 4, fontWeight: 600 }}>
            Assign to a goal to update status
          </div>
        )}
        {!statusLocked && (
          <div style={{
            fontSize: 11, fontWeight: 700, marginTop: 4,
            color: display.color,
          }}>
            {statusHint ?? display.label}
          </div>
        )}
        {showRemark && (
          <div style={{
            fontSize: 11, color: C.secondary, marginTop: 4, lineHeight: 1.35,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {remarkText}
          </div>
        )}
      </div>

      {isSkipped && (
        <span style={{
          fontSize: 10, background: SKIPPED_BADGE.bg, color: SKIPPED_BADGE.color,
          borderRadius: 5, padding: '2px 7px', fontWeight: 600, flexShrink: 0,
        }}>
          {SKIPPED_BADGE.label}
        </span>
      )}

      <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        {!isSkipped && status !== 'done' && onSimplify && (
          <button
            onClick={onSimplify}
            type="button"
            title="Simplify for me!"
            style={{
              ...touchIconButton,
              background: 'none', border: 'none', color: '#7c3aed', fontSize: 14,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#7c3aed12'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <ThunderboltOutlined />
          </button>
        )}
        {!isSkipped && status !== 'done' && (
          <TaskCalendarButton
            profileId={profileId}
            profileName={profileName}
            taskId={task.id}
            scope="day"
            dateKey={calendarDateKey}
            title={`Add "${task.label}" to calendar for ${calendarDateKey === getTodayKey() ? 'today' : 'tomorrow'}`}
          />
        )}
        {onEdit && (
          <button onClick={onEdit} type="button" style={{
            ...touchIconButton,
            background: 'none', border: 'none', color: C.secondary, fontSize: 13,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.background = `${C.primary}12`; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.secondary; e.currentTarget.style.background = 'none'; }}
          >
            <EditOutlined />
          </button>
        )}
        {onRestore && (
          <button
            onClick={onRestore}
            type="button"
            title="Restore"
            style={{
              ...touchIconButton,
              background: 'none', border: 'none', color: C.primary, fontSize: 11, fontWeight: 700,
            }}
          >
            Restore
          </button>
        )}
        {onArchive && !onRestore && (
          <button
            onClick={onArchive}
            type="button"
            title="Archive"
            style={{
              ...touchIconButton,
              background: 'none', border: 'none', color: C.secondary, fontSize: 11, fontWeight: 700,
            }}
          >
            Archive
          </button>
        )}
        <button onClick={onDelete} type="button" style={{
          ...touchIconButton,
          background: 'none', border: 'none', color: C.secondary, fontSize: 15,
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
  goal, tasks, statuses, notes, onOpenUpdate, onDelete, timeFilter,
  onEditTask, onAddSuggestedTask, onSimplifyTask, onArchiveTask, onRestoreTask,
  isFirst, profileId, profileName, calendarDateKey,
  selectionMode, selectedTaskIds, onToggleTaskSelect, showExploreSuggestions = true,
  emptyMessage = 'No tasks yet for this goal today.',
  getStatusHint,
}: {
  goal: PersonalGoal; tasks: UserTask_[];
  statuses: StatusMap; notes: NotesMap;
  onOpenUpdate: (t: Task, goal: PersonalGoal, doneCount: number, totalCount: number) => void;
  onDelete: (t: UserTask_) => void;
  timeFilter: 'all' | 'morning' | 'evening';
  onEditTask: (t: UserTask_) => void;
  onAddSuggestedTask: (label: string, goalId: string) => void;
  onSimplifyTask?: (t: UserTask_, goal: PersonalGoal) => void;
  onArchiveTask?: (t: UserTask_) => void;
  onRestoreTask?: (t: UserTask_) => void;
  isFirst?: boolean;
  profileId: string;
  profileName: string;
  calendarDateKey: string;
  selectionMode?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleTaskSelect?: (taskId: string) => void;
  showExploreSuggestions?: boolean;
  emptyMessage?: string;
  getStatusHint?: (task: UserTask_) => string | undefined;
}) {
  const [collapsed, setCollapsed] = useState(!isFirst);
  const accentColor = goalAccentColor(goal.id);

  const allVisibleTasks = tasks.filter(t =>
    timeFilter === 'all' || t.timeOfDay === timeFilter
  );
  const suggestedLabels = suggestTasksForGoal(goal).map(s => s.label);

  if (allVisibleTasks.length === 0) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
          background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}06)`,
          borderRadius: 16, border: `1.5px solid ${accentColor}30`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 5, background: `${accentColor}22`, color: accentColor,
              }}>
                Goal
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.headline }}>{goal.title}</div>
            <div style={{ fontSize: 12, color: C.body, marginTop: 4 }}>{emptyMessage}</div>
          </div>
          <button
            type="button"
            onClick={() => onAddSuggestedTask(suggestedLabels[0] ?? 'New task', goal.id)}
            style={{
              padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${accentColor}`,
              background: '#fff', color: accentColor, fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}
          >
            Add task
          </button>
        </div>
      </div>
    );
  }

  const countableTasks = allVisibleTasks.filter(t => statuses[t.id] !== 'skipped');
  const doneTasks = countableTasks.filter(t => statuses[t.id] === 'done').length;
  const totalTasks = countableTasks.length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const allDone = totalTasks > 0 && doneTasks === totalTasks;
  const accent = allDone ? C.primary : accentColor;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 5, background: `${accent}22`, color: accent,
            }}>
              Goal
            </span>
            <span style={{ fontSize: 10, color: C.secondary }}>
              {allDone ? '✓ All tasks done' : `${doneTasks} of ${totalTasks} tasks`}
            </span>
          </div>
          <div style={{
            fontSize: 16, fontWeight: 700, color: C.headline,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {goal.title}
          </div>
          <div style={{ fontSize: 11, color: C.body, marginTop: 2 }}>
            Outcome you&apos;re working toward
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

      {/* Tasks under this goal */}
      {!collapsed && (
        <div style={{
          paddingLeft: 10, paddingTop: 8,
          borderLeft: `3px solid ${accent}25`, marginLeft: 6,
          borderBottom: 'none',
          borderRight: `1.5px solid ${accent}30`,
          paddingRight: 6, paddingBottom: 4,
          background: C.bgCard,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
            color: C.secondary, margin: '0 0 8px 4px',
          }}>
            Tasks · do these actions
          </div>
          {allVisibleTasks.map(task => (
            <TaskItem
              key={task.id} task={task} catColor={accent}
              status={statuses[task.id] ?? null}
              remark={notes[task.id]}
              statusHint={getStatusHint?.(task)}
              profileId={profileId}
              profileName={profileName}
              calendarDateKey={calendarDateKey}
              selectionMode={selectionMode}
              selected={selectedTaskIds?.has(task.id)}
              onToggleSelect={() => onToggleTaskSelect?.(task.id)}
              onOpenUpdate={() => onOpenUpdate(task, goal, doneTasks, totalTasks)}
              onDelete={() => onDelete(task)}
              onEdit={() => onEditTask(task)}
              onSimplify={
                onSimplifyTask
                && (statuses[task.id] ?? null) !== 'done'
                && (statuses[task.id] ?? null) !== 'skipped'
                  ? () => onSimplifyTask(task, goal)
                  : undefined
              }
              onArchive={task.isUserCreated && onArchiveTask && !task.archivedAt ? () => onArchiveTask(task) : undefined}
              onRestore={task.isUserCreated && onRestoreTask && task.archivedAt ? () => onRestoreTask(task) : undefined}
            />
          ))}
        </div>
      )}

      {/* Other Tasks to Explore: keyword suggestions + custom entry */}
      {!collapsed && showExploreSuggestions && (
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

export function TaskList({ profile, onNavigateWeek: _onNavigateWeek, onPerfectDay, onTasksChange }: Props) {
  const { message } = App.useApp();
  const [taskView, setTaskView] = useState<TaskViewMode>(() => loadTaskView(profile.id));
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('active');
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'evening'>('all');
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [notes, setNotes] = useState<NotesMap>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; isUserCreated: boolean } | null>(null);
  const [deleteChoice, setDeleteChoice] = useState<DeleteTaskChoice>('today');
  const [goals, setGoals] = useState<PersonalGoal[]>(() => getPersonalGoals(profile.id));
  const [userTasks, setUserTasks] = useState<UserTask[]>(() => getUserTasks(profile.id));
  // Manage tasks
  const [manageTaskOpen, setManageTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<UserTask | null>(null);
  const [defaultTaskGoalId, setDefaultTaskGoalId] = useState<string | undefined>(undefined);
  const [showTour, setShowTour] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [congratTask, setCongratTask] = useState<{ label: string; rows: Array<{ icon: string; label: string; value: string }> } | null>(null);
  const [editingSeedTaskId, setEditingSeedTaskId] = useState<string | null>(null);
  const [liveCheckInEnabled, setLiveCheckInEnabled] = useState(() => isLiveCheckInEnabled());
  const [momentumEntry, setMomentumEntry] = useState<ReportEntry | null>(null);
  const [taskUpdateContext, setTaskUpdateContext] = useState<TaskUpdateContext | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [contextAssistOpen, setContextAssistOpen] = useState(false);
  const [simplifyTarget, setSimplifyTarget] = useState<{ task: UserTask_; goal?: PersonalGoal } | null>(null);
  const { capture: captureScroll, restore: restoreScroll, allowProgrammaticScroll } = useScrollPositionLock([
    statuses, notes, taskUpdateContext, momentumEntry,
  ]);

  useEffect(() => {
    setTaskView(loadTaskView(profile.id));
  }, [profile.id]);

  const setTaskViewPersisted = (v: TaskViewMode) => {
    setTaskView(v);
    localStorage.setItem(taskViewStorageKey(profile.id), v);
  };

  const today = getTodayKey();
  const calendarDateKey = getEffectiveDaySyncDateKey(profile.id);
  const categories = getTaskCategoriesForProfile(profile.id);
  const allTasks = categories.flatMap(c => c.tasks);
  const activeUserTasks = userTasks.filter(ut => !ut.archivedAt);
  const allTasksCombined = [
    ...allTasks,
    ...activeUserTasks
      .filter(ut => isTaskScheduledForDate(ut, today))
      .map(ut => ({ id: ut.id, label: ut.label, timeOfDay: ut.timeOfDay, type: ut.type, category: 'user' } as Task)),
  ];

  const overdueUserTasks = activeUserTasks.filter(ut =>
    isOverdueUserTask(ut, today, (id, dk) => getTaskStatus(profile.id, id, dk)),
  );

  const loadState = useCallback(() => {
    const s: StatusMap = {};
    const n: NotesMap = {};
    allTasks.forEach(task => {
      s[task.id] = getTaskStatus(profile.id, task.id, today);
      n[task.id] = getTaskNote(profile.id, task.id, today);
    });
    const uts = getUserTasks(profile.id);
    uts.forEach(ut => {
      s[ut.id] = getTaskStatus(profile.id, ut.id, today);
      n[ut.id] = getTaskNote(profile.id, ut.id, today);
    });
    setStatuses(s);
    setNotes(n);
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
    allowProgrammaticScroll(() => {
      requestAnimationFrame(() => {
        document.getElementById('live-check-in-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }, [allowProgrammaticScroll]);

  // Auto-start tasks tour on first visit
  useEffect(() => {
    if (areToursDismissedForProfile(profile.id)) return;
    if (!localStorage.getItem(tourStorageKey(TOUR_KEYS.tasks, profile.id))) {
      const t = setTimeout(() => setShowTour(true), 700);
      return () => clearTimeout(t);
    }
  }, [profile.id]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    applyTaskDelete(deleteTarget.id, deleteTarget.isUserCreated, deleteChoice, deleteTarget.label);
    setDeleteTarget(null);
  };

  const applyTaskDelete = (
    id: string,
    isUserCreated: boolean,
    choice: DeleteTaskChoice,
    label?: string,
  ) => {
    captureScroll();
    if (choice === 'today') {
      skipTaskForToday(profile.id, id, today);
      if (!selectMode) message.info('Task skipped for today');
    } else if (isUserCreated) {
      deleteUserTask(profile.id, id);
      if (!selectMode) message.info(`"${label ?? 'Task'}" permanently removed`);
    } else {
      permanentlyHideSeedTask(profile.id, id);
      if (!selectMode) message.info('Task permanently removed');
    }
    loadState();
    restoreScroll();
    const newPending = allTasksCombined.filter(t => {
      const st = getTaskStatus(profile.id, t.id, today);
      return st !== 'done' && st !== 'skipped';
    }).length;
    onTasksChange?.(newPending);
  };

  const toggleTaskSelect = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const runBulkDelete = (choice: DeleteTaskChoice) => {
    const count = selectedTaskIds.size;
    if (count === 0) return;
    const ids = [...selectedTaskIds];
    ids.forEach(id => {
      const task = allTasksCombined.find(t => t.id === id);
      const isUserCreated = userTasks.some(u => u.id === id);
      applyTaskDelete(id, isUserCreated, choice, task?.label);
    });
    setSelectedTaskIds(new Set());
    setSelectMode(false);
    try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
    message.success(`${count} task(s) updated`);
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
      const merged = mergeSeedForProfile(profile.id, task);
      setEditingTask(seedAsEditableUserTask(
        profile.id,
        merged,
        currentGoalId ?? getPrimaryGoalIdForTask(profile.id, task.id),
      ));
      setEditingSeedTaskId(task.id);
    }
    setManageTaskOpen(true);
  };

  // User task management
  const handleSaveUserTask = (data: Omit<UserTask, 'id' | 'profileId' | 'createdAt'> & { applyTo?: 'this' | 'all' }) => {
    const { applyTo, ...taskData } = data;

    const resolveSeedId = (): string | null => {
      if (editingSeedTaskId) return editingSeedTaskId;
      if (
        editingTask &&
        !userTasks.some(u => u.id === editingTask.id) &&
        allTasks.some(t => t.id === editingTask.id)
      ) {
        return editingTask.id;
      }
      return null;
    };

    const seedId = resolveSeedId();
    const isNewTask = !editingTask && !seedId;

    if (seedId) {
      const seedTask = categories.flatMap(c => c.tasks).find(t => t.id === seedId);
      if (!seedTask) {
        setManageTaskOpen(false);
        setEditingTask(null);
        setEditingSeedTaskId(null);
        return;
      }
      const merged = applySeedOverride(seedTask, getSeedOverride(profile.id, seedId));
      const onlyGoalAssignment =
        taskData.label.trim() === merged.label
        && taskData.timeOfDay === merged.timeOfDay
        && (taskData.description?.trim() || '') === (merged.description?.trim() || '')
        && pvEqual(taskData.potentialValue, merged.potentialValue)
        && recurrenceEqual(taskData.recurrence, merged.recurrence)
        && taskData.type === merged.type;

      if (onlyGoalAssignment && taskData.goalId) {
        setPrimaryGoalLinkForTask(profile.id, seedId, taskData.goalId);
      } else if (onlyGoalAssignment && !taskData.goalId) {
        clearUserGoalLinksForTask(profile.id, seedId);
      } else {
        const override: SeedTaskOverride = {
          label: taskData.label.trim(),
          timeOfDay: taskData.timeOfDay,
          type: seedTask.type,
          description: taskData.description,
          potentialValue: taskData.potentialValue,
          recurrence: taskData.recurrence,
        };
        setSeedOverrideForSameLabel(profile.id, seedId, override);
        if (taskData.goalId) {
          setPrimaryGoalLinkForTask(profile.id, seedId, taskData.goalId);
        } else {
          clearUserGoalLinksForTask(profile.id, seedId);
        }
      }
      setEditingSeedTaskId(null);
    } else if (editingTask) {
      const existing = userTasks.find(u => u.id === editingTask.id);
      if (!existing) {
        createUserTask(profile.id, taskData);
      } else if (!existing.goalId && taskData.goalId) {
        // Full move from Routines → Goal (never leave a copy in Routines)
        updateUserTask(profile.id, editingTask.id, taskData);
      } else if (applyTo === 'this' && isRecurringUT(existing)) {
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
    if (isNewTask) {
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
    setDefaultTaskGoalId(goalId);
    setEditingTask({
      id: '',
      profileId: profile.id,
      label,
      timeOfDay: 'morning',
      type: 'goal',
      goalId,
      createdAt: 0,
    } as UserTask);
    setEditingSeedTaskId(null);
    setManageTaskOpen(true);
  };

  const handleContextAssistConfirm = (groups: SeedSuggestionGroup[]) => {
    groups.forEach(group => {
      let goal = goals.find(g => g.title.toLowerCase() === group.goal.title.toLowerCase());
      if (!goal && group.selected) {
        goal = createUserGoal(profile.id, {
          title: group.goal.title,
          deepWhy: group.goal.deepWhy,
        });
      }
      if (!goal) return;
      group.tasks.forEach(task => {
        if (task.label.trim().toLowerCase() === goal!.title.trim().toLowerCase()) return;
        createUserTask(profile.id, {
          label: task.label,
          timeOfDay: task.timeOfDay,
          type: task.type,
          goalId: goal!.id,
          recurrence: task.recurrence.type === 'daily' ? undefined : task.recurrence,
        });
      });
    });
    loadState();
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
    try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
    message.success({ content: 'Tasks added!', duration: 2 });
  };

  const handleSimplifyConfirm = (replacements: Array<{ label: string; timeOfDay: 'morning' | 'evening' }>) => {
    if (!simplifyTarget) return;
    const { task, goal } = simplifyTarget;
    let existing = userTasks.find(u => u.id === task.id);

    if (!existing) {
      // Promote seed → user task once, hide all same-label day siblings
      const seed = categories.flatMap(c => c.tasks).find(t => t.id === task.id);
      const merged = seed
        ? applySeedOverride(seed, getSeedOverride(profile.id, task.id))
        : null;
      const sourceLabel = merged?.label ?? task.label;
      existing = createUserTask(profile.id, {
        label: sourceLabel,
        timeOfDay: merged?.timeOfDay ?? task.timeOfDay,
        type: (goal ? 'goal' : (merged?.type ?? task.type)) as UserTask['type'],
        goalId: goal?.id ?? task.goalId ?? getPrimaryGoalIdForTask(profile.id, task.id),
        description: merged?.description,
        potentialValue: getDisplayPotentialValue(merged?.potentialValue ?? task.potentialValue),
        recurrence: merged?.recurrence,
        sourceSeedTaskId: task.id,
      });
      permanentlyHideSeedTasksByLabel(profile.id, sourceLabel);
      clearSeedOverride(profile.id, task.id);
    }

    replacements.forEach(rep => {
      createUserTask(profile.id, {
        label: rep.label,
        timeOfDay: rep.timeOfDay,
        type: goal ? 'goal' : existing!.type,
        goalId: goal?.id ?? existing!.goalId,
        potentialValue: getDisplayPotentialValue(existing!.potentialValue),
        sourceSimplifiedFrom: existing!.id,
      });
    });
    deleteUserTask(profile.id, existing.id);
    setSimplifyTarget(null);
    loadState();
    try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
    message.success({ content: 'Task simplified into smaller steps!', duration: 2 });
  };

  // Build today goal → tasks map
  const goalTaskMap: Record<string, UserTask_[]> = {};
  goals.forEach(g => { goalTaskMap[g.id] = []; });
  const ungroupedTasks: UserTask_[] = [];

  const hiddenSeedIds = getPermanentlyHiddenSeedTaskIds(profile.id);
  const convertedSeedIds = new Set(
    userTasks.map(u => u.sourceSeedTaskId).filter((id): id is string => !!id),
  );
  const userTaskIds = new Set(userTasks.map(u => u.id));

  const shouldSkipSeedTask = (seedId: string) =>
    hiddenSeedIds.has(seedId) || convertedSeedIds.has(seedId);

  // Seed tasks from categories (today view)
  categories.forEach(cat => {
    cat.tasks.forEach(t => {
      if (shouldSkipSeedTask(t.id)) return;
      if (userTaskIds.has(t.id)) return;
      const merged = mergeSeedForProfile(profile.id, t);
      const taskObj: UserTask_ = {
        ...merged,
        potentialValue: getDisplayPotentialValue(merged.potentialValue),
        scheduleLabel: merged.recurrence ? recurrenceLabel(merged.recurrence) : 'Daily',
      };
      const effectiveGoalId = getPrimaryGoalIdForTask(profile.id, t.id, cat.goalId);
      if (effectiveGoalId && goalTaskMap[effectiveGoalId] !== undefined) {
        goalTaskMap[effectiveGoalId].push(taskObj);
      } else {
        ungroupedTasks.push(taskObj);
      }
    });
  });

  // User tasks scheduled for today (exclude archived)
  activeUserTasks.filter(ut => isTaskScheduledForDate(ut, today)).forEach(ut => {
    const taskObj: UserTask_ = {
      id: ut.id, label: ut.label, timeOfDay: ut.timeOfDay, type: ut.type,
      category: 'user', isUserCreated: true, recurrence: ut.recurrence,
      potentialValue: getDisplayPotentialValue(ut.potentialValue),
      scheduleLabel: recurrenceLabel(ut.recurrence),
      goalId: ut.goalId,
    };
    if (ut.goalId && goalTaskMap[ut.goalId] !== undefined) {
      goalTaskMap[ut.goalId].push(taskObj);
    } else {
      ungroupedTasks.push(taskObj);
    }
  });

  // All Tasks inventory
  const allInventory = buildAllTasksInventory(profile.id);
  const allGoalTaskMap: Record<string, UserTask_[]> = {};
  allInventory.goals.forEach(g => {
    allGoalTaskMap[g.id] = filterInventoryTasks(
      allInventory.goalTaskMap[g.id] ?? [],
      statusFilter,
      profile.id,
      today,
    ) as UserTask_[];
  });
  const allUnassigned = filterInventoryTasks(
    allInventory.unassigned,
    statusFilter,
    profile.id,
    today,
  ) as UserTask_[];

  const visible = allTasksCombined.filter(t =>
    timeFilter === 'all' || t.timeOfDay === timeFilter
  );
  const countable = visible.filter(t => statuses[t.id] !== 'skipped');
  const done = countable.filter(t => statuses[t.id] === 'done').length;
  const overallPct = countable.length > 0 ? Math.round((done / countable.length) * 100) : 0;
  const isEmpty = categories.length === 0 && userTasks.length === 0 && goals.length === 0;
  const hideExploreSuggestions = isFreshProfile(profile.id) || isUserDefinedProfile(profile.id);

  const statusHintForAll = (task: UserTask_): string | undefined => {
    const scheduledToday = task.isUserCreated
      ? (() => {
          const ut = userTasks.find(u => u.id === task.id);
          return ut ? isTaskScheduledForDate(ut, today) : false;
        })()
      : true;
    if (!scheduledToday) return 'Not due today';
    return undefined;
  };

  const openTaskUpdate = (
    task: Task,
    goal?: PersonalGoal,
    doneCount = 0,
    totalCount = 0,
  ) => {
    captureScroll();
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
    captureScroll();
    trackActivity(profile.id);
    const { taskId, taskLabel } = taskUpdateContext;
    const prevStatus = statuses[taskId] ?? null;

    const entry = applyTaskStatusUpdate({
      profileId: profile.id,
      taskId,
      status,
      note,
      source: 'task_list',
      taskLabel,
      previousStatus: prevStatus,
      liveCheckInEnabled,
    });

    const persisted = getTaskStatus(profile.id, taskId, today);
    const statusSaved = persisted === status || (status === null && persisted === null);

    const newStatuses = { ...statuses, [taskId]: status };
    setStatuses(newStatuses);
    setTaskUpdateContext(null);
    loadState();
    restoreScroll();

    const newPending = allTasksCombined.filter(t => {
      const st = newStatuses[t.id] ?? null;
      return st !== 'done' && st !== 'skipped';
    }).length;
    onTasksChange?.(newPending);

    if (statusSaved) {
      message.success({ content: 'Progress saved!', duration: 2 });
    } else {
      message.error({ content: 'Could not save progress. Try again.', duration: 3 });
      return;
    }

    if (status === 'done') {
      const task = allTasksCombined.find(t => t.id === taskId);
      if (task?.valueType && task.estimatedValue) {
        import('../data/valueTracking').then(({ trackValue, formatValueMessage }) => {
          trackValue(profile.id, task.valueType!, task.estimatedValue!);
          const { message: valueMsg, icon } = formatValueMessage(task.valueType!, task.estimatedValue!, 'immediate');
          message.success({ content: `${icon} ${valueMsg}`, duration: 3 });
        });
      }

      const allDone = (() => {
        const tasksForDay = allTasksCombined.filter(t => {
          const st = newStatuses[t.id] ?? null;
          return st !== 'skipped';
        });
        return tasksForDay.length > 0 && tasksForDay.every(t => (newStatuses[t.id] ?? null) === 'done');
      })();
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

  const handleArchiveTask = (task: UserTask_) => {
    if (!task.isUserCreated) return;
    archiveUserTask(profile.id, task.id);
    loadState();
    message.success('Task archived');
  };

  const handleRestoreTask = (task: UserTask_) => {
    if (!task.isUserCreated) return;
    restoreUserTask(profile.id, task.id);
    loadState();
    message.success('Task restored');
  };

  const handleMonthManage = (task: InventoryTask) => {
    handleEditAnyTask(task as UserTask_, task.goalId);
  };

  const viewTabs: Array<{ key: TaskViewMode; label: string }> = [
    { key: 'all', label: 'All Tasks' },
    { key: 'today', label: 'Today' },
    { key: 'month', label: 'Month' },
  ];

  const statusChips: Array<{ key: TaskStatusFilter; label: string }> = [
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'archived', label: 'Archived' },
  ];

  const renderGoalLists = (
    map: Record<string, UserTask_[]>,
    ungrouped: UserTask_[],
    opts: {
      showExplore: boolean;
      unassignedLabel: string;
      emptyMessage: string;
      getStatusHint?: (task: UserTask_) => string | undefined;
    },
  ) => (
    <>
      {goals.map((goal, idx) => (
        <div key={goal.id} {...(idx === 0 ? { 'data-tour-id': 'tasks-goal-group' } : {})}>
          <GoalGroup
            goal={goal}
            tasks={map[goal.id] ?? []}
            statuses={statuses} notes={notes}
            profileId={profile.id}
            profileName={profile.name}
            calendarDateKey={calendarDateKey}
            onOpenUpdate={openTaskUpdate}
            onDelete={t => openDeleteTask(t)}
            timeFilter={timeFilter}
            isFirst={idx === 0}
            onEditTask={t => handleEditAnyTask(t, goal.id)}
            onAddSuggestedTask={handleAddSuggestedTask}
            onSimplifyTask={(t, g) => setSimplifyTarget({ task: t, goal: g })}
            onArchiveTask={handleArchiveTask}
            onRestoreTask={handleRestoreTask}
            showExploreSuggestions={opts.showExplore && !hideExploreSuggestions}
            emptyMessage={opts.emptyMessage}
            getStatusHint={opts.getStatusHint}
            selectionMode={selectMode}
            selectedTaskIds={selectedTaskIds}
            onToggleTaskSelect={toggleTaskSelect}
          />
        </div>
      ))}

      {ungrouped.filter(t => timeFilter === 'all' || t.timeOfDay === timeFilter).length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {opts.unassignedLabel}
            </span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>
          {ungrouped
            .filter(t => timeFilter === 'all' || t.timeOfDay === timeFilter)
            .map(task => (
              <TaskItem
                key={task.id} task={task} catColor={C.secondary}
                status={statuses[task.id] ?? null}
                remark={notes[task.id]}
                statusHint={opts.getStatusHint?.(task)}
                profileId={profile.id}
                profileName={profile.name}
                calendarDateKey={calendarDateKey}
                selectionMode={selectMode}
                selected={selectedTaskIds.has(task.id)}
                onToggleSelect={() => toggleTaskSelect(task.id)}
                onOpenUpdate={() => openTaskUpdate(task)}
                onDelete={() => openDeleteTask(task)}
                onEdit={() => handleEditAnyTask(task, undefined)}
                onSimplify={
                  (statuses[task.id] ?? null) !== 'done' && (statuses[task.id] ?? null) !== 'skipped'
                    ? () => setSimplifyTarget({ task })
                    : undefined
                }
                onArchive={task.isUserCreated && !task.archivedAt ? () => handleArchiveTask(task) : undefined}
                onRestore={task.isUserCreated && task.archivedAt ? () => handleRestoreTask(task) : undefined}
              />
            ))}
        </div>
      )}
    </>
  );

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
      <p style={{ margin: '0 0 12px', color: C.secondary, fontSize: 13, lineHeight: 1.5 }}>
        {taskView === 'all' && 'Every task, grouped under its Goal (outcome) — tasks are the actions.'}
        {taskView === 'today' && 'Today’s tasks by Goal. Tap a task to update — Goal is the outcome, Tasks are the actions.'}
        {taskView === 'month' && 'See timing and workload across the month.'}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setContextAssistOpen(true)}
          style={{
            padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${C.primary}40`,
            background: `${C.primary}10`, color: C.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✨ Add with AI
        </button>
      </div>

      {/* View segmented control */}
      <div
        role="tablist"
        aria-label="Task views"
        style={{
          display: 'flex', gap: 4, marginBottom: 14, padding: 4,
          background: C.bgAlt, borderRadius: 14, border: `1px solid ${C.border}`,
        }}
      >
        {viewTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={taskView === key}
            onClick={() => setTaskViewPersisted(key)}
            style={{
              ...touchPrimaryButton,
              flex: 1,
              border: 'none',
              borderRadius: 10,
              background: taskView === key ? C.bgCard : 'transparent',
              color: taskView === key ? C.primary : C.secondary,
              fontWeight: taskView === key ? 800 : 600,
              fontSize: 13,
              boxShadow: taskView === key ? C.shadow : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overall progress */}
      {!isEmpty && (
        <div data-tour-id="tasks-list" style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '14px 18px', marginBottom: 16, boxShadow: C.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: C.body, fontSize: 13 }}>Overall today</span>
            <span style={{ color: C.primary, fontWeight: 700, fontSize: 13 }}>{done}/{countable.length}</span>
          </div>
          <Progress percent={overallPct} strokeColor={{ '0%': C.primary, '100%': C.headline }}
            railColor={C.bgAlt} showInfo={false} size={['100%', 8]} />
          {taskView !== 'month' && (
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
          )}
        </div>
      )}

      {liveCheckInEnabled && !isEmpty && taskView !== 'month' && (
        <LiveCheckInFeedbackCard profileId={profile.id} />
      )}

      {taskView === 'month' ? (
        <TasksMonthView
          profileId={profile.id}
          onManageTask={handleMonthManage}
          onGoAllTasks={() => setTaskViewPersisted('all')}
        />
      ) : (
        <>
          {taskView === 'today' && overdueUserTasks.length > 0 && (
            <div style={{
              marginBottom: 14, padding: '12px 14px', borderRadius: 14,
              background: `${C.tertiary}10`, border: `1.5px solid ${C.tertiary}35`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.tertiary, marginBottom: 8 }}>
                Overdue ({overdueUserTasks.length})
              </div>
              {overdueUserTasks.map(ut => {
                const taskObj: UserTask_ = {
                  id: ut.id, label: ut.label, timeOfDay: ut.timeOfDay, type: ut.type,
                  category: 'user', isUserCreated: true, recurrence: ut.recurrence,
                  potentialValue: getDisplayPotentialValue(ut.potentialValue),
                  scheduleLabel: recurrenceLabel(ut.recurrence),
                  goalId: ut.goalId,
                };
                const statusDate = ut.recurrence?.specificDate ?? today;
                const overdueStatus = getTaskStatus(profile.id, ut.id, statusDate);
                return (
                  <TaskItem
                    key={ut.id}
                    task={taskObj}
                    catColor={C.tertiary}
                    status={overdueStatus}
                    statusHint="Overdue"
                    profileId={profile.id}
                    profileName={profile.name}
                    calendarDateKey={calendarDateKey}
                    onOpenUpdate={() => openTaskUpdate(taskObj, goals.find(g => g.id === ut.goalId))}
                    onDelete={() => openDeleteTask(taskObj)}
                    onEdit={() => handleEditAnyTask(taskObj, ut.goalId)}
                    onSimplify={
                      overdueStatus !== 'done' && overdueStatus !== 'skipped'
                        ? () => setSimplifyTarget({ task: taskObj, goal: goals.find(g => g.id === ut.goalId) })
                        : undefined
                    }
                    onArchive={() => handleArchiveTask(taskObj)}
                  />
                );
              })}
            </div>
          )}

          {/* Filters: status · select · time — one compact wrap row */}
          <div style={{
            display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
          }}>
            {taskView === 'all' && (
              <div style={{
                display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center',
                padding: 4, borderRadius: 14, background: C.bgAlt, border: `1px solid ${C.border}`,
              }}>
                {statusChips.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    style={{
                      minHeight: MIN_TOUCH,
                      padding: '8px 11px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: statusFilter === key ? C.primary : 'transparent',
                      color: statusFilter === key ? '#fff' : C.secondary,
                      fontWeight: statusFilter === key ? 700 : 600,
                      fontSize: 12,
                      border: 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => { setSelectMode(m => !m); setSelectedTaskIds(new Set()); }}
              style={{
                minHeight: MIN_TOUCH,
                padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${selectMode ? C.primary : C.border}`,
                background: selectMode ? `${C.primary}15` : C.bgCard,
                color: selectMode ? C.primary : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
            {selectMode && selectedTaskIds.size > 0 && (
              <>
                <button type="button" onClick={() => runBulkDelete('today')} style={{ minHeight: MIN_TOUCH, padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.bgCard, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Skip today ({selectedTaskIds.size})
                </button>
                <button type="button" onClick={() => runBulkDelete('forever')} style={{ minHeight: MIN_TOUCH, padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${C.tertiary}40`, background: `${C.tertiary}10`, color: C.tertiary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Remove ({selectedTaskIds.size})
                </button>
              </>
            )}
            <div style={{
              display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center',
              padding: 4, borderRadius: 14, background: C.bgAlt, border: `1px solid ${C.border}`,
            }}>
              {([
                { key: 'all',     label: 'All' },
                { key: 'morning', label: '☀️ AM' },
                { key: 'evening', label: '🌙 PM' },
              ] as const).map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setTimeFilter(key)} style={{
                  minHeight: MIN_TOUCH,
                  padding: '8px 11px', borderRadius: 12, cursor: 'pointer',
                  background: timeFilter === key ? C.primary : 'transparent',
                  color: timeFilter === key ? '#fff' : C.secondary,
                  fontWeight: timeFilter === key ? 700 : 600, fontSize: 12,
                  border: 'none',
                  transition: 'all 0.18s',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {isEmpty ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <div style={{ fontWeight: 600, fontSize: 16, color: C.headline, marginBottom: 8 }}>No tasks yet</div>
              <div style={{ color: C.body, fontSize: 13 }}>Tap + to add your first task.</div>
            </div>
          ) : taskView === 'all' ? (
            renderGoalLists(allGoalTaskMap, allUnassigned, {
              showExplore: false,
              unassignedLabel: 'Tasks · no goal yet',
              emptyMessage: 'No tasks for this goal yet.',
              getStatusHint: statusHintForAll,
            })
          ) : (
            renderGoalLists(goalTaskMap, ungroupedTasks, {
              showExplore: true,
              unassignedLabel: 'Tasks · no goal yet',
              emptyMessage: 'No tasks yet for this goal today.',
            })
          )}
        </>
      )}

      {/* FAB - Add Task menu */}
      {fabMenuOpen && (
        <div
          onClick={() => setFabMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 47 }}
        />
      )}
      {fabMenuOpen && (
        <div style={{
          position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 72px)', right: 20, zIndex: 48,
          background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 14,
          boxShadow: C.shadow, overflow: 'hidden', minWidth: 160,
        }}>
          <button
            type="button"
            onClick={() => { setFabMenuOpen(false); setEditingTask(null); setEditingSeedTaskId(null); setDefaultTaskGoalId(undefined); setManageTaskOpen(true); }}
            style={{
              display: 'block', width: '100%', padding: '12px 16px', border: 'none', background: 'none',
              textAlign: 'left', fontSize: 13, fontWeight: 600, color: C.headline, cursor: 'pointer',
              minHeight: MIN_TOUCH,
            }}
          >
            Add manually
          </button>
          <button
            type="button"
            onClick={() => { setFabMenuOpen(false); setContextAssistOpen(true); }}
            style={{
              display: 'block', width: '100%', padding: '12px 16px', border: 'none', background: C.bgAlt,
              borderTop: `1px solid ${C.border}`, textAlign: 'left', fontSize: 13, fontWeight: 600,
              color: C.primary, cursor: 'pointer', minHeight: MIN_TOUCH,
            }}
          >
            ✨ Add with AI
          </button>
        </div>
      )}
      <button
        data-tour-id="tasks-add-btn"
        onClick={() => setFabMenuOpen(o => !o)}
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
        profileId={profile.id}
        task={editingTask}
        defaultGoalId={defaultTaskGoalId}
        goals={goals}
        currentDate={today}
        preserveTaskType={!!editingSeedTaskId}
        onSave={handleSaveUserTask}
        onCancel={() => { setManageTaskOpen(false); setEditingTask(null); setDefaultTaskGoalId(undefined); setEditingSeedTaskId(null); }}
      />

      <ContextAssistModal
        open={contextAssistOpen}
        onClose={() => setContextAssistOpen(false)}
        profileId={profile.id}
        mode="tasks"
        onConfirm={handleContextAssistConfirm}
      />

      {simplifyTarget && (
        <SimplifyTaskModal
          open={!!simplifyTarget}
          onClose={() => setSimplifyTarget(null)}
          taskLabel={simplifyTarget.task.label}
          goalTitle={simplifyTarget.goal?.title}
          goalWhy={simplifyTarget.goal?.deepWhy}
          onConfirm={handleSimplifyConfirm}
        />
      )}

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
        onClose={() => { setTaskUpdateContext(null); restoreScroll(); }}
        onSubmit={handleTaskUpdateSubmit}
        onInteractionCapture={captureScroll}
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
        storageKey={tourStorageKey(TOUR_KEYS.tasks, profile.id)}
        profileId={profile.id}
        pageLabel="Tasks"
        doneEmoji="✅"
        doneMessage="You know how Tasks work. Mark tasks done as you go - every checkmark builds your streak!"
        onInteract={() => { setEditingTask(null); setEditingSeedTaskId(null); setManageTaskOpen(true); }}
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
