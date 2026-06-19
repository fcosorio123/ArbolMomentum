import { useEffect, useRef } from 'react';
import { Modal, Button } from 'antd';
import { C } from '../data/colors';

interface SummaryRow {
  icon: string;
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  type: 'goal' | 'task';
  title: string;
  rows: SummaryRow[];
  onClose: () => void;
}

// ── Confetti burst (canvas, no external deps) ──────────────────────────
function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const COLORS = ['#094067', '#3da9fc', '#ef4565', '#f5a623', '#2cb67d', '#ffd700'];

    const particles = Array.from({ length: 48 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 60,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -(Math.random() * 8 + 3),
      size: Math.random() * 7 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.3,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));

    let frame = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx;
        p.vy += 0.25;
        p.y += p.vy;
        p.rot += p.rotV;
        const alpha = Math.max(0, 1 - frame / 80);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      frame++;
      if (frame < 90) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  );
}

export function CongratModal({ open, type, title, rows, onClose }: Props) {
  const isGoal = type === 'goal';
  const emoji = isGoal ? '🎯' : '✅';
  const headline = isGoal ? 'Goal Created!' : 'Task Added!';
  const accent = isGoal ? '#ef4565' : C.primary;
  const gradientEnd = isGoal ? '#f5a623' : '#1a6da8';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width="min(340px, calc(100vw - 24px))"
      style={{ maxWidth: '100vw' }}
      styles={{
        content: {
          borderRadius: 24, padding: 0,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(9,64,103,0.22)',
        },
        mask: { backdropFilter: 'blur(6px)' },
        wrapper: { zIndex: 1200 },
      }}
    >
      {/* Gradient header with confetti */}
      <div style={{
        position: 'relative',
        background: `linear-gradient(135deg, ${accent}, ${gradientEnd})`,
        padding: '32px 24px 24px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <ConfettiBurst />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 52, marginBottom: 8,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
          }}>
            {emoji}
          </div>
          <div style={{
            fontSize: 22, fontWeight: 900, color: '#fff',
            letterSpacing: -0.3, marginBottom: 4,
          }}>
            {headline}
          </div>
          <div style={{
            fontSize: 14, color: 'rgba(255,255,255,0.82)', fontWeight: 500,
            maxWidth: 260, margin: '0 auto', lineHeight: 1.4,
          }}>
            {title}
          </div>
        </div>
      </div>

      {/* Summary rows */}
      <div style={{ padding: '18px 20px 0' }}>
        {rows.length > 0 && (
          <div style={{
            background: C.bgAlt,
            border: `1.5px solid ${C.border}`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 18,
          }}>
            {rows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{row.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {row.label}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: C.headline,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 22px' }}>
        <Button
          type="primary"
          block
          size="large"
          onClick={onClose}
          style={{
            borderRadius: 14, height: 48, fontWeight: 800, fontSize: 15,
            background: `linear-gradient(135deg, ${accent}, ${gradientEnd})`,
            border: 'none',
            boxShadow: `0 6px 20px ${accent}40`,
          }}
        >
          {isGoal ? 'Awesome, let\'s go! 🚀' : 'Got it, keep going! 💪'}
        </Button>
      </div>
    </Modal>
  );
}
