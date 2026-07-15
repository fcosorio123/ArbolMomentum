// Suggest how-to links / steps for a newly created task (LLM optional)

import * as kv from "./kv_store.tsx";

export interface TaskResource {
  title: string;
  url?: string;
  steps?: string[];
}

export interface SuggestResourcesResult {
  ok: boolean;
  resources: TaskResource[];
  source: "llm" | "rules";
  reason?: string;
}

function searchUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function ruleBasedResources(taskLabel: string, goalTitle?: string): TaskResource[] {
  const label = taskLabel.trim().replace(/\s+/g, " ");
  if (label.length < 2) return [];
  const t = label.toLowerCase();
  const context = goalTitle ? ` (${goalTitle})` : "";

  if (/hydrat|water|drink/.test(t)) {
    return [
      {
        title: "Hydration habit tips",
        url: searchUrl("how to drink more water daily tips"),
        steps: ["Keep a bottle in sight", "Drink a glass with each meal", "Set 2 phone reminders"],
      },
      { title: "How much water is enough?", url: searchUrl("daily water intake guidelines") },
    ];
  }
  if (/protein|breakfast|lunch|dinner|meal|eat|food/.test(t)) {
    return [
      {
        title: `Quick ideas for: ${label}`,
        url: searchUrl(`${label} easy healthy recipes`),
        steps: ["Use food you already have", "Aim for one clear protein source", "Prep a snack for later"],
      },
      { title: "High-protein meal ideas", url: searchUrl("high protein meal ideas quick") },
    ];
  }
  if (/walk|run|workout|gym|exercise|stretch|lift/.test(t)) {
    return [
      {
        title: `Start guide: ${label}`,
        url: searchUrl(`${label} beginner how to`),
        steps: ["Set a short timer", "Do the easiest version first", "Stop while it still feels doable"],
      },
    ];
  }
  if (/sleep|bed|wind.?down/.test(t)) {
    return [
      {
        title: "Better wind-down checklist",
        url: searchUrl("sleep hygiene wind down routine"),
        steps: ["Dim lights 30 min before bed", "Phone down outside reach", "Keep the same bedtime"],
      },
    ];
  }

  return [
    {
      title: `How to get this done${context}`,
      url: searchUrl(`how to ${label}`),
      steps: ["Define the first 5-minute action", "Gather only what you need to start", "Finish one small, visible win"],
    },
    { title: "Step-by-step search", url: searchUrl(`${label} step by step guide`) },
  ];
}

async function checkRateLimit(key: string): Promise<boolean> {
  const hourKey = `arbol-resources-rate-${key}-${new Date().toISOString().slice(0, 13)}`;
  const raw = await kv.get(hourKey);
  const count = typeof raw?.count === "number" ? raw.count : 0;
  if (count >= 40) return false;
  await kv.set(hourKey, { count: count + 1, at: Date.now() });
  return true;
}

async function callOpenAi(taskLabel: string, goalTitle?: string): Promise<TaskResource[] | null> {
  const apiKey = Deno.env.get("LLM_API_KEY")?.trim();
  if (!apiKey) return null;

  const model = Deno.env.get("LLM_MODEL")?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  const context = [
    `Task: ${taskLabel}`,
    goalTitle ? `Related goal (context only): ${goalTitle}` : "",
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
              'Suggest 2-4 practical resources to help someone complete a TASK. Return JSON only: '
              + '{"resources":[{"title":"...","url":"https://...","steps":["..."]}]}. '
              + "Rules: (1) Focus on the task, not the goal. "
              + "(2) Prefer helpful https links (guides, reputable how-tos) OR concrete steps when a link is uncertain. "
              + "(3) Do not invent fake domains; if unsure, omit url and provide steps, or use a Google search URL. "
              + "(4) Keep titles short. Max 5 steps each. No em dashes.",
          },
          { role: "user", content: context },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;
    const parsed = JSON.parse(content);
    const raw = Array.isArray(parsed?.resources) ? parsed.resources : [];
    const resources: TaskResource[] = raw
      .slice(0, 4)
      .map((r: { title?: string; url?: string; steps?: string[] }) => ({
        title: String(r.title ?? "").trim().slice(0, 100),
        url: typeof r.url === "string" && /^https?:\/\//i.test(r.url) ? r.url.trim() : undefined,
        steps: Array.isArray(r.steps)
          ? r.steps.filter((s) => typeof s === "string" && s.trim()).map((s: string) => s.trim().slice(0, 120)).slice(0, 5)
          : undefined,
      }))
      .filter((r: TaskResource) => r.title.length >= 3);
    return resources.length >= 1 ? resources : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function suggestTaskResources(
  input: { taskLabel: string; goalTitle?: string },
  opts?: { rateLimitKey?: string },
): Promise<SuggestResourcesResult> {
  const taskLabel = input.taskLabel?.trim() ?? "";
  if (taskLabel.length < 2) {
    return { ok: false, resources: [], source: "rules", reason: "input_too_short" };
  }

  const fallback = ruleBasedResources(taskLabel, input.goalTitle);
  const rateKey = opts?.rateLimitKey || "global";
  if (!(await checkRateLimit(rateKey))) {
    return { ok: true, resources: fallback, source: "rules", reason: "rate_limited" };
  }

  const llm = await callOpenAi(taskLabel, input.goalTitle);
  if (llm && llm.length >= 1) {
    return { ok: true, resources: llm, source: "llm" };
  }
  return { ok: true, resources: fallback, source: "rules", reason: "llm_unavailable" };
}
