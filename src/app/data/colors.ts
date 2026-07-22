/**
 * Canonical Arbol Momentum color tokens.
 * Source of truth mirrored from arbol-ui:
 *   - tailwind.config.mjs (brand / secondary / extended / semantic / focus)
 *   - lara-light-indigo/_variables.scss (neutral shade scale)
 *
 * Prefer importing from this module over raw hex values.
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

/** Supporting brand */
export const ARBOL_SUPPORT = {
  maroonOak: '#550D0E',
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

/** Neutrals (PrimeNG shade scale + extras) */
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
  infoFg: '#017AAD',
  infoBg: '#E5F5FC',
  successFg: '#29823B',
  successBg: '#EAF3EB',
  warningFg: '#E9A100',
  warningBg: '#FDF6E5',
  errorFg: '#A72D1A',
  errorBg: '#FCEAEA',
} as const;

/** Accessibility focus */
export const ARBOL_FOCUS = {
  brand: '#8E1533',
  inner: '#101213',
  outer: '#FFD337',
} as const;

/**
 * Goal / category accent cycle — Arbol palette only.
 * Keeps goals distinguishable without stock indigo/violet or overusing primary.
 */
export const GOAL_ACCENT_COLORS = [
  ARBOL_PRIMARY.DEFAULT,
  ARBOL_SUPPORT.stormBlue,
  ARBOL_SEMANTIC.successFg,
  ARBOL_SUPPORT.freshGuacamole,
  ARBOL_SEMANTIC.warningFg,
  ARBOL_SEMANTIC.errorFg,
  ARBOL_SUPPORT.maroonOak,
  ARBOL_SUPPORT.frozenWave,
] as const;

export function accentColorForId(id: string): string {
  const hash = Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  return GOAL_ACCENT_COLORS[hash % GOAL_ACCENT_COLORS.length];
}

/**
 * App-wide runtime palette (legacy `C` API).
 * Components already import `C`; values now resolve to Arbol roles.
 */
export const C = {
  /** Page background — warm linen, low emphasis */
  bg: ARBOL_WARM.linen,
  /** Cards / elevated surfaces */
  bgCard: ARBOL_NEUTRAL.white,
  /** Subtle tinted surface (was light blue) */
  bgAlt: ARBOL_PRIMARY.tint,
  /** Stronger tinted surface */
  bgAlt2: ARBOL_PRIMARY.light,
  /** Dark brand text / sidebar — Fresh Guacamole (not burgundy fill) */
  headline: ARBOL_SUPPORT.freshGuacamole,
  /** Body / secondary copy */
  body: ARBOL_NEUTRAL.textSecondary,
  /** Primary CTA / selection / focus brand */
  primary: ARBOL_PRIMARY.DEFAULT,
  /** Primary hover */
  primaryDark: ARBOL_PRIMARY.hover,
  /** Primary pressed / gradient end */
  primaryPressed: ARBOL_PRIMARY.pressed,
  /** Muted secondary (icons, inactive) */
  secondary: ARBOL_NEUTRAL.disabled,
  /** Destructive / tertiary alert */
  tertiary: ARBOL_SEMANTIC.errorFg,
  /** Streak / attention / warning accents */
  streak: ARBOL_SEMANTIC.warningFg,
  /** Success */
  success: ARBOL_SEMANTIC.successFg,
  successBg: ARBOL_SEMANTIC.successBg,
  /** Info */
  info: ARBOL_SEMANTIC.infoFg,
  infoBg: ARBOL_SEMANTIC.infoBg,
  /** Warning surfaces */
  warningBg: ARBOL_SEMANTIC.warningBg,
  /** Error surfaces */
  errorBg: ARBOL_SEMANTIC.errorBg,
  /** Borders — neutral, not blue-tinted */
  border: 'rgba(39,39,42,0.10)',
  borderStrong: 'rgba(39,39,42,0.18)',
  /** Shadows — geometry unchanged; color remapped to neutral */
  shadow: '0 2px 16px rgba(39,39,42,0.08)',
  shadowMd: '0 4px 24px rgba(39,39,42,0.12)',
  /** Focus ring color only */
  focus: ARBOL_FOCUS.brand,
  focusOuter: ARBOL_FOCUS.outer,
} as const;

export type MomentumColorToken = keyof typeof C;
