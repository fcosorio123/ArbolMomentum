import { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { CheckOutlined } from '@ant-design/icons';
import { C } from '../data/colors';

const SWIPE_THRESHOLD = 72;

interface Props {
  title: string;
  pct: number;
  accent: string;
  emoji: string;
  isHighlighted?: boolean;
  onSwipeComplete: () => void;
  onTap: () => void;
}

export function SwipeableGoalCard({
  title, pct, accent, emoji, isHighlighted, onSwipeComplete, onTap,
}: Props) {
  const x = useMotionValue(0);
  const dragging = useRef(false);
  const dragDistance = useRef(0);
  const checkOpacity = useTransform(x, [0, 40, SWIPE_THRESHOLD], [0, 0.5, 1]);
  const cardRotate = useTransform(x, [0, 120], [0, 6]);
  const progressActive = pct > 0;

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    dragging.current = false;
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 500) {
      animate(x, 280, {
        duration: 0.28,
        ease: [0.32, 0.72, 0, 1],
        onComplete: onSwipeComplete,
      });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        flex: '0 0 auto',
        width: 'min(72vw, 220px)',
        scrollSnapAlign: 'start',
        touchAction: 'pan-y',
      }}
    >
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: 16,
          background: `linear-gradient(135deg, #2cb67d, #22c55e)`,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          paddingLeft: 18, opacity: checkOpacity,
        }}
      >
        <CheckOutlined style={{ color: '#fff', fontSize: 22 }} />
        <span style={{ marginLeft: 8, color: '#fff', fontWeight: 700, fontSize: 12 }}>Check in</span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.45 }}
        dragDirectionLock
        style={{ x, rotate: cardRotate, cursor: 'grab' }}
        onDragStart={() => { dragging.current = true; dragDistance.current = 0; }}
        onDrag={(_, info) => { dragDistance.current = Math.max(dragDistance.current, info.offset.x); }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (dragDistance.current < 8) onTap();
        }}
        whileTap={{ scale: 0.98 }}
      >
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '14px 16px 16px',
          border: isHighlighted ? `2px solid ${accent}` : `1.5px solid ${C.border}`,
          boxShadow: isHighlighted ? `0 4px 18px ${accent}22` : C.shadow,
          minHeight: 96,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: progressActive ? accent : C.border,
                boxShadow: progressActive ? `0 0 0 3px ${accent}22` : 'none',
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.secondary }}>{pct}%</span>
            </div>
            <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>{emoji}</span>
          </div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: C.headline, lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {title}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
