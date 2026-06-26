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

  const refresh = useCallback(() => {
    loadStarted.current = Date.now();
    setIsLoading(true);
    if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    setTick(t => t + 1);
  }, []);

  const finishLoading = useCallback(() => {
    const elapsed = Date.now() - loadStarted.current;
    const wait = Math.min(MAX_SKELETON_MS, Math.max(MIN_SKELETON_MS - elapsed, 0));
    loadingTimer.current = window.setTimeout(() => setIsLoading(false), wait);
  }, []);

  useEffect(() => {
    if (!isActive) {
      setIsLoading(false);
      return;
    }
    refresh();
  }, [isActive, profileId, refresh]);

  useEffect(() => {
    if (!isActive) return;
    finishLoading();
    return () => {
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    };
  }, [tick, isActive, finishLoading]);

  useEffect(() => {
    if (!isActive) return;
    const handler = () => refresh();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, handler);
    window.addEventListener('arbol-goals-updated', handler);
    window.addEventListener('arbol-tasks-updated', handler);
    window.addEventListener('arbol-live-feedback-updated', handler);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
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
