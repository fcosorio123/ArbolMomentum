import {
  getTaskCategoriesForProfile,
  isSeedTaskPermanentlyHidden,
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
import { resourcesForDisplay } from './taskResources';

export type InventoryTask = Task & {
  isUserCreated?: boolean;
  recurrence?: Recurrence;
  potentialValue?: UserTask['potentialValue'];
  description?: string;
  archivedAt?: number;
  goalId?: string;
  scheduleLabel?: string;
  resources?: UserTask['resources'];
};

export type TaskStatusFilter = 'active' | 'completed' | 'overdue' | 'archived';

export interface TasksInventory {
  goals: PersonalGoal[];
  goalTaskMap: Record<string, InventoryTask[]>;
  unassigned: InventoryTask[];
}

/** Build full task inventory for All Tasks - one row per setup, with frequency. */
export function buildAllTasksInventory(profileId: string): TasksInventory {
  const goals = getPersonalGoals(profileId);
  const goalTaskMap: Record<string, InventoryTask[]> = {};
  goals.forEach(g => { goalTaskMap[g.id] = []; });
  const unassigned: InventoryTask[] = [];

  const userTasks = getUserTasks(profileId);
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

  // Collect weekday seeds, then collapse same-label setups into one row + frequency.
  // (Profiles like Favio store Mon/Tue/… copies with different IDs - users want frequency, not 7 rows.)
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  type Acc = {
    task: InventoryTask;
    goalId?: string;
    days: Set<string>;
    ids: string[];
  };
  const bySetup = new Map<string, Acc>();

  for (const day of DAYS) {
    getTaskCategoriesForProfile(profileId, day).forEach(cat => {
      cat.tasks.forEach(t => {
        if (isSeedTaskPermanentlyHidden(profileId, t.id) || convertedSeedIds.has(t.id) || userTaskIds.has(t.id)) return;
        const merged = mergeSeedForProfile(profileId, t);
        const effectiveGoalId = getPrimaryGoalIdForTask(profileId, t.id, cat.goalId);
        const setupKey = [
          (merged.label || '').trim().toLowerCase(),
          merged.timeOfDay,
          merged.type,
          effectiveGoalId || '',
        ].join('|');

        const existing = bySetup.get(setupKey);
        if (existing) {
          existing.days.add(day);
          existing.ids.push(t.id);
          // Prefer today's instance as the editable representative id
          if (day === todayName) {
            existing.task = {
              ...existing.task,
              ...merged,
              id: t.id,
              potentialValue: getDisplayPotentialValue(merged.potentialValue),
              goalId: effectiveGoalId,
            };
            existing.goalId = effectiveGoalId;
          }
          return;
        }

        bySetup.set(setupKey, {
          days: new Set([day]),
          ids: [t.id],
          goalId: effectiveGoalId,
          task: {
            ...merged,
            potentialValue: getDisplayPotentialValue(merged.potentialValue),
            goalId: effectiveGoalId,
            scheduleLabel: 'Daily',
            resources: resourcesForDisplay(
              merged.label,
              undefined,
              effectiveGoalId ? goals.find(g => g.id === effectiveGoalId)?.title : undefined,
            ),
          },
        });
      });
    });
  }

  for (const acc of bySetup.values()) {
    const days = DAYS.filter(d => acc.days.has(d));
    acc.task.scheduleLabel = frequencyLabelFromDays(days);
    // If seed had explicit recurrence override, prefer that label
    if (acc.task.recurrence) {
      acc.task.scheduleLabel = recurrenceLabel(acc.task.recurrence);
    }
    place(acc.task, acc.goalId);
  }

  userTasks.forEach(ut => {
    const goalTitle = ut.goalId ? goals.find(g => g.id === ut.goalId)?.title : undefined;
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
      resources: resourcesForDisplay(ut.label, ut.resources, goalTitle),
    };
    place(taskObj, ut.goalId);
  });

  return { goals, goalTaskMap, unassigned };
}

function frequencyLabelFromDays(days: string[]): string {
  if (days.length === 0) return 'Scheduled';
  if (days.length >= 7) return 'Daily';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (days.length === 5 && weekdays.every(d => days.includes(d))) return 'Weekdays';
  if (days.length === 1) return days[0];
  return days.join(', ');
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
