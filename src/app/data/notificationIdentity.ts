/**
 * Opaque notification-instance IDs, stable CTA IDs, and attribution deep-link helpers.
 * Never put PII or emails in URLs.
 */

import {
  CHECKIN_QUERY_PARAM,
  buildCheckInDeepLink,
  checkInNotificationUrl as baseCheckInNotificationUrl,
} from './checkInDeepLink';

export const NID_QUERY_PARAM = 'nid';
export const CTA_QUERY_PARAM = 'cta';
export const DEST_QUERY_PARAM = 'dest';

export const ATTR_SESSION_KEY = 'arbol-attr-session';
export const ATTR_STAGE_PREFIX = 'arbol-attr-stage-';

/** Stable CTA action IDs (not free text). */
export const CTA_IDS = {
  open_checkin: 'cta.open_checkin',
  open_tasks: 'cta.open_tasks',
  open_goals: 'cta.open_goals',
  open_app: 'cta.open_app',
  open_dashboard: 'cta.open_dashboard',
} as const;

export type CtaId = (typeof CTA_IDS)[keyof typeof CTA_IDS];

export type DestId = 'checkin' | 'tasks' | 'goals' | 'home' | 'dashboard';

export interface AttributionSession {
  nid: string;
  cta: CtaId | string;
  dest: DestId;
  channel?: string;
  notifType?: string;
  stashedAt: number;
}

/** Opaque notification instance id — no PII. */
export function mintNotificationId(): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `n_${rand}`;
}

export function isValidNid(nid: string | null | undefined): boolean {
  if (!nid || typeof nid !== 'string') return false;
  return /^n_[a-zA-Z0-9]{8,64}$/.test(nid.trim());
}

function hrefOrCurrent(href?: string): string {
  if (href) return href;
  return typeof window !== 'undefined' ? window.location.href : 'https://example.invalid/';
}

export function readNidFromUrl(href?: string): string | null {
  try {
    const url = new URL(hrefOrCurrent(href));
    const nid = (url.searchParams.get(NID_QUERY_PARAM) || '').trim();
    return isValidNid(nid) ? nid : null;
  } catch {
    return null;
  }
}

export function readCtaFromUrl(href?: string): string | null {
  try {
    const url = new URL(hrefOrCurrent(href));
    const cta = (url.searchParams.get(CTA_QUERY_PARAM) || '').trim();
    return cta || null;
  } catch {
    return null;
  }
}

export function readDestFromUrl(href?: string): DestId | null {
  try {
    const url = new URL(hrefOrCurrent(href));
    const dest = (url.searchParams.get(DEST_QUERY_PARAM) || '').trim();
    if (dest === 'checkin' || dest === 'tasks' || dest === 'goals' || dest === 'home' || dest === 'dashboard') {
      return dest;
    }
    if (url.searchParams.get(CHECKIN_QUERY_PARAM)) return 'checkin';
    return null;
  } catch {
    return null;
  }
}

/** Append attribution params without putting PII in the URL. */
export function withAttributionParams(
  href: string,
  opts: { nid: string; cta: CtaId | string; dest?: DestId },
): string {
  const trimmed = (href || '/').trim();
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      url.searchParams.set(NID_QUERY_PARAM, opts.nid);
      url.searchParams.set(CTA_QUERY_PARAM, opts.cta);
      if (opts.dest) url.searchParams.set(DEST_QUERY_PARAM, opts.dest);
      return url.toString();
    }
    const pathish = trimmed.includes('?') || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    const url = new URL(pathish, 'https://arbol.local');
    url.searchParams.set(NID_QUERY_PARAM, opts.nid);
    url.searchParams.set(CTA_QUERY_PARAM, opts.cta);
    if (opts.dest) url.searchParams.set(DEST_QUERY_PARAM, opts.dest);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const join = trimmed.includes('?') ? '&' : trimmed.endsWith('/') ? '?' : '/?';
    let out = `${trimmed}${join}${NID_QUERY_PARAM}=${encodeURIComponent(opts.nid)}&${CTA_QUERY_PARAM}=${encodeURIComponent(opts.cta)}`;
    if (opts.dest) out += `&${DEST_QUERY_PARAM}=${encodeURIComponent(opts.dest)}`;
    return out;
  }
}

/** Check-in deep link with opaque nid + CTA. */
export function buildAttributedCheckInLink(
  baseUrl: string,
  opts?: { nid?: string; cta?: CtaId | string },
): string {
  const nid = opts?.nid && isValidNid(opts.nid) ? opts.nid : mintNotificationId();
  const cta = opts?.cta || CTA_IDS.open_checkin;
  const withCheckin = buildCheckInDeepLink(baseUrl);
  return withAttributionParams(withCheckin, { nid, cta, dest: 'checkin' });
}

export function checkInNotificationUrlWithAttr(
  appBase?: string,
  opts?: { nid?: string; cta?: CtaId | string },
): string {
  const base = baseCheckInNotificationUrl(appBase);
  const nid = opts?.nid && isValidNid(opts.nid) ? opts.nid : mintNotificationId();
  return withAttributionParams(base, {
    nid,
    cta: opts?.cta || CTA_IDS.open_checkin,
    dest: 'checkin',
  });
}

export function clearAttributionFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const p of [NID_QUERY_PARAM, CTA_QUERY_PARAM, DEST_QUERY_PARAM]) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    }
    if (!changed) return;
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* ignore */ }
}

export function stashAttributionSession(session: AttributionSession): void {
  try {
    sessionStorage.setItem(ATTR_SESSION_KEY, JSON.stringify(session));
  } catch { /* ignore */ }
}

export function peekAttributionSession(): AttributionSession | null {
  try {
    const raw = sessionStorage.getItem(ATTR_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttributionSession;
    if (!isValidNid(parsed?.nid)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumeAttributionSession(): AttributionSession | null {
  const s = peekAttributionSession();
  try {
    sessionStorage.removeItem(ATTR_SESSION_KEY);
  } catch { /* ignore */ }
  return s;
}

/** Capture nid/cta/dest from URL into session (survives access gate). */
export function captureAttributionFromUrl(href?: string): AttributionSession | null {
  const nid = readNidFromUrl(href);
  if (!nid) return null;
  const cta = readCtaFromUrl(href) || CTA_IDS.open_checkin;
  const dest = readDestFromUrl(href) || 'checkin';
  const session: AttributionSession = {
    nid,
    cta,
    dest,
    stashedAt: Date.now(),
  };
  stashAttributionSession(session);
  return session;
}

/** Idempotent per-nid stage marker (session). Returns true if first time. */
export function markAttributionStageOnce(nid: string, stage: string): boolean {
  if (!isValidNid(nid)) return false;
  const key = `${ATTR_STAGE_PREFIX}${nid}-${stage}`;
  try {
    if (sessionStorage.getItem(key) === '1') return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}
