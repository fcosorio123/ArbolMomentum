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
  const answerBlob = `${answers.blocker} ${answers.motivation} ${answers.constraint}`.toLowerCase();

  const minsMatch =
    answers.blocker.match(/(\d+)\s*-?\s*min/i)
    ?? answers.constraint.match(/(\d+)\s*-?\s*min/i)
    ?? answerBlob.match(/(\d+)\s*-?\s*min/);
  const minutes = minsMatch ? Math.min(30, Math.max(2, Number(minsMatch[1]))) : null;

  const sig = {
    minutes,
    lowEnergy: /tired|energy|exhaust|fatigue|low energy|drained/i.test(answerBlob),
    forgetful: /forget|remember|distract|ADHD|adhd|lose track/i.test(answerBlob),
    noTime: /time|busy|rush|rushed|quick|short|no time|structure|overwhelm|too much|complicated|hard/i
      .test(`${answers.blocker} ${answers.constraint}`),
    vague: /vague|don't know|dont know|not sure|where to start|too big|big|overwhelm/i.test(answers.blocker),
    noMoney: /money|cost|expensive|broke|budget|cheap|free/i.test(answerBlob),
    atHome: /no (gym|equipment)|home only|at home|apartment|no gear/i.test(answerBlob),
    morning: /morning|am\b|before work|after wake|breakfast/i.test(answerBlob),
    evening: /evening|night|pm\b|before bed|after work|dinner/i.test(answerBlob),
    solo: /alone|solo|by myself|no one/i.test(answerBlob),
    wantsTaste: /taste|tasty|enjoy|good|like|delicious|fun/i.test(answers.motivation),
    familyWhy: /family|kids|wife|husband|partner|child|loved ones/i.test(answers.motivation),
    healthWhy: /health|strong|sharp|energy|focus|feel better/i.test(answers.motivation),
    needsReminder: /remind|alarm|notif|phone|calendar|cue|habit/i.test(answerBlob),
    wantsAccountability: /accountab|partner|friend|coach|tell someone/i.test(answerBlob),
  };

  const labelL = label.toLowerCase();
  const t = blob.toLowerCase();
  const domain: string =
    /hydrat|drink(?:ing)?\s+(?:enough\s+)?water|water\s+intake|fluids?|\b\d+\s*-?\s*\d*\s*l\b|liter|litre|oz\b.*water|water\b.*(?:day|target|goal)/i.test(labelL)
      ? 'hydration'
    : /hydrat|drink(?:ing)?\s+(?:enough\s+)?water|water\s+intake/i.test(t) && !/protein|fruit|meal|snack|breakfast|lunch|dinner|eat\b/i.test(labelL)
      ? 'hydration'
    : /eat|food|meal|healthy|diet|nutrition|protein|fruit|veg|cook|snack/.test(labelL) ? 'eating'
    : /exercise|workout|gym|run|walk|fit|lift|cardio|stretch/.test(labelL) ? 'exercise'
    : /sleep|bed|wind.?down|rest|insomnia/.test(labelL) ? 'sleep'
    : /study|homework|read|class|exam|assignment|learn/.test(labelL) ? 'study'
    : /budget|money|save|spend|bill|expense/.test(labelL) ? 'money'
    : /clean|laundry|dishes|chore|organize|tid(y|ying)/.test(labelL) ? 'chores'
    : /eat|food|meal|healthy|diet|nutrition|protein|fruit|veg|cook|snack/.test(t) ? 'eating'
    : /exercise|workout|gym|run|walk|fit|lift|cardio|stretch/.test(t) ? 'exercise'
    : /sleep|bed|wind.?down|rest|insomnia/.test(t) ? 'sleep'
    : /study|homework|read|class|exam|assignment|learn/.test(t) ? 'study'
    : /budget|money|save|spend|bill|expense/.test(t) ? 'money'
    : /clean|laundry|dishes|chore|organize|tid(y|ying)/.test(t) ? 'chores'
    : 'generic';

  const budget = sig.minutes ?? (sig.noTime || sig.vague || sig.lowEnergy ? 5 : 10);
  const steps: string[] = [];

  if (domain === 'hydration') {
    if (sig.forgetful || sig.needsReminder) {
      steps.push('Fill a bottle now and place it where you will see it all morning');
    }
    steps.push(sig.morning
      ? 'Drink one full glass of water with breakfast (or right after waking)'
      : 'Drink a full glass of water right now');
    steps.push(sig.lowEnergy || sig.noTime
      ? `Take ${Math.min(8, Math.max(3, Math.round(budget / 2)))} sips of water before your next focused block`
      : 'Drink a glass of water with (or instead of) your next snack craving');
    if (sig.needsReminder || sig.forgetful) {
      steps.push('Set one phone reminder for later today: drink a glass of water');
    } else {
      steps.push('Log glasses today and add one more before evening');
    }
    steps.push(sig.evening
      ? 'Have one more glass of water with dinner'
      : 'Refill your bottle once before midday ends');
  } else if (domain === 'eating') {
    const protein = /protein|chicken|egg|eggs|tofu|turkey|meat|whey|fish|salmon|tuna|beans?|lentil|greek\s*yogurt|cottage\s*cheese/.test(labelL)
      || /protein|chicken|egg|eggs|tofu|turkey|meat|whey|fish|salmon|tuna/.test(t);
    const fruit = /fruit|apple|banana|berry|orange/.test(labelL) || /fruit|apple|banana|berry|orange/.test(t);
    const veg = /veg|vegetable|salad|greens?/.test(labelL) || /veg|vegetable|salad|greens?/.test(t);

    if (protein) {
      steps.push(sig.noTime || sig.lowEnergy
        ? 'Grab one high-protein snack you already have and eat it'
        : 'Add a clear protein source to your next meal');
      steps.push(sig.wantsTaste
        ? 'Choose a protein food you actually enjoy and eat one portion'
        : 'Eat eggs, yogurt, chicken, fish, beans, or tofu once today');
      if (sig.noMoney) steps.push('Use a protein food already in your kitchen (eggs, beans, yogurt, tuna)');
      else steps.push(sig.morning ? 'Include protein at breakfast today' : 'Prep one high-protein snack for later today');
      steps.push('Drink water with that protein meal');
    } else if (fruit) {
      steps.push(sig.noMoney ? 'Eat one piece of fruit you already have at home' : 'Buy or grab one piece of fruit today');
      steps.push(sig.morning ? 'Eat that fruit with breakfast' : 'Eat that fruit with one meal');
      steps.push(sig.wantsTaste
        ? 'Pick a fruit you actually like so it is easy to finish'
        : 'Add one vegetable to lunch or dinner');
      steps.push(sig.noTime ? 'Drink a full glass of water with your next meal' : 'Prep one simple healthy snack for tomorrow');
    } else if (veg) {
      steps.push('Add one vegetable to lunch or dinner today');
      steps.push(sig.noTime || sig.lowEnergy
        ? 'Eat a ready-to-eat veggie portion (bagged salad, baby carrots, or frozen veg)'
        : 'Prep a ready-to-eat veggie portion for tomorrow');
      steps.push('Drink a full glass of water with your next meal');
      if (sig.wantsTaste) steps.push('Season or dress the vegetables so you actually want them');
    } else {
      steps.push(sig.noTime ? 'Add one fruit to one meal today' : 'Find one apple or banana you will actually eat');
      steps.push(sig.wantsTaste
        ? 'Choose one healthy food that also tastes good to you'
        : 'Add one vegetable to lunch or dinner');
      steps.push(sig.noMoney
        ? 'Swap one snack for something already in your kitchen'
        : 'Swap one processed snack for a whole-food option once');
      steps.push('Drink a full glass of water with your next meal');
    }
  } else if (domain === 'exercise') {
    const walkMins = sig.minutes ?? (sig.noTime || sig.lowEnergy ? 10 : 20);
    steps.push(sig.atHome || sig.noMoney
      ? `Do a ${Math.min(walkMins, 15)}-minute walk or bodyweight movement at home`
      : `Walk for ${walkMins} minutes today`);
    steps.push(sig.lowEnergy
      ? 'Do 3 minutes of gentle stretching while seated or standing'
      : 'Do 5 minutes of stretching after you wake up or before bed');
    steps.push('Put on workout clothes with no pressure to finish a full session');
    steps.push(sig.solo
      ? 'Do one set of a movement you already know, alone'
      : 'Do one set of a movement you already know');
    if (sig.needsReminder) steps.push(`Set a phone alarm for a ${walkMins}-minute movement break`);
  } else if (domain === 'sleep') {
    steps.push(sig.needsReminder
      ? 'Set a phone-down reminder 30 minutes before bed'
      : 'Put your phone away 30 minutes before bed');
    steps.push('Lights low and screens off for the last 15 minutes tonight');
    steps.push("Write tomorrow's top 1 task so your brain can settle");
    steps.push('Get in bed at a set time tonight (even if you are not sleepy yet)');
  } else if (domain === 'study') {
    steps.push(sig.noTime || sig.vague || sig.lowEnergy
      ? `Study the hardest topic for ${budget} focused minutes`
      : 'Study for one 25-minute block');
    steps.push('Open the material and complete only the first page or section');
    steps.push('Write three bullet notes from what you just covered');
    steps.push(sig.needsReminder
      ? "Set a calendar reminder for tomorrow's short study block"
      : "Schedule tomorrow's short study block on your calendar");
  } else if (domain === 'money') {
    steps.push("Open your account and check today's balance");
    steps.push(sig.noTime ? "Write down today's purchases only" : 'Write down every purchase from the last 24 hours');
    steps.push(sig.noMoney ? 'Move the smallest amount you can into savings once' : 'Move a tiny amount (even $5) into savings once');
    steps.push('Pick one upcoming bill and confirm the due date');
  } else if (domain === 'chores') {
    steps.push(sig.lowEnergy || sig.noTime
      ? 'Clear one small surface only (desk corner, counter spot, or nightstand)'
      : 'Clear one small surface (desk, counter, or nightstand)');
    steps.push(`Put away ${sig.noTime ? 5 : 10} items that are out of place`);
    steps.push(sig.lowEnergy
      ? 'Start one load of laundry or wash five dishes, then stop'
      : 'Start one load of laundry or wash one sink of dishes');
    steps.push('Take out the trash or recycling');
  } else {
    const noun = label
      .replace(/^(i\s+need\s+to|i\s+want\s+to|i\s+should|try\s+to|need\s+to|want\s+to)\s+/i, '')
      .replace(/^to\s+/i, '')
      .trim()
      .slice(0, 36) || 'this';
    steps.push(`Spend ${budget} minutes on the smallest useful piece of ${noun}`);
    steps.push(sig.vague || sig.forgetful
      ? `Write the very next physical action for ${noun} in one line, then do it`
      : `Gather only what you need to start ${noun}`);
    steps.push(sig.lowEnergy
      ? `Do a low-effort version of ${noun} for ${Math.max(2, Math.floor(budget / 2))} minutes`
      : `Finish one visible win related to ${noun}`);
    if (sig.noMoney) steps.push(`Use only free tools or things you already have for ${noun}`);
    else if (sig.needsReminder) steps.push(`Set one phone reminder so you return to ${noun}`);
    else steps.push(sig.noTime ? `Set a ${budget}-minute timer and stop when it rings` : `Repeat that small win once more today`);
  }

  if (sig.familyWhy && domain !== 'generic') {
    steps.push('Tell yourself this one action is for the people who matter, then start immediately');
  }
  if (sig.healthWhy && (domain === 'hydration' || domain === 'eating' || domain === 'exercise')) {
    steps.push('Complete one action now that leaves you feeling sharper afterward');
  }
  if (sig.wantsAccountability) {
    steps.push('Text one person your plan before you start');
  }
  if (sig.solo && !steps.some(s => /alone|solo/i.test(s))) {
    steps.push('Do this solo so you never wait on anyone');
  }

  const preferEvening = sig.evening && !sig.morning;
  const preferMorning = sig.morning && !sig.evening;
  const answerSnippets = [answers.blocker, answers.motivation, answers.constraint]
    .filter(s => s.length >= 8)
    .map(s => s.toLowerCase());

  const seen = new Set<string>();
  const unique = steps
    .map(s => s.replace(/\s+/g, ' ').trim().slice(0, MAX_SIMPLIFY_LABEL))
    .filter(s => {
      const key = s.toLowerCase();
      if (s.length < 8 || seen.has(key)) return false;
      if (/^(5-min start:|easiest piece|finish .+ within|note win:|clarify |use this motivation|skip:|keep "|work around "|respect ")/i.test(s)) {
        return false;
      }
      if (/"[^"]{6,}"/.test(s)) return false;
      for (const snip of answerSnippets) {
        const clip = snip.slice(0, 24);
        if (clip.length >= 10 && key.includes(clip)) return false;
      }
      seen.add(key);
      return true;
    });

  while (unique.length < 2) {
    unique.push(`Take one tiny action on this task in the next ${budget} minutes`);
  }

  return unique.slice(0, 5).map((s, i) => ({
    label: s,
    timeOfDay: (preferEvening
      ? (i % 2 === 0 ? 'evening' : 'morning')
      : preferMorning
        ? (i % 2 === 0 ? 'morning' : 'evening')
        : (i % 2 === 0 ? 'morning' : 'evening')) as 'morning' | 'evening',
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
