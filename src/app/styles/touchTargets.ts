import type { CSSProperties } from 'react';

/** Shared mobile touch target sizes (44px minimum). */
export const MIN_TOUCH = 44;

/**
 * Bottom padding so content clears bottom nav (~72) + FAB (52) + gap.
 * Use on screens with a floating Add action above BottomNav.
 */
export const PAGE_PAD_BOTTOM_WITH_FAB =
  'calc(160px + env(safe-area-inset-bottom, 0px))';

/** Bottom padding when only BottomNav is present (no FAB). */
export const PAGE_PAD_BOTTOM_NAV =
  'calc(100px + env(safe-area-inset-bottom, 0px))';

/** Toast / sticky chrome sitting above FAB + BottomNav. */
export const TOAST_BOTTOM_ABOVE_FAB =
  'calc(72px + 52px + 20px + env(safe-area-inset-bottom, 0px))';

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
