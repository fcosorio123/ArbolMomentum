import { C } from '../data/colors';
import type { TaskStatus } from '../data/profiles';

export function truncateRemark(text: string, maxLen = 72): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trimEnd()}…`;
}

export const SKIPPED_CARD_STYLE = {
  opacity: 0.55,
  background: C.bgAlt,
} as const;

export const SKIPPED_BADGE = {
  label: 'Skipped',
  bg: `${C.tertiary}18`,
  color: C.tertiary,
} as const;

export function shouldShowRemark(status: TaskStatus | null, remark: string): boolean {
  if (!remark.trim()) return false;
  if (status === null) return true;
  return true;
}
