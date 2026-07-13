/** Pure helpers for daily check-in task navigation (testable). */

export interface CheckInTaskRef {
  id: string;
}

export function nextTaskId(
  sessionTasks: CheckInTaskRef[],
  currentId: string | null,
): string | null {
  if (!currentId || sessionTasks.length === 0) return null;
  const idx = sessionTasks.findIndex(t => t.id === currentId);
  if (idx < 0 || idx >= sessionTasks.length - 1) return null;
  return sessionTasks[idx + 1].id;
}

export function prevTaskId(
  sessionTasks: CheckInTaskRef[],
  currentId: string | null,
): string | null {
  if (!currentId || sessionTasks.length === 0) return null;
  const idx = sessionTasks.findIndex(t => t.id === currentId);
  if (idx <= 0) return null;
  return sessionTasks[idx - 1].id;
}

export function firstUnansweredTaskId(
  sessionTasks: CheckInTaskRef[],
  answeredIds: Set<string>,
): string | null {
  const found = sessionTasks.find(t => !answeredIds.has(t.id));
  return found?.id ?? sessionTasks[0]?.id ?? null;
}

export function canRecordCheckIn(
  sessionTasks: CheckInTaskRef[],
  answeredIds: Set<string>,
): boolean {
  return sessionTasks.length === 0 || answeredIds.size >= sessionTasks.length;
}

export function shouldPersistSkipOnAdvance(
  taskId: string,
  answeredIds: Set<string>,
  selections: Record<string, string | null | undefined>,
): boolean {
  if (answeredIds.has(taskId)) return false;
  return selections[taskId] === undefined;
}
