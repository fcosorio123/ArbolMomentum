// AI-assisted task simplification — replaces one task with 2–5 real micro-actions

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
  | "eating"
  | "exercise"
  | "sleep"
  | "study"
  | "money"
  | "chores"
  | "generic";

function detectDomain(text: string): Domain {
  const t = text.toLowerCase();
  if (/eat|food|meal|healthy|diet|nutrition|protein|fruit|veg|hydrate|water|cook|snack/.test(t)) {
    return "eating";
  }
  if (/exercise|workout|gym|run|walk|fit|lift|cardio|stretch/.test(t)) return "exercise";
  if (/sleep|bed|wind.?down|rest|insomnia/.test(t)) return "sleep";
  if (/study|homework|read|class|exam|assignment|learn/.test(t)) return "study";
  if (/budget|money|save|spend|bill|expense/.test(t)) return "money";
  if (/clean|laundry|dishes|chore|organize|tid(y|ying)/.test(t)) return "chores";
  return "generic";
}

function mention(haystack: string, re: RegExp): boolean {
  return re.test(haystack);
}

/**
 * Real checklist micro-tasks — never wrap the original phrase,
 * never paste question answers into the label.
 */
export function ruleBasedSimplify(input: SimplifyTaskInput): SimplifiedTask[] {
  const label = input.taskLabel.trim().replace(/\s+/g, " ");
  const answers = normalizeSimplifyAnswers(input);
  const blob = `${label} ${answers.blocker} ${answers.motivation} ${answers.constraint} ${input.goalTitle ?? ""}`;
  const domain = detectDomain(blob);
  const tightTime = /time|min|busy|rushed|quick|short|structure|overwhelm|vague|big|hard|complicated/i
    .test(`${answers.blocker} ${answers.constraint}`);
  const likesTaste = /taste|tasty|enjoy|good|like|delicious/i.test(answers.motivation);

  const steps: string[] = [];

  if (domain === "eating") {
    // Anchor to original task keywords first (protein > fruit > veg > generic)
    if (mention(blob, /protein|chicken|egg|eggs|tofu|turkey|meat|whey|fish|salmon|tuna|beans?|lentil|greek\s*yogurt|cottage\s*cheese/)) {
      steps.push("Add a clear protein source to your next meal");
      steps.push("Eat eggs, yogurt, chicken, fish, beans, or tofu once today");
      steps.push(tightTime
        ? "Grab one high-protein snack you already have"
        : "Prep one high-protein snack for later today");
      steps.push(likesTaste
        ? "Choose a protein food you actually enjoy and eat a portion of it"
        : "Include protein at breakfast or the meal you usually skip");
      steps.push("Drink water with that protein meal");
    } else if (mention(blob, /fruit|apple|banana|berry|orange/)) {
      steps.push("Buy or grab one piece of fruit today");
      steps.push("Eat that fruit with one meal");
      steps.push(likesTaste
        ? "Choose one healthy food that also tastes good to you"
        : "Add one vegetable to lunch or dinner");
      steps.push(tightTime
        ? "Drink a full glass of water with your next meal"
        : "Prep one simple healthy snack for tomorrow");
      steps.push("Swap one processed snack for a whole-food option once");
    } else if (mention(blob, /veg|vegetable|salad|greens?/)) {
      steps.push("Add one vegetable to lunch or dinner today");
      steps.push("Prep a ready-to-eat veggie portion for tomorrow");
      steps.push("Eat a simple salad or steamed veg once");
      steps.push("Drink a full glass of water with your next meal");
    } else {
      steps.push("Add one fruit to one meal today");
      steps.push("Find one apple or banana you will actually eat");
      steps.push(likesTaste
        ? "Choose one healthy food that also tastes good to you"
        : "Add one vegetable to lunch or dinner");
      steps.push(tightTime
        ? "Drink a full glass of water with your next meal"
        : "Prep one simple healthy snack for tomorrow");
      steps.push("Swap one processed snack for a whole-food option once");
    }
  } else if (domain === "exercise") {
    steps.push(tightTime ? "Walk for 10 minutes today" : "Walk for 20 minutes today");
    steps.push("Do 5 minutes of stretching after you wake up or before bed");
    steps.push("Put on workout clothes — no pressure to finish a full session");
    steps.push("Do one set of a movement you already know");
  } else if (domain === "sleep") {
    steps.push("Set a phone-down reminder 30 minutes before bed");
    steps.push("Lights low and screens off for the last 15 minutes tonight");
    steps.push("Write tomorrow’s top 1 task so your brain can settle");
    steps.push("Get in bed at a set time tonight (even if you aren’t sleepy yet)");
  } else if (domain === "study") {
    steps.push(tightTime ? "Study the hardest topic for 10 focused minutes" : "Study for one 25-minute block");
    steps.push("Open the material and complete only the first page or section");
    steps.push("Write three bullet notes from what you just covered");
    steps.push("Schedule tomorrow’s short study block on your calendar");
  } else if (domain === "money") {
    steps.push("Open your account and check today’s balance");
    steps.push("Write down every purchase from the last 24 hours");
    steps.push("Move a tiny amount (even $5) into savings once");
    steps.push("Pick one upcoming bill and confirm the due date");
  } else if (domain === "chores") {
    steps.push("Clear one small surface (desk, counter, or nightstand)");
    steps.push("Put away 10 items that are out of place");
    steps.push("Start one load of laundry or wash one sink of dishes");
    steps.push("Take out the trash or recycling");
  } else {
    // Generic: narrow the original into concrete verbs without echoing the whole phrase
    const noun = label
      .replace(/^(i\s+need\s+to|i\s+want\s+to|i\s+should|try\s+to|need\s+to|want\s+to)\s+/i, "")
      .replace(/^to\s+/i, "")
      .trim()
      .slice(0, 40) || "this";
    steps.push(`Do the smallest possible version of ${noun} for 5 minutes`);
    steps.push(`Gather only what you need to start ${noun}`);
    steps.push(`Finish one visible win related to ${noun}`);
    if (tightTime) {
      steps.push(`Set a 10-minute timer and stop when it rings`);
    } else {
      steps.push(`Repeat that small win once more today`);
    }
  }

  const seen = new Set<string>();
  const unique = steps
    .map((s) => s.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_CHARS))
    .filter((s) => {
      const key = s.toLowerCase();
      if (s.length < 8 || seen.has(key)) return false;
      // Never ship meta / answer-echo templates
      if (/^(5-min start:|easiest piece|finish .+ within|note win:|clarify |use this motivation|skip:)/i.test(s)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  while (unique.length < 2) {
    unique.push("Take one tiny action toward your goal in the next 10 minutes");
  }

  return unique.slice(0, 5).map((s, i) => ({
    label: s,
    timeOfDay: (i % 2 === 0 ? "morning" : "evening") as "morning" | "evening",
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

async function callOpenAi(input: SimplifyTaskInput): Promise<SimplifiedTask[] | null> {
  const apiKey = Deno.env.get("LLM_API_KEY")?.trim();
  if (!apiKey) return null;

  const model = Deno.env.get("LLM_MODEL")?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const answers = normalizeSimplifyAnswers(input);

  const context = [
    input.goalTitle ? `Goal: ${input.goalTitle}` : "",
    input.goalWhy ? `Why: ${input.goalWhy}` : "",
    `Overwhelming task: ${input.taskLabel}`,
    `What's hard: ${answers.blocker || "(none)"}`,
    `What would motivate them: ${answers.motivation || "(none)"}`,
    `Constraints: ${answers.constraint || "(none)"}`,
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
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Simplify an overwhelming task into 2–5 TINY, concrete checklist actions the user can do today. Return JSON only: {"tasks":[{"label":"...","timeOfDay":"morning|evening"}]}. '
              + "Rules: (1) Labels must be real doable actions (Buy one apple, Walk 10 minutes, Drink a glass of water) — never meta wording. "
              + "(2) NEVER output templates like \"5-min start:\", \"Easiest piece of…\", \"note win:\", \"skip:\", or paste the user's answers into the task. "
              + "(3) Stay anchored to the ORIGINAL task keywords — if they said protein / workout / study, every suggestion must clearly involve that topic (do not invent unrelated food like fruit when the task was about protein). "
              + "(4) Prefer under-10-minute actions. Labels max 120 chars. Always return at least 2 tasks.",
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
      .filter((t: SimplifiedTask) =>
        t.label.length >= 6
        && !/^(5-min start:|easiest piece|finish .+ within|note win:|clarify |skip:)/i.test(t.label)
      );

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

  const llmTasks = await callOpenAi(input);
  if (llmTasks && llmTasks.length >= 2) {
    return { ok: true, tasks: llmTasks, source: "llm" };
  }

  const tasks = ruleBasedSimplify(input);
  if (tasks.length < 2) {
    return { ok: false, tasks: [], source: "rules", reason: "no_suggestions" };
  }
  return { ok: true, tasks: tasks.slice(0, 5), source: "rules", reason: "llm_unavailable" };
}
