// AI-assisted task simplification — replaces one task with 2–5 simpler checklist tasks

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
  /** Named answers preferred; legacy string[] still accepted. */
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

/**
 * Produce concrete simpler replacements for the original task —
 * not coaching prompts, not "clarify blocker", not motivational notes.
 */
export function ruleBasedSimplify(input: SimplifyTaskInput): SimplifiedTask[] {
  const label = input.taskLabel.trim().replace(/\s+/g, " ");
  const short = label.slice(0, 70);
  const { blocker, motivation, constraint } = normalizeSimplifyAnswers(input);

  const steps: string[] = [];

  // Always: a micro version of the actual task
  steps.push(`5-min start: ${short}`);

  // Prep / easier slice tied to the same work (use blocker only to shrink the action)
  if (blocker) {
    const hint = blocker.slice(0, 36);
    steps.push(`Easiest piece of "${short}" (skip: ${hint})`);
  } else {
    steps.push(`Prep what you need for: ${short}`);
  }

  // Finish a short complete win
  if (constraint) {
    steps.push(`Finish ${short} within ${constraint.slice(0, 36)}`);
  } else {
    steps.push(`Complete a short version of: ${short}`);
  }

  // Optional fourth: accountability framed as a doable task, not a note
  if (motivation) {
    steps.push(`${short} — then note win: ${motivation.slice(0, 40)}`);
  }

  // Dedupe near-identical labels
  const seen = new Set<string>();
  const unique = steps.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  while (unique.length < 2) {
    unique.push(`Do the first step of: ${short}`);
  }

  return unique.slice(0, 5).map((s, i) => ({
    label: s.slice(0, MAX_LABEL_CHARS),
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
    `Original task to replace: ${input.taskLabel}`,
    `What makes it hard: ${answers.blocker || "(no answer)"}`,
    `Motivation: ${answers.motivation || "(no answer)"}`,
    `Constraints: ${answers.constraint || "(no answer)"}`,
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
              'Replace ONE overwhelming task with 2–5 SIMPLER checklist tasks that are shorter versions or micro-steps OF that same work. Return JSON only: {"tasks":[{"label":"...","timeOfDay":"morning|evening"}]}. Rules: (1) Each label must read like a doable to-do the user can mark done (e.g. "Put protein on breakfast plate", not "Clarify why protein is hard"). (2) Do NOT invent coaching, reflections, "define next action", or echo the user\'s answers as the task. (3) Use the blocker only to shrink scope; respect constraints; prefer under-15-minute actions. (4) Labels max 120 chars. Always return at least 2 tasks that clearly relate to the original task.',
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
      .filter((t: SimplifiedTask) => t.label.length >= 3);

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
