/** Generic potential value scale for tasks and goals (MVP). */

export type PotentialValueScore = 1 | 2 | 3 | 4;

export type PotentialValueSource = 'manual' | 'llm' | 'staff' | 'default';

export type PotentialValueUnit = 'progress' | 'time' | 'risk' | 'money';

export interface PotentialValue {
  score: PotentialValueScore;
  label: string;
  rationale: string;
  source: PotentialValueSource;
  unit?: PotentialValueUnit;
  estimatedAmount?: number;
  updatedAt: number;
}

export const PV_LABELS: Record<PotentialValueScore, string> = {
  1: 'Low',
  2: 'Moderate',
  3: 'High',
  4: 'Transformative',
};

export function defaultPotentialValue(source: PotentialValueSource = 'default'): PotentialValue {
  return {
    score: 2,
    label: PV_LABELS[2],
    rationale: 'Completing this task supports your daily progress.',
    source,
    unit: 'progress',
    updatedAt: Date.now(),
  };
}

export function normalizePotentialValue(raw?: Partial<PotentialValue> | null): PotentialValue | undefined {
  if (!raw) return undefined;
  const score = ([1, 2, 3, 4] as const).includes(raw.score as PotentialValueScore)
    ? (raw.score as PotentialValueScore)
    : 2;
  return {
    score,
    label: raw.label?.trim() || PV_LABELS[score],
    rationale: raw.rationale?.trim() || defaultPotentialValue(raw.source ?? 'default').rationale,
    source: raw.source ?? 'default',
    unit: raw.unit,
    estimatedAmount: raw.estimatedAmount,
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

/** Always returns a displayable PV (Moderate default). */
export function getDisplayPotentialValue(raw?: Partial<PotentialValue> | null): PotentialValue {
  return normalizePotentialValue(raw) ?? defaultPotentialValue('default');
}

export function isValidPotentialValueScore(score: unknown): score is PotentialValueScore {
  return ([1, 2, 3, 4] as const).includes(score as PotentialValueScore);
}

export function potentialValuePriorityBonus(pv?: PotentialValue): number {
  if (!pv) return 0;
  return pv.score * 10;
}
