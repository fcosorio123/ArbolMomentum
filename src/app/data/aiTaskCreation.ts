// ──────────────────────────────────────────────
// AI-assisted task creation (edge parse-context-tasks)
// ──────────────────────────────────────────────

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { parseGoalInput, type SeedSuggestionGroup } from './profileSeedParser';
import {
  ruleBasedSimplifyCore,
  filterCandidateSteps,
  isGoalRelevantToTask,
  buildTaskContextFromAnswers,
  type SimplifyAnswers,
} from './simplifyTaskCore';

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
async function edgePost(path: string, body: Record<string, unknown>): Promise<{ data: any; error: string | null }> {
  try {
    const res = await fetch(`${FN_BASE}/${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      return { data, error: data?.error || data?.message || `HTTP ${res.status}` };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: String(err) };
  }
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
}

export interface SimplifyTaskResult {
  ok: boolean;
  tasks: SimplifiedTaskSuggestion[];
  source: ParseContextSource;
  reason?: string;
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

/** Client-side mirror — uses shared task-anchored core (same validators as edge). */
export function ruleBasedSimplifyClient(input: SimplifyTaskInput): SimplifiedTaskSuggestion[] {
  const answers = normalizeClientAnswers(input);
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  return ruleBasedSimplifyCore({
    taskLabel: input.taskLabel,
    goalTitle,
    ...answers,
  });
}

export async function simplifyTaskFromEdge(input: SimplifyTaskInput): Promise<SimplifyTaskResult> {
  const answers = normalizeClientAnswers(input);
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  const goalWhy = goalTitle ? input.goalWhy : undefined;
  const payload = {
    taskLabel: input.taskLabel,
    goalTitle,
    goalWhy,
    blocker: answers.blocker,
    motivation: answers.motivation,
    constraint: answers.constraint,
  };

  // Dev observability (never log raw answer text)
  if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    const facts = buildTaskContextFromAnswers(answers);
    console.debug('[Simplify]', {
      taskLabel: input.taskLabel,
      goalAccepted: !!goalTitle,
      goalDiscarded: !!input.goalTitle && !goalTitle,
      factCategories: facts.map(f => f.category),
      factCount: facts.length,
    });
  }

  const clientFallback = (): SimplifyTaskResult => {
    const tasks = ruleBasedSimplifyClient({ ...input, goalTitle, ...answers });
    if (tasks.length >= 2) {
      return { ok: true, tasks, source: 'rules', reason: 'client_fallback' };
    }
    return { ok: false, tasks: [], source: 'rules', reason: tasks.length === 0 ? 'network_error' : 'no_suggestions' };
  };

  try {
    const { data, error } = await edgePost(`${FN}/simplify-task`, payload);
    if (error) {
      return clientFallback();
    }
    const result = data as SimplifyTaskResult | null;
    if (!result?.ok || !Array.isArray(result.tasks) || result.tasks.length < 2) {
      if (result?.reason === 'input_too_short') {
        return { ok: false, tasks: [], source: 'rules', reason: 'input_too_short' };
      }
      // Re-validate edge payload, then fallback
      if (result?.tasks?.length) {
        const { kept } = filterCandidateSteps(input.taskLabel, result.tasks, { goalTitle, answers });
        if (kept.length >= 2) {
          return { ok: true, tasks: kept, source: result.source === 'llm' ? 'llm' : 'rules', reason: result.reason };
        }
      }
      return clientFallback();
    }
    const { kept } = filterCandidateSteps(input.taskLabel, result.tasks, { goalTitle, answers });
    if (kept.length >= 2) {
      return {
        ok: true,
        tasks: kept,
        source: result.source === 'llm' ? 'llm' : 'rules',
        reason: result.reason,
      };
    }
    return clientFallback();
  } catch {
    return clientFallback();
  }
}

export { isGoalRelevantToTask };
