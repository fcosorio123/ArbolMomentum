import { useState, useEffect, useRef, useLayoutEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { C } from '../data/colors';

export const TOUR_KEYS = {
  home:  'arbol-tour-home-done',
  goals: 'arbol-tour-goals-done',
  tasks: 'arbol-tour-tasks-done',
  week:  'arbol-tour-week-done',
};

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface PageTourStep {
  title: string;
  description: string;
  /** Query `[data-tour-id="…"]` — preferred for readable step configs */
  targetId?: string;
  target?: () => HTMLElement | null;
  placement?: TourPlacement;
}

/** Resolve a tour target element by `data-tour-id`. */
export function tourEl(id: string): HTMLElement | null {
  return document.querySelector(`[data-tour-id="${id}"]`) as HTMLElement | null;
}

function resolveTarget(step: PageTourStep): HTMLElement | null {
  if (step.target) return step.target();
  if (step.targetId) return tourEl(step.targetId);
  return null;
}

function isTargetVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

/** Keep only visible targets and order them top → bottom on screen. */
export function sortTourStepsTopToBottom(steps: PageTourStep[]): PageTourStep[] {
  return steps
    .map(step => ({ step, el: resolveTarget(step) }))
    .filter((item): item is { step: PageTourStep; el: HTMLElement } =>
      !!item.el && isTargetVisible(item.el))
    .sort((a, b) => {
      const dy = a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top;
      if (Math.abs(dy) > 2) return dy;
      return a.el.getBoundingClientRect().left - b.el.getBoundingClientRect().left;
    })
    .map(({ step }) => step);
}

const HIGHLIGHT_PAD = 10;
const MASK_COLOR = 'rgba(9, 64, 103, 0.62)';
const MASK_ID = 'arbol-tour-spotlight-mask';

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

function measureHighlight(el: HTMLElement): HighlightRect {
  const r = el.getBoundingClientRect();
  return {
    x: Math.max(0, r.left - HIGHLIGHT_PAD),
    y: Math.max(0, r.top - HIGHLIGHT_PAD),
    width: r.width + HIGHLIGHT_PAD * 2,
    height: r.height + HIGHLIGHT_PAD * 2,
    radius: 14,
  };
}

interface TooltipLayout {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
  arrowOffset: number;
}

function computeTooltipLayout(
  hole: HighlightRect,
  tooltipW: number,
  tooltipH: number,
  placement: TourPlacement,
): TooltipLayout {
  const gap = 14;
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates: TourPlacement[] =
    placement === 'auto'
      ? ['bottom', 'top', 'right', 'left']
      : [placement, 'bottom', 'top', 'right', 'left'];

  const holeCenterX = hole.x + hole.width / 2;
  const holeCenterY = hole.y + hole.height / 2;

  for (const side of candidates) {
    let top = 0;
    let left = 0;
    let arrowSide: TooltipLayout['arrowSide'] = 'top';
    let arrowOffset = tooltipW / 2;

    if (side === 'bottom') {
      top = hole.y + hole.height + gap;
      left = holeCenterX - tooltipW / 2;
      arrowSide = 'top';
      arrowOffset = holeCenterX - left;
      if (top + tooltipH <= vh - margin) {
        left = clamp(left, margin, vw - tooltipW - margin);
        arrowOffset = clamp(holeCenterX - left, 24, tooltipW - 24);
        return { top, left, arrowSide, arrowOffset };
      }
    }

    if (side === 'top') {
      top = hole.y - tooltipH - gap;
      left = holeCenterX - tooltipW / 2;
      arrowSide = 'bottom';
      arrowOffset = holeCenterX - left;
      if (top >= margin) {
        left = clamp(left, margin, vw - tooltipW - margin);
        arrowOffset = clamp(holeCenterX - left, 24, tooltipW - 24);
        return { top, left, arrowSide, arrowOffset };
      }
    }

    if (side === 'right') {
      left = hole.x + hole.width + gap;
      top = holeCenterY - tooltipH / 2;
      arrowSide = 'left';
      arrowOffset = holeCenterY - top;
      if (left + tooltipW <= vw - margin) {
        top = clamp(top, margin, vh - tooltipH - margin);
        arrowOffset = clamp(holeCenterY - top, 24, tooltipH - 24);
        return { top, left, arrowSide, arrowOffset };
      }
    }

    if (side === 'left') {
      left = hole.x - tooltipW - gap;
      top = holeCenterY - tooltipH / 2;
      arrowSide = 'right';
      arrowOffset = holeCenterY - top;
      if (left >= margin) {
        top = clamp(top, margin, vh - tooltipH - margin);
        arrowOffset = clamp(holeCenterY - top, 24, tooltipH - 24);
        return { top, left, arrowSide, arrowOffset };
      }
    }
  }

  const fallbackTop = clamp(hole.y + hole.height + gap, margin, vh - tooltipH - margin);
  const fallbackLeft = clamp(holeCenterX - tooltipW / 2, margin, vw - tooltipW - margin);
  return {
    top: fallbackTop,
    left: fallbackLeft,
    arrowSide: 'top',
    arrowOffset: clamp(holeCenterX - fallbackLeft, 24, tooltipW - 24),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function getScrollParents(el: HTMLElement): Array<HTMLElement | Window> {
  const parents: Array<HTMLElement | Window> = [window];
  let node = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const scrollable = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    if (scrollable) parents.push(node);
    node = node.parentElement;
  }
  return parents;
}

function scrollPageToTop(anchor?: HTMLElement | null) {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  if (!anchor) return;
  let node = anchor.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY)) node.scrollTop = 0;
    node = node.parentElement;
  }
}

function TourSpotlight({ hole }: { hole: HighlightRect | null }) {
  if (!hole) return null;

  return (
    <svg
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 9998,
        pointerEvents: 'auto',
      }}
    >
      <defs>
        <mask id={MASK_ID}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={hole.x}
            y={hole.y}
            width={hole.width}
            height={hole.height}
            rx={hole.radius}
            ry={hole.radius}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill={MASK_COLOR}
        mask={`url(#${MASK_ID})`}
      />
      <rect
        x={hole.x}
        y={hole.y}
        width={hole.width}
        height={hole.height}
        rx={hole.radius}
        ry={hole.radius}
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth={2}
      />
    </svg>
  );
}

interface TourTooltipProps {
  step: PageTourStep;
  current: number;
  total: number;
  layout: TooltipLayout | null;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
  showInteract?: boolean;
  interactLabel?: string;
  onInteract?: () => void;
}

function TourTooltip({
  step, current, total, layout, onNext, onSkip, isLast,
  showInteract, interactLabel, onInteract,
}: TourTooltipProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  if (!layout) return null;

  const arrowSize = 10;
  const arrowStyle: CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };

  if (layout.arrowSide === 'top') {
    Object.assign(arrowStyle, {
      top: -arrowSize,
      left: layout.arrowOffset - arrowSize,
      borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
      borderColor: `transparent transparent #fff transparent`,
    });
  } else if (layout.arrowSide === 'bottom') {
    Object.assign(arrowStyle, {
      bottom: -arrowSize,
      left: layout.arrowOffset - arrowSize,
      borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
      borderColor: `#fff transparent transparent transparent`,
    });
  } else if (layout.arrowSide === 'left') {
    Object.assign(arrowStyle, {
      left: -arrowSize,
      top: layout.arrowOffset - arrowSize,
      borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
      borderColor: `transparent #fff transparent transparent`,
    });
  } else {
    Object.assign(arrowStyle, {
      right: -arrowSize,
      top: layout.arrowOffset - arrowSize,
      borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
      borderColor: `transparent transparent transparent #fff`,
    });
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: layout.top,
        left: layout.left,
        zIndex: 9999,
        width: 'min(340px, calc(100vw - 32px))',
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 12px 40px rgba(9,64,103,0.22), 0 2px 8px rgba(9,64,103,0.08)',
        border: '1px solid rgba(9,64,103,0.1)',
        animation: 'arbolTourCardIn 0.22s ease',
        pointerEvents: 'auto',
      }}
    >
      <div style={arrowStyle} />
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 10px', borderRadius: 999,
            background: `${C.primary}18`, color: C.headline,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            Tour
          </span>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close tour"
            style={{
              background: 'none', border: 'none', padding: 4, margin: -4,
              cursor: 'pointer', color: C.secondary, lineHeight: 0,
            }}
          >
            <CloseOutlined style={{ fontSize: 14 }} />
          </button>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: C.headline, lineHeight: 1.35 }}>
          {step.title}
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: C.body, lineHeight: 1.55 }}>
          {step.description}
        </p>
        {showInteract && onInteract && (
          <button
            type="button"
            onClick={onInteract}
            style={{
              marginTop: 14,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #ef4565, #f5a623)',
              border: 'none', borderRadius: 10,
              padding: '8px 14px', cursor: 'pointer',
              color: '#fff', fontSize: 12, fontWeight: 700,
            }}
          >
            {interactLabel}
          </button>
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: '14px 18px 16px', marginTop: 14,
        borderTop: '1px solid rgba(9,64,103,0.08)',
      }}>
        <button type="button" onClick={onSkip} className="arbol-tour-skip-btn">
          Skip
        </button>
        <span style={{ fontSize: 12, color: C.secondary, fontWeight: 600 }}>
          {current + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onNext}
          style={{
            border: 'none', borderRadius: 999, padding: '9px 18px',
            background: C.headline, color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(9,64,103,0.25)',
          }}
        >
          {isLast ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  );
}

let styleInjected = false;
function injectTourStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes arbolTourCardIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .arbol-tour-skip-btn {
      background: none; border: none; padding: 0;
      font-size: 12px; font-weight: 600; color: #90b4ce;
      cursor: pointer;
    }
    .arbol-tour-skip-btn:hover { color: #5f6c7b; }
  `;
  document.head.appendChild(el);
}

interface PageTourProps {
  open: boolean;
  onClose: () => void;
  steps: PageTourStep[];
  pageLabel: string;
  storageKey: string;
  doneEmoji?: string;
  doneMessage?: string;
  onInteract?: () => void;
  interactLabel?: string;
  /** When true (default), steps are sorted by on-screen Y position top → bottom */
  sortTopToBottom?: boolean;
}

export function PageTour({
  open, onClose, steps, pageLabel, storageKey,
  doneEmoji = '✅', doneMessage,
  onInteract, interactLabel = 'Try it now →',
  sortTopToBottom = true,
}: PageTourProps) {
  const [current, setCurrent] = useState(0);
  const [activeSteps, setActiveSteps] = useState<PageTourStep[]>([]);
  const [hole, setHole] = useState<HighlightRect | null>(null);
  const [tooltipLayout, setTooltipLayout] = useState<TooltipLayout | null>(null);
  const [showDone, setShowDone] = useState(false);
  const dismissed = useRef(false);
  const tooltipSize = useRef({ w: 320, h: 200 });

  useEffect(() => { injectTourStyles(); }, []);

  const refreshSteps = useCallback(() => {
    const resolved = sortTopToBottom ? sortTourStepsTopToBottom(steps) : steps.filter(s => {
      const el = resolveTarget(s);
      return el && isTargetVisible(el);
    });
    setActiveSteps(resolved);
    return resolved;
  }, [steps, sortTopToBottom]);

  useEffect(() => {
    if (!open) return;
    dismissed.current = false;
    const resolved = refreshSteps();
    const anchor = resolved[0] ? resolveTarget(resolved[0]) : null;
    scrollPageToTop(anchor);
    setCurrent(0);
    if (resolved.length === 0) {
      onClose();
    }
  }, [open, refreshSteps, onClose]);

  const step = activeSteps[current] ?? null;

  const measureStep = useCallback(() => {
    if (!step) {
      setHole(null);
      setTooltipLayout(null);
      return;
    }
    const el = resolveTarget(step);
    if (!el) {
      setHole(null);
      setTooltipLayout(null);
      return;
    }
    const nextHole = measureHighlight(el);
    setHole(nextHole);
    const layout = computeTooltipLayout(
      nextHole,
      tooltipSize.current.w,
      tooltipSize.current.h,
      step.placement ?? 'auto',
    );
    setTooltipLayout(layout);
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = resolveTarget(step);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const t1 = window.setTimeout(measureStep, 50);
    const t2 = window.setTimeout(measureStep, 320);
    const t3 = window.setTimeout(measureStep, 600);

    const onScrollOrResize = () => measureStep();
    const scrollParents = getScrollParents(el);
    scrollParents.forEach(parent => {
      parent.addEventListener('scroll', onScrollOrResize, { passive: true });
    });
    window.addEventListener('resize', onScrollOrResize);

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onScrollOrResize);
      ro.observe(el);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      scrollParents.forEach(parent => {
        parent.removeEventListener('scroll', onScrollOrResize);
      });
      window.removeEventListener('resize', onScrollOrResize);
      ro?.disconnect();
    };
  }, [open, step, current, measureStep]);

  const persistDismiss = (showCompletion = false) => {
    if (dismissed.current) return;
    dismissed.current = true;
    localStorage.setItem(storageKey, 'true');
    onClose();
    if (showCompletion) setTimeout(() => setShowDone(true), 120);
  };

  const handleSkip = () => persistDismiss(false);

  const handleNext = () => {
    const isLast = current >= activeSteps.length - 1;
    if (isLast) {
      persistDismiss(true);
    } else {
      setCurrent(c => c + 1);
    }
  };

  const handleInteract = () => {
    onInteract?.();
    persistDismiss(true);
  };

  const isLast = current >= activeSteps.length - 1;

  return (
    <>
      {open && step && activeSteps.length > 0 && createPortal(
        <>
          <TourSpotlight hole={hole} />
          <TourTooltip
            step={step}
            current={current}
            total={activeSteps.length}
            layout={tooltipLayout}
            onNext={handleNext}
            onSkip={handleSkip}
            isLast={isLast}
            showInteract={isLast && !!onInteract}
            interactLabel={interactLabel}
            onInteract={handleInteract}
          />
        </>,
        document.body,
      )}
      <Modal
        open={showDone}
        onCancel={() => setShowDone(false)}
        footer={null}
        centered
        width={320}
        styles={{
          content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
          mask: { zIndex: 1100 },
          wrapper: { zIndex: 1100 },
        }}
      >
        <div style={{ height: 4, background: `linear-gradient(90deg, ${C.primary}, #3da9fc)` }} />
        <div style={{ padding: '24px 20px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{doneEmoji}</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: C.headline }}>
            {pageLabel} — ready!
          </h3>
          <p style={{ margin: '0 0 20px', color: C.body, fontSize: 13, lineHeight: 1.55 }}>
            {doneMessage ?? `Tap ? anytime to revisit this tour.`}
          </p>
          <Button
            type="primary"
            block
            onClick={() => setShowDone(false)}
            style={{
              borderRadius: 12, height: 44, fontWeight: 700,
              background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
              border: 'none', fontSize: 14,
            }}
          >
            Got It
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function PageTourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Page Tour"
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: `${C.primary}12`,
        border: `1.5px solid ${C.primary}28`,
        cursor: 'pointer', color: C.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, flexShrink: 0,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}22`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}12`; }}
    >
      ?
    </button>
  );
}
