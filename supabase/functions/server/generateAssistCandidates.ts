// AI Assist Creation V2 — primary-object candidate generation (not SeedSuggestionGroup packages)

import * as kv from "./kv_store.tsx";
import type {
  AiAssistCreationType,
  AiAssistGenerationResponse,
  AiAssistReasonCode,
  AiAssistStarterResponse,
  CandidateDraft,
  GoalCandidate,
  GoalStarterTaskDraft,
  TaskCandidate,
} from "./aiAssistCreationTypes.ts";

const MAX_INPUT = 4000;
const RATE_LIMIT = 20;

const STOP = new Set([
  "a", "an", "the", "to", "and", "or", "of", "for", "my", "me", "i", "in", "on", "at",
  "with", "from", "into", "about", "that", "this", "be", "is", "are",
]);

function stemToken(t: string): string {
  if (t.length <= 4) return t;
  let s = t;
  if (s.endsWith("ies") && s.length > 5) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith("ing") && s.length > 6) s = s.slice(0, -3);
  else if (s.endsWith("ers") && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith("er") && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith("ance") && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith("ence") && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith("tion") && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith("sion") && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith("es") && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith("s") && s.length > 4 && !s.endsWith("ss")) s = s.slice(0, -1);
  if (s.endsWith("anc")) s = s.slice(0, -3);
  return s;
}

function normalizeTitle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(raw: string): Set<string> {
  const out = new Set<string>();
  for (const t of normalizeTitle(raw).split(" ")) {
    if (t.length >= 2 && !STOP.has(t)) out.add(stemToken(t));
  }
  return out;
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) {
    const na = normalizeTitle(a);
    const nb = normalizeTitle(b);
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    return 0;
  }
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function isNearDuplicate(candidate: string, priors: string[], threshold = 0.62): boolean {
  const nc = normalizeTitle(candidate);
  if (!nc) return true;
  const caTokens = [...tokens(candidate)];
  for (const p of priors) {
    if (nc === normalizeTitle(p)) return true;
    if (similarity(candidate, p) >= threshold) return true;
    const ca = caTokens.slice(0, 3).join(" ");
    const pa = [...tokens(p)].slice(0, 3).join(" ");
    if (ca && pa && ca === pa) return true;
    const ta = tokens(candidate);
    const tb = tokens(p);
    const smaller = ta.size <= tb.size ? ta : tb;
    const larger = ta.size <= tb.size ? tb : ta;
    if (smaller.size >= 3) {
      let hit = 0;
      for (const t of smaller) if (larger.has(t)) hit++;
      if (hit / smaller.size >= 0.8) return true;
    }
  }
  return false;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clip(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function extractFocus(text: string): string {
  const words = text.replace(/[^\w\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 8);
  return words.join(" ") || "this priority";
}

function rulesGoalCandidates(text: string, prior: string[]): GoalCandidate[] {
  const lower = text.toLowerCase();
  const family = /family|kids|schedule|realistic/.test(lower);
  const drafts: GoalCandidate[] = [];
  if (/exhaust|tired|energy|health|fit|exercise|gym|eat/.test(lower)) {
    drafts.push(
      {
        id: newId("g"),
        type: "goal",
        title: "Build a sustainable weekly fitness routine",
        previewReason: "Habit framing for energy and movement",
        suggestedFields: { deepWhy: family ? "Habits that fit a busy family schedule." : "Steady movement without burnout." },
        description: family ? "Habits that fit a busy family schedule." : "Steady movement without burnout.",
      },
      {
        id: newId("g"),
        type: "goal",
        title: "Improve daily energy through consistent movement",
        previewReason: "Energy-first outcome",
        suggestedFields: { deepWhy: "Feel less exhausted after work." },
        description: "Feel less exhausted after work.",
      },
      {
        id: newId("g"),
        type: "goal",
        title: family ? "Create healthier habits that fit my family schedule" : "Create healthier daily habits I can keep",
        previewReason: "Constraint-aware framing",
        suggestedFields: { deepWhy: "Realistic habits for real life." },
        description: "Realistic habits for real life.",
      },
    );
  } else if (/insur|claim|money|budget|financ/.test(lower)) {
    drafts.push(
      { id: newId("g"), type: "goal", title: "Regain control of my finances", previewReason: "Broad money outcome", suggestedFields: { deepWhy: "Clarity reduces money stress." }, description: "Clarity reduces money stress." },
      { id: newId("g"), type: "goal", title: "Resolve the open insurance issue", previewReason: "Concrete administrative outcome", suggestedFields: { deepWhy: "Close the loop on the denied claim." }, description: "Close the loop on the denied claim." },
      { id: newId("g"), type: "goal", title: "Build a simple weekly money review habit", previewReason: "Habit framing", suggestedFields: { deepWhy: "Short weekly check-ins prevent surprises." }, description: "Short weekly check-ins prevent surprises." },
    );
  } else {
    const focus = clip(extractFocus(text), 48);
    drafts.push(
      { id: newId("g"), type: "goal", title: `Make real progress on ${focus}`, previewReason: "Progress outcome", suggestedFields: { deepWhy: "Turn intention into a clear success picture." }, description: "Turn intention into a clear success picture." },
      { id: newId("g"), type: "goal", title: `Reduce friction around ${focus}`, previewReason: "Problem-relief framing", suggestedFields: { deepWhy: "Remove the biggest blockers first." }, description: "Remove the biggest blockers first." },
      { id: newId("g"), type: "goal", title: `Build a simple plan for ${focus}`, previewReason: "Planning framing", suggestedFields: { deepWhy: "A plan you can start this week." }, description: "A plan you can start this week." },
    );
  }
  return drafts.filter((d) => !isNearDuplicate(d.title, prior)).slice(0, 3);
}

function rulesTaskCandidates(text: string, prior: string[]): TaskCandidate[] {
  const lower = text.toLowerCase();
  const drafts: TaskCandidate[] = [];
  if (/insur|claim|deni|letter|call/.test(lower)) {
    drafts.push(
      { id: newId("t"), type: "task", title: "Review the denial letter and identify the stated reason", previewReason: "Understand the document", suggestedFields: { description: "Highlight reasons, deadlines, and appeal steps.", timeOfDay: "morning" }, description: "Highlight reasons, deadlines, and appeal steps." },
      { id: newId("t"), type: "task", title: "Prepare questions for the insurance company", previewReason: "Prepare before calling", suggestedFields: { description: "Write 3–5 questions and gather claim numbers.", timeOfDay: "morning" }, description: "Write 3–5 questions and gather claim numbers." },
      { id: newId("t"), type: "task", title: "Call the insurer about the denied claim", previewReason: "Direct action", suggestedFields: { description: "Call with notes and claim ID ready.", timeOfDay: "morning" }, description: "Call with notes and claim ID ready." },
      { id: newId("t"), type: "task", title: "Outline an appeal timeline with hard deadlines", previewReason: "Planning angle", suggestedFields: { description: "List filing dates, docs, and owners.", timeOfDay: "morning" }, description: "List filing dates, docs, and owners." },
      { id: newId("t"), type: "task", title: "Collect claim numbers and recent correspondence in one place", previewReason: "Organization prep", suggestedFields: { description: "Folder with claim ID, letters, policy number.", timeOfDay: "morning" }, description: "Folder with claim ID, letters, policy number." },
      { id: newId("t"), type: "task", title: "Draft a short script for the insurance call", previewReason: "Communication prep", suggestedFields: { description: "Opening line, 3 asks, success criteria.", timeOfDay: "evening" }, description: "Opening line, 3 asks, success criteria." },
    );
  } else {
    const focus = clip(extractFocus(text), 40);
    drafts.push(
      { id: newId("t"), type: "task", title: `Define the next concrete step for ${focus}`, previewReason: "Clarify first move", suggestedFields: { timeOfDay: "morning" } },
      { id: newId("t"), type: "task", title: `Gather what you need to start on ${focus}`, previewReason: "Unblocking prep", suggestedFields: { timeOfDay: "morning" } },
      { id: newId("t"), type: "task", title: `Spend 15 focused minutes on ${focus}`, previewReason: "Time-boxed action", suggestedFields: { timeOfDay: "evening" } },
      { id: newId("t"), type: "task", title: `Write the smallest done definition for ${focus}`, previewReason: "Clarify success", suggestedFields: { timeOfDay: "morning" } },
      { id: newId("t"), type: "task", title: `Remove one blocker related to ${focus}`, previewReason: "Unblocking", suggestedFields: { timeOfDay: "morning" } },
      { id: newId("t"), type: "task", title: `Ask one clarifying question about ${focus}`, previewReason: "Information gathering", suggestedFields: { timeOfDay: "evening" } },
    );
  }
  return drafts.filter((d) => !isNearDuplicate(d.title, prior)).slice(0, 3);
}

function rulesStarters(goalTitle: string, text: string, prior: string[]): GoalStarterTaskDraft[] {
  const lower = `${goalTitle} ${text}`.toLowerCase();
  const ideas: string[] = /fit|energy|health|exercise|movement/.test(lower)
    ? [
      "Schedule three 20-minute walks this week",
      "Prep workout clothes the night before",
      "Do a 10-minute stretch after dinner",
      "Write a realistic weekly movement plan",
      "Track energy after each short workout",
    ]
    : /money|budget|insur|claim/.test(lower)
    ? [
      "Gather claim numbers and recent letters",
      "List questions before calling support",
      "Call during posted business hours",
      "Note the agent name and next deadline",
      "Set a calendar reminder for follow-up",
    ]
    : [
      `Take one concrete action toward "${clip(goalTitle, 36)}" today`,
      `Spend 15 focused minutes on "${clip(goalTitle, 36)}"`,
      `Write the smallest next step for "${clip(goalTitle, 36)}"`,
      `Remove one blocker related to "${clip(goalTitle, 36)}"`,
      `Review progress on "${clip(goalTitle, 36)}" this weekend`,
    ];
  return ideas
    .filter((label) => !isNearDuplicate(label, prior))
    .slice(0, 5)
    .map((label, i) => ({
      id: newId("s"),
      clientKey: newId("sk"),
      label,
      selected: true,
      timeOfDay: i % 2 === 0 ? "morning" as const : "evening" as const,
    }));
}

async function checkRateLimit(key: string): Promise<boolean> {
  const hourKey = `arbol-assist-rate-${key}-${new Date().toISOString().slice(0, 13)}`;
  const raw = await kv.get(hourKey);
  const count = typeof raw?.count === "number" ? raw.count : 0;
  if (count >= RATE_LIMIT) return false;
  await kv.set(hourKey, { count: count + 1, at: Date.now() });
  return true;
}

async function callLlmCandidates(
  creationType: AiAssistCreationType,
  text: string,
  prior: string[],
): Promise<CandidateDraft[] | null> {
  const apiKey = Deno.env.get("LLM_API_KEY")?.trim();
  if (!apiKey) return null;
  const model = Deno.env.get("LLM_MODEL")?.trim() || "gpt-4o-mini";
  const system = creationType === "goal"
    ? 'Return JSON only: {"candidates":[{"title":string,"description"?:string,"previewReason":string}]}. Give exactly 3 meaningfully different GOAL (outcome) candidates based on the user brain dump. Titles must be outcome-driven, not feelings. Avoid paraphrases of each other or of priorTitles. Do not invent tasks.'
    : 'Return JSON only: {"candidates":[{"title":string,"description"?:string,"previewReason":string,"timeOfDay"?: "morning"|"evening"}]}. Give exactly 3 meaningfully different TASK (action) candidates. Verb-led titles. Avoid paraphrases of each other or priorTitles. Do not invent goals.';
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
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({ brainDump: text.slice(0, MAX_INPUT), priorTitles: prior }),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    const out: CandidateDraft[] = [];
    for (const raw of arr) {
      const title = String(raw?.title || "").trim();
      if (title.length < 3) continue;
      if (isNearDuplicate(title, [...prior, ...out.map((c) => c.title)])) continue;
      if (creationType === "goal") {
        out.push({
          id: newId("g"),
          type: "goal",
          title: title.slice(0, 80),
          description: raw?.description ? String(raw.description).slice(0, 240) : undefined,
          previewReason: raw?.previewReason ? String(raw.previewReason).slice(0, 120) : undefined,
          suggestedFields: raw?.description ? { deepWhy: String(raw.description).slice(0, 240) } : undefined,
        });
      } else {
        out.push({
          id: newId("t"),
          type: "task",
          title: title.slice(0, 120),
          description: raw?.description ? String(raw.description).slice(0, 240) : undefined,
          previewReason: raw?.previewReason ? String(raw.previewReason).slice(0, 120) : undefined,
          suggestedFields: {
            description: raw?.description ? String(raw.description).slice(0, 240) : undefined,
            timeOfDay: raw?.timeOfDay === "evening" ? "evening" : "morning",
          },
        });
      }
      if (out.length >= 3) break;
    }
    return out.length >= 2 ? out : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callLlmStarters(
  goalTitle: string,
  text: string,
  prior: string[],
): Promise<GoalStarterTaskDraft[] | null> {
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
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Return JSON only: {"tasks":[{"label":string,"timeOfDay"?: "morning"|"evening"}]}. Give 2–5 concrete verb-led starter tasks that support ONLY the given goal. No separate goals. Avoid priorTitles paraphrases.',
          },
          {
            role: "user",
            content: JSON.stringify({ goalTitle, brainDump: text.slice(0, MAX_INPUT), priorTitles: prior }),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    const out: GoalStarterTaskDraft[] = [];
    for (const raw of arr) {
      const label = String(raw?.label || "").trim();
      if (label.length < 3) continue;
      if (isNearDuplicate(label, [...prior, ...out.map((t) => t.label)])) continue;
      out.push({
        id: newId("s"),
        clientKey: newId("sk"),
        label: label.slice(0, 120),
        selected: true,
        timeOfDay: raw?.timeOfDay === "evening" ? "evening" : "morning",
      });
      if (out.length >= 5) break;
    }
    return out.length >= 2 ? out : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAssistCandidates(body: {
  requestId?: string;
  sessionId?: string;
  creationType?: string;
  text?: string;
  preferRules?: boolean;
  priorCandidateTitles?: string[];
}, opts?: { rateLimitKey?: string }): Promise<AiAssistGenerationResponse> {
  const requestId = typeof body.requestId === "string" ? body.requestId : newId("req");
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : newId("sess");
  const creationType: AiAssistCreationType = body.creationType === "task" ? "task" : "goal";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const prior = Array.isArray(body.priorCandidateTitles)
    ? body.priorCandidateTitles.filter((t) => typeof t === "string")
    : [];

  if (text.length < 8) {
    return { ok: false, requestId, sessionId, creationType, source: "server_rules", reason: "input_too_short", candidates: [] };
  }

  const allowed = await checkRateLimit(opts?.rateLimitKey || "anon");
  if (!allowed) {
    const candidates = creationType === "goal" ? rulesGoalCandidates(text, prior) : rulesTaskCandidates(text, prior);
    return {
      ok: candidates.length >= 2,
      requestId,
      sessionId,
      creationType,
      source: "server_rules",
      reason: "rate_limited",
      candidates,
    };
  }

  let reason: AiAssistReasonCode = "ok";
  let source: AiAssistGenerationResponse["source"] = "server_rules";
  let candidates: CandidateDraft[] | null = null;

  if (!body.preferRules) {
    candidates = await callLlmCandidates(creationType, text, prior);
    if (candidates) source = "llm";
    else reason = "llm_unavailable";
  } else {
    reason = "ok";
  }

  if (!candidates || candidates.length < 2) {
    candidates = creationType === "goal" ? rulesGoalCandidates(text, prior) : rulesTaskCandidates(text, prior);
    source = "server_rules";
    if (reason === "ok" && body.preferRules) reason = "ok";
  }

  return {
    ok: candidates.length >= 2,
    requestId,
    sessionId,
    creationType,
    source,
    reason: candidates.length >= 2 ? reason : "no_candidates",
    candidates,
  };
}

export async function generateAssistStarters(body: {
  requestId?: string;
  sessionId?: string;
  text?: string;
  goalTitle?: string;
  goalDeepWhy?: string;
  preferRules?: boolean;
  priorStarterTitles?: string[];
}, opts?: { rateLimitKey?: string }): Promise<AiAssistStarterResponse> {
  const requestId = typeof body.requestId === "string" ? body.requestId : newId("req");
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : newId("sess");
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const goalTitle = typeof body.goalTitle === "string" ? body.goalTitle.trim() : "Goal";
  const prior = Array.isArray(body.priorStarterTitles)
    ? body.priorStarterTitles.filter((t) => typeof t === "string")
    : [];

  await checkRateLimit(`starters-${opts?.rateLimitKey || "anon"}`);

  let tasks: GoalStarterTaskDraft[] | null = null;
  let source: AiAssistStarterResponse["source"] = "server_rules";
  let reason: AiAssistReasonCode = "ok";

  if (!body.preferRules) {
    tasks = await callLlmStarters(goalTitle, text, prior);
    if (tasks) source = "llm";
    else reason = "llm_unavailable";
  }

  if (!tasks || tasks.length < 2) {
    tasks = rulesStarters(goalTitle, text, prior);
    source = "server_rules";
  }

  return {
    ok: tasks.length >= 2,
    requestId,
    sessionId,
    source,
    reason: tasks.length >= 2 ? reason : "no_candidates",
    tasks,
  };
}
