// Shared AI Assist Creation V2 contracts (client). Keep field-identical with edge twin.

import type { Recurrence } from './userTasks';
import type { PotentialValue } from './potentialValue';

export type AiAssistCreationType = 'goal' | 'task';
export type AiAssistGenerationSource = 'llm' | 'server_rules' | 'client_fallback';
export type AiAssistEntryPage = 'goals' | 'tasks';

export type AiAssistReasonCode =
  | 'ok'
  | 'input_too_short'
  | 'rate_limited'
  | 'llm_unavailable'
  | 'invalid_llm_output'
  | 'timeout'
  | 'network_error'
  | 'no_candidates'
  | 'client_fallback';

export interface AiAssistBrainDumpState {
  text: string;
  updatedAt: number;
}

export interface GoalCandidate {
  id: string;
  type: 'goal';
  title: string;
  description?: string;
  previewReason?: string;
  suggestedFields?: {
    deepWhy?: string;
  };
}

export interface TaskCandidate {
  id: string;
  type: 'task';
  title: string;
  description?: string;
  previewReason?: string;
  suggestedFields?: {
    description?: string;
    timeOfDay?: 'morning' | 'evening';
    recurrence?: Recurrence;
    potentialValueScore?: 1 | 2 | 3 | 4;
    recommendedGoalId?: string;
  };
}

export type CandidateDraft = GoalCandidate | TaskCandidate;

export interface AiAssistGenerationRequest {
  requestId: string;
  sessionId: string;
  creationType: AiAssistCreationType;
  text: string;
  preferRules?: boolean;
  priorCandidateTitles: string[];
  context?: {
    existingGoalTitles?: string[];
    existingTaskLabels?: string[];
  };
}

export interface AiAssistGenerationResponse {
  ok: boolean;
  requestId: string;
  sessionId: string;
  creationType: AiAssistCreationType;
  source: AiAssistGenerationSource;
  reason?: AiAssistReasonCode;
  candidates: CandidateDraft[];
}

export interface GoalStarterTaskDraft {
  id: string;
  label: string;
  selected: boolean;
  description?: string;
  timeOfDay?: 'morning' | 'evening';
  recurrence?: Recurrence;
  clientKey: string;
}

export interface AiAssistStarterRequest {
  requestId: string;
  sessionId: string;
  text: string;
  goalTitle: string;
  goalDeepWhy?: string;
  preferRules?: boolean;
  priorStarterTitles: string[];
}

export interface AiAssistStarterResponse {
  ok: boolean;
  requestId: string;
  sessionId: string;
  source: AiAssistGenerationSource;
  reason?: AiAssistReasonCode;
  tasks: GoalStarterTaskDraft[];
}

export interface SelectedGoalDraft {
  title: string;
  deepWhy: string;
  starterMode: 'goal_only' | 'goal_with_tasks';
  starterTasks: GoalStarterTaskDraft[];
  clientKey: string;
}

export interface SelectedTaskDraft {
  label: string;
  description?: string;
  timeOfDay: 'morning' | 'evening';
  potentialValue?: PotentialValue;
  recurrence?: Recurrence;
  goalRelationship:
    | { kind: 'none' }
    | { kind: 'existing'; goalId: string }
    | { kind: 'new'; goalDraft: { title: string; deepWhy: string }; clientKey: string };
  clientKey: string;
}

export interface AiAssistCandidateHistoryEntry {
  requestId: string;
  createdAt: number;
  creationType: AiAssistCreationType;
  source: AiAssistGenerationSource;
  titles: string[];
}

export type AiAssistStep =
  | 'capture'
  | 'candidates'
  | 'edit_goal'
  | 'edit_task'
  | 'edit_new_goal_for_task'
  | 'starter_choice'
  | 'starter_review'
  | 'final_review';

export interface AiAssistSession {
  sessionId: string;
  entryPage: AiAssistEntryPage;
  creationType: AiAssistCreationType;
  brainDump: AiAssistBrainDumpState;
  requestSeq: number;
  activeRequestId: string | null;
  candidates: CandidateDraft[] | null;
  history: AiAssistCandidateHistoryEntry[];
  selectedCandidateId: string | null;
  goalDraft: SelectedGoalDraft | null;
  taskDraft: SelectedTaskDraft | null;
  step: AiAssistStep;
  dirty: boolean;
  /** session-only idempotency: clientKey → created entity id */
  createdIds: Record<string, string>;
}

export interface AiAssistSaveResult {
  ok: boolean;
  createdGoalIds: string[];
  createdTaskIds: string[];
  failed: Array<{ role: 'goal' | 'task'; clientKey: string; message: string }>;
  partial: boolean;
}

export function newAiAssistId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
