/**
 * Recommended how-to resources for newly created tasks.
 * LLM optional; always has a rule-based fallback so create never blocks.
 */

import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { TaskResource } from './userTasks';
import { getUserTasks, updateUserTask } from './userTasks';

const FN = 'make-server-5d90ddf5';
const FN_BASE = `https://${projectId}.supabase.co/functions/v1`;

function searchUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Fast, offline-friendly tips + search links from the task label. */
export function ruleBasedTaskResources(taskLabel: string, goalTitle?: string): TaskResource[] {
  const label = taskLabel.trim().replace(/\s+/g, ' ');
  if (label.length < 2) return [];
  const t = label.toLowerCase();
  const context = goalTitle ? ` (${goalTitle})` : '';

  if (/hydrat|water|drink/.test(t)) {
    return [
      {
        title: 'Hydration habit tips',
        url: searchUrl('how to drink more water daily tips'),
        steps: ['Keep a bottle in sight', 'Drink a glass with each meal', 'Set 2 phone reminders'],
      },
      {
        title: 'How much water is enough?',
        url: searchUrl('daily water intake guidelines'),
      },
    ];
  }
  if (/protein|breakfast|lunch|dinner|meal|eat|food/.test(t)) {
    return [
      {
        title: `Quick ideas for: ${label}`,
        url: searchUrl(`${label} easy healthy recipes`),
        steps: ['Use food you already have', 'Aim for one clear protein source', 'Prep a snack for later'],
      },
      {
        title: 'High-protein meal ideas',
        url: searchUrl('high protein meal ideas quick'),
      },
    ];
  }
  if (/walk|run|workout|gym|exercise|stretch|lift/.test(t)) {
    return [
      {
        title: `Start guide: ${label}`,
        url: searchUrl(`${label} beginner how to`),
        steps: ['Set a short timer', 'Do the easiest version first', 'Stop while it still feels doable'],
      },
    ];
  }
  if (/sleep|bed|wind.?down/.test(t)) {
    return [
      {
        title: 'Better wind-down checklist',
        url: searchUrl('sleep hygiene wind down routine'),
        steps: ['Dim lights 30 min before bed', 'Phone down outside reach', 'Keep the same bedtime'],
      },
    ];
  }
  if (/study|read|learn|homework|exam/.test(t)) {
    return [
      {
        title: `How to make progress on: ${label}`,
        url: searchUrl(`${label} study tips`),
        steps: ['Open the material for 10 minutes', 'Write 3 bullets from what you covered', 'Schedule the next short block'],
      },
    ];
  }

  return [
    {
      title: `How to get this done${context}`,
      url: searchUrl(`how to ${label}`),
      steps: [
        'Define the first 5-minute action',
        'Gather only what you need to start',
        'Finish one small, visible win',
      ],
    },
    {
      title: 'Step-by-step search',
      url: searchUrl(`${label} step by step guide`),
    },
  ];
}

async function edgePost(body: Record<string, unknown>): Promise<{ data: any; error: string | null }> {
  try {
    const res = await fetch(`${FN_BASE}/${FN}/suggest-task-resources`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) return { data, error: data?.error || `HTTP ${res.status}` };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

function normalizeResources(raw: unknown): TaskResource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 4)
    .map((r: any) => ({
      title: String(r?.title ?? '').trim().slice(0, 100),
      url: typeof r?.url === 'string' && /^https?:\/\//i.test(r.url) ? r.url.trim() : undefined,
      steps: Array.isArray(r?.steps)
        ? r.steps.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim().slice(0, 120)).slice(0, 5)
        : undefined,
    }))
    .filter(r => r.title.length >= 3);
}

/** Prefer LLM resources; fall back to rules. Never throws. */
export async function suggestTaskResources(opts: {
  taskLabel: string;
  goalTitle?: string;
}): Promise<TaskResource[]> {
  const fallback = ruleBasedTaskResources(opts.taskLabel, opts.goalTitle);
  try {
    const { data, error } = await edgePost({
      taskLabel: opts.taskLabel,
      goalTitle: opts.goalTitle,
    });
    if (error) return fallback;
    const resources = normalizeResources(data?.resources);
    return resources.length >= 1 ? resources : fallback;
  } catch {
    return fallback;
  }
}

/** Attach resources after create (non-blocking for the caller). */
export async function attachResourcesToNewTask(
  profileId: string,
  taskId: string,
  taskLabel: string,
  goalTitle?: string,
): Promise<void> {
  const resources = await suggestTaskResources({ taskLabel, goalTitle });
  if (!resources.length) return;
  updateUserTask(profileId, taskId, { resources });
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch { /* ignore */ }
}

/** Display helper: use saved resources, or rule-based tips so older tasks still show how-tos. */
export function resourcesForDisplay(
  taskLabel: string,
  existing?: TaskResource[] | null,
  goalTitle?: string,
): TaskResource[] {
  const saved = (existing ?? []).filter(r => r.title?.trim());
  if (saved.length > 0) return saved;
  return ruleBasedTaskResources(taskLabel, goalTitle);
}

/**
 * Persist rule-based resources onto user tasks that never got any
 * (created before the feature, or attach failed). Synchronous; LLM optional later.
 * Does not emit events (caller should refresh state).
 */
export function seedMissingTaskResources(
  profileId: string,
  goalTitleById?: Record<string, string>,
): number {
  const tasks = getUserTasks(profileId);
  let updated = 0;
  for (const ut of tasks) {
    if (ut.resources?.some(r => r.title?.trim())) continue;
    const goalTitle = ut.goalId ? goalTitleById?.[ut.goalId] : undefined;
    const resources = ruleBasedTaskResources(ut.label, goalTitle);
    if (!resources.length) continue;
    updateUserTask(profileId, ut.id, { resources });
    updated++;
  }
  return updated;
}
