import { createUserGoal } from './personalGoals';
import { createUserTask, type Recurrence } from './userTasks';
import {
  defaultPotentialValue,
  normalizePotentialValue,
  type PotentialValueScore,
} from './potentialValue';
import type {
  AiAssistSaveResult,
  AiAssistSession,
  SelectedGoalDraft,
  SelectedTaskDraft,
} from './aiAssistCreationTypes';

function scoreFromDraft(score?: PotentialValueScore) {
  return normalizePotentialValue(
    score
      ? { ...defaultPotentialValue('manual'), score, updatedAt: Date.now() }
      : defaultPotentialValue('manual'),
  ) ?? defaultPotentialValue('manual');
}

export type PersistDeps = {
  createUserGoal?: typeof createUserGoal;
  createUserTask?: typeof createUserTask;
};

export function persistAiAssistTask(
  profileId: string,
  session: AiAssistSession,
  draft: SelectedTaskDraft,
  deps?: PersistDeps,
): { result: AiAssistSaveResult; session: AiAssistSession } {
  const createGoal = deps?.createUserGoal ?? createUserGoal;
  const createTask = deps?.createUserTask ?? createUserTask;
  const createdGoalIds: string[] = [];
  const createdTaskIds: string[] = [];
  const failed: AiAssistSaveResult['failed'] = [];
  const createdIds = { ...session.createdIds };

  let goalId: string | undefined;

  try {
    if (draft.goalRelationship.kind === 'existing') {
      goalId = draft.goalRelationship.goalId;
    } else if (draft.goalRelationship.kind === 'new') {
      const gKey = draft.goalRelationship.clientKey;
      if (createdIds[gKey]) {
        goalId = createdIds[gKey];
      } else {
        const g = createGoal(profileId, {
          title: draft.goalRelationship.goalDraft.title,
          deepWhy: draft.goalRelationship.goalDraft.deepWhy,
        });
        createdIds[gKey] = g.id;
        createdGoalIds.push(g.id);
        goalId = g.id;
      }
    }

    if (createdIds[draft.clientKey]) {
      createdTaskIds.push(createdIds[draft.clientKey]);
    } else {
      const task = createTask(profileId, {
        label: draft.label,
        description: draft.description,
        timeOfDay: draft.timeOfDay,
        type: goalId ? 'goal' : 'routine',
        goalId,
        recurrence: draft.recurrence as Recurrence | undefined,
        potentialValue: draft.potentialValue ?? scoreFromDraft(),
      });
      createdIds[draft.clientKey] = task.id;
      createdTaskIds.push(task.id);
    }
  } catch (err) {
    failed.push({ role: 'task', clientKey: draft.clientKey, message: String(err) });
  }

  const partial = failed.length > 0 && (createdGoalIds.length > 0 || createdTaskIds.length > 0);
  const ok = failed.length === 0 && createdTaskIds.length > 0;
  return {
    result: { ok, createdGoalIds, createdTaskIds, failed, partial },
    session: { ...session, createdIds },
  };
}

export function persistAiAssistGoal(
  profileId: string,
  session: AiAssistSession,
  draft: SelectedGoalDraft,
  /** When set, only these clientKeys are attempted (for retry). */
  onlyKeys?: string[],
  deps?: PersistDeps,
): { result: AiAssistSaveResult; session: AiAssistSession } {
  const createGoal = deps?.createUserGoal ?? createUserGoal;
  const createTask = deps?.createUserTask ?? createUserTask;
  const createdGoalIds: string[] = [];
  const createdTaskIds: string[] = [];
  const failed: AiAssistSaveResult['failed'] = [];
  const createdIds = { ...session.createdIds };

  let goalId = createdIds[draft.clientKey];

  try {
    if (!goalId) {
      const g = createGoal(profileId, {
        title: draft.title,
        deepWhy: draft.deepWhy,
      });
      createdIds[draft.clientKey] = g.id;
      goalId = g.id;
      createdGoalIds.push(g.id);
    } else {
      createdGoalIds.push(goalId);
    }
  } catch (err) {
    failed.push({ role: 'goal', clientKey: draft.clientKey, message: String(err) });
    return {
      result: { ok: false, createdGoalIds, createdTaskIds, failed, partial: false },
      session: { ...session, createdIds },
    };
  }

  if (draft.starterMode === 'goal_with_tasks') {
    const selected = draft.starterTasks.filter(t => t.selected && t.label.trim());
    for (const t of selected) {
      if (onlyKeys && !onlyKeys.includes(t.clientKey)) {
        if (createdIds[t.clientKey]) createdTaskIds.push(createdIds[t.clientKey]);
        continue;
      }
      if (createdIds[t.clientKey]) {
        createdTaskIds.push(createdIds[t.clientKey]);
        continue;
      }
      try {
        const task = createTask(profileId, {
          label: t.label.trim(),
          description: t.description,
          timeOfDay: t.timeOfDay ?? 'morning',
          type: 'goal',
          goalId,
          recurrence: t.recurrence,
          potentialValue: defaultPotentialValue('manual'),
        });
        createdIds[t.clientKey] = task.id;
        createdTaskIds.push(task.id);
      } catch (err) {
        failed.push({ role: 'task', clientKey: t.clientKey, message: String(err) });
      }
    }
  }

  const wantedTasks = draft.starterMode === 'goal_with_tasks'
    ? draft.starterTasks.filter(t => t.selected).length
    : 0;
  const partial = failed.length > 0;
  const ok = failed.length === 0 && !!goalId && (wantedTasks === 0 || createdTaskIds.length === wantedTasks);

  return {
    result: { ok, createdGoalIds, createdTaskIds, failed, partial },
    session: { ...session, createdIds },
  };
}

/** Test helper: inject a failing create for one clientKey via monkeypatch-friendly wrapper. */
export type CreateTaskFn = typeof createUserTask;
