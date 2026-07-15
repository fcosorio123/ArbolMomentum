// AI-assisted task simplification — break ONE task into 2–5 concrete micro-actions.
// User Q&A shapes HOW (time, energy, constraints, motivation). Never quote answers back.

import * as kv from "./kv_store.tsx";

const MAX_LABEL_CHARS = 120;
const RATE_LIMIT_PER_HOUR = 30;

export interface SimplifyTaskAnswers {
  blocker?: string;
  motivation?: string;
  constraint?: string;
}

export interface SimplifyTaskInput {
  taskLabel: string;
  goalTitle?: string;
  goalWhy?: string;
  blocker?: string;
  motivation?: string;
  constraint?: string;
  answers?: string[];
}

export interface SimplifiedTask {
  label: string;
  timeOfDay: "morning" | "evening";
}

export interface SimplifyTaskResult {
  ok: boolean;
  tasks: SimplifiedTask[];
  source: "llm" | "rules";
  reason?: string;
}

export function normalizeSimplifyAnswers(input: SimplifyTaskInput): Required<SimplifyTaskAnswers> {
  const fromNamed = {
    blocker: (input.blocker ?? "").trim(),
    motivation: (input.motivation ?? "").trim(),
    constraint: (input.constraint ?? "").trim(),
  };
  if (fromNamed.blocker || fromNamed.motivation || fromNamed.constraint || !input.answers?.length) {
    return fromNamed;
  }
  const a = input.answers.map((x) => (typeof x === "string" ? x.trim() : ""));
  return {
    blocker: a[0] ?? "",
    motivation: a[1] ?? "",
    constraint: a[2] ?? "",
  };
}

type Domain =
  | "hydration"
  | "eating"
  | "exercise"
  | "sleep"
  | "study"
  | "money"
  | "chores"
  | "generic";

interface AnswerSignals {
  minutes: number | null;
  lowEnergy: boolean;
  forgetful: boolean;
  noTime: boolean;
  vague: boolean;
  noMoney: boolean;
  atHome: boolean;
  morning: boolean;
  evening: boolean;
  solo: boolean;
  wantsTaste: boolean;
  familyWhy: boolean;
  healthWhy: boolean;
  needsReminder: boolean;
  wantsAccountability: boolean;
}

/** Extract actionable SIGNAL flags from answers — never paste answer text into labels. */
export function extractAnswerSignals(answers: Required<SimplifyTaskAnswers>): AnswerSignals {
  const blob = `${answers.blocker} ${answers.motivation} ${answers.constraint}`.toLowerCase();
  const minsMatch =
    answers.blocker.match(/(\d+)\s*-?\s*min/i)
    ?? answers.constraint.match(/(\d+)\s*-?\s*min/i)
    ?? blob.match(/(\d+)\s*-?\s*min/);
  const minutes = minsMatch ? Math.min(30, Math.max(2, Number(minsMatch[1]))) : null;

  return {
    minutes,
    lowEnergy: /tired|energy|exhaust|fatigue|low energy|drained/i.test(blob),
    forgetful: /forget|remember|distract|ADHD|adhd|lose track/i.test(blob),
    noTime: /time|busy|rush|rushed|quick|short|no time|structure|overwhelm|too much|complicated|hard/i
      .test(`${answers.blocker} ${answers.constraint}`),
    vague: /vague|don't know|dont know|not sure|where to start|too big|big|overwhelm/i.test(answers.blocker),
    noMoney: /money|cost|expensive|broke|budget|cheap|free/i.test(blob),
    atHome: /no (gym|equipment)|home only|at home|apartment|no gear/i.test(blob),
    morning: /morning|am\b|before work|after wake|breakfast/i.test(blob),
    evening: /evening|night|pm\b|before bed|after work|dinner/i.test(blob),
    solo: /alone|solo|by myself|no one/i.test(blob),
    wantsTaste: /taste|tasty|enjoy|good|like|delicious|fun/i.test(answers.motivation),
    familyWhy: /family|kids|wife|husband|partner|child|loved ones/i.test(answers.motivation),
    healthWhy: /health|strong|sharp|energy|focus|feel better/i.test(answers.motivation),
    needsReminder: /remind|alarm|notif|phone|calendar|cue|habit/i.test(blob),
    wantsAccountability: /accountab|partner|friend|coach|tell someone/i.test(blob),
  };
}

function detectDomain(taskLabel: string, contextBlob: string): Domain {
  const label = taskLabel.toLowerCase();
  const blob = contextBlob.toLowerCase();

  if (/hydrat|drink(?:ing)?\s+(?:enough\s+)?water|water\s+intake|fluids?|\b\d+\s*-?\s*\d*\s*l\b|liter|litre|oz\b.*water|water\b.*(?:day|target|goal)/i
    .test(label)) {
    return "hydration";
  }
  if (/hydrat|drink(?:ing)?\s+(?:enough\s+)?water|water\s+intake/i.test(blob)
    && !/protein|fruit|meal|snack|breakfast|lunch|dinner|eat\b/i.test(label)) {
    return "hydration";
  }

  if (/eat|food|meal|healthy|diet|nutrition|protein|fruit|veg|cook|snack/.test(label)) return "eating";
  if (/exercise|workout|gym|run|walk|fit|lift|cardio|stretch/.test(label)) return "exercise";
  if (/sleep|bed|wind.?down|rest|insomnia/.test(label)) return "sleep";
  if (/study|homework|read|class|exam|assignment|learn/.test(label)) return "study";
  if (/budget|money|save|spend|bill|expense/.test(label)) return "money";
  if (/clean|laundry|dishes|chore|organize|tid(y|ying)/.test(label)) return "chores";

  if (/eat|food|meal|healthy|diet|nutrition|protein|fruit|veg|cook|snack/.test(blob)) return "eating";
  if (/exercise|workout|gym|run|walk|fit|lift|cardio|stretch/.test(blob)) return "exercise";
  if (/sleep|bed|wind.?down|rest|insomnia/.test(blob)) return "sleep";
  if (/study|homework|read|class|exam|assignment|learn/.test(blob)) return "study";
  if (/budget|money|save|spend|bill|expense/.test(blob)) return "money";
  if (/clean|laundry|dishes|chore|organize|tid(y|ying)/.test(blob)) return "chores";
  return "generic";
}

function mention(haystack: string, re: RegExp): boolean {
  return re.test(haystack);
}

function shortActionNoun(label: string): string {
  return label
    .replace(/^(i\s+need\s+to|i\s+want\s+to|i\s+should|try\s+to|need\s+to|want\s+to)\s+/i, "")
    .replace(/^to\s+/i, "")
    .trim()
    .slice(0, 36) || "this";
}

/**
 * Build concrete micro-steps for the ORIGINAL task.
 * Answer signals change duration, effort, cues, and timing — they never appear as quoted text.
 */
export function ruleBasedSimplify(input: SimplifyTaskInput): SimplifiedTask[] {
  const label = input.taskLabel.trim().replace(/\s+/g, " ");
  const answers = normalizeSimplifyAnswers(input);
  const sig = extractAnswerSignals(answers);
  const blob = `${label} ${answers.blocker} ${answers.motivation} ${answers.constraint} ${input.goalTitle ?? ""}`;
  const domain = detectDomain(label, blob);
  const budget = sig.minutes ?? (sig.noTime || sig.vague || sig.lowEnergy ? 5 : 10);
  const steps: string[] = [];

  if (domain === "hydration") {
    if (sig.forgetful || sig.needsReminder) {
      steps.push("Fill a bottle now and place it where you will see it all morning");
    }
    steps.push(sig.morning
      ? "Drink one full glass of water with breakfast (or right after waking)"
      : "Drink a full glass of water right now");
    steps.push(sig.lowEnergy || sig.noTime
      ? `Take ${Math.min(8, Math.max(3, Math.round(budget / 2)))} sips of water before your next focused block`
      : "Drink a glass of water with (or instead of) your next snack craving");
    if (sig.needsReminder || sig.forgetful) {
      steps.push("Set one phone reminder for later today: drink a glass of water");
    } else {
      steps.push("Log glasses today and add one more before evening");
    }
    steps.push(sig.evening
      ? "Have one more glass of water with dinner"
      : "Refill your bottle once before midday ends");
  } else if (domain === "eating") {
    const protein = mention(label, /protein|chicken|egg|eggs|tofu|turkey|meat|whey|fish|salmon|tuna|beans?|lentil|greek\s*yogurt|cottage\s*cheese/)
      || mention(blob, /protein|chicken|egg|eggs|tofu|turkey|meat|whey|fish|salmon|tuna/);
    const fruit = mention(label, /fruit|apple|banana|berry|orange/) || mention(blob, /fruit|apple|banana|berry|orange/);
    const veg = mention(label, /veg|vegetable|salad|greens?/) || mention(blob, /veg|vegetable|salad|greens?/);

    if (protein) {
      steps.push(sig.noTime || sig.lowEnergy
        ? "Grab one high-protein snack you already have and eat it"
        : "Add a clear protein source to your next meal");
      steps.push(sig.wantsTaste
        ? "Choose a protein food you actually enjoy and eat one portion"
        : "Eat eggs, yogurt, chicken, fish, beans, or tofu once today");
      if (sig.noMoney) steps.push("Use a protein food already in your kitchen (eggs, beans, yogurt, tuna)");
      else steps.push(sig.morning ? "Include protein at breakfast today" : "Prep one high-protein snack for later today");
      steps.push("Drink water with that protein meal");
    } else if (fruit) {
      steps.push(sig.noMoney ? "Eat one piece of fruit you already have at home" : "Buy or grab one piece of fruit today");
      steps.push(sig.morning ? "Eat that fruit with breakfast" : "Eat that fruit with one meal");
      steps.push(sig.wantsTaste
        ? "Pick a fruit you actually like so it is easy to finish"
        : "Add one vegetable to lunch or dinner");
      steps.push(sig.noTime ? "Drink a full glass of water with your next meal" : "Prep one simple healthy snack for tomorrow");
    } else if (veg) {
      steps.push("Add one vegetable to lunch or dinner today");
      steps.push(sig.noTime || sig.lowEnergy
        ? "Eat a ready-to-eat veggie portion (bagged salad, baby carrots, or frozen veg)"
        : "Prep a ready-to-eat veggie portion for tomorrow");
      steps.push("Drink a full glass of water with your next meal");
      if (sig.wantsTaste) steps.push("Season or dress the vegetables so you actually want them");
    } else {
      steps.push(sig.noTime ? "Add one fruit to one meal today" : "Find one apple or banana you will actually eat");
      steps.push(sig.wantsTaste
        ? "Choose one healthy food that also tastes good to you"
        : "Add one vegetable to lunch or dinner");
      steps.push(sig.noMoney
        ? "Swap one snack for something already in your kitchen"
        : "Swap one processed snack for a whole-food option once");
      steps.push("Drink a full glass of water with your next meal");
    }
  } else if (domain === "exercise") {
    const walkMins = sig.minutes ?? (sig.noTime || sig.lowEnergy ? 10 : 20);
    steps.push(sig.atHome || sig.noMoney
      ? `Do a ${Math.min(walkMins, 15)}-minute walk or bodyweight movement at home`
      : `Walk for ${walkMins} minutes today`);
    steps.push(sig.lowEnergy
      ? "Do 3 minutes of gentle stretching while seated or standing"
      : "Do 5 minutes of stretching after you wake up or before bed");
    steps.push("Put on workout clothes with no pressure to finish a full session");
    steps.push(sig.solo
      ? "Do one set of a movement you already know, alone"
      : "Do one set of a movement you already know");
    if (sig.needsReminder) steps.push(`Set a phone alarm for a ${walkMins}-minute movement break`);
  } else if (domain === "sleep") {
    steps.push(sig.needsReminder
      ? "Set a phone-down reminder 30 minutes before bed"
      : "Put your phone away 30 minutes before bed");
    steps.push("Lights low and screens off for the last 15 minutes tonight");
    steps.push("Write tomorrow's top 1 task so your brain can settle");
    steps.push("Get in bed at a set time tonight (even if you are not sleepy yet)");
  } else if (domain === "study") {
    steps.push(sig.noTime || sig.vague || sig.lowEnergy
      ? `Study the hardest topic for ${budget} focused minutes`
      : "Study for one 25-minute block");
    steps.push("Open the material and complete only the first page or section");
    steps.push("Write three bullet notes from what you just covered");
    steps.push(sig.needsReminder
      ? "Set a calendar reminder for tomorrow's short study block"
      : "Schedule tomorrow's short study block on your calendar");
  } else if (domain === "money") {
    steps.push("Open your account and check today's balance");
    steps.push(sig.noTime ? "Write down today's purchases only" : "Write down every purchase from the last 24 hours");
    steps.push(sig.noMoney ? "Move the smallest amount you can into savings once" : "Move a tiny amount (even $5) into savings once");
    steps.push("Pick one upcoming bill and confirm the due date");
  } else if (domain === "chores") {
    steps.push(sig.lowEnergy || sig.noTime
      ? "Clear one small surface only (desk corner, counter spot, or nightstand)"
      : "Clear one small surface (desk, counter, or nightstand)");
    steps.push(`Put away ${sig.noTime ? 5 : 10} items that are out of place`);
    steps.push(sig.lowEnergy
      ? "Start one load of laundry or wash five dishes, then stop"
      : "Start one load of laundry or wash one sink of dishes");
    steps.push("Take out the trash or recycling");
  } else {
    const noun = shortActionNoun(label);
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

  // Soft boosters from motivation / constraints — still concrete actions, never quoted answers
  if (sig.familyWhy && domain !== "generic") {
    steps.push("Tell yourself this one action is for the people who matter, then start immediately");
  }
  if (sig.healthWhy && (domain === "hydration" || domain === "eating" || domain === "exercise")) {
    steps.push("Complete one action now that leaves you feeling sharper afterward");
  }
  if (sig.wantsAccountability) {
    steps.push("Text one person your plan before you start");
  }
  if (sig.solo && !steps.some((s) => /alone|solo/i.test(s))) {
    steps.push("Do this solo so you never wait on anyone");
  }

  const preferEvening = sig.evening && !sig.morning;
  const preferMorning = sig.morning && !sig.evening;

  const answerSnippets = [answers.blocker, answers.motivation, answers.constraint]
    .filter((s) => s.length >= 8)
    .map((s) => s.toLowerCase());

  const seen = new Set<string>();
  const unique = steps
    .map((s) => s.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_CHARS))
    .filter((s) => {
      const key = s.toLowerCase();
      if (s.length < 8 || seen.has(key)) return false;
      // Reject meta / answer-echo templates
      if (/^(5-min start:|easiest piece|finish .+ within|note win:|clarify |use this motivation|skip:|keep "|work around "|respect ")/i.test(s)) {
        return false;
      }
      if (/"[^"]{6,}"/.test(s)) return false;
      // Reject labels that largely paste a user answer
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
      ? (i % 2 === 0 ? "evening" : "morning")
      : preferMorning
        ? (i % 2 === 0 ? "morning" : "evening")
        : (i % 2 === 0 ? "morning" : "evening")) as "morning" | "evening",
  }));
}

async function checkRateLimit(key: string): Promise<boolean> {
  const hourKey = `arbol-simplify-rate-${key}-${new Date().toISOString().slice(0, 13)}`;
  const raw = await kv.get(hourKey);
  const count = typeof raw?.count === "number" ? raw.count : 0;
  if (count >= RATE_LIMIT_PER_HOUR) return false;
  await kv.set(hourKey, { count: count + 1, at: Date.now() });
  return true;
}

function rejectsEcho(label: string, answers: Required<SimplifyTaskAnswers>): boolean {
  const key = label.toLowerCase();
  if (/"[^"]{6,}"/.test(label)) return true;
  if (/^(5-min start:|easiest piece|keep "|work around "|respect "|note win:|skip:)/i.test(label)) return true;
  for (const raw of [answers.blocker, answers.motivation, answers.constraint]) {
    const snip = raw.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 24);
    if (snip.length >= 10 && key.includes(snip)) return true;
  }
  return false;
}

async function callOpenAi(input: SimplifyTaskInput): Promise<SimplifiedTask[] | null> {
  const apiKey = Deno.env.get("LLM_API_KEY")?.trim();
  if (!apiKey) return null;

  const model = Deno.env.get("LLM_MODEL")?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const answers = normalizeSimplifyAnswers(input);
  const sig = extractAnswerSignals(answers);

  const context = [
    `ORIGINAL TASK TO BREAK DOWN (this is what you simplify): ${input.taskLabel}`,
    `Signal - blocker theme (DO NOT quote this text in labels): ${answers.blocker || "(none)"}`,
    `Signal - motivation theme (DO NOT quote this text in labels): ${answers.motivation || "(none)"}`,
    `Signal - constraint theme (DO NOT quote this text in labels): ${answers.constraint || "(none)"}`,
    `Derived timing preference: ${sig.morning ? "morning" : sig.evening ? "evening" : "either"}`,
    `Derived time budget minutes: ${sig.minutes ?? (sig.noTime ? 5 : 10)}`,
    input.goalTitle ? `Related goal (background only): ${input.goalTitle}` : "",
    input.goalWhy ? `Goal why (background only): ${input.goalWhy}` : "",
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Break ONE overwhelming ORIGINAL TASK into 2-5 TINY checklist actions that replace it. Return JSON only: {"tasks":[{"label":"...","timeOfDay":"morning|evening"}]}. '
              + "YOU ARE SIMPLIFYING THE ORIGINAL TASK, not inventing a new topic. "
              + "Answers are SIGNALS for how to shape steps (shorter if busy, easier if tired, at-home if no gym, morning if mornings only). "
              + "CRITICAL: Never quote, paraphrase, or paste user answer text into labels. No quotation marks around their words. "
              + "Bad: Keep \"more energy\" in mind... / Work around \"I forget\"... / Respect \"only mornings\"... "
              + "Good: Drink a glass of water with breakfast / Put a filled bottle by the coffee maker. "
              + "Labels must be concrete doable actions under ~10 minutes when time is tight. Max 120 chars. At least 2 tasks. "
              + "Stay on the same topic as the original task (water stays water; protein stays protein).",
          },
          { role: "user", content: context },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) {
      console.log("[SimplifyTask] LLM HTTP error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    const parsed = JSON.parse(content);
    const raw = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    const tasks: SimplifiedTask[] = raw
      .slice(0, 5)
      .map((t: { label?: string; timeOfDay?: string }) => ({
        label: String(t.label ?? "").trim().slice(0, MAX_LABEL_CHARS),
        timeOfDay: t.timeOfDay === "evening" ? "evening" : "morning",
      }))
      .filter((t: SimplifiedTask) => t.label.length >= 6 && !rejectsEcho(t.label, answers));

    return tasks.length >= 2 ? tasks : null;
  } catch (err) {
    clearTimeout(timeout);
    console.log("[SimplifyTask] LLM call failed:", err);
    return null;
  }
}

export async function simplifyTask(
  input: SimplifyTaskInput,
  opts?: { rateLimitKey?: string },
): Promise<SimplifyTaskResult> {
  const taskLabel = input.taskLabel?.trim() ?? "";
  if (taskLabel.length < 2) {
    return { ok: false, tasks: [], source: "rules", reason: "input_too_short" };
  }

  const rateKey = opts?.rateLimitKey || "global";
  if (!(await checkRateLimit(rateKey))) {
    const tasks = ruleBasedSimplify(input).slice(0, 5);
    return { ok: tasks.length >= 2, tasks, source: "rules", reason: "rate_limited" };
  }

  const rulesTasks = ruleBasedSimplify(input).slice(0, 5);
  const llmTasks = await callOpenAi(input);

  // Prefer LLM when valid; still require answer-shaped rules if LLM ignored signals by returning generic fluff.
  if (llmTasks && llmTasks.length >= 2) {
    const answers = normalizeSimplifyAnswers(input);
    const hasAnswers = !!(answers.blocker || answers.motivation || answers.constraint);
    if (hasAnswers) {
      // Interleave: lead with 2 rule-based (guaranteed answer-shaped) then fill from LLM
      const seen = new Set<string>();
      const merged: SimplifiedTask[] = [];
      for (const t of [...rulesTasks.slice(0, 2), ...llmTasks, ...rulesTasks.slice(2)]) {
        const key = t.label.toLowerCase();
        if (seen.has(key) || rejectsEcho(t.label, answers)) continue;
        seen.add(key);
        merged.push(t);
        if (merged.length >= 5) break;
      }
      if (merged.length >= 2) return { ok: true, tasks: merged, source: "llm" };
    }
    return { ok: true, tasks: llmTasks, source: "llm" };
  }

  if (rulesTasks.length < 2) {
    return { ok: false, tasks: [], source: "rules", reason: "no_suggestions" };
  }
  return { ok: true, tasks: rulesTasks, source: "rules", reason: "llm_unavailable" };
}
