/**
 * Canonical Arbol Momentum color tokens.
 * Mirrored from arbol-ui (tailwind.config.mjs + lara-light-indigo/_variables.scss).
 *
 * Product rules for Momentum:
 * - No blue/cyan chrome (storm-blue / frozen-wave / fresh-guacamole navy are not used in UI).
 * - Dark surfaces use maroon/primary-dark; text uses Arbol neutral scale for AA contrast.
 * - Semantic green / warning / error retain meaning.
 */

/** Brand primary scale */
export const ARBOL_PRIMARY = {
  DEFAULT: '#8E1533',
  hover: '#B01B42',
  600: '#80132E',
  pressed: '#6B1026',
  dark: '#550D1F',
  darkest: '#460A19',
  400: '#B05B70',
  300: '#D2A1AD',
  200: '#E3C5CC',
  light: '#F4E8EB',
  tint: '#F9F3F5',
} as const;

/** Supporting brand (UI chrome avoids blues) */
export const ARBOL_SUPPORT = {
  maroonOak: '#550D0E',
  /** Kept for reference only — do not use in Momentum chrome */
  stormBlue: '#0096D1',
  frozenWave: '#52A7CC',
  freshGuacamole: '#182F53',
} as const;

/** Warm surfaces */
export const ARBOL_WARM = {
  chanterelle: '#ECDCC4',
  linen: '#FCF4F0',
  wildOats: '#FFF7EC',
  majesticBeige: '#DFD7CC',
} as const;

/** Neutrals */
export const ARBOL_NEUTRAL = {
  white: '#FFFFFF',
  surfaceSubtle: '#FAFAFA',
  surfaceMuted: '#F4F4F5',
  borderLight: '#E5E7EB',
  borderMedium: '#CCCCCC',
  disabled: '#A1A1AA',
  textSecondary: '#595959',
  textStrongSecondary: '#3F3F46',
  textPrimary: '#27272A',
  textStrongest: '#18181B',
  heavyCharcoal: '#56514B',
  mysticalMist: '#E7E5DD',
  hurricaneHaze: '#BDBBAD',
  concreteJungle: '#999990',
  blackSafflower: '#342E37',
} as const;

/** Semantic */
export const ARBOL_SEMANTIC = {
  /** Informational chrome uses charcoal — not cyan — so Momentum stays non-blue */
  infoFg: '#56514B',
  infoBg: '#F4F4F5',
  successFg: '#29823B',
  successBg: '#EAF3EB',
  warningFg: '#E9A100',
  /** Darker warning text for AA on light warning surfaces */
  warningText: '#875700',
  warningBg: '#FDF6E5',
  errorFg: '#A72D1A',
  errorBg: '#FCEAEA',
} as const;

export const ARBOL_FOCUS = {
  brand: '#8E1533',
  inner: '#101213',
  outer: '#FFD337',
} as const;

/**
 * Goal / category accents — warm + brand + semantic only (no blue/cyan).
 */
export const GOAL_ACCENT_COLORS = [
  ARBOL_PRIMARY.DEFAULT,
  ARBOL_SEMANTIC.successFg,
  ARBOL_SUPPORT.maroonOak,
  ARBOL_SEMANTIC.errorFg,
  ARBOL_SEMANTIC.warningFg,
  ARBOL_NEUTRAL.textStrongest,
  '#DEA81C',
  ARBOL_PRIMARY[400],
] as const;

export function accentColorForId(id: string): string {
  const hash = Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  return GOAL_ACCENT_COLORS[hash % GOAL_ACCENT_COLORS.length];
}

/**
 * App-wide runtime palette (`C`).
 * Contrast targets: body/secondary text ≥ AA on linen/white; white text on maroon chrome.
 */
export const C = {
  bg: ARBOL_WARM.linen,
  bgCard: ARBOL_NEUTRAL.white,
  /** Subtle surface — warm beige, not pink-washed (better text contrast) */
  bgAlt: ARBOL_WARM.wildOats,
  bgAlt2: ARBOL_PRIMARY.light,
  /** Dark chrome / sidebar / headlines on light — maroon, not navy */
  headline: ARBOL_PRIMARY.dark,
  /** Primary readable body copy */
  body: ARBOL_NEUTRAL.textStrongSecondary,
  primary: ARBOL_PRIMARY.DEFAULT,
  primaryDark: ARBOL_PRIMARY.hover,
  primaryPressed: ARBOL_PRIMARY.pressed,
  /**
   * Secondary labels / inactive icons on light surfaces.
   * Heavy charcoal (not zinc-400) so text stays readable on linen.
   */
  secondary: ARBOL_NEUTRAL.heavyCharcoal,
  /** Truly disabled / decorative only */
  muted: ARBOL_NEUTRAL.disabled,
  tertiary: ARBOL_SEMANTIC.errorFg,
  streak: ARBOL_SEMANTIC.warningFg,
  /** Readable warning copy on light yellow */
  streakText: ARBOL_SEMANTIC.warningText,
  success: ARBOL_SEMANTIC.successFg,
  successBg: ARBOL_SEMANTIC.successBg,
  info: ARBOL_SEMANTIC.infoFg,
  infoBg: ARBOL_SEMANTIC.infoBg,
  warningBg: ARBOL_SEMANTIC.warningBg,
  errorBg: ARBOL_SEMANTIC.errorBg,
  border: 'rgba(24,24,27,0.14)',
  borderStrong: 'rgba(24,24,27,0.22)',
  shadow: '0 2px 16px rgba(24,24,27,0.10)',
  shadowMd: '0 4px 24px rgba(24,24,27,0.14)',
  focus: ARBOL_FOCUS.brand,
  focusOuter: ARBOL_FOCUS.outer,
} as const;

export type MomentumColorToken = keyof typeof C;
