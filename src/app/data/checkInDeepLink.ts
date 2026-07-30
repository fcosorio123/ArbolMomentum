/**
 * Check-in deep-link intent (?checkin=1) from email CTAs and browser notifications.
 * Survives access gate / profile select via sessionStorage stash.
 */

export const CHECKIN_QUERY_PARAM = 'checkin';
export const CHECKIN_INTENT_KEY = 'arbol-checkin-intent';

function hrefOrCurrent(href?: string): string {
  if (href) return href;
  return typeof window !== 'undefined' ? window.location.href : 'https://example.invalid/';
}

/** True when URL carries check-in intent (?checkin=1|true|yes). */
export function readCheckInIntentFromUrl(href?: string): boolean {
  try {
    const url = new URL(hrefOrCurrent(href));
    const raw = (url.searchParams.get(CHECKIN_QUERY_PARAM) || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  } catch {
    return false;
  }
}

export function clearCheckInFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CHECKIN_QUERY_PARAM)) return;
    url.searchParams.delete(CHECKIN_QUERY_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    /* ignore */
  }
}

export function stashCheckInIntent(): void {
  try {
    sessionStorage.setItem(CHECKIN_INTENT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function peekCheckInIntent(): boolean {
  try {
    if (sessionStorage.getItem(CHECKIN_INTENT_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return readCheckInIntentFromUrl();
}

/** Consume stashed intent (URL should already be cleared). */
export function consumeStashedCheckInIntent(): boolean {
  try {
    if (sessionStorage.getItem(CHECKIN_INTENT_KEY) === '1') {
      sessionStorage.removeItem(CHECKIN_INTENT_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Build a check-in deep link from an app base URL.
 * Preserves existing query (e.g. invite=) and sets checkin=1.
 */
export function buildCheckInDeepLink(baseUrl: string): string {
  const trimmed = (baseUrl || '/').trim();
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      url.searchParams.set(CHECKIN_QUERY_PARAM, '1');
      return url.toString();
    }
    const pathish = trimmed.includes('?') || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    const url = new URL(pathish, 'https://arbol.local');
    url.searchParams.set(CHECKIN_QUERY_PARAM, '1');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    if (trimmed.includes('?')) return `${trimmed}&${CHECKIN_QUERY_PARAM}=1`;
    if (trimmed.endsWith('/')) return `${trimmed}?${CHECKIN_QUERY_PARAM}=1`;
    return `${trimmed}/?${CHECKIN_QUERY_PARAM}=1`;
  }
}

/** App-relative URL for SW / local notifications (respects Vite BASE_URL). */
export function checkInNotificationUrl(appBase?: string): string {
  const base = appBase
    ?? (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : '/');
  return buildCheckInDeepLink(base);
}
