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

  // Reminder / alarm setup - before generic sleep matching on "bed"
  if (
    /(set|create|add|make|schedule).*(remind|alarm|notif)/i.test(t)
    || /phone-?down/i.test(t)
    || (/remind|alarm/i.test(t) && /phone|bed/i.test(t))
  ) {
    return [
      {
        title: 'Set a Phone down reminder (step by step)',
        url: searchUrl('how to set a repeating reminder or alarm on iPhone or Android'),
        steps: [
          'Open Clock (Alarm) or the Reminders app on your phone',
          'Tap Add Alarm / New Reminder',
          'Choose a time 30 minutes before your usual bedtime',
          'Turn on Repeat for every night (or weekdays)',
          'Name it Phone down, then Save',
        ],
      },
      {
        title: 'Apple: Create a repeating reminder',
        url: 'https://support.apple.com/guide/iphone/get-started-with-reminders-iph2f43d3267/ios',
      },
      {
        title: 'Android: Set a repeating alarm',
        url: searchUrl('set repeating alarm Android Clock app Google'),
      },
    ];
  }

  if (/cancel .+ (subscription|software|account)|unsubscribe/i.test(t)) {
    return [
      {
        title: `Cancel this subscription: ${label}`,
        url: searchUrl(`${label} how to cancel subscription confirmation email`),
        steps: [
          'Search your email for the signup or billing confirmation',
          'Open the cancellation or manage-subscription link',
          'Confirm cancel and screenshot the confirmation page',
        ],
      },
    ];
  }

  if (/call .+|phone the |denied claim|insurance/i.test(t)) {
    return [
      {
        title: 'Prepare then make the call',
        url: searchUrl(`${label} what to say phone script`),
        steps: [
          'Find the claim or account number on the latest notice',
          'Write the denial reason and two questions to ask',
          'Call during your available window with notes in front of you',
        ],
      },
    ];
  }

  if (/organiz|documents? needed|tax appointment|sort .+ (document|bill)/i.test(t)) {
    return [
      {
        title: 'Document folder workflow',
        url: searchUrl(`${label} checklist documents needed`),
        steps: [
          'Get the required-document list from your preparer or portal',
          'Create one folder (digital or paper) for this appointment',
          'Add documents you already have; list what is still missing',
        ],
      },
    ];
  }

  if (/hydrat|water|drink/.test(t)) {
    return [
      {
        title: 'Hydration habit tips',
        url: searchUrl('how to drink more water daily tips'),
        steps: ['Keep a filled bottle where you can see it', 'Drink a full glass with your next meal', 'Set one phone reminder mid-afternoon'],
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
        steps: ['Use food you already have', 'Add one clear protein source', 'Prep one grab-and-go option for later'],
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
        steps: ['Set a short timer (10 minutes)', 'Do the easiest version first', 'Stop while it still feels doable'],
      },
    ];
  }
  if (/^(sleep|go to bed|wind.?down)/i.test(t) || (/sleep|wind.?down/.test(t) && !/remind|alarm/i.test(t))) {
    return [
      {
        title: 'Better wind-down checklist',
        url: searchUrl('sleep hygiene wind down routine step by step'),
        steps: ['Dim lights 30 minutes before bed', 'Put the phone on charge outside arm reach', 'Keep a consistent bedtime'],
      },
    ];
  }
  if (/study|read|learn|homework|exam/.test(t)) {
    return [
      {
        title: `How to make progress on: ${label}`,
        url: searchUrl(`${label} study tips step by step`),
        steps: ['Open the material for 10 focused minutes', 'Write 3 bullets from what you covered', 'Schedule the next short study block'],
      },
    ];
  }

  return [
    {
      title: `How to get this done${context}`,
      url: searchUrl(`how to ${label} step by step guide`),
      steps: [
        `Write the first physical action for: ${label.slice(0, 48)}`,
        'Open only the tool or place you need for that action',
        'Finish that one action, then stop or schedule the next short block',
      ],
    },
    {
      title: 'Search a detailed walkthrough',
      url: searchUrl(`${label} tutorial OR how-to`),
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

/** Display helper: use saved resources, or rule-based tips so older tasks still show how-tos.
 * Always ensure at least one link + concrete steps. */
export function resourcesForDisplay(
  taskLabel: string,
  existing?: TaskResource[] | null,
  goalTitle?: string,
): TaskResource[] {
  const fallback = ruleBasedTaskResources(taskLabel, goalTitle);
  const saved = (existing ?? []).filter(r => r.title?.trim());
  const t = taskLabel.toLowerCase();
  const isReminder =
    /(set|create|add|make|schedule).*(remind|alarm|notif)/i.test(t)
    || /phone-?down/i.test(t)
    || (/remind|alarm/i.test(t) && /phone|bed/i.test(t));

  // Replace stale sleep-hygiene cards saved when reminder tasks matched "bed"
  const savedLooksWrong = isReminder && saved.some(r =>
    /sleep hygiene|wind-down|dim lights/i.test(`${r.title} ${(r.steps ?? []).join(' ')}`)
    && !/remind|alarm|clock/i.test(`${r.title} ${(r.steps ?? []).join(' ')}`),
  );

  const base = (!saved.length || savedLooksWrong) ? fallback : saved;

  const withLinks = base.map((r, i) => ({
    ...r,
    url: r.url && /^https?:\/\//i.test(r.url)
      ? r.url
      : (fallback[i]?.url || fallback[0]?.url || searchUrl(`how to ${taskLabel} step by step`)),
    steps: (r.steps && r.steps.length > 0)
      ? r.steps
      : (fallback[0]?.steps ?? [
        `Start the first action for: ${taskLabel.slice(0, 40)}`,
        'Use only the tool you need for that action',
        'Finish that one action before adding more',
      ]),
  }));

  if (!withLinks.some(r => r.url) || withLinks.length === 0) {
    return fallback;
  }
  // Prefer cards that have both a link and steps first
  return withLinks.sort((a, b) => {
    const score = (r: TaskResource) => (r.url ? 2 : 0) + (r.steps?.length ? 1 : 0);
    return score(b) - score(a);
  });
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
