/** Shared edge URL for runtime test scripts. */
export const PROJECT = 'lhbvzojmtvjeauqnnmdu';
export const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYnZ6b2ptdHZqZWF1cW5ubWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk3OTYsImV4cCI6MjA5NDY3NTc5Nn0.ZRNFRD6I2E03nmP3N8ScDQig5SeVsSbliyyw-XjkEXI';

export function getEdgeBase() {
  const override = process.env.ARBOL_EDGE_BASE?.trim();
  if (override) return override.replace(/\/$/, '');
  return `https://${PROJECT}.supabase.co/functions/v1/make-server-5d90ddf5`;
}

export const REQUIRED_EDGE_ROUTES = [
  '/cron-last-run',
  '/cron-attempt-log',
  '/parse-context-tasks',
];

export async function probeEdgeRoutes(base = getEdgeBase()) {
  const headers = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };
  const results = [];
  for (const path of REQUIRED_EDGE_ROUTES) {
    const method = path === '/parse-context-tasks' ? 'POST' : 'GET';
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(method === 'POST' ? { body: JSON.stringify({ text: 'Complete FAFSA, track expenses', preferRules: true }) } : {}),
    });
    results.push({ path, status: res.status, ok: res.status !== 404 });
  }

  const probeId = 'pre-c6-stale-probe';
  const now = Date.now();
  await fetch(`${base}/backup/${probeId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ profileEmail: 'newer@example.com', savedAt: now + 60_000 }),
  });
  const stale = await fetch(`${base}/backup/${probeId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ profileEmail: 'stale@example.com', savedAt: now }),
  });
  let staleData = {};
  try { staleData = await stale.json(); } catch { /* ignore */ }
  results.push({
    path: '/backup stale guard',
    status: stale.status,
    ok: staleData?.reason === 'stale_backup',
    staleGuard: staleData?.reason === 'stale_backup',
  });
  return results;
}
