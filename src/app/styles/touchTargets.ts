import type { CSSProperties } from 'react';

/** Shared mobile touch target sizes (44px minimum). */
export const MIN_TOUCH = 44;

export const touchIconButton: CSSProperties = {
  minWidth: MIN_TOUCH,
  minHeight: MIN_TOUCH,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 10,
  borderRadius: 8,
  cursor: 'pointer',
};

export const touchPrimaryButton: CSSProperties = {
  minHeight: MIN_TOUCH,
  padding: '12px 16px',
  borderRadius: 12,
  cursor: 'pointer',
};
