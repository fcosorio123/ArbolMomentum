// AI-assisted context parsing with provider abstraction + rule-based edge fallback

import * as kv from "./kv_store.tsx";
import {
  parseGoalInputRuleBased,
  type Recurrence,
  type SeedSuggestionGroup,
  type SeedTaskSuggestion,
  type TaskType,
} from "./ruleBasedSeedParser.ts";

const MAX_INPUT_CHARS = 4000;
const MAX_GOALS = 8;
const MAX_TASKS_PER_GOAL = 12;
const RATE_LIMIT_PER_HOUR = 20;

export type ParseSource = "llm" | "rules";

export interface ParseContextResult {
  ok: boolean;
  groups: SeedSuggestionGroup[];
  source: ParseSource;
  reason?: string;
}

interface RawLlmGroup {
  goal?: { title?: string; deepWhy?: string };
  tasks?: Array<{
    label?: string;
    timeOfDay?: string;
    type?: string;
    recurrence?: { type?: string; weekdays?: number[]; monthDates?: number[] };
  }>;
}

function normalizeRecurrence(raw?: { type?: string; weekdays?: number[]; monthDates?: number[] }): Recurrence {
  const type = raw?.type;
  if (type === "weekly") {
    const weekdays = Array.isArray(raw?.weekdays)
      ? raw!.weekdays!.filter((d) => d >= 0 && d <= 6).slice(0, 7)
      : [6];
    return { type: "weekly", weekdays: weekdays.length ? weekdays : [6] };
  }
  if (type === "monthly") {
    const monthDates = Array.isArray(raw?.monthDates)
      ? raw!.monthDates!.filter((d) => d >= 1 && d <= 31).slice(0, 4)
      : [1];
    return { type: "monthly", monthDates: monthDates.length ? monthDates : [1] };
  }
  if (type === "one-time") return { type: "one-time" };
  return { type: "daily" };
}

function normalizeTaskType(raw?: string): TaskType {
  if (raw === "priority" || raw === "goal" || raw === "routine") return raw;
  return "routine";
}

function normalizeTimeOfDay(raw?: string): "morning" | "evening" {
  return raw === "evening" ? "evening" : "morning";
}

function assignIds(groups: Array<{ goal: { title: string; deepWhy: string }; tasks: Array<Omit<SeedTaskSuggestion, 'id'>>; selected: boolean }>): SeedSuggestionGroup[] {
  let n = 0;
  const next = (prefix: string) => `${prefix}-${++n}`;
  return groups.map((g) => ({
    id: next("goal"),
    goal: {
      title: g.goal.title.slice(0, 80),
      deepWhy: g.goal.deepWhy.slice(0, 240),
    },
    selected: true,
    tasks: g.tasks.map((t) => ({
      id: next("task"),
      label: t.label.slice(0, 120),
      timeOfDay: normalizeTimeOfDay(t.timeOfDay),
      type: normalizeTaskType(t.type),
      recurrence: normalizeRecurrence(t.recurrence),
      selected: true,
    })),
  }));
}

function normalizeLlmGroups(raw: RawLlmGroup[]): SeedSuggestionGroup[] {
  const trimmed = raw.slice(0, MAX_GOALS).map((g) => {
    const title = (g.goal?.title ?? "Goal").trim();
    const deepWhy = (g.goal?.deepWhy ?? "A goal from your description.").trim();
    const tasks = (g.tasks ?? []).slice(0, MAX_TASKS_PER_GOAL).map((t) => ({
      label: (t.label ?? "").trim(),
      timeOfDay: normalizeTimeOfDay(t.timeOfDay),
      type: normalizeTaskType(t.type),
      recurrence: normalizeRecurrence(t.recurrence),
      selected: true,
    })).filter((t) => t.label.length >= 3);

    return {
      goal: { title: title || "Goal", deepWhy: deepWhy || "A goal from your description." },
      tasks,
      selected: true,
    };
  }).filter((g) => g.tasks.length > 0);

  return assignIds(trimmed);
}

async function checkRateLimit(key: string): Promise<boolean> {
  const now = Date.now();
  const hourKey = `arbol-parse-rate-${key}-${new Date().toISOString().slice(0, 13)}`;
  const raw = await kv.get(hourKey);
  const count = typeof raw?.count === "number" ? raw.count : 0;
  if (count >= RATE_LIMIT_PER_HOUR) return false;
  await kv.set(hourKey, { count: count + 1, at: now });
  return true;
}

async function callOpenAi(prompt: string): Promise<RawLlmGroup[] | null> {
  const apiKey = Deno.env.get("LLM_API_KEY")?.trim();
  if (!apiKey) return null;

  const model = Deno.env.get("LLM_MODEL")?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract goals and tasks from student life planning text. Return JSON only: {\"groups\":[{\"goal\":{\"title\",\"deepWhy\"},\"tasks\":[{\"label\",\"timeOfDay\":\"morning|evening\",\"type\":\"priority|goal|routine\",\"recurrence\":{\"type\":\"daily|weekly|monthly|one-time\",\"weekdays\":[0-6]}}]}]}. Use only user-mentioned items. Max 8 goals, 12 tasks per goal.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) {
      console.log("[ParseContext] OpenAI error:", res.status, await res.text());
      return null;
    }

    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    const parsed = JSON.parse(content);
    const groups = Array.isArray(parsed?.groups) ? parsed.groups : [];
    return groups as RawLlmGroup[];
  } catch (err) {
    clearTimeout(timeout);
    console.log("[ParseContext] LLM request failed:", err);
    return null;
  }
}

async function callLlmProvider(text: string): Promise<RawLlmGroup[] | null> {
  const provider = (Deno.env.get("LLM_PROVIDER")?.trim() || "openai").toLowerCase();
  if (provider === "openai" || provider === "none") {
    if (provider === "none") return null;
    return callOpenAi(text);
  }
  // Future providers hook here; unknown provider falls through to rules
  console.log("[ParseContext] Unknown LLM_PROVIDER:", provider);
  return null;
}

export async function parseContextTasks(
  text: string,
  opts?: { rateLimitKey?: string; preferRules?: boolean },
): Promise<ParseContextResult> {
  const trimmed = text.trim().slice(0, MAX_INPUT_CHARS);
  if (trimmed.length < 8) {
    return { ok: false, groups: [], source: "rules", reason: "input_too_short" };
  }

  const rateKey = opts?.rateLimitKey || "global";
  if (!(await checkRateLimit(rateKey))) {
    const fallback = parseGoalInputRuleBased(trimmed);
    return { ok: true, groups: fallback, source: "rules", reason: "rate_limited" };
  }

  if (!opts?.preferRules) {
    const llmRaw = await callLlmProvider(trimmed);
    if (llmRaw?.length) {
      const groups = normalizeLlmGroups(llmRaw);
      if (groups.length > 0) {
        return { ok: true, groups, source: "llm" };
      }
    }
  }

  const groups = parseGoalInputRuleBased(trimmed);
  return {
    ok: groups.length > 0,
    groups,
    source: "rules",
    reason: groups.length > 0 ? undefined : "no_suggestions",
  };
}
