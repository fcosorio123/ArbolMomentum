import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DASHBOARD_REFRESH_EVENT,
  getDashboardSnapshot,
  type DashboardSnapshot,
} from '../data/dashboardSnapshot';

const MIN_SKELETON_MS = 320;
const MAX_SKELETON_MS = 700;

export function useDashboardRefresh(profileId: string, isActive: boolean) {
  const [tick, setTick] = useState(0);
  const [isLoading, setIsLoading] = useState(isActive);
  const loadingTimer = useRef<number | undefined>(undefined);
  const loadStarted = useRef(0);
  const hasLoadedOnce = useRef(false);

  /**
   * Full load shows skeleton.
   * Soft refresh only recomputes the snapshot — avoids remounting Home and
   * restarting auto page tours on every goals/tasks event (flash loop).
   */
  const refresh = useCallback((mode: 'full' | 'soft' = 'full') => {
    if (mode === 'full' || !hasLoadedOnce.current) {
      loadStarted.current = Date.now();
      setIsLoading(true);
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    }
    setTick(t => t + 1);
  }, []);

  const finishLoading = useCallback(() => {
    const elapsed = Date.now() - loadStarted.current;
    const wait = Math.min(MAX_SKELETON_MS, Math.max(MIN_SKELETON_MS - elapsed, 0));
    if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    loadingTimer.current = window.setTimeout(() => {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }, wait);
  }, []);

  useEffect(() => {
    hasLoadedOnce.current = false;
    if (!isActive) {
      setIsLoading(false);
      return;
    }
    refresh('full');
  }, [isActive, profileId, refresh]);

  useEffect(() => {
    if (!isActive || !isLoading) return;
    finishLoading();
    return () => {
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    };
  }, [tick, isActive, isLoading, finishLoading]);

  useEffect(() => {
    if (!isActive) return;
    const handler = () => refresh('soft');
    window.addEventListener(DASHBOARD_REFRESH_EVENT, handler);
    window.addEventListener('arbol-goals-updated', handler);
    window.addEventListener('arbol-tasks-updated', handler);
    window.addEventListener('arbol-live-feedback-updated', handler);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh('soft');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, handler);
      window.removeEventListener('arbol-goals-updated', handler);
      window.removeEventListener('arbol-tasks-updated', handler);
      window.removeEventListener('arbol-live-feedback-updated', handler);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, isActive]);

  const snapshot = useMemo(
    (): DashboardSnapshot => getDashboardSnapshot(profileId),
    [profileId, tick],
  );

  return { snapshot, isLoading, refresh, tick };
}
