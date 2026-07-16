/**
 * Simplify-for-Me detail assist: sufficiency checks, answer merge,
 * and prevalidated clarification suggestions.
 * Mirrored on the edge (supabase/functions/server/simplifyDetailAssist.ts).
 */

export type SimplifyQuestionId = 'hard_part' | 'what_would_help' | 'constraints';

export type DetailAssistStatus = 'sufficient' | 'needs_detail' | 'irrelevant' | 'empty';

export type MissingDetailType =
  | 'specific_blocker'
  | 'practical_support'
  | 'operational_constraint'
  | 'context';

export interface DetailSuggestion {
  id: string;
  appendText: string;
  validatedCombinedAnswer: string;
}

export interface DetailAssistResult {
  requestId: string;
  taskId: string;
  questionId: SimplifyQuestionId;
  status: DetailAssistStatus;
  missingDetailType?: MissingDetailType;
  suggestions: DetailSuggestion[];
  source: 'llm' | 'server_rules' | 'client_fallback';
  reason?: string;
}

export interface DetailAssistInput {
  taskLabel: string;
  taskId?: string;
  requestId?: string;
  questionId: SimplifyQuestionId;
  currentAnswer: string;
  /** Optional seed to rotate "show different" sets without logging content. */
  refreshNonce?: number;
}

const QUESTION_FIELD: Record<SimplifyQuestionId, 'blocker' | 'motivation' | 'constraint'> = {
  hard_part: 'blocker',
  what_would_help: 'motivation',
  constraints: 'constraint',
};

/** Concrete signals that already personalize Simplify decomposition. */
const CONCRETE_RE =
  /\b(\d+)\s*-?\s*min(ute)?s?\b|\b(ten|fifteen|twenty|thirty)\s*min|\btonight\b|\blunch\b|\bmorning\b|\bevening\b|\biphon|ios\b|\bandroid\b|\bapp\b|\bscript\b|\bchecklist\b|\btemplate\b|\bpartner\b|\bspouse\b|\bclaim\b|\bletter\b|\bdenial\b|\bbedtime\b|\bdistract|\bignores?\b|\breminder\b|\bprinter\b|\bphone only\b|\bquestions?\b|\bclaim number\b|\bdocuments?\b|\benergy\b|\btransport|\bdeadline\b|\bcalendar\b|\balarm\b|\bbefore bed\b|\bwhich (app|claim|document)/i;

const VAGUE_HARD =
  /^(i\s+)?(just\s+)?(forget|forgot|don'?t know( what to do)?|do not know( what to do)?|not sure|it'?s hard|too hard|overwhelm(ed)?|procrastinat\w*|put(ting)? (it|this) off|keep putting this off)\.?$/i;

const VAGUE_HELP =
  /^(i\s+)?(just\s+)?(some (direction|help|guidance)|help|direction|support|guidance)( would help)?\.?$/i;

const VAGUE_CONSTRAINT =
  /^(i\s+)?(just\s+)?(don'?t|do not)?\s*(have )?(much |a lot of )?time\.?$|^(i'?m |i am )?(busy|rushed|limited)\.?$/i;

function normSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function wordCount(s: string): number {
  return normSpace(s).split(' ').filter(Boolean).length;
}

function isObviouslyIrrelevant(raw: string, taskLabel: string): boolean {
  const t = raw.toLowerCase();
  if (/favorite food|pizza|random thought|lol\b|asdf/i.test(t) && !/remind|alarm|bed|phone|call|claim|document/i.test(t)) {
    return true;
  }
  const actionable =
    /iphone|android|minute|time|app|don'?t know|do not know|not sure|forget|tired|busy|morning|evening|letter|claim|checklist|partner|phone|help|direction|script|what to (do|say|ask)/i.test(t);
  if (actionable) return false;
  return t.length > 12 && !significantOverlap(raw, taskLabel);
}

function significantOverlap(a: string, b: string): boolean {
  const weak = new Set(['the', 'and', 'for', 'with', 'your', 'you', 'this', 'that', 'from', 'into', 'about']);
  const toks = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !weak.has(t));
  const A = toks(a);
  const B = new Set(toks(b));
  return A.some(t => B.has(t));
}

export function missingDetailTypeFor(questionId: SimplifyQuestionId): MissingDetailType {
  if (questionId === 'hard_part') return 'specific_blocker';
  if (questionId === 'what_would_help') return 'practical_support';
  return 'operational_constraint';
}

/**
 * Meaningful-detail gate used by UI + server prevalidation.
 * Optional blank answers are `empty` (allowed to skip).
 */
export function evaluateAnswerSufficiency(
  questionId: SimplifyQuestionId,
  answer: string,
  taskLabel: string,
): { status: DetailAssistStatus; missingDetailType?: MissingDetailType } {
  const raw = normSpace(answer);
  if (raw.length < 2) return { status: 'empty' };
  if (isObviouslyIrrelevant(raw, taskLabel)) {
    return { status: 'irrelevant', missingDetailType: 'context' };
  }

  const concrete = CONCRETE_RE.test(raw);
  const words = wordCount(raw);
  const vague =
    (questionId === 'hard_part' && VAGUE_HARD.test(raw))
    || (questionId === 'what_would_help' && VAGUE_HELP.test(raw))
    || (questionId === 'constraints' && VAGUE_CONSTRAINT.test(raw));

  if (concrete && !vague) {
    return { status: 'sufficient' };
  }
  // Long answers with concrete markers win even if a vague stem appears inside.
  if (concrete && (words >= 6 || raw.length >= 28)) {
    return { status: 'sufficient' };
  }
  if (vague) {
    return { status: 'needs_detail', missingDetailType: missingDetailTypeFor(questionId) };
  }
  // Short relevant answers without concrete detail still need help.
  if (words < 6 || raw.length < 22) {
    return { status: 'needs_detail', missingDetailType: missingDetailTypeFor(questionId) };
  }
  if (raw.length >= 40 && words >= 8) {
    return { status: 'sufficient' };
  }
  return { status: 'needs_detail', missingDetailType: missingDetailTypeFor(questionId) };
}

/** Merge original answer + selected addition with natural punctuation. */
export function mergeAnswerWithAddition(existing: string, addition: string): string {
  const base = normSpace(existing);
  const add = normSpace(addition);
  if (!base) return add;
  if (!add) return base;

  const baseLower = base.toLowerCase();
  const addLower = add.toLowerCase();
  if (baseLower.includes(addLower)) return base;
  if (addLower.includes(baseLower) && add.length > base.length) return add;

  const baseEndsPunct = /[.!?]$/.test(base);
  const addStartsLower = /^[a-z]/.test(add);
  let left = baseEndsPunct ? base : `${base}.`;
  let right = add;
  // Avoid "I forget.. Something"
  left = left.replace(/\.+$/, '.');
  if (addStartsLower && !baseEndsPunct) {
    // "I forget" + "my bedtime..." → "I forget. My bedtime..."
    right = add.charAt(0).toUpperCase() + add.slice(1);
  }
  const combined = `${left} ${right}`.replace(/\s+/g, ' ').trim();
  return combined.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.');
}

function suggestionPasses(
  questionId: SimplifyQuestionId,
  existing: string,
  appendText: string,
  taskLabel: string,
): string | null {
  const combined = mergeAnswerWithAddition(existing, appendText);
  const check = evaluateAnswerSufficiency(questionId, combined, taskLabel);
  if (check.status !== 'sufficient') return null;
  // Must actually add something beyond a paraphrase of the same short answer.
  if (normSpace(combined).toLowerCase() === normSpace(existing).toLowerCase()) return null;
  if (wordCount(appendText) < 3) return null;
  return combined;
}

type CandidateBank = Record<SimplifyQuestionId, string[]>;

function taskDomainHints(taskLabel: string): { reminder: boolean; insurance: boolean; docs: boolean } {
  const t = taskLabel.toLowerCase();
  return {
    reminder: /remind|phone.?down|bed|alarm|notif/i.test(t),
    insurance: /insurance|claim|denied|denial/i.test(t),
    docs: /document|tax|organiz|paper|file/i.test(t),
  };
}

/** Rule-based candidate additions — always prevalidated before return. */
export function buildRuleBasedDetailCandidates(
  questionId: SimplifyQuestionId,
  taskLabel: string,
  currentAnswer: string,
): string[] {
  const domain = taskDomainHints(taskLabel);
  const lower = currentAnswer.toLowerCase();

  const hard: string[] = [];
  if (domain.reminder) {
    hard.push(
      'My bedtime changes from night to night.',
      'I usually ignore reminders once they appear.',
      'I am not sure which app to use.',
      'I get distracted and lose track of time.',
    );
  }
  if (domain.insurance) {
    hard.push(
      'I do not understand the reason listed in the denial letter.',
      'I do not know which claim number to reference.',
      'I am not sure what questions to ask during the call.',
      'I feel nervous about speaking with the insurer.',
    );
  }
  if (domain.docs) {
    hard.push(
      'I am not sure which documents I actually need.',
      'The papers are scattered in different places.',
      'I do not know what order to sort them in.',
      'I keep stopping once I find the first folder.',
    );
  }
  hard.push(
    'I am not sure where to start once I sit down.',
    'I get stuck deciding the first concrete action.',
    'I lose momentum after the first attempt.',
  );

  const help: string[] = [];
  if (domain.reminder) {
    help.push(
      'A short checklist for setting the reminder would help.',
      'Simple step-by-step directions for my phone would help.',
      'A default bedtime time I can adjust later would help.',
    );
  }
  if (domain.insurance) {
    help.push(
      'A short script for what to say would make it easier.',
      'A checklist of what to have ready would help.',
      'I would be more likely to do it with someone beside me.',
    );
  }
  if (domain.docs) {
    help.push(
      'A short checklist of the documents I need would help.',
      'A clear first pile to start with would help.',
      'A timer-based first session would help me begin.',
    );
  }
  help.push(
    'A short script for what to say would make it easier.',
    'A checklist of what to have ready would help.',
    'I would be more likely to do it with someone beside me.',
    'A reminder at a specific time would help me follow through.',
  );

  const constraints: string[] = [];
  constraints.push(
    'I only have about ten minutes tonight.',
    'I can only work on this during lunch.',
    'I need to complete it using my phone.',
    'I have low energy after work, so steps must stay tiny.',
    'I can only do this at home this week.',
  );
  if (domain.docs) {
    constraints.push('I do not have a printer available.');
  }
  if (domain.reminder) {
    constraints.push('My evenings are unpredictable, so the time must be easy to change.');
  }

  const bank: CandidateBank = {
    hard_part: hard,
    what_would_help: help,
    constraints,
  };

  const raw = bank[questionId];
  // Prefer candidates that do not repeat the existing answer wording.
  const filtered = raw.filter(c => {
    const cLow = c.toLowerCase();
    if (lower && cLow.includes(lower) && lower.length > 8) return false;
    // Avoid near-duplicates of the existing phrase
    const overlap = normSpace(currentAnswer).toLowerCase();
    if (overlap && cLow === overlap) return false;
    return true;
  });
  return [...new Set(filtered)];
}

function rotate<T>(items: T[], nonce: number): T[] {
  if (items.length === 0) return items;
  const n = ((nonce % items.length) + items.length) % items.length;
  return items.slice(n).concat(items.slice(0, n));
}

export function buildPrevalidatedSuggestions(
  input: DetailAssistInput,
  source: DetailAssistResult['source'] = 'server_rules',
): DetailAssistResult {
  const requestId = (input.requestId && input.requestId.trim()) || `det_${Date.now().toString(36)}`;
  const taskId = (input.taskId && input.taskId.trim()) || '';
  const taskLabel = normSpace(input.taskLabel);
  const currentAnswer = normSpace(input.currentAnswer);
  const questionId = input.questionId;

  const evaluation = evaluateAnswerSufficiency(questionId, currentAnswer, taskLabel);
  if (evaluation.status === 'sufficient' || evaluation.status === 'empty') {
    return {
      requestId,
      taskId,
      questionId,
      status: evaluation.status,
      suggestions: [],
      source,
      reason: evaluation.status === 'empty' ? 'blank_optional' : 'already_sufficient',
    };
  }
  if (evaluation.status === 'irrelevant') {
    return {
      requestId,
      taskId,
      questionId,
      status: 'irrelevant',
      missingDetailType: 'context',
      suggestions: [],
      source,
      reason: 'irrelevant_answer',
    };
  }

  const candidates = rotate(
    buildRuleBasedDetailCandidates(questionId, taskLabel, currentAnswer),
    input.refreshNonce ?? 0,
  );

  const suggestions: DetailSuggestion[] = [];
  for (let i = 0; i < candidates.length && suggestions.length < 4; i++) {
    const appendText = candidates[i];
    const validatedCombinedAnswer = suggestionPasses(questionId, currentAnswer, appendText, taskLabel);
    if (!validatedCombinedAnswer) continue;
    // Keep suggestions materially different from each other
    const tooSimilar = suggestions.some(s => {
      const a = s.appendText.toLowerCase();
      const b = appendText.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
    if (tooSimilar) continue;
    suggestions.push({
      id: `s${suggestions.length + 1}`,
      appendText,
      validatedCombinedAnswer,
    });
  }

  return {
    requestId,
    taskId,
    questionId,
    status: 'needs_detail',
    missingDetailType: evaluation.missingDetailType ?? missingDetailTypeFor(questionId),
    suggestions: suggestions.slice(0, 4),
    source,
    reason: suggestions.length >= 2 ? 'suggestions_ready' : 'insufficient_valid_suggestions',
  };
}

export function questionIdForStep(step: number): SimplifyQuestionId {
  return (['hard_part', 'what_would_help', 'constraints'] as const)[Math.max(0, Math.min(2, step))];
}

export { QUESTION_FIELD };
