/**
 * Edge entry for Simplify detail-assist suggestions.
 * Tries a short LLM pass, then always falls back to prevalidated rules.
 */

import {
  buildPrevalidatedSuggestions,
  evaluateAnswerSufficiency,
  mergeAnswerWithAddition,
  type DetailAssistInput,
  type DetailAssistResult,
  type DetailSuggestion,
  type SimplifyQuestionId,
} from "./simplifyDetailAssist.ts";

const VALID_Q = new Set<SimplifyQuestionId>(["hard_part", "what_would_help", "constraints"]);

function newRequestId(): string {
  return `det_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function llmCandidateAdditions(input: DetailAssistInput): Promise<string[] | null> {
  const apiKey = Deno.env.get("LLM_API_KEY")?.trim();
  if (!apiKey) return null;
  const model = Deno.env.get("LLM_MODEL")?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  const purpose =
    input.questionId === "hard_part"
      ? "Identify the specific blocker, confusing part, missing prerequisite, or friction point."
      : input.questionId === "what_would_help"
      ? "Identify practical support: checklist, script, reminder, tool, first move, or another person's help."
      : "Identify operational limits: time, energy, device, location, tools, or availability.";

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
              "You help users add one short missing detail to a Simplify-for-Me answer. "
              + "Return JSON {\"additions\":[\"...\",...]} with 3-4 short appendable sentences. "
              + "Each addition must build on the existing answer, relate to the task and question, "
              + "add only the missing detail, avoid repeating the answer, avoid sensitive assumptions, "
              + "and avoid inventing unrelated goals. Do not include chain-of-thought.",
          },
          {
            role: "user",
            content: [
              `Task: ${input.taskLabel}`,
              `Question id: ${input.questionId}`,
              `Purpose: ${purpose}`,
              `Current answer: ${input.currentAnswer}`,
              "Return 3-4 short additions the user could append.",
            ].join("\n"),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;
    const parsed = JSON.parse(text) as { additions?: unknown };
    if (!Array.isArray(parsed.additions)) return null;
    return parsed.additions
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map(s => s.trim())
      .slice(0, 6);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function prevalidateList(
  questionId: SimplifyQuestionId,
  currentAnswer: string,
  taskLabel: string,
  additions: string[],
): DetailSuggestion[] {
  const out: DetailSuggestion[] = [];
  for (const appendText of additions) {
    if (out.length >= 4) break;
    const combined = mergeAnswerWithAddition(currentAnswer, appendText);
    if (evaluateAnswerSufficiency(questionId, combined, taskLabel).status !== "sufficient") continue;
    if (combined.trim().toLowerCase() === currentAnswer.trim().toLowerCase()) continue;
    const tooSimilar = out.some(s => {
      const a = s.appendText.toLowerCase();
      const b = appendText.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
    if (tooSimilar) continue;
    out.push({
      id: `s${out.length + 1}`,
      appendText: appendText.replace(/\s+/g, " ").trim(),
      validatedCombinedAnswer: combined,
    });
  }
  return out;
}

export async function simplifyDetailAssist(
  input: DetailAssistInput,
): Promise<DetailAssistResult> {
  const requestId = (input.requestId && String(input.requestId).trim()) || newRequestId();
  const taskId = (input.taskId && String(input.taskId).trim()) || "";
  const questionId = input.questionId;
  if (!VALID_Q.has(questionId)) {
    return {
      requestId,
      taskId,
      questionId: "hard_part",
      status: "needs_detail",
      suggestions: [],
      source: "server_rules",
      reason: "invalid_question",
    };
  }

  const baseInput: DetailAssistInput = {
    ...input,
    requestId,
    taskId,
    currentAnswer: (input.currentAnswer ?? "").trim(),
    taskLabel: (input.taskLabel ?? "").trim(),
  };

  const evaluation = evaluateAnswerSufficiency(
    questionId,
    baseInput.currentAnswer,
    baseInput.taskLabel,
  );
  if (evaluation.status !== "needs_detail") {
    return buildPrevalidatedSuggestions(baseInput, "server_rules");
  }

  const llmAdds = await llmCandidateAdditions(baseInput);
  if (llmAdds && llmAdds.length > 0) {
    const suggestions = prevalidateList(
      questionId,
      baseInput.currentAnswer,
      baseInput.taskLabel,
      llmAdds,
    );
    if (suggestions.length >= 2) {
      return {
        requestId,
        taskId,
        questionId,
        status: "needs_detail",
        missingDetailType: evaluation.missingDetailType,
        suggestions,
        source: "llm",
        reason: "suggestions_ready",
      };
    }
  }

  return buildPrevalidatedSuggestions(baseInput, "server_rules");
}
