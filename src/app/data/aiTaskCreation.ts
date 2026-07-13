// ──────────────────────────────────────────────
// AI-assisted task creation (edge parse-context-tasks)
// ──────────────────────────────────────────────

import { supabase } from '/utils/supabase/client';
import { parseGoalInput, type SeedSuggestionGroup } from './profileSeedParser';

const FN = 'make-server-5d90ddf5';

export type ParseContextSource = 'llm' | 'rules';

export interface ParseContextTasksResult {
  ok: boolean;
  groups: SeedSuggestionGroup[];
  source: ParseContextSource;
  reason?: string;
}

export async function parseContextTasksFromEdge(
  text: string,
  opts?: { preferRules?: boolean },
): Promise<ParseContextTasksResult> {
  try {
    const { data, error } = await supabase.functions.invoke(`${FN}/parse-context-tasks`, {
      method: 'POST',
      body: { text, preferRules: opts?.preferRules ?? false },
    });
    if (error) {
      const fallback = parseGoalInput(text);
      if (fallback.length > 0) {
        return { ok: true, groups: fallback, source: 'rules', reason: 'client_fallback' };
      }
      return { ok: false, groups: [], source: 'rules', reason: 'network_error' };
    }
    const payload = data as ParseContextTasksResult | null;
    if (!payload?.ok || !Array.isArray(payload?.groups) || payload.groups.length === 0) {
      const fallback = parseGoalInput(text);
      if (fallback.length > 0) {
        return { ok: true, groups: fallback, source: 'rules', reason: payload?.reason ?? 'client_fallback' };
      }
    }
    return {
      ok: Boolean(payload?.ok),
      groups: Array.isArray(payload?.groups) ? payload.groups : [],
      source: payload?.source === 'llm' ? 'llm' : 'rules',
      reason: payload?.reason,
    };
  } catch {
    const fallback = parseGoalInput(text);
    if (fallback.length > 0) {
      return { ok: true, groups: fallback, source: 'rules', reason: 'client_fallback' };
    }
    return { ok: false, groups: [], source: 'rules', reason: 'network_error' };
  }
}
