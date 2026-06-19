import { BADGES, getEarnedBadges, type Profile } from '../data/profiles';
import { C } from '../data/colors';

interface Props { profile: Profile }

const CATEGORY_LABELS: Record<string, string> = {
  streak:      '🔥 Streak Badges',
  performance: '⚡ Performance',
  time:        '📅 Tenure',
  special:     '✨ Special',
};

export function BadgesSection({ profile }: Props) {
  const earned = new Set(getEarnedBadges(profile).map(b => b.id));

  const grouped = Object.entries(
    BADGES.reduce<Record<string, typeof BADGES>>((acc, b) => {
      acc[b.category] = [...(acc[b.category] || []), b];
      return acc;
    }, {})
  );

  return (
    <div>
      {grouped.map(([cat, badges]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            {CATEGORY_LABELS[cat]}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {badges.map(badge => {
              const unlocked = earned.has(badge.id);
              return (
                <div key={badge.id} style={{
                  background: unlocked ? C.bgCard : C.bgAlt,
                  border: `1.5px solid ${unlocked ? C.primary + '40' : C.border}`,
                  borderRadius: 14, padding: '12px 14px',
                  opacity: unlocked ? 1 : 0.55,
                  boxShadow: unlocked ? C.shadow : 'none',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 6, filter: unlocked ? 'none' : 'grayscale(1)' }}>
                    {badge.icon}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: unlocked ? C.headline : C.secondary, marginBottom: 3 }}>
                    {badge.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.secondary, lineHeight: 1.4 }}>
                    {badge.desc}
                  </div>
                  {unlocked && (
                    <div style={{
                      marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: `${C.primary}15`, borderRadius: 6, padding: '2px 8px',
                    }}>
                      <span style={{ fontSize: 10, color: C.primary, fontWeight: 700 }}>✓ Earned</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
