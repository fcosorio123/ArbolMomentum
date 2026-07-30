/**
 * Surgical feature controls for Adaptive Engagement (R1+).
 * Disabling never deletes historical event_logs or deferral records.
 */

import { getStorageKey, getAppEnv, isPublishedVersion } from './environment';

const STORAGE_KEY = () => getStorageKey('arbol-engagement-controls');

export interface EngagementControls {
  attributionCollect: boolean;
  adminNotifFunnel: boolean;
  taskDeferralUi: boolean;
  deferralReminders: boolean;
  /** Privacy-sensitive — default OFF until review cleared. */
  deferralReasonCapture: boolean;
  quickWinRecs: boolean;
  timingRecommendations: boolean;
  adaptiveTiming: boolean;
  /** Initial configurable hypotheses (not empirically validated product rules). */
  hypotheses: {
    repeatedDeferralCount: number;
    deferralWindowDays: number;
    quickWinsBeforePriority: number;
    minAttributableAlerts: number;
    minExecutionOutcomes: number;
    observationWeeks: number;
    optOutRelativePct: number;
    optOutAbsolutePp: number;
    optOutMinSample: number;
  };
  /** Allowlisted profile ids for cohort rollout (empty = all when control on). */
  cohortProfileIds: string[];
  updatedAt: number;
}

export const DEFAULT_ENGAGEMENT_CONTROLS: EngagementControls = {
  /** Enabled for user testing of R1 attribution + deferral (safe subset). */
  attributionCollect: true,
  adminNotifFunnel: true,
  taskDeferralUi: true,
  deferralReminders: true,
  /** Privacy-sensitive — remains OFF until review cleared. */
  deferralReasonCapture: false,
  quickWinRecs: false,
  timingRecommendations: false,
  adaptiveTiming: false,
  hypotheses: {
    repeatedDeferralCount: 3,
    deferralWindowDays: 7,
    quickWinsBeforePriority: 2,
    minAttributableAlerts: 100,
    minExecutionOutcomes: 30,
    observationWeeks: 4,
    optOutRelativePct: 20,
    optOutAbsolutePp: 2,
    optOutMinSample: 20,
  },
  cohortProfileIds: [],
  updatedAt: 0,
};

function readLocal(): EngagementControls {
  try {
    const raw = localStorage.getItem(STORAGE_KEY());
    if (!raw) return { ...DEFAULT_ENGAGEMENT_CONTROLS, hypotheses: { ...DEFAULT_ENGAGEMENT_CONTROLS.hypotheses } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ENGAGEMENT_CONTROLS,
      ...parsed,
      hypotheses: { ...DEFAULT_ENGAGEMENT_CONTROLS.hypotheses, ...(parsed.hypotheses ?? {}) },
      cohortProfileIds: Array.isArray(parsed.cohortProfileIds) ? parsed.cohortProfileIds : [],
    };
  } catch {
    return { ...DEFAULT_ENGAGEMENT_CONTROLS, hypotheses: { ...DEFAULT_ENGAGEMENT_CONTROLS.hypotheses } };
  }
}

let cached: EngagementControls = typeof localStorage !== 'undefined'
  ? readLocal()
  : { ...DEFAULT_ENGAGEMENT_CONTROLS, hypotheses: { ...DEFAULT_ENGAGEMENT_CONTROLS.hypotheses } };

function writeLocal(next: EngagementControls) {
  localStorage.setItem(STORAGE_KEY(), JSON.stringify(next));
}

export function getEngagementControls(): EngagementControls {
  return cached;
}

export function isInEngagementCohort(profileId: string | null | undefined): boolean {
  if (!profileId) return false;
  const ids = cached.cohortProfileIds;
  if (!ids.length) return true;
  return ids.includes(profileId);
}

export function isAttributionCollectEnabled(profileId?: string | null): boolean {
  if (!cached.attributionCollect) return false;
  if (profileId != null && !isInEngagementCohort(profileId)) return false;
  return true;
}

export function isTaskDeferralUiEnabled(profileId?: string | null): boolean {
  if (!cached.taskDeferralUi) return false;
  if (profileId != null && !isInEngagementCohort(profileId)) return false;
  return true;
}

export function isDeferralRemindersEnabled(profileId?: string | null): boolean {
  if (!cached.deferralReminders) return false;
  if (profileId != null && !isInEngagementCohort(profileId)) return false;
  return true;
}

export function isDeferralReasonCaptureEnabled(profileId?: string | null): boolean {
  if (!cached.deferralReasonCapture) return false;
  if (profileId != null && !isInEngagementCohort(profileId)) return false;
  return true;
}

export function isAdminNotifFunnelEnabled(): boolean {
  return cached.adminNotifFunnel;
}

/** Staging builds default-on for attribution/deferral UI so QA can validate without Admin. */
export function applyStagingQaDefaults(): void {
  if (getAppEnv() !== 'staging') return;
  if (cached.updatedAt > 0) return;
  cached = {
    ...cached,
    attributionCollect: true,
    adminNotifFunnel: true,
    taskDeferralUi: true,
    deferralReminders: true,
    deferralReasonCapture: false,
    updatedAt: Date.now(),
  };
  writeLocal(cached);
}

export function saveEngagementControls(partial: Partial<EngagementControls>): EngagementControls {
  const next: EngagementControls = {
    ...cached,
    ...partial,
    hypotheses: { ...cached.hypotheses, ...(partial.hypotheses ?? {}) },
    cohortProfileIds: partial.cohortProfileIds ?? cached.cohortProfileIds,
    updatedAt: Date.now(),
  };
  cached = next;
  writeLocal(next);

  if (typeof window !== 'undefined' && (isPublishedVersion() || getAppEnv() === 'staging')) {
    import('/utils/supabase/info').then(({ projectId, publicAnonKey }) => {
      const FN = 'make-server-5d90ddf5';
      fetch(`https://${projectId}.supabase.co/functions/v1/${FN}/engagement-controls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(next),
      }).catch(() => { /* best-effort */ });
    }).catch(() => {});
  }

  return next;
}

export async function fetchEngagementControls(): Promise<EngagementControls> {
  cached = readLocal();
  applyStagingQaDefaults();
  if (typeof window === 'undefined') return cached;
  if (!isPublishedVersion() && getAppEnv() !== 'staging') return cached;
  try {
    const { projectId, publicAnonKey } = await import('/utils/supabase/info');
    const FN = 'make-server-5d90ddf5';
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/${FN}/engagement-controls`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) return cached;
    const data = await res.json();
    if (data?.ok && data.data) {
      cached = {
        ...DEFAULT_ENGAGEMENT_CONTROLS,
        ...data.data,
        hypotheses: { ...DEFAULT_ENGAGEMENT_CONTROLS.hypotheses, ...(data.data.hypotheses ?? {}) },
      };
      writeLocal(cached);
    }
  } catch { /* keep local */ }
  return cached;
}
