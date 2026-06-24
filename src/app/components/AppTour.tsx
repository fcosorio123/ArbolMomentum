import { useState, useEffect, useRef } from 'react';
import { Tour, Modal, Button } from 'antd';
import type { TourProps } from 'antd';
import { C } from '../data/colors';

export const TOUR_KEYS = {
  home:  'arbol-tour-home-done',
  goals: 'arbol-tour-goals-done',
  tasks: 'arbol-tour-tasks-done',
  week:  'arbol-tour-week-done',
};

let styleInjected = false;
function injectTourStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    .ant-tour { z-index: 999 !important; transition: opacity 0.25s ease !important; }
    .ant-tour-mask { z-index: 998 !important; backdrop-filter: blur(2px); }

    .arbol-page-tour .ant-tour-inner {
      border-radius: 16px !important;
      overflow: hidden !important;
      box-shadow: 0 8px 32px rgba(9,64,103,0.18) !important;
      border: 1px solid rgba(9,64,103,0.12) !important;
      max-width: min(340px, calc(100vw - 32px)) !important;
      animation: arbolTourIn 0.25s ease;
    }
    @keyframes arbolTourIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .arbol-page-tour .ant-tour-inner-content { padding: 0 !important; }
    .arbol-page-tour .ant-tour-content {
      padding: 16px 20px !important;
      gap: 12px;
    }
    .arbol-page-tour .ant-tour-header { padding: 0 0 4px !important; }
    .arbol-page-tour .ant-tour-title {
      font-size: 15px !important;
      font-weight: 800 !important;
      color: #094067 !important;
      line-height: 1.35 !important;
    }
    .arbol-page-tour .ant-tour-description {
      font-size: 13px !important;
      color: #5f6c7b !important;
      line-height: 1.55 !important;
    }
    .arbol-page-tour .ant-tour-footer {
      padding: 12px 20px 16px !important;
      border-top: 1px solid rgba(9,64,103,0.08) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
    }
    .arbol-page-tour .ant-tour-buttons { gap: 8px !important; margin-left: auto !important; }
    .arbol-page-tour .ant-tour-prev-btn,
    .arbol-page-tour .ant-tour-next-btn,
    .arbol-page-tour .ant-tour-finish-btn {
      border-radius: 10px !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      height: 34px !important;
      padding: 0 14px !important;
    }
    .arbol-page-tour .ant-tour-prev-btn {
      border-color: rgba(9,64,103,0.2) !important;
      color: #094067 !important;
    }
    .arbol-page-tour .ant-tour-next-btn,
    .arbol-page-tour .ant-tour-finish-btn {
      background: linear-gradient(135deg, #094067, #1a6da8) !important;
      border: none !important;
    }
    .arbol-page-tour .ant-tour-close {
      color: #90b4ce !important;
    }
    .arbol-page-tour .ant-tour-target-placeholder {
      outline: 2px solid #3da9fc !important;
      outline-offset: 4px !important;
      border-radius: 12px !important;
      box-shadow: 0 0 0 4px rgba(61,169,252,0.15) !important;
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
  pageLabel: string;
  storageKey: string;
  doneEmoji?: string;
  doneMessage?: string;
  onInteract?: () => void;
  interactLabel?: string;
}

export function PageTour({
  open, onClose, steps, pageLabel, storageKey,
  doneEmoji = '✅', doneMessage,
  onInteract, interactLabel = 'Try it now →',
}: PageTourProps) {
  const [current, setCurrent] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => { injectTourStyles(); }, []);

  useEffect(() => {
    if (open) {
      setCurrent(0);
      dismissed.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      steps[current]?.target?.()?.scrollIntoView({
        behavior: 'smooth', block: 'nearest', inline: 'nearest',
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [open, current, steps]);

  const persistDismiss = (showCompletion = false) => {
    if (dismissed.current) return;
    dismissed.current = true;
    localStorage.setItem(storageKey, 'true');
    onClose();
    if (showCompletion) setTimeout(() => setShowDone(true), 120);
  };

  const handleFinish = () => persistDismiss(true);

  const handleClose = () => persistDismiss(false);

  const antdSteps: TourProps['steps'] = steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    const showInteract = isLast && !!onInteract;

    return {
      title: s.title,
      description: (
        <div>
          <div style={{ marginBottom: showInteract ? 12 : 0 }}>{s.description}</div>
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
        mask={{ color: 'rgba(9, 64, 103, 0.45)' }}
        scrollIntoViewOptions={{ behavior: 'smooth', block: 'nearest' }}
        actionsRender={(originNode, { current: cur, total: tot }) => (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
            <button type="button" className="arbol-tour-skip-btn" onClick={handleClose}>
              Skip
            </button>
            <span style={{
              fontSize: 11, color: C.secondary, fontWeight: 600,
              flex: 1, textAlign: 'center',
            }}>
              {cur + 1} / {tot}
            </span>
            {originNode}
          </div>
        )}
      />

      <Modal
        open={showDone}
        onCancel={() => setShowDone(false)}
        footer={null}
        centered
        width={320}
        styles={{
          content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
          mask: { backdropFilter: 'blur(6px)', zIndex: 1100 },
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
