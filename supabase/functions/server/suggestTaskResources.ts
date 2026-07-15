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

  // Reminder / alarm — before sleep matching on "bed"
  if (
    /(set|create|add|make|schedule).*(remind|alarm|notif)/i.test(t)
    || /phone-?down/i.test(t)
    || (/remind|alarm/i.test(t) && /phone|bed/i.test(t))
  ) {
    return [
      {
        title: "Set a Phone down reminder (step by step)",
        url: searchUrl("how to set a repeating reminder or alarm on iPhone or Android"),
        steps: [
          "Open Clock (Alarm) or the Reminders app on your phone",
          "Tap Add Alarm / New Reminder",
          "Choose a time 30 minutes before your usual bedtime",
          "Turn on Repeat for every night (or weekdays)",
          "Name it Phone down, then Save",
        ],
      },
      {
        title: "Apple: Create a repeating reminder",
        url: "https://support.apple.com/guide/iphone/get-started-with-reminders-iph2f43d3267/ios",
      },
      {
        title: "Android: Set a repeating alarm",
        url: searchUrl("set repeating alarm Android Clock app Google"),
      },
    ];
  }

  if (/cancel .+ (subscription|software|account)|unsubscribe/i.test(t)) {
    return [
      {
        title: `Cancel this subscription: ${label}`,
        url: searchUrl(`${label} how to cancel subscription confirmation email`),
        steps: [
          "Search your email for the signup or billing confirmation",
          "Open the cancellation or manage-subscription link",
          "Confirm cancel and screenshot the confirmation page",
        ],
      },
    ];
  }

  if (/call .+|phone the |denied claim|insurance/i.test(t)) {
    return [
      {
        title: "Prepare then make the call",
        url: searchUrl(`${label} what to say phone script`),
        steps: [
          "Find the claim or account number on the latest notice",
          "Write the denial reason and two questions to ask",
          "Call during your available window with notes in front of you",
        ],
      },
    ];
  }

  if (/organiz|documents? needed|tax appointment|sort .+ (document|bill)/i.test(t)) {
    return [
      {
        title: "Document folder workflow",
        url: searchUrl(`${label} checklist documents needed`),
        steps: [
          "Get the required-document list from your preparer or portal",
          "Create one folder (digital or paper) for this appointment",
          "Add documents you already have; list what is still missing",
        ],
      },
    ];
  }

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
  if (/^(sleep|go to bed|wind.?down|get (more )?sleep)/i.test(t) || (/sleep|wind.?down/.test(t) && !/remind|alarm|phone-?down/.test(t))) {
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
      url: searchUrl(`how to ${label} step by step`),
      steps: [
        `Start the first concrete action for: ${label.slice(0, 40)}`,
        "Use only the app or tool needed for that action",
        "Finish that one action before adding more work",
      ],
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
