// ──────────────────────────────────────────────
// AI-assisted task creation (edge parse-context-tasks)
// ──────────────────────────────────────────────

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { parseGoalInput, type SeedSuggestionGroup } from './profileSeedParser';
import {
  filterCandidateSteps,
  isGoalRelevantToTask,
  buildTaskContextFromAnswers,
  buildSimplifyPackage,
  classifyTaskComplexity,
  type SimplifyAnswers,
  type AnswerReviewItem,
} from './simplifyTaskCore';
import {
  buildPrevalidatedSuggestions,
  evaluateAnswerSufficiency,
  mergeAnswerWithAddition,
  type DetailAssistInput,
  type DetailAssistResult,
  type SimplifyQuestionId,
} from './simplifyDetailAssist';

const FN = 'make-server-5d90ddf5';
const FN_BASE = `https://${projectId}.supabase.co/functions/v1`;

export type ParseContextSource = 'llm' | 'rules';

export interface ParseContextTasksResult {
  ok: boolean;
  groups: SeedSuggestionGroup[];
  source: ParseContextSource;
  reason?: string;
}

/** Authorization-only fetch — avoid apikey header (CORS preflight breaks POSTs). */
async function edgePost(
  path: string,
  body: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<{ data: any; error: string | null }> {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${FN_BASE}/${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: any = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      return { data, error: data?.error || data?.message || `HTTP ${res.status}` };
    }
    return { data, error: null };
  } catch (err) {
    const msg = String(err);
    if (/AbortError|aborted/i.test(msg)) {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Normalize any path (edge/LLM/rules/fallback) to the shared Simplify response contract. */
export function normalizeSimplifyResult(
  input: SimplifyTaskInput,
  answers: SimplifyAnswers,
  partial: Partial<SimplifyTaskResult> & { tasks?: SimplifiedTaskSuggestion[] },
  meta: { requestId: string; taskId: string; source: ParseContextSource; reason?: string },
): SimplifyTaskResult {
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  const pkg = buildSimplifyPackage({
    taskLabel: input.taskLabel,
    goalTitle,
    ...answers,
  });

  const reviewAnswers = Array.isArray(partial.answers) && partial.answers.length > 0
    ? partial.answers.map((a, i) => ({
      ...a,
      rawAnswer: (a.rawAnswer && a.rawAnswer.trim()) || answers[['blocker', 'motivation', 'constraint'][i] as keyof SimplifyAnswers] || a.rawAnswer,
    }))
    : pkg.answers;

  const rawTasks = Array.isArray(partial.tasks) ? partial.tasks : [];
  const { kept } = filterCandidateSteps(input.taskLabel, rawTasks, { goalTitle, answers });
  const baseSteps = kept.length >= 1 ? kept : pkg.suggestions;

  const tasks: SimplifiedTaskSuggestion[] = baseSteps.map((s, i) => {
    const fromServer = rawTasks.find(t => t.label === s.label) ?? rawTasks[i];
    // Prefer shared-core how-to/link matched by label so client and edge stay on one contract.
    const fromPkg = pkg.suggestions.find(p => p.label === s.label)
      ?? pkg.suggestions[i]
      ?? pkg.suggestions[0];
    const howTo = (fromPkg?.howTo && fromPkg.howTo.length > 0)
      ? fromPkg.howTo
      : (fromServer?.howTo && fromServer.howTo.length > 0 ? fromServer.howTo : []);
    return {
      label: s.label,
      timeOfDay: s.timeOfDay,
      howTo,
      resourceLink: fromPkg?.resourceLink ?? fromServer?.resourceLink,
      signalsUsed: fromServer?.signalsUsed ?? fromPkg?.signalsUsed,
    };
  });

  return {
    ok: tasks.length >= 1,
    requestId: partial.requestId || meta.requestId,
    taskId: partial.taskId || meta.taskId,
    originalTask: partial.originalTask || pkg.originalTask,
    answers: reviewAnswers,
    tasks,
    source: meta.source,
    reason: meta.reason ?? partial.reason,
  };
}

export async function parseContextTasksFromEdge(
  text: string,
  opts?: { preferRules?: boolean; mode?: 'profile' | 'goals' | 'tasks' },
): Promise<ParseContextTasksResult> {
  try {
    const { data, error } = await edgePost(`${FN}/parse-context-tasks`, {
      text,
      preferRules: opts?.preferRules ?? false,
      mode: opts?.mode ?? 'goals',
    });
    if (error) {
      const fallback = parseGoalInput(text);
      if (fallback.length > 0) {
        return { ok: true, groups: fallback, source: 'rules', reason: 'client_fallback' };
      }
      return { ok: false, groups: [], source: 'rules', reason: 'network_error' };
    }
    const payload = data as ParseContextTasksResult | null;
    if (!payload?.ok || !Array.isArray(payload?.groups) || payload.groups.length === 0) {
      const fallback = parseGoalInput(text);
      if (fallback.length > 0) {
        return { ok: true, groups: fallback, source: 'rules', reason: 'client_fallback' };
      }
      return { ok: false, groups: [], source: 'rules', reason: payload?.reason || 'empty' };
    }
    return {
      ok: true,
      groups: payload.groups,
      source: payload.source === 'llm' ? 'llm' : 'rules',
      reason: payload.reason,
    };
  } catch {
    const fallback = parseGoalInput(text);
    if (fallback.length > 0) {
      return { ok: true, groups: fallback, source: 'rules', reason: 'client_fallback' };
    }
    return { ok: false, groups: [], source: 'rules', reason: 'network_error' };
  }
}

// ──────────────────────────────────────────────
// AI-assisted task simplification (edge simplify-task)
// ──────────────────────────────────────────────

export interface SimplifyTaskInput {
  taskLabel: string;
  taskId?: string;
  requestId?: string;
  goalTitle?: string;
  goalWhy?: string;
  blocker?: string;
  motivation?: string;
  constraint?: string;
  /** @deprecated Prefer named fields; kept for callers that still send an array. */
  answers?: string[];
}

export interface SimplifiedTaskSuggestion {
  label: string;
  timeOfDay: 'morning' | 'evening';
  howTo?: string[];
  resourceLink?: { label: string; url: string };
  signalsUsed?: string[];
}

export interface SimplifyTaskResult {
  ok: boolean;
  requestId: string;
  taskId: string;
  originalTask: string;
  answers: AnswerReviewItem[];
  tasks: SimplifiedTaskSuggestion[];
  source: ParseContextSource;
  reason?: string;
}

function newClientRequestId(): string {
  return `simp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeClientAnswers(input: SimplifyTaskInput): SimplifyAnswers {
  const named = {
    blocker: (input.blocker ?? '').trim(),
    motivation: (input.motivation ?? '').trim(),
    constraint: (input.constraint ?? '').trim(),
  };
  if (named.blocker || named.motivation || named.constraint || !input.answers?.length) {
    return named;
  }
  const a = input.answers.map(x => (typeof x === 'string' ? x.trim() : ''));
  return {
    blocker: a[0] ?? '',
    motivation: a[1] ?? '',
    constraint: a[2] ?? '',
  };
}

function packageToClientResult(
  input: SimplifyTaskInput,
  answers: SimplifyAnswers,
  meta: { requestId: string; taskId: string; source: ParseContextSource; reason?: string },
): SimplifyTaskResult {
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  const pkg = buildSimplifyPackage({
    taskLabel: input.taskLabel,
    goalTitle,
    ...answers,
  });
  return {
    ok: pkg.suggestions.length >= 1,
    requestId: meta.requestId,
    taskId: meta.taskId,
    originalTask: pkg.originalTask,
    answers: pkg.answers,
    tasks: pkg.suggestions,
    source: meta.source,
    reason: meta.reason,
  };
}

/** Client-side mirror — uses shared task-anchored core (same validators as edge). */
export function ruleBasedSimplifyClient(input: SimplifyTaskInput): SimplifiedTaskSuggestion[] {
  const answers = normalizeClientAnswers(input);
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  return buildSimplifyPackage({
    taskLabel: input.taskLabel,
    goalTitle,
    ...answers,
  }).suggestions;
}

export async function simplifyTaskFromEdge(input: SimplifyTaskInput): Promise<SimplifyTaskResult> {
  const answers = normalizeClientAnswers(input);
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  const goalWhy = goalTitle ? input.goalWhy : undefined;
  const requestId = (input.requestId && input.requestId.trim()) || newClientRequestId();
  const taskId = (input.taskId && input.taskId.trim()) || '';
  const payload = {
    taskLabel: input.taskLabel,
    taskId,
    requestId,
    goalTitle,
    goalWhy,
    blocker: answers.blocker,
    motivation: answers.motivation,
    constraint: answers.constraint,
  };

  if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    const facts = buildTaskContextFromAnswers(answers);
    console.debug('[Simplify]', {
      taskLabel: input.taskLabel,
      taskId,
      requestId,
      complexity: classifyTaskComplexity(input.taskLabel),
      goalAccepted: !!goalTitle,
      goalDiscarded: !!input.goalTitle && !goalTitle,
      factCategories: facts.map(f => f.category),
      factCount: facts.length,
      answerLens: [answers.blocker, answers.motivation, answers.constraint].map(a => a.length),
      route: 'edge_first_then_shared_fallback',
    });
  }

  const fallback = (reason: string): SimplifyTaskResult =>
    normalizeSimplifyResult(input, answers, {}, {
      requestId,
      taskId,
      source: 'rules',
      reason,
    });

  // Single production path: try edge (LLM or rules on server), then shared-core fallback.
  // Atomic and decomposable use the same response contract via normalizeSimplifyResult.
  try {
    const { data, error } = await edgePost(`${FN}/simplify-task`, payload, {
      // Atomic replies should be fast after edge deploy; keep a hard ceiling for all paths.
      timeoutMs: classifyTaskComplexity(input.taskLabel) === 'atomic' ? 8_000 : 15_000,
    });

    if (error) {
      return fallback(error === 'timeout' ? 'timeout_fallback' : 'client_fallback');
    }

    const result = data as SimplifyTaskResult | null;
    if (result?.reason === 'input_too_short') {
      return {
        ok: false,
        requestId: result.requestId || requestId,
        taskId: result.taskId || taskId,
        originalTask: input.taskLabel,
        answers: result.answers ?? [],
        tasks: [],
        source: 'rules',
        reason: 'input_too_short',
      };
    }

    if (!result?.ok || !Array.isArray(result.tasks) || result.tasks.length < 1) {
      return fallback(result?.reason || 'empty_edge');
    }

    return normalizeSimplifyResult(input, answers, result, {
      requestId,
      taskId,
      source: result.source === 'llm' ? 'llm' : 'rules',
      reason: result.reason || 'edge',
    });
  } catch {
    return fallback('network_error');
  }
}

export { isGoalRelevantToTask, buildSimplifyPackage };
export type { AnswerReviewItem };
export type { DetailAssistInput, DetailAssistResult, SimplifyQuestionId };

// ──────────────────────────────────────────────
// Simplify detail-assist (clarification suggestions)
// ──────────────────────────────────────────────

export async function simplifyDetailAssistFromEdge(
  input: DetailAssistInput,
): Promise<DetailAssistResult> {
  const requestId =
    (input.requestId && input.requestId.trim())
    || `det_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const taskId = (input.taskId && input.taskId.trim()) || '';
  const payload = {
    taskLabel: input.taskLabel,
    taskId,
    requestId,
    questionId: input.questionId,
    currentAnswer: input.currentAnswer,
    refreshNonce: input.refreshNonce ?? 0,
  };

  const localFallback = (reason: string): DetailAssistResult => ({
    ...buildPrevalidatedSuggestions(
      { ...payload, requestId, taskId },
      'client_fallback',
    ),
    reason,
  });

  try {
    const { data, error } = await edgePost(`${FN}/simplify-detail-assist`, payload, {
      timeoutMs: 10_000,
    });
    if (error) {
      return localFallback(error === 'timeout' ? 'timeout_fallback' : 'client_fallback');
    }
    const result = data as DetailAssistResult | null;
    if (!result || !Array.isArray(result.suggestions)) {
      return localFallback('empty_edge');
    }

    // Re-validate every combined answer locally before UI render.
    const edgeValid = result.suggestions
      .filter(s => typeof s?.appendText === 'string' && typeof s?.validatedCombinedAnswer === 'string')
      .map((s, i) => {
        const combined = mergeAnswerWithAddition(input.currentAnswer, s.appendText);
        if (evaluateAnswerSufficiency(input.questionId, combined, input.taskLabel).status !== 'sufficient') {
          return null;
        }
        return {
          id: s.id || `s${i + 1}`,
          appendText: s.appendText.trim(),
          validatedCombinedAnswer: combined,
        };
      })
      .filter((s): s is NonNullable<typeof s> => !!s)
      .slice(0, 4);

    if (result.status === 'sufficient' || result.status === 'empty' || result.status === 'irrelevant') {
      return {
        requestId: result.requestId || requestId,
        taskId: result.taskId || taskId,
        questionId: input.questionId,
        status: result.status,
        suggestions: [],
        source: result.source === 'llm' ? 'llm' : 'server_rules',
        reason: result.reason,
        missingDetailType: result.missingDetailType,
      };
    }

    if (edgeValid.length >= 2) {
      return {
        requestId: result.requestId || requestId,
        taskId: result.taskId || taskId,
        questionId: input.questionId,
        status: 'needs_detail',
        missingDetailType: result.missingDetailType,
        suggestions: edgeValid,
        source: result.source === 'llm' ? 'llm' : 'server_rules',
        reason: result.reason || 'edge',
      };
    }

    return localFallback(result.reason || 'edge_unvalidated');
  } catch {
    return localFallback('network_error');
  }
}
