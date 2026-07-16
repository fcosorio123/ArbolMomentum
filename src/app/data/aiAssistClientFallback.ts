/** Client/rules fallback that emits V2 CandidateDraft[] — not SeedSuggestionGroup packages. */

import {
  newAiAssistId,
  type AiAssistCreationType,
  type CandidateDraft,
  type GoalCandidate,
  type GoalStarterTaskDraft,
  type TaskCandidate,
} from './aiAssistCreationTypes';
import { filterDistinctTitles } from './aiAssistSimilarity';

function clip(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function extractNounish(text: string): string {
  const cleaned = text.replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(w => w.length > 2).slice(0, 8);
  return words.join(' ') || 'this priority';
}

function goalVariants(text: string): GoalCandidate[] {
  const focus = clip(extractNounish(text), 48);
  const lower = text.toLowerCase();
  const energy = /exhaust|tired|energy|sleep|rest|burn/.test(lower);
  const money = /money|budget|financ|save|debt|insur|claim/.test(lower);
  const health = /health|fit|exercise|gym|eat|food|nour/.test(lower);
  const family = /family|kids|schedule|realistic|time/.test(lower);

  const drafts: Array<{ title: string; description?: string; previewReason: string; deepWhy?: string }> = [];

  if (health || energy) {
    drafts.push({
      title: 'Build a sustainable weekly fitness routine',
      previewReason: 'Frames the dump as a realistic movement habit',
      deepWhy: family
        ? 'Keep energy up with habits that fit a busy family schedule.'
        : 'Steady movement that restores energy without burning out.',
    });
    drafts.push({
      title: 'Improve daily energy through consistent movement',
      previewReason: 'Centers energy as the outcome, not gym performance',
      deepWhy: 'Feel less exhausted after work by protecting small daily movement.',
    });
    drafts.push({
      title: family
        ? 'Create healthier habits that fit my family schedule'
        : 'Create healthier daily habits I can keep',
      previewReason: 'Emphasizes sustainability and constraints in the dump',
      deepWhy: 'Habits that work with real life, not an ideal week.',
    });
  } else if (money) {
    drafts.push({
      title: 'Regain control of my finances',
      previewReason: 'Outcome framing for money stress',
      deepWhy: 'Clarity and steady actions reduce money anxiety.',
    });
    drafts.push({
      title: 'Resolve the open insurance / money issue',
      previewReason: 'Targets a concrete administrative outcome',
      deepWhy: 'Close the loop on the denied claim or money blocker.',
    });
    drafts.push({
      title: 'Build a simple weekly money review habit',
      previewReason: 'Habit framing rather than a one-off crisis',
      deepWhy: 'Short weekly check-ins prevent surprises.',
    });
  } else {
    drafts.push({
      title: `Make real progress on ${focus}`,
      previewReason: 'General outcome from your words',
      deepWhy: 'Turn an unclear intention into a clear success picture.',
    });
    drafts.push({
      title: `Reduce friction around ${focus}`,
      previewReason: 'Problem-relief framing',
      deepWhy: 'Remove the biggest blockers first.',
    });
    drafts.push({
      title: `Build a simple plan for ${focus}`,
      previewReason: 'Planning framing with room for starter tasks',
      deepWhy: 'A plan you can start this week.',
    });
  }

  return drafts.slice(0, 3).map((d, i) => ({
    id: newAiAssistId(`goalcand${i}`),
    type: 'goal' as const,
    title: d.title,
    description: d.deepWhy,
    previewReason: d.previewReason,
    suggestedFields: d.deepWhy ? { deepWhy: d.deepWhy } : undefined,
  }));
}

function taskVariants(text: string, priorTitles: string[] = []): TaskCandidate[] {
  const lower = text.toLowerCase();
  const drafts: Array<{ title: string; previewReason: string; description?: string }> = [];

  if (/insur|claim|deni|letter|call/.test(lower)) {
    drafts.push(
      {
        title: 'Review the denial letter and identify the stated reason',
        previewReason: 'Start by understanding the document',
        description: 'Highlight the official reason, deadlines, and appeal instructions.',
      },
      {
        title: 'Prepare questions for the insurance company',
        previewReason: 'Prepare before the call',
        description: 'Write 3–5 questions and note claim numbers to have ready.',
      },
      {
        title: 'Call the insurer about the denied claim',
        previewReason: 'Direct action step',
        description: 'Call during business hours with notes and claim ID in hand.',
      },
      // Regen / anti-repeat set
      {
        title: 'Outline an appeal timeline with hard deadlines',
        previewReason: 'Planning angle instead of calling first',
        description: 'List filing dates, required docs, and who owns each step.',
      },
      {
        title: 'Collect claim numbers and recent correspondence in one place',
        previewReason: 'Organization / unblocking prep',
        description: 'Folder or note with claim ID, letters, and policy number.',
      },
      {
        title: 'Draft a short script for the insurance call',
        previewReason: 'Communication prep, not the call itself',
        description: 'Opening line, 3 asks, and what success looks like.',
      },
    );
  } else if (/budget|money|financ|save/.test(lower)) {
    drafts.push(
      { title: 'List this month’s fixed expenses', previewReason: 'Clarify the baseline' },
      { title: 'Open the banking app and check current balances', previewReason: 'Quick situational awareness' },
      { title: 'Set a 20-minute weekly money check on the calendar', previewReason: 'Turn control into a repeating action' },
      { title: 'Pick one expense to cut or pause this week', previewReason: 'Immediate leverage' },
      { title: 'Transfer a small savings amount today', previewReason: 'Actionable money move' },
      { title: 'Write down next month’s money priorities', previewReason: 'Forward-looking planning' },
    );
  } else {
    const focus = clip(extractNounish(text), 40);
    drafts.push(
      { title: `Define the next concrete step for ${focus}`, previewReason: 'Clarify the first move' },
      { title: `Gather what you need to start on ${focus}`, previewReason: 'Prep / unblocking step' },
      { title: `Spend 15 focused minutes on ${focus}`, previewReason: 'Time-boxed action' },
      { title: `Write the smallest done definition for ${focus}`, previewReason: 'Clarify success' },
      { title: `Remove one blocker related to ${focus}`, previewReason: 'Unblocking' },
      { title: `Ask one clarifying question about ${focus}`, previewReason: 'Information gathering' },
    );
  }

  const titles = filterDistinctTitles(drafts.map(d => d.title), priorTitles, 3);
  const byTitle = new Map(drafts.map(d => [d.title, d]));
  return titles.map((t, i) => {
    const d = byTitle.get(t)!;
    return {
      id: newAiAssistId(`taskcand${i}`),
      type: 'task' as const,
      title: d.title,
      description: d.description,
      previewReason: d.previewReason,
      suggestedFields: d.description
        ? { description: d.description, timeOfDay: i === 2 ? 'evening' : 'morning' }
        : { timeOfDay: i === 2 ? 'evening' : 'morning' },
    };
  });
}

export function buildClientAssistCandidates(
  creationType: AiAssistCreationType,
  text: string,
  priorTitles: string[],
): CandidateDraft[] {
  if (creationType === 'task') {
    return taskVariants(text, priorTitles);
  }
  const raw = goalVariants(text);
  // Extra goal regen angles when priors already used the primary set
  const extras: GoalCandidate[] = [
    {
      id: newAiAssistId('goalextra0'),
      type: 'goal',
      title: 'Protect recovery time so weekdays feel sustainable',
      previewReason: 'Recovery framing for energy',
      description: 'Guard small recovery blocks that fit family life.',
      suggestedFields: { deepWhy: 'Guard small recovery blocks that fit family life.' },
    },
    {
      id: newAiAssistId('goalextra1'),
      type: 'goal',
      title: 'Build a low-friction evening reset ritual',
      previewReason: 'Evening energy ritual',
      description: 'A short wind-down that restores energy without a gym mandate.',
      suggestedFields: { deepWhy: 'A short wind-down that restores energy without a gym mandate.' },
    },
    {
      id: newAiAssistId('goalextra2'),
      type: 'goal',
      title: 'Increase weekday energy with tiny consistent habits',
      previewReason: 'Tiny habits framing',
      description: 'Small repeatable actions beat ambitious plans that fail.',
      suggestedFields: { deepWhy: 'Small repeatable actions beat ambitious plans that fail.' },
    },
  ];
  const pool = [...raw, ...extras];
  const titles = filterDistinctTitles(pool.map(c => c.title), priorTitles, 3);
  const byTitle = new Map(pool.map(c => [c.title, c]));
  return titles.map(t => byTitle.get(t)!).filter(Boolean).slice(0, 3);
}

export function buildClientStarterTasks(
  goalTitle: string,
  brainDump: string,
  priorTitles: string[],
): GoalStarterTaskDraft[] {
  const lower = `${goalTitle} ${brainDump}`.toLowerCase();
  const ideas: string[] = [];
  if (/fit|energy|health|exercise|gym|movement/.test(lower)) {
    ideas.push(
      'Schedule three 20-minute walks this week',
      'Prep workout clothes the night before',
      'Do a 10-minute stretch after dinner',
      'Write a realistic weekly movement plan',
      'Track energy after each short workout',
    );
  } else if (/money|budget|insur|claim|financ/.test(lower)) {
    ideas.push(
      'Gather claim numbers and recent letters',
      'List questions before calling support',
      'Call during posted business hours',
      'Note the agent name and next deadline',
      'Set a calendar reminder for follow-up',
    );
  } else {
    ideas.push(
      `Take one concrete action toward "${clip(goalTitle, 36)}" today`,
      `Spend 15 focused minutes on "${clip(goalTitle, 36)}"`,
      `Write the smallest next step for "${clip(goalTitle, 36)}"`,
      `Remove one blocker related to "${clip(goalTitle, 36)}"`,
      `Review progress on "${clip(goalTitle, 36)}" this weekend`,
    );
  }
  const titles = filterDistinctTitles(ideas, priorTitles, 5);
  return titles.map((label, i) => ({
    id: newAiAssistId(`starter${i}`),
    clientKey: newAiAssistId(`starterkey${i}`),
    label,
    selected: true,
    timeOfDay: (i % 2 === 0 ? 'morning' : 'evening') as 'morning' | 'evening',
    recurrence: { type: 'daily' as const },
  }));
}
