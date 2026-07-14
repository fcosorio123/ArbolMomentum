// AI-assisted task simplification — breaks one task into 2–5 smaller steps

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

export function ruleBasedSimplify(input: SimplifyTaskInput): SimplifiedTask[] {
  const label = input.taskLabel.trim();
  const { blocker, motivation, constraint } = normalizeSimplifyAnswers(input);

  const steps: string[] = [];
  if (blocker) steps.push(`Clarify blocker: ${blocker.slice(0, 60)}`);
  if (motivation) {
    steps.push(`Use this motivation: ${motivation.slice(0, 80)}`);
  }
  steps.push(`Spend 10 minutes on: ${label.slice(0, 72)}`);
  if (constraint) steps.push(`Work within constraint: ${constraint.slice(0, 60)}`);
  steps.push(`Define the very next action for "${label.slice(0, 40)}"`);

  return steps.slice(0, 5).map((s, i) => ({
    label: s.slice(0, MAX_LABEL_CHARS),
    timeOfDay: i % 2 === 0 ? "morning" : "evening",
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
    `Task: ${input.taskLabel}`,
    `Q1 — What makes this hard/vague/overwhelming? Answer: ${answers.blocker || "(no answer)"}`,
    `Q2 — What would make you feel motivated to take the next step today? Answer: ${answers.motivation || "(no answer)"}`,
    `Q3 — Any constraints (time, energy, tools, dependencies)? Answer: ${answers.constraint || "(no answer)"}`,
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Break an overwhelming task into 2–5 concrete, smaller tasks. Return JSON only: {"tasks":[{"label":"...","timeOfDay":"morning|evening"}]}. Labels max 120 chars. Each step should be doable in under 30 minutes. Personalize using the answers: use the blocker to shrink or clarify the first step; use motivation to frame steps toward accountability or outcome; respect constraints and do not invent specific facts the user did not provide. Prefer a useful guess over rejecting when answers are thin. Always return at least 2 steps.',
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
