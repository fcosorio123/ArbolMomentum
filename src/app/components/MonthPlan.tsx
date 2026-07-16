import { useState } from 'react';
import { message } from 'antd';
import { C } from '../data/colors';
import type { Profile } from '../data/profiles';
import { TasksMonthView } from './TasksMonthView';
import { ManageTaskModal } from './ManageTaskModal';
import type { InventoryTask } from '../data/tasksInventory';
import { getPersonalGoals } from '../data/personalGoals';
import {
  getUserTasks,
  createUserTask,
  updateUserTask,
  type UserTask,
} from '../data/userTasks';
import { mergeSeedForProfile, setSeedOverride, setSeedOverrideForSameLabel, seedAsEditableUserTask } from '../data/seedOverrides';
import { getTodayKey } from '../data/profiles';

interface Props {
  profile: Profile;
  onGoAllTasks: () => void;
}

/** Standalone Month tab - same calendar as Tasks → Month. */
export function MonthPlan({ profile, onGoAllTasks }: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<UserTask | null>(null);
  const [editingSeedId, setEditingSeedId] = useState<string | null>(null);
  const goals = getPersonalGoals(profile.id);
  const today = getTodayKey();

  const onManageTask = (task: InventoryTask) => {
    const userTasks = getUserTasks(profile.id);
    const existing = userTasks.find(u => u.id === task.id);
    if (existing) {
      setEditing(existing);
      setEditingSeedId(null);
    } else {
      const merged = mergeSeedForProfile(profile.id, task);
      setEditing(seedAsEditableUserTask(
        profile.id,
        merged,
        task.goalId ?? getPrimaryGoalIdForTask(profile.id, task.id),
      ));
      setEditingSeedId(task.id);
    }
    setManageOpen(true);
  };

  const handleSave = (data: Omit<UserTask, 'id' | 'profileId' | 'createdAt'> & { applyTo?: 'this' | 'all' }) => {
    const { applyTo: _a, ...taskData } = data;
    if (editingSeedId) {
      setSeedOverride(profile.id, editingSeedId, {
        label: taskData.label,
        timeOfDay: taskData.timeOfDay,
        description: taskData.description,
        potentialValue: taskData.potentialValue,
        recurrence: taskData.recurrence,
        type: taskData.type,
      });
      setSeedOverrideForSameLabel(profile.id, editingSeedId, {
        label: taskData.label,
        timeOfDay: taskData.timeOfDay,
        description: taskData.description,
        potentialValue: taskData.potentialValue,
        recurrence: taskData.recurrence,
        type: taskData.type,
      });
      if (taskData.goalId) {
        createUserTask(profile.id, {
          ...taskData,
          sourceSeedTaskId: editingSeedId,
        });
      }
    } else if (editing && getUserTasks(profile.id).some(u => u.id === editing.id)) {
      updateUserTask(profile.id, editing.id, taskData);
    } else {
      createUserTask(profile.id, taskData);
    }
    setManageOpen(false);
    setEditing(null);
    setEditingSeedId(null);
    try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
    message.success('Task saved');
  };

  return (
    <div style={{
      padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 100px',
      background: C.bg,
      minHeight: '100dvh',
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.headline }}>Month</h2>
      <p style={{ margin: '0 0 18px', color: C.body, fontSize: 13, lineHeight: 1.45 }}>
        See timing and workload across the month. Tap a day for its tasks.
      </p>
      <TasksMonthView
        profileId={profile.id}
        onManageTask={onManageTask}
        onGoAllTasks={onGoAllTasks}
      />
      <ManageTaskModal
        open={manageOpen}
        profileId={profile.id}
        task={editing}
        goals={goals}
        currentDate={today}
        preserveTaskType={!!editingSeedId}
        onSave={handleSave}
        onCancel={() => { setManageOpen(false); setEditing(null); setEditingSeedId(null); }}
      />
    </div>
  );
}
