import { useRef, useCallback, useLayoutEffect } from 'react';

/** Preserve scroll position during task updates; allow explicit scroll via allowProgrammaticScroll. */
export function useScrollPositionLock(deps: unknown[] = []) {
  const savedY = useRef(0);
  const allowScroll = useRef(false);

  const capture = useCallback(() => {
    savedY.current = window.scrollY;
  }, []);

  const restore = useCallback(() => {
    if (allowScroll.current) return;
    const y = savedY.current;
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    });
  }, []);

  const allowProgrammaticScroll = useCallback((fn: () => void) => {
    allowScroll.current = true;
    fn();
    window.setTimeout(() => { allowScroll.current = false; }, 700);
  }, []);

  useLayoutEffect(() => {
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { capture, restore, allowProgrammaticScroll };
}
