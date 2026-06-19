import { useState, useEffect, useRef } from 'react';
import { Tour, Modal, Button } from 'antd';
import type { TourProps } from 'antd';
import { C } from '../data/colors';

// ── Storage keys per page ─────────────────────────────────────────────
export const TOUR_KEYS = {
  home:  'arbol-tour-home-done',
  goals: 'arbol-tour-goals-done',
  tasks: 'arbol-tour-tasks-done',
  week:  'arbol-tour-week-done',
};

// ── Inject brand CSS once ─────────────────────────────────────────────
let styleInjected = false;
function injectTourStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    /* Lower z-index so modals can appear above the tour */
    .ant-tour { z-index: 999 !important; }
    .ant-tour-mask { z-index: 998 !important; }

    /* Brand-coded popup */
    .arbol-page-tour .ant-tour-inner {
      border-radius: 18px !important;
      overflow: hidden !important;
      box-shadow: 0 12px 40px rgba(9,64,103,0.22) !important;
      border: 1.5px solid rgba(9,64,103,0.14) !important;
      max-width: 280px;
    }
    .arbol-page-tour .ant-tour-inner-content {
      padding: 0 !important;
    }
    .arbol-page-tour .ant-tour-content {
      padding: 14px 16px 16px !important;
    }
    .arbol-page-tour .ant-tour-header {
      padding: 0 0 6px !important;
    }
    .arbol-page-tour .ant-tour-title {
      font-size: 14px !important;
      font-weight: 800 !important;
      color: #094067 !important;
    }
    .arbol-page-tour .ant-tour-description {
      font-size: 12px !important;
      color: #5f6c7b !important;
      line-height: 1.55 !important;
    }
    .arbol-page-tour .ant-tour-footer {
      padding: 10px 16px 14px !important;
      border-top: 1px solid rgba(9,64,103,0.08) !important;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .arbol-page-tour .ant-tour-buttons {
      gap: 6px !important;
    }
    .arbol-page-tour .ant-tour-prev-btn {
      border-color: rgba(9,64,103,0.25) !important;
      color: #094067 !important;
      border-radius: 10px !important;
      font-size: 12px !important;
      height: 32px !important;
      padding: 0 14px !important;
    }
    .arbol-page-tour .ant-tour-next-btn,
    .arbol-page-tour .ant-tour-finish-btn {
      background: linear-gradient(135deg, #094067, #1a6da8) !important;
      border: none !important;
      border-radius: 10px !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      height: 32px !important;
      padding: 0 16px !important;
    }
    /* Spotlight ring */
    .arbol-page-tour .ant-tour-target-placeholder {
      outline: 2.5px solid #094067 !important;
      outline-offset: 4px !important;
      border-radius: 12px !important;
    }
  `;
  document.head.appendChild(el);
}

// ── Types ─────────────────────────────────────────────────────────────
export interface PageTourStep {
  title: string;
  description: string;
  target: () => HTMLElement | null;
  placement?: TourProps['steps'][0]['placement'];
}

interface PageTourProps {
  open: boolean;
  onClose: () => void;
  steps: PageTourStep[];
  pageLabel: string;       // e.g. "Home", "Goals"
  storageKey: string;      // from TOUR_KEYS
  doneEmoji?: string;
  doneMessage?: string;
  /** If provided, the last step shows a "Try it now" button that calls this + marks tour done */
  onInteract?: () => void;
  interactLabel?: string;
}

// ── Brand header bar injected at top of each step ─────────────────────
function StepHeader({ step, total }: { step: number; total: number }) {
  return (
    <div style={{
      height: 4,
      background: `linear-gradient(90deg, ${C.primary}, #3da9fc)`,
      margin: '-1px -1px 0',
      borderRadius: '17px 17px 0 0',
    }}>
      {/* invisible, just the gradient bar */}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export function PageTour({
  open, onClose, steps, pageLabel, storageKey,
  doneEmoji = '✅', doneMessage,
  onInteract, interactLabel = 'Try it now →',
}: PageTourProps) {
  const [current, setCurrent] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const finished = useRef(false);

  useEffect(() => { injectTourStyles(); }, []);

  useEffect(() => {
    if (open) {
      setCurrent(0);
      finished.current = false;
    }
  }, [open]);

  const handleFinish = () => {
    finished.current = true;
    localStorage.setItem(storageKey, 'true');
    onClose();
    setTimeout(() => setShowDone(true), 120);
  };

  const handleClose = () => {
    // Only show DONE if user completed (clicked Finish on last step)
    onClose();
  };

  // Build antd-compatible steps (inject brand header + interactive button into descriptions)
  const antdSteps: TourProps['steps'] = steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    const showInteract = isLast && !!onInteract;

    return {
      title: (
        <div>
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${C.primary}, #3da9fc)`,
            margin: '-14px -16px 10px',
            borderRadius: '17px 17px 0 0',
          }} />
          {s.title}
        </div>
      ) as any,
      description: (
        <div>
          <div style={{ marginBottom: showInteract ? 10 : 0 }}>{s.description}</div>
          {showInteract && (
            <button
              onClick={() => {
                onInteract!();
                handleFinish();
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: `linear-gradient(135deg, #ef4565, #f5a623)`,
                border: 'none', borderRadius: 10,
                padding: '8px 14px', cursor: 'pointer',
                color: '#fff', fontSize: 12, fontWeight: 700,
                marginTop: 2,
              }}
            >
              {interactLabel}
            </button>
          )}
        </div>
      ),
      target: s.target,
      placement: s.placement,
    };
  });

  const total = steps.length;

  return (
    <>
      <Tour
        open={open}
        current={current}
        onChange={setCurrent}
        onClose={handleClose}
        onFinish={handleFinish}
        steps={antdSteps}
        className="arbol-page-tour"
        indicatorsRender={(cur, tot) => (
          <span style={{
            fontSize: 10, color: C.secondary,
            background: C.bgAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: '2px 8px',
            fontWeight: 600,
          }}>
            {cur + 1} / {tot}
          </span>
        )}
      />

      {/* ── DONE completion modal */}
      <Modal
        open={showDone}
        onCancel={() => setShowDone(false)}
        footer={null}
        centered
        width={320}
        styles={{
          content: { borderRadius: 24, padding: 0, overflow: 'hidden' },
          mask: { backdropFilter: 'blur(6px)', zIndex: 1100 },
          wrapper: { zIndex: 1100 },
        }}
      >
        <div style={{ height: 5, background: `linear-gradient(90deg, ${C.primary}, #3da9fc)` }} />
        <div style={{ padding: '28px 24px 26px', textAlign: 'center' }}>
          <div style={{ fontSize: 46, marginBottom: 10 }}>{doneEmoji}</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: C.headline }}>
            {pageLabel} — unlocked!
          </h3>
          <p style={{ margin: '0 0 22px', color: C.body, fontSize: 13, lineHeight: 1.6 }}>
            {doneMessage ?? `You know how this page works. Tap ? anytime to revisit the tour.`}
          </p>
          <Button
            type="primary"
            block
            size="large"
            onClick={() => setShowDone(false)}
            style={{
              borderRadius: 12, height: 46, fontWeight: 700,
              background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
              border: 'none', fontSize: 14,
            }}
          >
            Got it 👍
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ── Reusable branded tour trigger button ──────────────────────────────
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
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}22`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}12`;
      }}
    >
      ?
    </button>
  );
}
