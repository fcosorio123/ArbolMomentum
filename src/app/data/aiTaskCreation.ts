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
  const answers = normalizeClientAnswers(input);
  const blob = `${label} ${answers.blocker} ${answers.motivation} ${answers.constraint} ${input.goalTitle ?? ''}`;
  const t = blob.toLowerCase();

  const domain =
    /eat|food|meal|healthy|diet|nutrition|protein|fruit|veg|hydrate|water|cook|snack/.test(t) ? 'eating'
    : /exercise|workout|gym|run|walk|fit|lift|cardio|stretch/.test(t) ? 'exercise'
    : /sleep|bed|wind.?down|rest|insomnia/.test(t) ? 'sleep'
    : /study|homework|read|class|exam|assignment|learn/.test(t) ? 'study'
    : /budget|money|save|spend|bill|expense/.test(t) ? 'money'
    : /clean|laundry|dishes|chore|organize|tid(y|ying)/.test(t) ? 'chores'
    : 'generic';

  const tightTime = /time|min|busy|rushed|quick|short|structure|overwhelm|vague|big|hard|complicated/i
    .test(`${answers.blocker} ${answers.constraint}`);
  const likesTaste = /taste|tasty|enjoy|good|like|delicious/i.test(answers.motivation);

  const steps: string[] = [];
  if (domain === 'eating') {
    if (/fruit|apple|banana|berry|orange/.test(t)) {
      steps.push('Buy or grab one piece of fruit today');
      steps.push('Eat that fruit with one meal');
    } else {
      steps.push('Add one fruit to one meal today');
      steps.push('Find one apple or banana you will actually eat');
    }
    steps.push(likesTaste
      ? 'Choose one healthy food that also tastes good to you'
      : 'Add one vegetable to lunch or dinner');
    steps.push(tightTime
      ? 'Drink a full glass of water with your next meal'
      : 'Prep one simple healthy snack for tomorrow');
    steps.push('Swap one processed snack for a whole-food option once');
  } else if (domain === 'exercise') {
    steps.push(tightTime ? 'Walk for 10 minutes today' : 'Walk for 20 minutes today');
    steps.push('Do 5 minutes of stretching after you wake up or before bed');
    steps.push('Put on workout clothes — no pressure to finish a full session');
    steps.push('Do one set of a movement you already know');
  } else if (domain === 'sleep') {
    steps.push('Set a phone-down reminder 30 minutes before bed');
    steps.push('Lights low and screens off for the last 15 minutes tonight');
    steps.push('Write tomorrow’s top 1 task so your brain can settle');
    steps.push('Get in bed at a set time tonight (even if you aren’t sleepy yet)');
  } else if (domain === 'study') {
    steps.push(tightTime ? 'Study the hardest topic for 10 focused minutes' : 'Study for one 25-minute block');
    steps.push('Open the material and complete only the first page or section');
    steps.push('Write three bullet notes from what you just covered');
    steps.push('Schedule tomorrow’s short study block on your calendar');
  } else if (domain === 'money') {
    steps.push('Open your account and check today’s balance');
    steps.push('Write down every purchase from the last 24 hours');
    steps.push('Move a tiny amount (even $5) into savings once');
    steps.push('Pick one upcoming bill and confirm the due date');
  } else if (domain === 'chores') {
    steps.push('Clear one small surface (desk, counter, or nightstand)');
    steps.push('Put away 10 items that are out of place');
    steps.push('Start one load of laundry or wash one sink of dishes');
    steps.push('Take out the trash or recycling');
  } else {
    const noun = label
      .replace(/^(i\s+need\s+to|i\s+want\s+to|i\s+should|try\s+to|need\s+to|want\s+to)\s+/i, '')
      .replace(/^to\s+/i, '')
      .trim()
      .slice(0, 40) || 'this';
    steps.push(`Do the smallest possible version of ${noun} for 5 minutes`);
    steps.push(`Gather only what you need to start ${noun}`);
    steps.push(`Finish one visible win related to ${noun}`);
    steps.push(tightTime
      ? 'Set a 10-minute timer and stop when it rings'
      : `Repeat that small win once more today`);
  }

  const seen = new Set<string>();
  const unique = steps
    .map(s => s.replace(/\s+/g, ' ').trim().slice(0, MAX_SIMPLIFY_LABEL))
    .filter(s => {
      const key = s.toLowerCase();
      if (s.length < 8 || seen.has(key)) return false;
      if (/^(5-min start:|easiest piece|finish .+ within|note win:|clarify |use this motivation|skip:)/i.test(s)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  while (unique.length < 2) {
    unique.push('Take one tiny action toward your goal in the next 10 minutes');
  }

  return unique.slice(0, 5).map((s, i) => ({
    label: s,
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
