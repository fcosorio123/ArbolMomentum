import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import confetti from 'canvas-confetti';
import { getPersonalGoals, type PersonalGoal } from '../data/personalGoals';
import {
  getGoalAccentColor, getGoalEmoji, getGoalProgressPercent, quickCheckInGoal,
} from '../data/goalProgressUtils';
import { SwipeableGoalCard } from './SwipeableGoalCard';
import { C } from '../data/colors';

interface Props {
  profileId: string;
  onNavigateGoals?: () => void;
  onProgressUpdated?: () => void;
}

function fireSwipeConfetti(accent: string) {
  confetti({
    particleCount: 55,
    spread: 65,
    origin: { y: 0.72, x: 0.5 },
    colors: [accent, '#3da9fc', '#2cb67d', '#ffffff'],
    ticks: 120,
    gravity: 1.1,
    scalar: 0.9,
  });
}

export function ActiveGoalsList({ profileId, onNavigateGoals, onProgressUpdated }: Props) {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const loadGoals = useCallback(() => {
    setGoals(getPersonalGoals(profileId));
  }, [profileId]);

  useEffect(() => {
    loadGoals();
    const handler = () => loadGoals();
    window.addEventListener('arbol-goals-updated', handler);
    return () => window.removeEventListener('arbol-goals-updated', handler);
  }, [loadGoals]);

  const goalCards = useMemo(() => goals.map(goal => ({
    goal,
    pct: getGoalProgressPercent(profileId, goal),
    accent: getGoalAccentColor(goal.id),
    emoji: getGoalEmoji(goal),
  })), [goals, profileId]);

  const handleSwipe = (goalId: string, accent: string) => {
    if (animatingId) return;
    setAnimatingId(goalId);
    const result = quickCheckInGoal(profileId, goalId);
    if (result.ok) {
      fireSwipeConfetti(accent);
      message.success('Progress updated!');
      loadGoals();
      onProgressUpdated?.();
    } else {
      message.info('Already checked in for this goal today');
    }
    setTimeout(() => setAnimatingId(null), 320);
  };

  if (goals.length === 0) {
    return (
      <div data-tour-id="home-active-goals" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.headline }}>What are we working on?</h2>
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
        <span style={{ fontSize: 12, color: C.secondary, fontWeight: 600 }}>
          {goals.length} goal{goals.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        data-active-goals-scroll
        style={{
          display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, paddingRight: 4,
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}
      >
        <style>{`[data-active-goals-scroll]::-webkit-scrollbar { display: none; }`}</style>
        {goalCards.map(({ goal, pct, accent, emoji }, idx) => (
            <SwipeableGoalCard
              key={goal.id}
              title={goal.title}
              pct={pct}
              accent={accent}
              emoji={emoji}
              isHighlighted={idx === 0}
              onTap={() => onNavigateGoals?.()}
              onSwipeComplete={() => handleSwipe(goal.id, accent)}
            />
          ))}
      </div>

      <div style={{ fontSize: 11, color: C.secondary, marginTop: 6, paddingLeft: 2 }}>
        Swipe right on a card to log today&apos;s progress · Tap to open goals
      </div>
    </div>
  );
}
