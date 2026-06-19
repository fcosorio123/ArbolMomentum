import { useEffect } from 'react';
import { Modal, Button } from 'antd';
import confetti from 'canvas-confetti';
import type { Badge } from '../data/profiles';
import { C } from '../data/colors';

interface Props {
  open: boolean;
  streak: number;
  newBadges: Badge[];
  onClose: () => void;
  onViewWeek: () => void;
}

const STREAK_MILESTONES = [3, 7, 14, 30];

export function CelebrationModal({ open, streak, newBadges, onClose, onViewWeek }: Props) {
  useEffect(() => {
    if (!open) return;
    confetti({
      particleCount: 140,
      spread: 90,
      origin: { y: 0.55 },
      colors: ['#3da9fc', '#094067', '#f5a623', '#ef4565', '#90b4ce', '#ffffff'],
    });
    const t = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.4, x: 0.2 },
        colors: ['#f5a623', '#3da9fc'],
      });
    }, 400);
    return () => clearTimeout(t);
  }, [open]);

  const isStreakMilestone = STREAK_MILESTONES.includes(streak);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      closable={false}
      styles={{
        content: { borderRadius: 24, padding: 0, overflow: 'hidden', maxWidth: 340, margin: '0 auto' },
        mask: { backdropFilter: 'blur(8px)', background: 'rgba(9,64,103,0.35)' },
      }}
    >
      <div style={{ padding: '36px 24px 28px', textAlign: 'center' }}>
        {/* Hero emoji */}
        <div style={{ fontSize: 64, marginBottom: 12, lineHeight: 1 }}>🎉</div>

        <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: C.headline }}>
          Perfect Day!
        </h2>
        <p style={{ color: C.body, fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          You completed every task for today. That's incredible momentum!
        </p>

        {/* Streak milestone */}
        {isStreakMilestone && (
          <div style={{
            background: `linear-gradient(135deg, ${C.streak}18, ${C.streak}08)`,
            border: `1.5px solid ${C.streak}50`,
            borderRadius: 16, padding: '16px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 36 }}>🔥</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: C.headline, fontSize: 16 }}>
                {streak}-day streak!
              </div>
              <div style={{ color: C.body, fontSize: 12, marginTop: 3 }}>
                Milestone unlocked. You're absolutely on fire!
              </div>
            </div>
          </div>
        )}

        {/* New badges */}
        {newBadges.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              🏅 New badges earned
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {newBadges.map(badge => (
                <div key={badge.id} style={{
                  background: `${C.primary}10`,
                  border: `1.5px solid ${C.primary}30`,
                  borderRadius: 14, padding: '12px 14px',
                  minWidth: 90, flex: '0 1 auto',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{badge.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.headline }}>{badge.name}</div>
                  <div style={{ fontSize: 10, color: C.secondary, marginTop: 3, lineHeight: 1.4 }}>{badge.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            type="primary"
            block
            onClick={() => { onViewWeek(); onClose(); }}
            style={{
              height: 50, borderRadius: 14,
              background: `linear-gradient(135deg, ${C.headline}, #1a6da8)`,
              border: 'none', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            View Week Plan →
          </Button>
          <Button
            block
            onClick={onClose}
            style={{
              height: 44, borderRadius: 14,
              border: `1px solid ${C.border}`,
              color: C.body, fontSize: 14,
            }}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
