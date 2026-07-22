/**
 * Map a voice transcript into existing goal/task form fields only.
 * Never persists. Never invents required values — leaves them missing.
 *
 * Draft shapes mirror ManageGoalModal / ManageTaskModal create-mode fields
 * (no import from UI — avoids circular deps).
 */

import type { PersonalGoal } from './personalGoals';
import type { Recurrence } from './userTasks';
import type { PotentialValue } from './potentialValue';

export type VoiceRecordType = 'goal' | 'task';

/** Same fields as GoalDraftValues — populate existing goal form only. */
export interface VoiceGoalDraft {
  title?: string;
  deepWhy?: string;
}

/** Same fields as TaskDraftValues — populate existing task form only. */
export interface VoiceTaskDraft {
  label?: string;
  description?: string;
  timeOfDay?: 'morning' | 'evening';
  goalId?: string;
  potentialValue?: PotentialValue;
  recurrence?: Recurrence;
}

export interface VoiceExtractGoalResult {
  recordType: 'goal';
  draft: VoiceGoalDraft;
  missingRequiredFields: Array<'title'>;
  uncertainFields: string[];
  unsupportedContent: string[];
  transcript: string;
}

export interface VoiceExtractTaskResult {
  recordType: 'task';
  draft: VoiceTaskDraft;
  missingRequiredFields: Array<'label'>;
  uncertainFields: string[];
  unsupportedContent: string[];
  transcript: string;
}

export type VoiceExtractResult = VoiceExtractGoalResult | VoiceExtractTaskResult;

/** Guidance shown before recording — derived from real form fields. */
export const VOICE_GOAL_INSTRUCTIONS = [
  'Say the goal name (required).',
  'Optionally say why it matters.',
  'Example: “I want to save twenty thousand pesos by December for my family’s security.”',
] as const;

export const VOICE_TASK_INSTRUCTIONS = [
  'Say what needs to be done (required).',
  'Optionally say morning or evening.',
  'Optionally name which goal it supports.',
  'Optionally say daily, weekly, monthly, or a one-time date.',
  'Example: “Review the budget every Monday morning for my savings goal.”',
] as const;

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function sentenceCase(s: string): string {
  const t = clean(s);
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function stripFiller(s: string): string {
  return clean(
    s
      .replace(/^(um+|uh+|like|so|okay|ok|well)[,.\s]+/i, '')
      .replace(/\b(please|thanks|thank you)\b/gi, ''),
  );
}

/** Heuristic goal extract — title required field only. */
export function extractGoalDraftFromTranscript(transcript: string): VoiceExtractGoalResult {
  const raw = stripFiller(transcript);
  const uncertainFields: string[] = [];
  const unsupportedContent: string[] = [];

  if (!raw) {
    return {
      recordType: 'goal',
      draft: {},
      missingRequiredFields: ['title'],
      uncertainFields,
      unsupportedContent,
      transcript: raw,
    };
  }

  // “I want to X because Y” / “so that” / “for”
  const because = raw.match(/^(.+?)\s+(?:because|so that|so I can|in order to)\s+(.+)$/i);
  let title = '';
  let deepWhy = '';

  if (because) {
    title = sentenceCase(
      because[1]
        .replace(/^(i want to|i'd like to|i need to|my goal is to|goal is)\s+/i, '')
        .replace(/\.$/, ''),
    );
    deepWhy = sentenceCase(because[2].replace(/\.$/, ''));
  } else {
    const parts = raw.split(/(?<=[.!?])\s+/);
    const first = parts[0] || raw;
    title = sentenceCase(
      first
        .replace(/^(i want to|i'd like to|i need to|my goal is to|goal is)\s+/i, '')
        .replace(/\.$/, ''),
    );
    if (parts.length > 1) {
      deepWhy = sentenceCase(parts.slice(1).join(' ').replace(/\.$/, ''));
    }
  }

  // Soft length guard — keep title scannable; overflow → deepWhy if empty
  if (title.length > 120) {
    uncertainFields.push('title');
    if (!deepWhy) deepWhy = title;
    title = title.slice(0, 117).trim() + '…';
  }

  const draft: VoiceGoalDraft = {};
  if (title) draft.title = title;
  if (deepWhy) draft.deepWhy = deepWhy;

  const missingRequiredFields: Array<'title'> = draft.title ? [] : ['title'];

  return {
    recordType: 'goal',
    draft,
    missingRequiredFields,
    uncertainFields,
    unsupportedContent,
    transcript: raw,
  };
}

function matchGoalId(text: string, goals: PersonalGoal[]): string | undefined {
  const lower = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const g of goals) {
    const t = g.title.trim().toLowerCase();
    if (t.length < 3) continue;
    if (lower.includes(t)) {
      const score = t.length;
      if (!best || score > best.score) best = { id: g.id, score };
    }
  }
  return best?.id;
}

function extractTimeOfDay(text: string): 'morning' | 'evening' | undefined {
  if (/\b(morning|am|a\.m\.|before noon|wake)\b/i.test(text)) return 'morning';
  if (/\b(evening|night|pm|p\.m\.|tonight|after work)\b/i.test(text)) return 'evening';
  return undefined;
}

function extractRecurrence(text: string): Recurrence | undefined {
  if (/\b(every day|daily|each day)\b/i.test(text)) return undefined; // daily default
  if (/\b(one[- ]time|once|tomorrow|on \d{4}-\d{2}-\d{2})\b/i.test(text)) {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return { type: 'one-time', specificDate: iso[1] };
    // Ambiguous one-time without date — leave default daily; mark uncertain at caller
    return undefined;
  }

  const map: Record<string, number> = {
    monday: 0, mon: 0, tuesday: 1, tue: 1, wednesday: 2, wed: 2,
    thursday: 3, thu: 3, friday: 4, fri: 4, saturday: 5, sat: 5, sunday: 6, sun: 6,
  };
  const weekdays: number[] = [];
  for (const [name, idx] of Object.entries(map)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text) && !weekdays.includes(idx)) weekdays.push(idx);
  }
  // "every Monday" / "weekly" / "every week"
  if (weekdays.length && (/\b(weekly|every week|every)\b/i.test(text) || /\bon\s+(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/i.test(text))) {
    return { type: 'weekly', weekdays: weekdays.sort((a, b) => a - b) };
  }
  if (/\bweekly|every week\b/i.test(text) && weekdays.length) {
    return { type: 'weekly', weekdays: weekdays.sort((a, b) => a - b) };
  }

  if (/\bmonthly|every month\b/i.test(text)) {
    const day = text.match(/\b(?:on the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
    const n = day ? Number(day[1]) : NaN;
    if (n >= 1 && n <= 31) return { type: 'monthly', monthDates: [n] };
  }
  return undefined;
}

/** Heuristic task extract — label required; optional fields only when clear. */
export function extractTaskDraftFromTranscript(
  transcript: string,
  goals: ReadonlyArray<PersonalGoal> = [],
): VoiceExtractTaskResult {
  const raw = stripFiller(transcript);
  const uncertainFields: string[] = [];
  const unsupportedContent: string[] = [];

  if (!raw) {
    return {
      recordType: 'task',
      draft: {},
      missingRequiredFields: ['label'],
      uncertainFields,
      unsupportedContent,
      transcript: raw,
    };
  }

  let working = raw;
  const goalId = matchGoalId(working, [...goals]);
  // Strip matched goal title from label candidate when present
  if (goalId) {
    const g = goals.find(x => x.id === goalId);
    if (g) {
      working = working.replace(new RegExp(g.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
    }
  }

  const timeOfDay = extractTimeOfDay(raw);
  const recurrence = extractRecurrence(raw);

  if (/\b(one[- ]time|once|tomorrow)\b/i.test(raw) && !recurrence) {
    uncertainFields.push('recurrence');
  }

  let label = sentenceCase(
    stripFiller(working)
      .replace(/^(i need to|i want to|i have to|remind me to|task is|please)\s+/i, '')
      .replace(/\b(every day|daily|every week|weekly|every month|monthly|in the morning|in the evening|tonight)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[.,;]+$/, '')
      .trim(),
  );

  if (label.length > 140) {
    uncertainFields.push('label');
    label = label.slice(0, 137).trim() + '…';
  }

  const draft: VoiceTaskDraft = {};
  if (label) draft.label = label;
  if (timeOfDay) draft.timeOfDay = timeOfDay;
  if (goalId) draft.goalId = goalId;
  if (recurrence) draft.recurrence = recurrence;

  // Description: second sentence if present and distinct from label
  const parts = raw.split(/(?<=[.!?])\s+/);
  if (parts.length > 1) {
    const rest = sentenceCase(parts.slice(1).join(' '));
    if (rest && rest.toLowerCase() !== label.toLowerCase()) draft.description = rest;
  }

  const missingRequiredFields: Array<'label'> = draft.label ? [] : ['label'];

  return {
    recordType: 'task',
    draft,
    missingRequiredFields,
    uncertainFields,
    unsupportedContent,
    transcript: raw,
  };
}

export function extractVoiceFormDraft(
  recordType: VoiceRecordType,
  transcript: string,
  goals: ReadonlyArray<PersonalGoal> = [],
): VoiceExtractResult {
  return recordType === 'goal'
    ? extractGoalDraftFromTranscript(transcript)
    : extractTaskDraftFromTranscript(transcript, goals);
}
