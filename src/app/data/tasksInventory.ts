import {
  getTaskCategoriesForProfile,
  getPermanentlyHiddenSeedTaskIds,
  getTaskStatus,
  type Task,
  type TimeOfDay,
  type TaskType,
} from './profiles';
import {
  getUserTasks,
  isTaskScheduledForDate,
  isOverdueUserTask,
  recurrenceLabel,
  type UserTask,
  type Recurrence,
} from './userTasks';
import { getPrimaryGoalIdForTask } from './taskGoalLinks';
import { getPersonalGoals, type PersonalGoal } from './personalGoals';
import { mergeSeedForProfile } from './seedOverrides';
import { getDisplayPotentialValue } from './potentialValue';

export type InventoryTask = Task & {
  isUserCreated?: boolean;
  recurrence?: Recurrence;
  potentialValue?: UserTask['potentialValue'];
  description?: string;
  archivedAt?: number;
  goalId?: string;
  scheduleLabel?: string;
};

export type TaskStatusFilter = 'active' | 'completed' | 'overdue' | 'archived';

export interface TasksInventory {
  goals: PersonalGoal[];
  goalTaskMap: Record<string, InventoryTask[]>;
  unassigned: InventoryTask[];
}

/** Build full task inventory (all dates) for All Tasks management view. */
export function buildAllTasksInventory(profileId: string): TasksInventory {
  const goals = getPersonalGoals(profileId);
  const goalTaskMap: Record<string, InventoryTask[]> = {};
  goals.forEach(g => { goalTaskMap[g.id] = []; });
  const unassigned: InventoryTask[] = [];

  const userTasks = getUserTasks(profileId);
  const hiddenSeedIds = getPermanentlyHiddenSeedTaskIds(profileId);
  const convertedSeedIds = new Set(
    userTasks.map(u => u.sourceSeedTaskId).filter((id): id is string => !!id),
  );
  const userTaskIds = new Set(userTasks.map(u => u.id));

  const place = (task: InventoryTask, goalId?: string) => {
    if (goalId && goalTaskMap[goalId] !== undefined) {
      goalTaskMap[goalId].push(task);
    } else {
      unassigned.push(task);
    }
  };

  // All weekdays — not just "today" — so seeded tasks stay stable across days
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const seenSeedIds = new Set<string>();
  for (const day of DAYS) {
    getTaskCategoriesForProfile(profileId, day).forEach(cat => {
      cat.tasks.forEach(t => {
        if (seenSeedIds.has(t.id)) return;
        seenSeedIds.add(t.id);
        if (hiddenSeedIds.has(t.id) || convertedSeedIds.has(t.id) || userTaskIds.has(t.id)) return;
        const merged = mergeSeedForProfile(profileId, t);
        const effectiveGoalId = getPrimaryGoalIdForTask(profileId, t.id, cat.goalId);
        place(
          {
            ...merged,
            potentialValue: getDisplayPotentialValue(merged.potentialValue),
            goalId: effectiveGoalId,
            scheduleLabel: merged.recurrence ? recurrenceLabel(merged.recurrence) : `${day} seed`,
          },
          effectiveGoalId,
        );
      });
    });
  }

  userTasks.forEach(ut => {
    const taskObj: InventoryTask = {
      id: ut.id,
      label: ut.label,
      timeOfDay: ut.timeOfDay,
      type: ut.type as TaskType,
      category: 'user',
      isUserCreated: true,
      recurrence: ut.recurrence,
      potentialValue: getDisplayPotentialValue(ut.potentialValue),
      archivedAt: ut.archivedAt,
      goalId: ut.goalId,
      scheduleLabel: recurrenceLabel(ut.recurrence),
    };
    place(taskObj, ut.goalId);
  });

  return { goals, goalTaskMap, unassigned };
}

export function filterInventoryTasks(
  tasks: InventoryTask[],
  filter: TaskStatusFilter,
  profileId: string,
  todayKey: string,
): InventoryTask[] {
  return tasks.filter(t => {
    const archived = !!t.archivedAt;
    if (filter === 'archived') return archived;
    if (archived) return false;

    const ut = t.isUserCreated
      ? getUserTasks(profileId).find(u => u.id === t.id)
      : undefined;

    if (filter === 'overdue') {
      if (!ut) return false;
      return isOverdueUserTask(ut, todayKey, (id, dk) => getTaskStatus(profileId, id, dk));
    }

    if (filter === 'completed') {
      if (ut?.recurrence?.type === 'one-time' && ut.recurrence.specificDate) {
        return getTaskStatus(profileId, ut.id, ut.recurrence.specificDate) === 'done';
      }
      return getTaskStatus(profileId, t.id, todayKey) === 'done';
    }

    // active: not archived, and not purely a completed one-time past task
    if (ut?.recurrence?.type === 'one-time' && ut.recurrence.specificDate) {
      if (
        ut.recurrence.specificDate < todayKey &&
        getTaskStatus(profileId, ut.id, ut.recurrence.specificDate) === 'done'
      ) {
        return false;
      }
    }
    return true;
  });
}

/** Count scheduled non-archived user tasks on a calendar day. */
export function countTasksOnDate(profileId: string, dateKey: string): number {
  return getUserTasks(profileId).filter(
    ut => !ut.archivedAt && isTaskScheduledForDate(ut, dateKey),
  ).length;
}

export function getInventoryTasksForDate(profileId: string, dateKey: string): InventoryTask[] {
  const inv = buildAllTasksInventory(profileId);
  const byId = new Map<string, InventoryTask>();
  for (const t of [...Object.values(inv.goalTaskMap).flat(), ...inv.unassigned]) {
    byId.set(t.id, t);
  }

  return getUserTasks(profileId)
    .filter(ut => !ut.archivedAt && isTaskScheduledForDate(ut, dateKey))
    .map(ut => byId.get(ut.id) ?? {
      id: ut.id,
      label: ut.label,
      timeOfDay: ut.timeOfDay,
      type: ut.type,
      category: 'user',
      isUserCreated: true,
      recurrence: ut.recurrence,
      potentialValue: getDisplayPotentialValue(ut.potentialValue),
      goalId: ut.goalId,
      scheduleLabel: recurrenceLabel(ut.recurrence),
    });
}

export function hasOverdueOnDate(profileId: string, dateKey: string, todayKey: string): boolean {
  if (dateKey >= todayKey) return false;
  return getUserTasks(profileId).some(ut => {
    if (ut.archivedAt) return false;
    const rec = ut.recurrence;
    if (!rec || rec.type !== 'one-time' || rec.specificDate !== dateKey) return false;
    return getTaskStatus(profileId, ut.id, dateKey) !== 'done';
  });
}

export type { TimeOfDay };
