import { useRef, type TouchEvent } from 'react';
import { Modal, Button } from 'antd';
import {
  type ReportEntry,
  getMomentumHeadline,
  getFeedbackTeaser,
} from '../data/liveCheckInFeedback';
import { MomentumMiniChart } from './MomentumMiniChart';
import { C } from '../data/colors';

interface Props {
  open: boolean;
  entry: ReportEntry | null;
  profileId: string;
  onContinue: () => void;
  onViewFeedback: () => void;
}

const MODAL_WIDTH = 'min(480px, calc(100vw - 32px))';

export function MomentumUpdateModal({
  open, entry, profileId, onContinue, onViewFeedback,
}: Props) {
  const touchStartY = useRef<number | null>(null);

  if (!entry) return null;

  const delta = entry.progressAtTime - entry.previousProgress;
  const isUrgent = entry.warningType === 'urgent_safety';
  const headline = getMomentumHeadline(entry);
  const teaser = !isUrgent ? getFeedbackTeaser(entry.responseText) : '';

  const handleTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    if (endY - touchStartY.current > 72) onContinue();
    touchStartY.current = null;
  };

  return (
    <>
      <style>{`
        .momentum-update-modal .ant-modal-content {
          animation: momentumModalIn 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes momentumModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <Modal
        className="momentum-update-modal"
        open={open}
        onCancel={onContinue}
        footer={null}
        centered
        closable={false}
        destroyOnClose
        maskClosable
        width={MODAL_WIDTH}
        style={{ maxWidth: '100vw' }}
        styles={{
          content: {
            borderRadius: 20,
            padding: 0,
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(9,64,103,0.22)',
          },
          mask: {
            background: 'rgba(9, 64, 103, 0.45)',
            backdropFilter: 'blur(4px)',
          },
          header: {
            margin: 0,
            padding: 0,
            background: 'transparent',
            border: 'none',
          },
          body: { padding: 0 },
          wrapper: { zIndex: 1100 },
        }}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Compact gradient header */}
          <div style={{
            position: 'relative',
            background: isUrgent
              ? 'linear-gradient(135deg, #cf1322, #ff7875)'
              : `linear-gradient(135deg, ${C.headline}, ${C.primary})`,
            padding: '14px 44px 12px 18px',
            color: '#fff',
          }}>
            <button
              type="button"
              aria-label="Close"
              onClick={onContinue}
              style={{
                position: 'absolute', top: 10, right: 12,
                width: 28, height: 28, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 16, lineHeight: 1,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
            <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, marginBottom: 3, letterSpacing: 0.3 }}>
              Momentum update
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>
              {headline}
            </div>
          </div>

          <div style={{ padding: '20px 22px 8px' }}>
            <div style={{
              display: 'flex', gap: 16, marginBottom: 20,
              background: C.bgAlt, borderRadius: 14, padding: '14px 16px',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                  Progress
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.headline }}>
                  {entry.previousProgress}% → {entry.progressAtTime}%
                  {delta > 0 && (
                    <span style={{ fontSize: 12, color: C.primary, marginLeft: 6 }}>+{delta}%</span>
                  )}
                </div>
              </div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                  Momentum
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>
                  {entry.momentumScore}
                </div>
              </div>
            </div>

            {!isUrgent && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.secondary, marginBottom: 8 }}>
                  Today&apos;s momentum
                </div>
                <MomentumMiniChart profileId={profileId} height={96} />
              </div>
            )}

            {isUrgent ? (
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#cf1322', lineHeight: 1.55 }}>
                {entry.responseText}
              </p>
            ) : teaser ? (
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <p style={{
                  margin: 0,
                  fontSize: 12,
                  color: C.body,
                  lineHeight: 1.55,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {teaser}
                </p>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 14,
                  background: `linear-gradient(to bottom, transparent, ${C.bgCard})`,
                  pointerEvents: 'none',
                }} />
              </div>
            ) : (
              <div style={{ marginBottom: 20 }} />
            )}
          </div>

          <div style={{
            padding: '4px 22px max(22px, env(safe-area-inset-bottom))',
            display: 'flex', flexDirection: 'row', gap: 10,
          }}>
            <Button
              type="primary"
              size="large"
              onClick={onContinue}
              style={{
                borderRadius: 12, height: 48, fontWeight: 700, fontSize: 14, flex: 1.15,
                background: C.primary, border: 'none',
                boxShadow: `0 4px 14px ${C.primary}40`,
              }}
            >
              Continue with Tasks
            </Button>
            {!isUrgent && (
              <Button
                size="large"
                onClick={onViewFeedback}
                style={{
                  borderRadius: 12, height: 48, fontWeight: 600, fontSize: 14, flex: 1,
                  border: `1.5px solid ${C.border}`, color: C.headline, background: '#fff',
                }}
              >
                Read More
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
