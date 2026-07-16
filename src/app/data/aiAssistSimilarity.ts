/** Title normalization + near-duplicate detection for AI Assist candidates. */

const STOP = new Set([
  'a', 'an', 'the', 'to', 'and', 'or', 'of', 'for', 'my', 'me', 'i', 'in', 'on', 'at',
  'with', 'from', 'into', 'about', 'that', 'this', 'be', 'is', 'are', 'was', 'were',
]);

/** Crude stem so insurer/insurance/insuring collide; keep short tokens intact. */
function stemToken(t: string): string {
  if (t.length <= 4) return t;
  let s = t;
  if (s.endsWith('ies') && s.length > 5) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith('ing') && s.length > 6) s = s.slice(0, -3);
  else if (s.endsWith('ers') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('er') && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith('ance') && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith('ence') && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith('tion') && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith('sion') && s.length > 6) s = s.slice(0, -4);
  else if (s.endsWith('es') && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith('s') && s.length > 4 && !s.endsWith('ss')) s = s.slice(0, -1);
  if (s.endsWith('anc')) s = s.slice(0, -3);
  return s;
}

export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTokens(raw: string): Set<string> {
  const norm = normalizeTitle(raw);
  const out = new Set<string>();
  for (const t of norm.split(' ')) {
    if (t.length < 2 || STOP.has(t)) continue;
    out.add(stemToken(t));
  }
  return out;
}

/** Jaccard similarity on content tokens. Empty both → 1; one empty → 0. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) {
    const na = normalizeTitle(a);
    const nb = normalizeTitle(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    return 0;
  }
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * True when titles are too similar (paraphrase / near-duplicate).
 * Default threshold 0.62 after stemming - catches insurer/insurance paraphrases.
 */
export function isNearDuplicate(
  candidate: string,
  priors: string[],
  threshold = 0.62,
): boolean {
  const nc = normalizeTitle(candidate);
  if (!nc) return true;
  const caTokens = [...titleTokens(candidate)];
  for (const p of priors) {
    const np = normalizeTitle(p);
    if (!np) continue;
    if (nc === np) return true;
    const sim = titleSimilarity(candidate, p);
    if (sim >= threshold) return true;
    const ca = caTokens.slice(0, 3).join(' ');
    const pa = [...titleTokens(p)].slice(0, 3).join(' ');
    if (ca && pa && ca === pa) return true;
    const ta = titleTokens(candidate);
    const tb = titleTokens(p);
    const smaller = ta.size <= tb.size ? ta : tb;
    const larger = ta.size <= tb.size ? tb : ta;
    if (smaller.size >= 3) {
      let hit = 0;
      for (const t of smaller) if (larger.has(t)) hit += 1;
      if (hit / smaller.size >= 0.8) return true;
    }
  }
  return false;
}

export function filterDistinctTitles(
  titles: string[],
  priors: string[],
  max = 3,
  threshold = 0.62,
): string[] {
  const kept: string[] = [];
  const against = [...priors];
  for (const t of titles) {
    const trimmed = t.trim();
    if (trimmed.length < 3) continue;
    if (isNearDuplicate(trimmed, [...against, ...kept], threshold)) continue;
    kept.push(trimmed);
    if (kept.length >= max) break;
  }
  return kept;
}
