// ──────────────────────────────────────────────
// AI-assisted task creation (edge parse-context-tasks)
// ──────────────────────────────────────────────

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { parseGoalInput, type SeedSuggestionGroup } from './profileSeedParser';

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

const MAX_SIMPLIFY_LABEL = 120;

function normalizeClientAnswers(input: SimplifyTaskInput): {
  blocker: string;
  motivation: string;
  constraint: string;
} {
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

/** Client-side mirror of edge ruleBasedSimplify (used when the invoke fails). */
export function ruleBasedSimplifyClient(input: SimplifyTaskInput): SimplifiedTaskSuggestion[] {
  const label = input.taskLabel.trim().replace(/\s+/g, ' ');
  const short = label.slice(0, 70);
  const { blocker, motivation, constraint } = normalizeClientAnswers(input);

  const steps: string[] = [];
  steps.push(`5-min start: ${short}`);
  if (blocker) {
    steps.push(`Easiest piece of "${short}" (skip: ${blocker.slice(0, 36)})`);
  } else {
    steps.push(`Prep what you need for: ${short}`);
  }
  if (constraint) {
    steps.push(`Finish ${short} within ${constraint.slice(0, 36)}`);
  } else {
    steps.push(`Complete a short version of: ${short}`);
  }
  if (motivation) {
    steps.push(`${short} — then note win: ${motivation.slice(0, 40)}`);
  }

  const seen = new Set<string>();
  const unique = steps.filter(s => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  while (unique.length < 2) {
    unique.push(`Do the first step of: ${short}`);
  }

  return unique.slice(0, 5).map((s, i) => ({
    label: s.slice(0, MAX_SIMPLIFY_LABEL),
    timeOfDay: (i % 2 === 0 ? 'morning' : 'evening') as 'morning' | 'evening',
  }));
}

export async function simplifyTaskFromEdge(input: SimplifyTaskInput): Promise<SimplifyTaskResult> {
  const answers = normalizeClientAnswers(input);
  const payload = {
    taskLabel: input.taskLabel,
    goalTitle: input.goalTitle,
    goalWhy: input.goalWhy,
    blocker: answers.blocker,
    motivation: answers.motivation,
    constraint: answers.constraint,
  };

  const clientFallback = (): SimplifyTaskResult => {
    const tasks = ruleBasedSimplifyClient({ ...input, ...answers });
    if (tasks.length >= 2) {
      return { ok: true, tasks, source: 'rules', reason: 'client_fallback' };
    }
    return { ok: false, tasks: [], source: 'rules', reason: 'network_error' };
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
      return clientFallback();
    }
    return {
      ok: true,
      tasks: result.tasks,
      source: result.source === 'llm' ? 'llm' : 'rules',
      reason: result.reason,
    };
  } catch {
    return clientFallback();
  }
}
