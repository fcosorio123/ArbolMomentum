// AI-assisted task simplification - task-anchored decomposition with answer context.
// Always returns answer-review data for UI. Atomic tasks prefer validated rules packages
// so device/time answers materially change the output.

import * as kv from "./kv_store.tsx";
import {
  ruleBasedSimplifyCore,
  filterCandidateSteps,
  isGoalRelevantToTask,
  buildTaskContextFromAnswers,
  classifyTaskComplexity,
  buildSimplifyPackage,
  type SimplifiedStep,
  type AnswerReviewItem,
  type SimplifiedSuggestion,
} from "./simplifyTaskCore.ts";

const RATE_LIMIT_PER_HOUR = 30;
const MAX_LABEL_CHARS = 120;

export interface SimplifyTaskAnswers {
  blocker?: string;
  motivation?: string;
  constraint?: string;
}

export interface SimplifyTaskInput {
  taskLabel: string;
  taskId?: string;
  requestId?: string;
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
  tasks: SimplifiedTask[];
  source: "llm" | "rules";
  reason?: string;
}

function newRequestId(): string {
  return `simp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function packageToResult(
  pkg: ReturnType<typeof buildSimplifyPackage>,
  meta: { requestId: string; taskId: string; source: "llm" | "rules"; reason?: string },
): SimplifyTaskResult {
  return {
    ok: pkg.suggestions.length >= 1,
    requestId: meta.requestId,
    taskId: meta.taskId,
    originalTask: pkg.originalTask,
    answers: pkg.answers,
    tasks: pkg.suggestions.map((s) => ({
      label: s.label,
      timeOfDay: s.timeOfDay,
      howTo: s.howTo,
      resourceLink: s.resourceLink,
      signalsUsed: s.signalsUsed,
    })),
    source: meta.source,
    reason: meta.reason,
  };
}

/** Attach how-to / links / answer review from rules package onto LLM labels. */
function enrichWithPackage(
  labels: SimplifiedStep[],
  pkg: ReturnType<typeof buildSimplifyPackage>,
  meta: { requestId: string; taskId: string; source: "llm" | "rules"; reason?: string },
): SimplifyTaskResult {
  const template = pkg.suggestions[0];
  const tasks: SimplifiedTask[] = labels.map((s, i) => {
    const fromPkg = pkg.suggestions[i];
    return {
      label: s.label,
      timeOfDay: s.timeOfDay,
      howTo: fromPkg?.howTo ?? template?.howTo ?? [],
      resourceLink: fromPkg?.resourceLink ?? template?.resourceLink,
      signalsUsed: fromPkg?.signalsUsed ?? template?.signalsUsed ?? [],
    };
  });
  return {
    ok: tasks.length >= 1,
    requestId: meta.requestId,
    taskId: meta.taskId,
    originalTask: pkg.originalTask,
    answers: pkg.answers,
    tasks,
    source: meta.source,
    reason: meta.reason,
  };
}

async function checkRateLimit(key: string): Promise<boolean> {
  const hourKey = `arbol-simplify-rate-${key}-${new Date().toISOString().slice(0, 13)}`;
  const raw = await kv.get(hourKey);
  const count = typeof raw?.count === "number" ? raw.count : 0;
  if (count >= RATE_LIMIT_PER_HOUR) return false;
  await kv.set(hourKey, { count: count + 1, at: Date.now() });
  return true;
}

async function callOpenAi(input: SimplifyTaskInput): Promise<SimplifiedStep[] | null> {
  const apiKey = Deno.env.get("LLM_API_KEY")?.trim();
  if (!apiKey) return null;

  const model = Deno.env.get("LLM_MODEL")?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const answers = normalizeSimplifyAnswers(input);
  const facts = buildTaskContextFromAnswers({
    blocker: answers.blocker,
    motivation: answers.motivation,
    constraint: answers.constraint,
  });
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  const goalWhy = goalTitle ? input.goalWhy : undefined;
  const complexity = classifyTaskComplexity(input.taskLabel);
  const maxSteps = complexity === "atomic" ? 2 : 5;

  const context = [
    `ORIGINAL TASK TO DECOMPOSE (anchor - every step must advance THIS task): ${input.taskLabel}`,
    `Complexity class: ${complexity} (atomic → exactly 2 compact actions; decomposable/broad → 2-${maxSteps}, never pad)`,
    `Internal task facts from answers (DO NOT quote or paraphrase into labels):`,
    ...facts.map((f) => `- [${f.category}/${f.influence}] ${f.fact}`),
    facts.length === 0 ? "- (no structured facts extracted)" : "",
    `Raw blocker (context only, never echo): ${answers.blocker || "(none)"}`,
    `Raw help (context only, never echo): ${answers.motivation || "(none)"}`,
    `Raw constraint (context only, never echo): ${answers.constraint || "(none)"}`,
    goalTitle ? `Relevant goal (secondary only): ${goalTitle}` : "Goal: excluded as irrelevant to this task",
    goalWhy ? `Goal why (secondary): ${goalWhy}` : "",
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
              "Decompose ONE original task into replacement checklist actions that complete THAT task. "
              + 'Return JSON only: {"tasks":[{"label":"...","timeOfDay":"morning|evening"}]}. '
              + "Rules: (1) Original task is the only object being simplified. "
              + "(2) Use answer-derived facts to change first action, tool, timing, size, order, or prerequisites - different answers must yield different labels. "
              + "(3) Never quote or paraphrase user answers. Never say because you said. "
              + "(4) Never repeat the original task as a suggestion. "
              + "(5) Never add lifestyle habits, goal plans, or unrelated tips (no sleep hygiene when the task is setting a reminder). "
              + "(6) Atomic tasks: return exactly 2 compact actions. Combine open-app + create. "
              + "Do NOT split choose-time / name / repeat / save into separate tracked tasks. "
              + "(7) Decomposable tasks: 2-5 only when pieces are genuinely separable. Never pad. "
              + "(8) If the user names iPhone or Android, name that platform’s app in the open step. "
              + "(9) Result must not feel larger/harder than the original. Max 120 chars per label.",
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
    const mapped: SimplifiedStep[] = raw
      .slice(0, maxSteps)
      .map((t: { label?: string; timeOfDay?: string }) => ({
        label: String(t.label ?? "").trim().slice(0, MAX_LABEL_CHARS),
        timeOfDay: (t.timeOfDay === "evening" ? "evening" : "morning") as "morning" | "evening",
      }));

    const { kept, rejected } = filterCandidateSteps(input.taskLabel, mapped, {
      goalTitle: goalTitle ?? null,
      answers: {
        blocker: answers.blocker,
        motivation: answers.motivation,
        constraint: answers.constraint,
      },
    });

    console.log("[SimplifyTask] LLM keep/reject", {
      kept: kept.length,
      rejected: rejected.map((r) => r.reason),
      goalAccepted: !!goalTitle,
      factCount: facts.length,
      complexity,
      maxSteps,
    });

    return kept.length >= 2 ? kept.slice(0, maxSteps) : null;
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
  const requestId = (input.requestId && String(input.requestId).trim()) || newRequestId();
  const taskId = (input.taskId && String(input.taskId).trim()) || "";

  if (taskLabel.length < 2) {
    return {
      ok: false,
      requestId,
      taskId,
      originalTask: taskLabel,
      answers: [],
      tasks: [],
      source: "rules",
      reason: "input_too_short",
    };
  }

  const answers = normalizeSimplifyAnswers(input);
  const goalTitle = isGoalRelevantToTask(taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  const complexity = classifyTaskComplexity(taskLabel);
  const pkg = buildSimplifyPackage({
    taskLabel,
    goalTitle,
    blocker: answers.blocker,
    motivation: answers.motivation,
    constraint: answers.constraint,
  });

  // Atomic: prefer rules so iPhone/Android/time answers always materialize in labels.
  if (complexity === "atomic") {
    return packageToResult(pkg, {
      requestId,
      taskId,
      source: "rules",
      reason: "atomic_rules_prefer",
    });
  }

  const rateKey = opts?.rateLimitKey || "global";
  if (!(await checkRateLimit(rateKey))) {
    return packageToResult(pkg, { requestId, taskId, source: "rules", reason: "rate_limited" });
  }

  const llmTasks = await callOpenAi({
    ...input,
    goalTitle,
    goalWhy: goalTitle ? input.goalWhy : undefined,
  });

  if (llmTasks && llmTasks.length >= 2) {
    return enrichWithPackage(llmTasks, pkg, { requestId, taskId, source: "llm" });
  }

  if (pkg.suggestions.length < 1) {
    return {
      ok: false,
      requestId,
      taskId,
      originalTask: pkg.originalTask,
      answers: pkg.answers,
      tasks: [],
      source: "rules",
      reason: "no_suggestions",
    };
  }

  return packageToResult(pkg, {
    requestId,
    taskId,
    source: "rules",
    reason: llmTasks ? "llm_filtered" : "llm_unavailable",
  });
}

/** @deprecated Prefer buildSimplifyPackage / simplifyTask. */
export function ruleBasedSimplify(input: SimplifyTaskInput): SimplifiedTask[] {
  const answers = normalizeSimplifyAnswers(input);
  const goalTitle = isGoalRelevantToTask(input.taskLabel, input.goalTitle) ? input.goalTitle : undefined;
  return ruleBasedSimplifyCore({
    taskLabel: input.taskLabel,
    goalTitle,
    ...answers,
  });
}

export type { AnswerReviewItem, SimplifiedSuggestion };
