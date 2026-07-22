import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightOutlined } from '@ant-design/icons';
import { getPersonalGoals, type PersonalGoal } from '../data/personalGoals';
import {
  getGoalAccentColor, getGoalEmoji, getGoalWeekProgressPercent,
} from '../data/goalProgressUtils';
import { GoalProgressCard } from './GoalProgressCard';
import { C } from '../data/colors';

interface Props {
  profileId: string;
  onNavigateGoals?: () => void;
  onProgressUpdated?: () => void;
}

export function ActiveGoalsList({ profileId, onNavigateGoals }: Props) {
  const [goals, setGoals] = useState<PersonalGoal[]>(() => getPersonalGoals(profileId));
  const [refreshTick, setRefreshTick] = useState(0);

  const loadGoals = useCallback(() => {
    setGoals(getPersonalGoals(profileId));
    setRefreshTick(n => n + 1);
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
    pct: getGoalWeekProgressPercent(profileId, goal),
    accent: getGoalAccentColor(goal.id),
    emoji: getGoalEmoji(goal),
  })), [goals, profileId, refreshTick]);

  const header = (
    <div
      role={onNavigateGoals ? 'button' : undefined}
      tabIndex={onNavigateGoals ? 0 : undefined}
      onClick={onNavigateGoals}
      onKeyDown={onNavigateGoals ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNavigateGoals();
        }
      } : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: onNavigateGoals ? 'pointer' : 'default',
        marginBottom: goals.length === 0 ? 0 : 14,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        background: `${C.primary}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        🏆
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>My Goals</div>
        <div style={{ fontSize: 12, color: C.body, marginTop: 2 }}>
          View, edit, and set new goals
        </div>
      </div>
      {onNavigateGoals && (
        <ArrowRightOutlined style={{ color: C.secondary, fontSize: 14, flexShrink: 0 }} />
      )}
    </div>
  );

  return (
    <div
      data-tour-id="home-active-goals"
      style={{
        background: C.bgCard,
        border: `1.5px solid ${C.primary}25`,
        borderRadius: 20,
        padding: '14px 16px 16px',
        marginBottom: 14,
        boxShadow: C.shadow,
      }}
    >
      {header}

      {goals.length === 0 ? (
        <div style={{
          marginTop: 14,
          background: `${C.primary}06`,
          border: `1.5px dashed ${C.border}`,
          borderRadius: 14,
          padding: '18px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>🎯</div>
          <div style={{ fontSize: 13, color: C.body, marginBottom: 10 }}>
            Set a goal or task to get started
          </div>
          {onNavigateGoals && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateGoals();
              }}
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryPressed})`,
                border: 'none', borderRadius: 10, padding: '8px 14px',
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              Add a goal
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
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
            {goalCards.length > 1 && (
              <div aria-hidden style={{
                position: 'absolute', top: 0, right: 0, bottom: 4, width: 28, pointerEvents: 'none',
                background: `linear-gradient(90deg, transparent, ${C.bgCard})`,
              }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: C.secondary, marginTop: 6, paddingLeft: 2 }}>
            Swipe to browse your active goals
          </div>
        </>
      )}
    </div>
  );
}
