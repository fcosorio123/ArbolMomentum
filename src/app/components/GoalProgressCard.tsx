import { C } from '../data/colors';

interface Props {
  title: string;
  pct: number;
  accent: string;
  emoji: string;
  isHighlighted?: boolean;
}

/** Display-only goal card for the home carousel (scroll to browse, no tap/drag). */
export function GoalProgressCard({ title, pct, accent, emoji, isHighlighted }: Props) {
  const progressActive = pct > 0;

  return (
    <div
      style={{
        flex: '0 0 auto',
        width: 'min(72vw, 220px)',
        scrollSnapAlign: 'start',
        userSelect: 'none',
      }}
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
    </div>
  );
}
