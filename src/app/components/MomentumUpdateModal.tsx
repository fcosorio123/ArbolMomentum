import { Modal, Button } from 'antd';
import {
  type ReportEntry,
  getMomentumHeadline,
  getMomentumCoachingLine,
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

export function MomentumUpdateModal({
  open, entry, profileId, onContinue, onViewFeedback,
}: Props) {
  if (!entry) return null;

  const delta = entry.progressAtTime - entry.previousProgress;
  const headline = getMomentumHeadline(entry);
  const coaching = getMomentumCoachingLine(entry);
  const isUrgent = entry.warningType === 'urgent_safety';

  return (
    <Modal
      open={open}
      onCancel={onContinue}
      footer={null}
      centered={false}
      destroyOnClose
      width="100%"
      style={{ top: 'auto', paddingBottom: 0, margin: 0, maxWidth: '100%' }}
      styles={{
        content: {
          borderRadius: '20px 20px 0 0',
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(9,64,103,0.15)',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          margin: '0 auto',
          maxWidth: 480,
        },
        mask: { backdropFilter: 'blur(4px)' },
        wrapper: { zIndex: 1100 },
      }}
    >
      <div style={{
        background: isUrgent
          ? 'linear-gradient(135deg, #cf1322, #ff7875)'
          : `linear-gradient(135deg, ${C.headline}, ${C.primary})`,
        padding: '20px 20px 16px',
        color: '#fff',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>
          Momentum update
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3 }}>
          {headline}
        </div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          display: 'flex', gap: 12, marginBottom: 14,
          background: C.bgAlt, borderRadius: 12, padding: '12px 14px',
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Progress
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.headline }}>
              {entry.previousProgress}% → {entry.progressAtTime}%
              {delta > 0 && (
                <span style={{ fontSize: 12, color: C.primary, marginLeft: 6 }}>+{delta}%</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Momentum
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>
              {entry.momentumScore}
            </div>
          </div>
        </div>

        {!isUrgent && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.secondary, marginBottom: 6 }}>
              Today&apos;s momentum
            </div>
            <MomentumMiniChart profileId={profileId} />
          </div>
        )}

        {isUrgent ? (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#cf1322', lineHeight: 1.5 }}>
            {entry.responseText}
          </p>
        ) : coaching ? (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: C.body, lineHeight: 1.5, fontStyle: 'italic' }}>
            {coaching}
          </p>
        ) : null}
      </div>

      <div style={{
        padding: '0 20px max(20px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 10,
      }}>
        <Button
          block
          size="large"
          onClick={onContinue}
          style={{
            borderRadius: 12, height: 48, fontWeight: 700, fontSize: 15, flex: 1,
            border: `1.5px solid ${C.border}`, color: C.headline,
          }}
        >
          Continue
        </Button>
        {!isUrgent && (
          <Button
            block
            type="primary"
            size="large"
            onClick={onViewFeedback}
            style={{
              borderRadius: 12, height: 48, fontWeight: 700, fontSize: 15, flex: 1,
              background: C.primary, border: 'none',
            }}
          >
            View Feedback
          </Button>
        )}
      </div>
    </Modal>
  );
}
