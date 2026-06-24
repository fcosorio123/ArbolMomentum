import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPersonalGoals, type PersonalGoal } from '../data/personalGoals';
import {
  getGoalAccentColor, getGoalEmoji, getGoalProgressPercent,
} from '../data/goalProgressUtils';
import { GoalProgressCard } from './GoalProgressCard';
import { C } from '../data/colors';

interface Props {
  profileId: string;
  onNavigateGoals?: () => void;
  onProgressUpdated?: () => void;
}

export function ActiveGoalsList({ profileId, onNavigateGoals }: Props) {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);

  const loadGoals = useCallback(() => {
    setGoals(getPersonalGoals(profileId));
  }, [profileId]);

  useEffect(() => {
    loadGoals();
    const handler = () => loadGoals();
    window.addEventListener('arbol-goals-updated', handler);
    window.addEventListener('arbol-tasks-updated', handler);
    return () => {
      window.removeEventListener('arbol-goals-updated', handler);
      window.removeEventListener('arbol-tasks-updated', handler);
    };
  }, [loadGoals]);

  const goalCards = useMemo(() => goals.map(goal => ({
    goal,
    pct: getGoalProgressPercent(profileId, goal),
    accent: getGoalAccentColor(goal.id),
    emoji: getGoalEmoji(goal),
  })), [goals, profileId]);

  const headerLink = onNavigateGoals ? (
    <button
      type="button"
      onClick={onNavigateGoals}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        fontSize: 12, fontWeight: 700, color: C.primary,
        textDecoration: 'underline', textUnderlineOffset: 3,
      }}
    >
      View All
    </button>
  ) : null;

  if (goals.length === 0) {
    return (
      <div data-tour-id="home-active-goals" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.headline }}>What are we working on?</h2>
          {headerLink}
        </div>
        <div style={{
          background: C.bgCard, border: `1.5px dashed ${C.border}`, borderRadius: 16,
          padding: '20px 16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🎯</div>
          <div style={{ fontSize: 13, color: C.body, marginBottom: 10 }}>Set a goal to track progress here</div>
          {onNavigateGoals && (
            <button
              onClick={onNavigateGoals}
              style={{
                background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
                border: 'none', borderRadius: 10, padding: '8px 14px',
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              Add a goal
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-tour-id="home-active-goals" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, paddingRight: 2 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.headline }}>What are we working on?</h2>
        {headerLink}
      </div>

      <div
        data-active-goals-scroll
        style={{
          display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, paddingRight: 4,
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
        }}
      >
        <style>{`[data-active-goals-scroll]::-webkit-scrollbar { display: none; }`}</style>
        {goalCards.map(({ goal, pct, accent, emoji }, idx) => (
          <GoalProgressCard
            key={goal.id}
            title={goal.title}
            pct={pct}
            accent={accent}
            emoji={emoji}
            isHighlighted={idx === 0}
          />
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.secondary, marginTop: 6, paddingLeft: 2 }}>
        Swipe to browse your active goals · View All for details
      </div>
    </div>
  );
}
