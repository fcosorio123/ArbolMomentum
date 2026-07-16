import { projectId, publicAnonKey } from '/utils/supabase/info';
import { buildClientAssistCandidates, buildClientStarterTasks } from './aiAssistClientFallback';
import {
  type AiAssistGenerationRequest,
  type AiAssistGenerationResponse,
  type AiAssistStarterRequest,
  type AiAssistStarterResponse,
  type CandidateDraft,
  newAiAssistId,
} from './aiAssistCreationTypes';
import { filterDistinctTitles, isNearDuplicate } from './aiAssistSimilarity';

const FN = 'make-server-5d90ddf5';
const FN_BASE = `https://${projectId}.supabase.co/functions/v1`;

async function edgePost(
  path: string,
  body: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<{ data: any; error: string | null; timedOut?: boolean }> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${FN_BASE}/${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: any = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      return { data, error: data?.error || data?.message || data?.reason || `HTTP ${res.status}` };
    }
    return { data, error: null };
  } catch (err) {
    const msg = String(err);
    if (/AbortError|aborted/i.test(msg)) {
      return { data: null, error: 'timeout', timedOut: true };
    }
    return { data: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeCandidates(
  creationType: AiAssistGenerationRequest['creationType'],
  candidates: CandidateDraft[] | undefined,
  prior: string[],
): CandidateDraft[] {
  if (!Array.isArray(candidates)) return [];
  const typed = candidates.filter(c => c && c.type === creationType && typeof c.title === 'string');
  const titles = filterDistinctTitles(typed.map(c => c.title), prior, 3);
  const byTitle = new Map(typed.map(c => [c.title.trim(), c]));
  const out: CandidateDraft[] = [];
  for (const t of titles) {
    const hit = [...byTitle.entries()].find(([k]) => k === t || !isNearDuplicate(k, [t], 0.95));
    const c = byTitle.get(t) ?? typed.find(x => x.title === t);
    if (c) out.push({ ...c, id: c.id || newAiAssistId('cand') });
    else if (hit) out.push({ ...hit[1], id: hit[1].id || newAiAssistId('cand') });
  }
  return out.slice(0, 3);
}

function clientFallbackResponse(req: AiAssistGenerationRequest, reason: AiAssistGenerationResponse['reason']): AiAssistGenerationResponse {
  const candidates = buildClientAssistCandidates(req.creationType, req.text, req.priorCandidateTitles ?? []);
  return {
    ok: candidates.length >= 2,
    requestId: req.requestId,
    sessionId: req.sessionId,
    creationType: req.creationType,
    source: 'client_fallback',
    reason: reason ?? 'client_fallback',
    candidates,
  };
}

export async function generateAssistCandidates(
  req: AiAssistGenerationRequest,
): Promise<AiAssistGenerationResponse> {
  const text = (req.text || '').trim();
  if (text.length < 8) {
    return {
      ok: false,
      requestId: req.requestId,
      sessionId: req.sessionId,
      creationType: req.creationType,
      source: 'client_fallback',
      reason: 'input_too_short',
      candidates: [],
    };
  }

  const { data, error, timedOut } = await edgePost(`${FN}/generate-assist-candidates`, {
    requestId: req.requestId,
    sessionId: req.sessionId,
    creationType: req.creationType,
    text,
    preferRules: req.preferRules ?? false,
    priorCandidateTitles: req.priorCandidateTitles ?? [],
    context: req.context ?? {},
  });

  if (error || !data) {
    return clientFallbackResponse(req, timedOut ? 'timeout' : 'network_error');
  }

  const payload = data as AiAssistGenerationResponse;
  const sanitized = sanitizeCandidates(
    req.creationType,
    payload.candidates,
    req.priorCandidateTitles ?? [],
  );

  if (sanitized.length >= 2) {
    const source = payload.source === 'llm'
      ? 'llm'
      : payload.source === 'client_fallback'
        ? 'client_fallback'
        : 'server_rules';
    return {
      ok: true,
      requestId: payload.requestId || req.requestId,
      sessionId: payload.sessionId || req.sessionId,
      creationType: req.creationType,
      source,
      reason: payload.reason ?? 'ok',
      candidates: sanitized,
    };
  }

  return clientFallbackResponse(req, payload.reason === 'rate_limited' ? 'rate_limited' : 'no_candidates');
}

export async function generateAssistStarters(
  req: AiAssistStarterRequest,
): Promise<AiAssistStarterResponse> {
  const { data, error, timedOut } = await edgePost(`${FN}/generate-assist-starters`, {
    requestId: req.requestId,
    sessionId: req.sessionId,
    text: req.text,
    goalTitle: req.goalTitle,
    goalDeepWhy: req.goalDeepWhy,
    preferRules: req.preferRules ?? false,
    priorStarterTitles: req.priorStarterTitles ?? [],
  });

  if (error || !data?.ok || !Array.isArray(data.tasks) || data.tasks.length < 2) {
    const tasks = buildClientStarterTasks(req.goalTitle, req.text, req.priorStarterTitles ?? []);
    return {
      ok: tasks.length >= 2,
      requestId: req.requestId,
      sessionId: req.sessionId,
      source: 'client_fallback',
      reason: timedOut ? 'timeout' : (error ? 'network_error' : 'client_fallback'),
      tasks,
    };
  }

  return {
    ok: true,
    requestId: data.requestId || req.requestId,
    sessionId: data.sessionId || req.sessionId,
    source: data.source === 'llm' ? 'llm' : 'server_rules',
    reason: data.reason ?? 'ok',
    tasks: data.tasks.map((t: any, i: number) => ({
      id: t.id || newAiAssistId(`starter${i}`),
      clientKey: t.clientKey || newAiAssistId(`starterkey${i}`),
      label: String(t.label || '').trim(),
      selected: t.selected !== false,
      description: t.description,
      timeOfDay: t.timeOfDay === 'evening' ? 'evening' : 'morning',
      recurrence: t.recurrence,
    })).filter((t: GoalStarterTaskDraftLike) => t.label.length >= 3),
  };
}

type GoalStarterTaskDraftLike = { label: string };
