// Edge twin of client aiAssistCreationTypes - keep fields identical.

export type AiAssistCreationType = "goal" | "task";
export type AiAssistGenerationSource = "llm" | "server_rules" | "client_fallback";

export type AiAssistReasonCode =
  | "ok"
  | "input_too_short"
  | "rate_limited"
  | "llm_unavailable"
  | "invalid_llm_output"
  | "timeout"
  | "network_error"
  | "no_candidates"
  | "client_fallback";

export interface GoalCandidate {
  id: string;
  type: "goal";
  title: string;
  description?: string;
  previewReason?: string;
  suggestedFields?: { deepWhy?: string };
}

export interface TaskCandidate {
  id: string;
  type: "task";
  title: string;
  description?: string;
  previewReason?: string;
  suggestedFields?: {
    description?: string;
    timeOfDay?: "morning" | "evening";
    potentialValueScore?: 1 | 2 | 3 | 4;
    recommendedGoalId?: string;
  };
}

export type CandidateDraft = GoalCandidate | TaskCandidate;

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
  timeOfDay?: "morning" | "evening";
  clientKey: string;
}

export interface AiAssistStarterResponse {
  ok: boolean;
  requestId: string;
  sessionId: string;
  source: AiAssistGenerationSource;
  reason?: AiAssistReasonCode;
  tasks: GoalStarterTaskDraft[];
}
