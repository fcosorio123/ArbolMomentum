/**
 * Shared Simplify-for-Me core (client + mirrored on edge).
 * Anchors decomposition on the original task; answers enrich context; goals are optional background.
 */

export interface SimplifyAnswers {
  blocker: string;
  motivation: string;
  constraint: string;
}

export interface TaskContextFact {
  category:
    | 'blocker'
    | 'missing_information'
    | 'helpful_resource'
    | 'available_support'
    | 'constraint'
    | 'preference'
    | 'timing'
    | 'tools'
    | 'environment'
    | 'completion_detail';
  /** Short internal fact — never shown / never pasted into labels from raw answers. */
  fact: string;
  influence:
    | 'prerequisite'
    | 'tool'
    | 'timing'
    | 'scope'
    | 'support'
    | 'order'
    | 'step_size';
}

export type RejectionReason =
  | 'duplicate_original'
  | 'semantic_restatement'
  | 'unrelated_to_task'
  | 'generic_domain_advice'
  | 'goal_drift'
  | 'answer_echo'
  | 'duplicate_step'
  | 'new_objective'
  | 'not_smaller_than_original'
  | 'insufficiently_concrete'
  | 'procedural_fragment';

export interface SimplifiedStep {
  label: string;
  timeOfDay: 'morning' | 'evening';
}

const MAX_LABEL = 120;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length > 2);
}

const WEAK = new Set([
  'the', 'and', 'for', 'with', 'your', 'you', 'this', 'that', 'from', 'into', 'about',
  'before', 'after', 'today', 'tonight', 'tomorrow', 'make', 'doing', 'have', 'need',
  'want', 'just', 'like', 'time', 'task', 'step', 'help', 'more', 'than',
]);

function significantTokens(s: string): string[] {
  return tokens(s).filter(t => !WEAK.has(t) && t.length > 2);
}

/**
 * Goal is relevant only if it shares meaningful keywords with the task.
 * Artwork vs phone-down → false.
 */
export function isGoalRelevantToTask(taskLabel: string, goalTitle?: string | null): boolean {
  if (!goalTitle?.trim()) return false;
  const taskSig = significantTokens(taskLabel);
  const goalSig = significantTokens(goalTitle);
  if (taskSig.length === 0 || goalSig.length === 0) return false;
  const shared = goalSig.filter(t => taskSig.includes(t));
  if (shared.length >= 2) return true;
  if (shared.length === 1 && shared[0].length >= 6) return true;
  const tn = norm(taskLabel);
  const gn = norm(goalTitle);
  if (tn.includes(gn) || gn.includes(tn)) return true;
  return false;
}

/** Extract task-relevant facts from free-text answers without exposing raw wording. */
export function buildTaskContextFromAnswers(answers: SimplifyAnswers): TaskContextFact[] {
  const facts: TaskContextFact[] = [];
  const b = answers.blocker.trim();
  const m = answers.motivation.trim();
  const c = answers.constraint.trim();

  const push = (category: TaskContextFact['category'], fact: string, influence: TaskContextFact['influence']) => {
    if (!fact || facts.some(f => f.fact === fact)) return;
    facts.push({ category, fact, influence });
  };

  const consider = (raw: string, role: 'blocker' | 'motivation' | 'constraint') => {
    if (!raw || raw.length < 3) return;
    const lower = raw.toLowerCase();

    if (/don'?t know|do not know|not sure|unclear|no idea|what to (say|ask|write)|which (documents?|forms?|files?)/i.test(lower)) {
      push('missing_information', 'User lacks key info or a script/checklist before acting', 'prerequisite');
    }
    if (/don'?t understand|confused about|why it was|denial|denied/i.test(lower)) {
      push('missing_information', 'User needs to review the reason or source material first', 'prerequisite');
    }
    if (/forget|remember|distract|lose track|adhd/i.test(lower)) {
      push('blocker', 'Follow-through is unreliable without a cue or repeat', 'tool');
    }
    if (/nervous|anxious|afraid|scared|awkward/i.test(lower)) {
      push('blocker', 'User needs a prepared script or questions before contacting someone', 'prerequisite');
    }
    if (/too (big|vague|hard)|overwhelm|where to start|complicated/i.test(lower)) {
      push('blocker', 'Scope feels too large; start with one visible sub-action', 'step_size');
    }
    if (/tired|exhaust|low energy|drained|fatigue/i.test(lower)) {
      push('constraint', 'Energy is limited; keep steps short and low-effort', 'scope');
    }

    if (role === 'motivation') {
      if (/checklist|list|template|script|outline/i.test(lower)) {
        push('helpful_resource', 'A short checklist or template would help start', 'tool');
      }
      if (/spouse|partner|wife|husband|daughter|son|friend|together|with (my|someone)/i.test(lower)) {
        push('available_support', 'Doing it with another person would help', 'support');
      }
      if (/remind|alarm|notif|calendar/i.test(lower)) {
        push('helpful_resource', 'A reminder or alarm would help', 'tool');
      }
      if (/first step|know where to start|what to do first/i.test(lower)) {
        push('missing_information', 'User needs a clear first physical action', 'order');
      }
    }

    if (role === 'constraint' || role === 'blocker') {
      const mins = lower.match(/(\d+)\s*-?\s*min/);
      if (mins) {
        push('timing', `Only about ${Math.min(30, Math.max(2, Number(mins[1])))} minutes available`, 'scope');
      } else if (/no time|busy|rushed|quick|short session|only a (minute|moment)/i.test(lower)) {
        push('timing', 'Very limited time; keep to 1-2 tiny steps', 'scope');
      }
      if (/morning|before work|after wake|breakfast/i.test(lower)) {
        push('timing', 'Must happen in the morning', 'timing');
      }
      if (/evening|night|before bed|after work|lunch/i.test(lower)) {
        push('timing', 'Must happen in a specific later window', 'timing');
      }
      if (/phone only|only (have |on )?my phone|no (computer|desktop|laptop|printer)/i.test(lower)) {
        push('tools', 'Phone-only; avoid desktop or printer steps', 'tool');
      }
      if (/no printer|cannot print|can't print/i.test(lower)) {
        push('tools', 'No printer available', 'tool');
      }
      if (/at home|cannot leave|can't leave|no gym|home only/i.test(lower)) {
        push('environment', 'Must stay at home / no special venue', 'tool');
      }
      if (/alone|solo|by myself/i.test(lower)) {
        push('constraint', 'Must be done alone', 'support');
      }
      if (/with (my )?(spouse|partner|someone)|needs? another person/i.test(lower)) {
        push('available_support', 'Requires coordinating with another person', 'support');
      }
      if (/password|login|account|claim number|confirmation email/i.test(lower)) {
        push('missing_information', 'Needs account or reference details first', 'prerequisite');
      }
      if (/bedtime changes|schedule changes|different every night/i.test(lower)) {
        push('constraint', 'Bedtime varies; pick a default time', 'timing');
      }
    }
  };

  consider(b, 'blocker');
  consider(m, 'motivation');
  consider(c, 'constraint');
  return facts;
}

function hasFact(facts: TaskContextFact[], re: RegExp): boolean {
  return facts.some(f => re.test(f.fact));
}

function minuteBudget(facts: TaskContextFact[], answers: SimplifyAnswers): number | null {
  const fromFact = facts.find(f => f.category === 'timing' && /\d+ minutes/.test(f.fact));
  if (fromFact) {
    const m = fromFact.fact.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  const raw = `${answers.blocker} ${answers.constraint}`;
  const m = raw.match(/(\d+)\s*-?\s*min/i);
  return m ? Math.min(30, Math.max(2, Number(m[1]))) : null;
}

export function isSemanticRestatement(original: string, candidate: string): boolean {
  const o = norm(original);
  const c = norm(candidate);
  if (!o || !c) return false;
  if (o === c) return true;
  if (c.includes(o) || o.includes(c)) return true;
  const ot = significantTokens(original);
  const ct = significantTokens(candidate);
  if (ot.length === 0) return false;
  const shared = ot.filter(t => ct.includes(t)).length;
  const ratio = shared / ot.length;
  if (ratio >= 0.75 && Math.abs(ct.length - ot.length) <= 3) return true;
  if (ratio >= 0.85) return true;
  return false;
}

function isGenericDomainAdvice(taskLabel: string, candidate: string): boolean {
  const task = taskLabel.toLowerCase();
  const isReminderSetup = /remind|alarm|notif/i.test(task)
    && /set|create|add|make|schedule|phone-?down/i.test(task);

  if (isReminderSetup) {
    if (/lights low|screens off|tomorrow'?s top|get in bed|journal|sleep routine|meditat|put (the )?phone outside|improve your sleep/i.test(candidate)) {
      return true;
    }
  }
  if (/spend more (quality )?time with|talk to .+ about healthy|entire (marketing|acquisition)/i.test(candidate)) {
    return true;
  }
  if (/write tomorrow'?s top/i.test(candidate) && !/tomorrow|plan|task list/i.test(task)) return true;
  return false;
}

function sharesTaskAnchor(taskLabel: string, candidate: string): boolean {
  const taskSig = significantTokens(taskLabel);
  const candSig = significantTokens(candidate);
  const shared = taskSig.filter(t => candSig.includes(t));
  if (/remind|alarm|notif|phone/i.test(taskLabel)
    && /remind|alarm|notif|phone|app|bedtime|clock|label|repeat|save|open|time/i.test(candidate)) {
    return true;
  }
  if (/call|insurance|claim/i.test(taskLabel)
    && /call|claim|denial|number|ask|question|insur|notice/i.test(candidate)) {
    return true;
  }
  if (/document|organiz|tax|bill/i.test(taskLabel)
    && /document|folder|checklist|file|bill|mark|missing/i.test(candidate)) {
    return true;
  }
  if (shared.length >= 1) return true;
  if (/open .+app|choose .+time|enable .+repeat|save the|find the|write down|draft |highlight |create a folder/i.test(candidate)) {
    return true;
  }
  return false;
}

/** Clicks/fields that belong in How to Get This Done, not as tracked tasks. */
export function isProceduralFragment(label: string): boolean {
  const t = label.replace(/\s+/g, ' ').trim();
  return (
    /^(tap |press |click |hit |save\b|choose the time|pick a time|name it|enter the name|turn on repeat|enable repeat|confirm\b|submit\b|continue\b)/i.test(t)
    || /^(name it|set the (time|name)|type the name|select the time)\b/i.test(t)
    || /^(choose|pick|select) (the |a )?\w*\s*time\b/i.test(t)
    || (/\band save\b/i.test(t) && t.split(/\s+/).length <= 8)
    || (/^(open .+ and (tap|click|press))/i.test(t) && t.split(/\s+/).length <= 6)
  );
}

export function validateSimplifiedLabel(
  original: string,
  candidate: string,
  opts?: { goalTitle?: string | null; answers?: SimplifyAnswers },
): { ok: true } | { ok: false; reason: RejectionReason } {
  const label = candidate.replace(/\s+/g, ' ').trim();
  if (label.length < 8) return { ok: false, reason: 'insufficiently_concrete' };
  if (norm(label) === norm(original)) return { ok: false, reason: 'duplicate_original' };
  if (isProceduralFragment(label)) return { ok: false, reason: 'procedural_fragment' };
  if (isSemanticRestatement(original, label)) return { ok: false, reason: 'semantic_restatement' };
  if (isGenericDomainAdvice(original, label)) return { ok: false, reason: 'generic_domain_advice' };
  if (!sharesTaskAnchor(original, label)) return { ok: false, reason: 'unrelated_to_task' };

  if (opts?.goalTitle && !isGoalRelevantToTask(original, opts.goalTitle)) {
    const goalOnly = significantTokens(opts.goalTitle).filter(t => !significantTokens(original).includes(t));
    if (goalOnly.length && goalOnly.some(t => norm(label).includes(t))) {
      return { ok: false, reason: 'goal_drift' };
    }
  }

  if (opts?.answers) {
    for (const raw of [opts.answers.blocker, opts.answers.motivation, opts.answers.constraint]) {
      const snip = raw.replace(/\s+/g, ' ').trim();
      if (snip.length < 10) continue;
      const clip = snip.slice(0, 28).toLowerCase();
      if (label.toLowerCase().includes(clip)) return { ok: false, reason: 'answer_echo' };
      if (/because you (said|mentioned)|since you said|you said/i.test(label)) {
        return { ok: false, reason: 'answer_echo' };
      }
    }
  }

  if (/spend more quality time|improve your relationship/i.test(label)) {
    return { ok: false, reason: 'new_objective' };
  }

  return { ok: true };
}

function preferEvening(facts: TaskContextFact[], answers: SimplifyAnswers): boolean {
  const blob = `${answers.constraint} ${answers.motivation} ${facts.map(f => f.fact).join(' ')}`.toLowerCase();
  return /evening|night|before bed|after work|dinner|lunch/i.test(blob) && !/morning|before work|breakfast/i.test(blob);
}

function preferMorning(facts: TaskContextFact[], answers: SimplifyAnswers): boolean {
  const blob = `${answers.constraint} ${answers.motivation} ${facts.map(f => f.fact).join(' ')}`.toLowerCase();
  return /morning|before work|after wake|breakfast/i.test(blob);
}

export type TaskComplexity = 'atomic' | 'decomposable' | 'broad';

/** Classify how far to decompose — drives step count caps. */
export function classifyTaskComplexity(taskLabel: string): TaskComplexity {
  const t = taskLabel.toLowerCase().trim();
  if (
    /(set|create|add|make|schedule).*(remind|alarm|notif)/i.test(t)
    || /phone-?down/i.test(t)
    || (/remind|alarm/i.test(t) && /phone|bed/i.test(t))
    || /cancel .+ (subscription|software|account)|unsubscribe/i.test(t)
    || /download |submit a form|add .+ (to )?(calendar|event)/i.test(t)
    || /send (a |an )?(short )?email|text my |message my /i.test(t)
    || (
      (/^call |^text |phone my advisor|email my /i.test(t))
      && !/denied|insurance|claim|professor|extension/i.test(t)
      && t.split(/\s+/).length <= 10
    )
  ) {
    return 'atomic';
  }
  if (
    /organiz|documents? needed|compare .+ (apartment|listing)|prepare questions|under control|get my .+ in order|figure out|plan my/i.test(t)
    || /^get |improve |rebuild |overhaul /i.test(t)
  ) {
    // Broad goals vs multi-part work
    if (/under control|get my life|be more|start being|figure out how/i.test(t)) return 'broad';
    return 'decomposable';
  }
  if (t.split(/\s+/).length <= 8 && /^(buy|open|pay|mail|file|book|RSVP|rsvp)/i.test(t)) {
    return 'atomic';
  }
  return 'decomposable';
}

function detectActionFamily(taskLabel: string): string {
  const t = taskLabel.toLowerCase();
  if (
    /(set|create|add|make|schedule).*(remind|alarm|notif)/i.test(t)
    || /phone-?down remind/i.test(t)
    || (/remind/i.test(t) && /phone|bed/i.test(t))
  ) {
    return 'set_reminder';
  }
  if (/^call |call the |phone the |phone my /i.test(t) || (/denied claim|insurance/i.test(t) && /call/i.test(t))) {
    return 'make_call';
  }
  if (/organiz|sort .+ (document|bill|file)|documents? needed/i.test(t)) return 'organize_docs';
  if (/cancel .+ (subscription|software|account)/i.test(t)) return 'cancel_subscription';
  if (/compare .+ (apartment|listing|option)/i.test(t)) return 'compare_options';
  if (/ask .+ (professor|teacher|boss)|request an? extension/i.test(t)) return 'ask_extension';
  if (/update .+ headline|landing page headline/i.test(t)) return 'update_headline';
  if (/hydrat|drink.{0,20}water|water intake/i.test(t)) return 'hydration';
  if (/eat|protein|fruit|meal|healthy lunch/i.test(t)) return 'eating';
  if (/exercise|workout|walk \d|gym|stretch/i.test(t)) return 'exercise';
  if (/^(sleep|go to bed|wind.?down|get (more )?sleep)/i.test(t)) return 'sleep';
  if (/under control|get my finances|figure out|be more productive/i.test(t)) return 'broad';
  return 'generic';
}

/**
 * Atomic reminder task: never more than 2 replacement tasks.
 * Answers change the second (or both) lines; procedural clicks belong in How to Get This Done.
 */
function decomposeSetReminder(facts: TaskContextFact[], answers: SimplifyAnswers): string[] {
  const limited = hasFact(facts, /Only about \d+ minutes|Very limited time/i);
  const variableBed = hasFact(facts, /Bedtime varies|default time/i)
    || /bedtime changes|different every night|schedule changes/i.test(`${answers.blocker} ${answers.constraint}`);
  const forgetRepeat = hasFact(facts, /cue or repeat|Follow-through|reminder or alarm would help/i)
    || /forget|repeat|notif/i.test(`${answers.blocker} ${answers.motivation}`);
  const needsHowTo = hasFact(facts, /lacks key info|clear first physical|script\/checklist/i)
    || /don'?t know how|do not know how|how to set|how do i/i.test(`${answers.blocker} ${answers.motivation}`);

  if (limited) {
    return [
      "Open Reminders or Clock on your phone",
      'Create a repeating Phone-down alert for 30 minutes before bed',
    ];
  }
  if (needsHowTo) {
    return [
      'Open the Clock or Reminders app',
      'Create a repeating Phone-down reminder for 30 minutes before bedtime',
    ];
  }
  if (variableBed) {
    return [
      "Open your phone's Clock or Reminders app",
      'Create the reminder for your most common bedtime minus 30 minutes (adjust on late nights)',
    ];
  }
  if (forgetRepeat) {
    return [
      "Open your phone's Clock or Reminders app",
      'Create a repeating Phone-down alert and leave notifications enabled',
    ];
  }
  // Default: two compact actions (never four interface clicks)
  return [
    "Open your phone's Clock or Reminders app",
    'Create a repeating Phone-down reminder for 30 minutes before your usual bedtime',
  ];
}

function decomposeMakeCall(facts: TaskContextFact[], taskLabel: string): string[] {
  const steps: string[] = [];
  if (hasFact(facts, /review the reason|lacks key info|prepared script|questions before contacting/i)) {
    steps.push('Find the claim number and denial notice');
    steps.push('Highlight or write down the reason listed for the denial');
    steps.push('Write two short questions about the decision');
  } else {
    steps.push('Find the phone number and any claim reference on the notice');
  }
  if (/insurance|claim/i.test(taskLabel)) {
    steps.push('Call the number on the notice with your questions ready');
  } else {
    steps.push('Place the call with your notes in front of you');
  }
  return steps;
}

function decomposeOrganizeDocs(facts: TaskContextFact[]): string[] {
  const steps: string[] = [];
  if (hasFact(facts, /lacks key info|checklist/i)) {
    steps.push('Find the checklist of required documents from your preparer or portal');
  }
  steps.push('Create one folder for the required documents');
  if (hasFact(facts, /Only about \d+ minutes|Very limited time/i)) {
    steps.push('Add the easiest documents you already have on hand');
    return steps.slice(0, 3);
  }
  steps.push('Add each document as you find it');
  steps.push('Mark anything that is still missing');
  return steps;
}

function decomposeCancelSub(facts: TaskContextFact[]): string[] {
  const steps = [
    'Open the subscription confirmation email on your phone',
    'Use the cancellation link in the email',
    'Save or screenshot the cancellation confirmation',
  ];
  if (hasFact(facts, /Only about \d+|Very limited time/i)) return steps.slice(0, 2);
  return steps;
}

function decomposeCompare(facts: TaskContextFact[], goalRelevant: boolean, goalTitle?: string): string[] {
  const steps = [
    'Open the three apartment listings side by side',
    'Note rent, move-in date, and parking for each',
  ];
  if (goalRelevant && goalTitle && /work|commute|closer/i.test(goalTitle)) {
    steps.push('Add approximate commute time for each listing');
  } else {
    steps.push('Add one must-have criterion and score each listing against it');
  }
  steps.push('Cross out any option that fails a must-have');
  return steps;
}

function decomposeAskExtension(facts: TaskContextFact[]): string[] {
  const steps = [
    'Write down the assignment name and the new deadline you want',
    'Draft a short message: reason, new date requested, and thanks',
  ];
  if (hasFact(facts, /morning|before work/i)) {
    steps.push('Review once and send before work');
  } else {
    steps.push('Review once and send');
  }
  return steps;
}

function decomposeGeneric(taskLabel: string, facts: TaskContextFact[], budget: number): string[] {
  const noun = taskLabel
    .replace(/^(i\s+need\s+to|i\s+want\s+to|i\s+should|try\s+to|need\s+to|want\s+to)\s+/i, '')
    .replace(/^to\s+/i, '')
    .trim()
    .slice(0, 48);
  const steps: string[] = [];
  if (hasFact(facts, /lacks key info|prepared script|review the reason|checklist/i)) {
    steps.push(`Gather the missing info or materials needed for: ${noun}`.slice(0, MAX_LABEL));
  }
  steps.push(`Do the first visible action for: ${noun}`.slice(0, MAX_LABEL));
  steps.push(`Spend ${budget} minutes only on the next smallest piece`);
  if (hasFact(facts, /another person|with another person/i)) {
    steps.push('Pick a short time when the other person can join');
  }
  if (hasFact(facts, /Phone-only|No printer/i)) {
    steps.push('Use only your phone for this next action');
  }
  return steps;
}

/**
 * Task-anchored rule decomposition. Does not expand reminder tasks into sleep hygiene.
 */
export function ruleBasedSimplifyCore(input: {
  taskLabel: string;
  goalTitle?: string;
  blocker?: string;
  motivation?: string;
  constraint?: string;
}): SimplifiedStep[] {
  const taskLabel = input.taskLabel.trim().replace(/\s+/g, ' ');
  const answers: SimplifyAnswers = {
    blocker: (input.blocker ?? '').trim(),
    motivation: (input.motivation ?? '').trim(),
    constraint: (input.constraint ?? '').trim(),
  };
  const facts = buildTaskContextFromAnswers(answers);
  const budget = minuteBudget(facts, answers) ?? (hasFact(facts, /Very limited|Only about/i) ? 5 : 10);
  const goalOk = isGoalRelevantToTask(taskLabel, input.goalTitle);
  const family = detectActionFamily(taskLabel);
  const complexity = classifyTaskComplexity(taskLabel);
  const maxSteps = complexity === 'atomic' ? 2 : 5;

  let raw: string[] = [];
  switch (family) {
    case 'set_reminder':
      raw = decomposeSetReminder(facts, answers);
      break;
    case 'make_call':
      raw = decomposeMakeCall(facts, taskLabel);
      break;
    case 'organize_docs':
      raw = decomposeOrganizeDocs(facts);
      break;
    case 'cancel_subscription':
      raw = decomposeCancelSub(facts).slice(0, 2);
      break;
    case 'compare_options':
      raw = decomposeCompare(facts, goalOk, input.goalTitle);
      break;
    case 'ask_extension':
      raw = decomposeAskExtension(facts);
      break;
    case 'update_headline':
      raw = [
        'Open the landing page headline field',
        'Write one clearer alternative headline and save as draft',
      ];
      break;
    case 'hydration':
      raw = [
        ...(hasFact(facts, /cue or repeat|reminder/i) ? ['Fill a bottle and place it where you will see it'] : []),
        'Drink one full glass of water now',
        hasFact(facts, /Only about|Very limited/i)
          ? 'Take five sips again before your next break'
          : 'Refill once and finish another glass before midday',
      ];
      break;
    case 'eating':
      raw = [
        'Add one clear food item you will actually eat today',
        hasFact(facts, /Very limited|Only about/i) ? 'Eat it at the next meal window' : 'Prep one portion ahead for later',
        'Drink water with that meal',
      ];
      break;
    case 'exercise':
      raw = [
        hasFact(facts, /at home|No special venue/i)
          ? 'Do 10 minutes of walking or bodyweight at home'
          : `Walk for ${budget} minutes`,
        'Do one set of a movement you already know',
      ];
      break;
    case 'sleep':
      raw = [
        'Dim lights for the last 15 minutes before bed',
        'Get in bed at your chosen time',
      ];
      break;
    case 'broad':
      raw = [
        'Write one concrete outcome that would mean progress this week',
        'Pick the single first action that unlocks that outcome',
        hasFact(facts, /lacks key info|checklist/i)
          ? 'Gather the missing info needed for that first action'
          : `Spend ${budget} minutes only on that first action`,
      ];
      break;
    default:
      raw = decomposeGeneric(taskLabel, facts, budget);
  }

  if (hasFact(facts, /with another person/i) && family !== 'set_reminder' && complexity !== 'atomic') {
    if (!raw.some(s => /other person|together|join/i.test(s))) {
      raw.unshift('Pick a 15-minute time when both of you are available');
    }
  }

  // Atomic: hard-cap before validation so we never return 4 interface clicks
  if (complexity === 'atomic') {
    raw = raw.slice(0, 2);
  }

  const evening = preferEvening(facts, answers);
  const morning = preferMorning(facts, answers);
  const seen = new Set<string>();
  const out: SimplifiedStep[] = [];

  for (const s of raw) {
    const label = s.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
    const v = validateSimplifiedLabel(taskLabel, label, {
      goalTitle: goalOk ? input.goalTitle : null,
      answers,
    });
    if (!v.ok) continue;
    const key = norm(label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label,
      timeOfDay: evening
        ? (out.length % 2 === 0 ? 'evening' : 'morning')
        : morning
          ? (out.length % 2 === 0 ? 'morning' : 'evening')
          : (out.length % 2 === 0 ? 'morning' : 'evening'),
    });
    if (out.length >= maxSteps) break;
  }

  if (out.length === 1 && complexity === 'atomic') {
    // Prefer a compact create/finish line that won't restatement-fail
    const fallbacks = family === 'set_reminder'
      ? [
        'Create a repeating Phone-down alert for your usual bedtime minus 30 minutes',
        'Finish creating the reminder with nightly repeat on',
      ]
      : [
        'Complete the next visible action for this task',
        'Finish the remaining setup in one pass',
      ];
    for (const plain of fallbacks) {
      const v = validateSimplifiedLabel(taskLabel, plain, {
        goalTitle: goalOk ? input.goalTitle : null,
        answers,
      });
      if (v.ok && !seen.has(norm(plain))) {
        out.push({
          label: plain.slice(0, MAX_LABEL),
          timeOfDay: out[0].timeOfDay === 'morning' ? 'evening' : 'morning',
        });
        break;
      }
    }
  }

  if (out.length === 1 && complexity !== 'atomic') {
    const plain = 'Open the app or place where you will finish the next action';
    const v = validateSimplifiedLabel(taskLabel, plain, {
      goalTitle: goalOk ? input.goalTitle : null,
      answers,
    });
    if (v.ok && !seen.has(norm(plain))) {
      out.push({
        label: plain.slice(0, MAX_LABEL),
        timeOfDay: out[0].timeOfDay === 'morning' ? 'evening' : 'morning',
      });
    }
  }

  return out.slice(0, maxSteps);
}

/** Filter LLM/rules candidates through the same validators. */
export function filterCandidateSteps(
  taskLabel: string,
  candidates: SimplifiedStep[],
  opts?: { goalTitle?: string | null; answers?: SimplifyAnswers },
): { kept: SimplifiedStep[]; rejected: Array<{ label: string; reason: RejectionReason }> } {
  const seen = new Set<string>();
  const kept: SimplifiedStep[] = [];
  const rejected: Array<{ label: string; reason: RejectionReason }> = [];
  const answers = opts?.answers ?? { blocker: '', motivation: '', constraint: '' };
  const goalTitle = opts?.goalTitle && isGoalRelevantToTask(taskLabel, opts.goalTitle)
    ? opts.goalTitle
    : null;
  const maxSteps = classifyTaskComplexity(taskLabel) === 'atomic' ? 2 : 5;

  for (const c of candidates) {
    const label = c.label.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
    const v = validateSimplifiedLabel(taskLabel, label, { goalTitle, answers });
    if (!v.ok) {
      rejected.push({ label, reason: v.reason });
      continue;
    }
    const key = norm(label);
    if (seen.has(key)) {
      rejected.push({ label, reason: 'duplicate_step' });
      continue;
    }
    seen.add(key);
    kept.push({ label, timeOfDay: c.timeOfDay === 'evening' ? 'evening' : 'morning' });
    if (kept.length >= maxSteps) break;
  }
  return { kept, rejected };
}
