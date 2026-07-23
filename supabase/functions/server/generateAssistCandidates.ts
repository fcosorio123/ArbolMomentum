// AI Assist Creation V2 - primary-object candidate generation (not SeedSuggestionGroup packages)

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
  const push = (
    title: string,
    previewReason: string,
    description?: string,
    timeOfDay: "morning" | "evening" = "morning",
  ) => {
    drafts.push({
      id: newId("t"),
      type: "task",
      title,
      previewReason,
      description,
      suggestedFields: description
        ? { description, timeOfDay }
        : { timeOfDay },
    });
  };

  // Insurance / claims — do NOT match bare "call" (that stole "Call mom tonight").
  if (/insur|claim|deni|appeal|policy/.test(lower)) {
    push("Review the denial letter and identify the stated reason", "Understand the document", "Highlight reasons, deadlines, and appeal steps.");
    push("Prepare questions for the insurance company", "Prepare before calling", "Write 3–5 questions and gather claim numbers.");
    push("Call the insurer about the denied claim", "Direct action", "Call with notes and claim ID ready.");
    push("Outline an appeal timeline with hard deadlines", "Planning angle", "List filing dates, docs, and owners.");
    push("Collect claim numbers and recent correspondence in one place", "Organization prep", "Folder with claim ID, letters, policy number.");
    push("Draft a short script for the insurance call", "Communication prep", "Opening line, 3 asks, success criteria.", "evening");
  } else if (/report|essay|paper|presentation|thesis|write-?up|\bdeck\b|slides?/.test(lower)) {
    push("Draft the project outline", "Structure first", "Section list and success criteria for the deliverable.");
    push("Complete the introduction", "Lead section", "Write the opening that sets scope and stakes.");
    push("Gather supporting data", "Evidence", "Collect figures, sources, or notes the report needs.");
    push("Write the remaining sections", "Core drafting", "Fill body sections against the outline.");
    push("Proofread the report", "Quality pass", "Fix clarity, typos, and formatting.");
    push("Submit the final report", "Close the loop", "Send or file by the deadline.");
  } else if (/exercise|workout|\bgym\b|fitness|\brun\b|jog|stretch|go to the gym|gto the gym/.test(lower)) {
    push("Put on workout clothes and stretch for 5 minutes", "Start frictionless", "Lower the barrier to beginning.");
    push("Do a 20-minute workout or brisk walk", "Primary action", "Pick a realistic duration and finish it.");
    push("Log how you felt after exercising", "Feedback loop", "Note energy and anything to adjust next time.", "evening");
    push("Schedule the next workout on the calendar", "Follow-through", "Protect a repeat slot this week.");
    push("Prep a water bottle and shoes by the door", "Remove blockers", "Make tomorrow’s session automatic.", "evening");
    push("Choose tomorrow’s workout type (walk, strength, or stretch)", "Plan lightly", "Decide once so you don’t stall later.", "evening");
  } else if (/\bcall\b|\bphone\b|\btext\b/.test(lower)) {
    const who = clip(
      text.replace(/^(call|phone|text)\s+/i, "").replace(/\b(tonight|today|tomorrow|this evening)\b/gi, "").trim() ||
        extractFocus(text),
      36,
    );
    push(`Call ${who}`, "Direct action", "Make the call with a clear purpose.");
    push(`Jot 3 talking points before calling ${who}`, "Prep", "Keep the conversation focused.");
    push(`Set a reminder to call ${who}`, "Time cue", "Protect the slot so it doesn’t slip.");
    push(`Send a short text to ${who} if they miss the call`, "Backup path", "Keep the thread moving.", "evening");
    push(`Note the outcome after talking with ${who}`, "Close the loop", "Capture next steps while fresh.", "evening");
    push(`Confirm a follow-up time with ${who}`, "Next step", "Agree when you’ll talk again if needed.");
  } else if (/grocer|supermarket|shopping list|buy groceries|on the way home/.test(lower)) {
    push("Check the fridge and write a short grocery list", "Prep", "Only buy what you need.");
    push("Buy groceries on the way home", "Primary action", "Stick to the list while commuting.");
    push("Grab healthy staples first (produce, protein)", "Prioritize", "Fill the cart with essentials before extras.");
    push("Unpack groceries and put perishables away", "Finish strong", "Avoid waste after the trip.", "evening");
    push("Add missing staples to a recurring list", "System", "Make the next shop faster.", "evening");
    push("Set a midweek grocery top-up reminder", "Follow-through", "Prevent an empty fridge midweek.");
  } else if (/plants?|garden|water the/.test(lower)) {
    push("Water the plants", "Primary action", "Give each plant enough water without overdoing it.");
    push("Check soil moisture before watering", "Avoid overwatering", "Only water pots that are dry.");
    push("Set a Tuesday reminder to water the plants", "Repeating cue", "Protect the weekly habit.");
    push("Move thirsty plants to a brighter spot if needed", "Care tweak", "Fix light issues that dry them out.");
    push("Wipe dust off leaves while watering", "Small upgrade", "Help plants absorb light better.");
    push("Note which plants need more or less water", "Learn the pattern", "Adjust the Tuesday routine.", "evening");
  } else if (/tax|irs|deadline|before friday|due (by |before )?friday|submit .*documents|documents before/.test(lower)) {
    push("Gather tax documents into one folder", "Collect inputs", "W-2s, receipts, IDs, and prior returns.");
    push("List missing forms and who to request them from", "Gap check", "Know what’s still outstanding.");
    push("Block 45 minutes to complete the filing steps", "Time box", "Protect focus before the deadline.");
    push("Submit tax documents before Friday", "Deadline action", "File or send with confirmation saved.");
    push("Confirm submission receipt or tracking number", "Proof", "Keep evidence the deadline was met.", "evening");
    push("Calendar a reminder two days before Friday", "Buffer", "Leave time to fix surprises.");
  } else if (/budget|money|financ|save|debt/.test(lower)) {
    push("List this month’s fixed expenses", "Clarify the baseline");
    push("Open the banking app and check current balances", "Quick situational awareness");
    push("Set a 20-minute weekly money check on the calendar", "Turn control into a repeating action");
    push("Pick one expense to cut or pause this week", "Immediate leverage");
    push("Transfer a small savings amount today", "Actionable money move");
    push("Write down next month’s money priorities", "Forward-looking planning", undefined, "evening");
  } else {
    // Prefer action-shaped titles from the dump over meta coaching templates.
    const focus = clip(extractFocus(text), 40);
    const raw = clip(text.replace(/\s+/g, " "), 72);
    push(raw.length >= 8 ? raw : `Finish ${focus}`, "Use your wording", "Keep the action concrete and doable today.");
    push(`Break ${focus} into the first unfinished piece and do it`, "Decompose", "Ship one real chunk instead of planning forever.");
    push(`Block 25 focused minutes for ${focus}`, "Time box", "Protect a short window and start.");
    push(`Prep what you need, then start ${focus}`, "Unblock + act", "Gather materials only long enough to begin.");
    push(`Define done for ${focus} in one sentence, then execute`, "Success criteria", "Know when to stop.");
    push(`Schedule the finish-by time for ${focus} today`, "Deadline", "Give the work a clear end.", "evening");
  }
  return drafts.filter((d) => !isNearDuplicate(d.title, prior)).slice(0, 3);
}

function rulesStarters(goalTitle: string, text: string, prior: string[]): GoalStarterTaskDraft[] {
  const lower = `${goalTitle} ${text}`.toLowerCase();
  // Weight / nutrition first so planning-titled goals like "Build a simple plan for Lose lbs"
  // still produce domain-specific tasks when the dump mentions weight loss.
  const ideas: string[] = /weight|lose\b.*\blbs?\b|\blbs?\b|diet|nutrition|calorie|meal\s*plan/.test(lower)
    ? [
      "Define your target weight and a realistic deadline",
      "Calculate your daily calorie goal",
      "Create a healthy meal plan for this week",
      "Schedule three workout sessions in your calendar",
      "List foods to avoid and healthy alternatives",
      "Buy healthy groceries for the week",
      "Identify your biggest weight-loss obstacle and write one solution",
    ]
    : /fit|energy|health|exercise|gym|movement/.test(lower)
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
    : 'Return JSON only: {"candidates":[{"title":string,"description"?:string,"previewReason":string,"timeOfDay"?: "morning"|"evening"}]}. Give exactly 3 meaningfully different TASK (action) candidates grounded in the brain dump domain (e.g. project report → outline/draft/proofread/submit; groceries → list/buy/unpack; call mom → call/prep points). Verb-led, specific titles. Ban meta coaching like "define the next concrete step", "gather what you need to start", "spend 15 focused minutes", "smallest done definition", "remove one blocker". Avoid paraphrases of each other or priorTitles. Do not invent goals.';
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
      if (creationType === "task" && META_TASK_RE.test(title)) continue;
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

const META_TASK_RE =
  /define the next concrete|gather what you need|spend 15 focused|smallest done definition|remove one blocker|ask one clarifying|smallest next step|concrete action toward|build a (simple )?plan for/i;

const META_STARTER_RE =
  /smallest next step|define next|concrete action toward|spend 15 focused|build a (simple )?plan for|remove one blocker|review progress on/i;

async function callLlmStarters(
  goalTitle: string,
  text: string,
  prior: string[],
  goalDeepWhy?: string,
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
              'Return JSON only: {"tasks":[{"label":string,"timeOfDay"?: "morning"|"evening"}]}. Give 2–5 concrete verb-led starter tasks that support ONLY the given goal. Ground every task in the user\'s domain from brainDump/goalDeepWhy (e.g. lose weight → target weight, calories, meal plan, workouts, groceries—not generic coaching). Ban meta labels like "smallest next step", "define next concrete step", "take one concrete action toward", "spend 15 focused minutes on", "build a plan for". No separate goals. Avoid priorTitles paraphrases.',
          },
          {
            role: "user",
            content: JSON.stringify({
              goalTitle,
              goalDeepWhy: (goalDeepWhy || "").slice(0, 240),
              brainDump: text.slice(0, MAX_INPUT),
              priorTitles: prior,
            }),
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
      if (META_STARTER_RE.test(label)) continue;
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
  const goalDeepWhy = typeof body.goalDeepWhy === "string" ? body.goalDeepWhy.trim() : "";
  const prior = Array.isArray(body.priorStarterTitles)
    ? body.priorStarterTitles.filter((t) => typeof t === "string")
    : [];

  await checkRateLimit(`starters-${opts?.rateLimitKey || "anon"}`);

  let tasks: GoalStarterTaskDraft[] | null = null;
  let source: AiAssistStarterResponse["source"] = "server_rules";
  let reason: AiAssistReasonCode = "ok";

  if (!body.preferRules) {
    tasks = await callLlmStarters(goalTitle, text, prior, goalDeepWhy);
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
