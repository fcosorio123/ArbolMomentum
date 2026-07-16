import { useState, useEffect } from 'react';
import { C } from '../data/colors';
import { trackEvent } from '../data/deviceAnalytics';
import { ONBOARDING_TOUR_VERSION } from '../data/productOnboarding';

const STEPS = [
  {
    emoji: '🌿',
    title: 'Welcome to Arbol Momentum',
    desc: 'Plan outcomes as goals, take action with tasks, and keep momentum with check-ins and streaks.',
    tip: null,
    accent: C.primary,
    dark: true,
    id: 'welcome',
  },
  {
    emoji: '🎯',
    title: 'Goals vs Tasks',
    desc: 'Goals are outcomes you want to reach. Tasks are the concrete actions that move those outcomes forward. Use Goals to set direction and Tasks to get things done.',
    tip: '💡 Start with either a goal or a task — you can link them later.',
    accent: '#ef4565',
    dark: false,
    id: 'goals-vs-tasks',
  },
  {
    emoji: '✍️',
    title: 'Create manually or with AI Assist',
    desc: 'Manual creation gives you full control. AI Assist turns a brain dump into a few editable options — nothing is saved until you confirm in the editor.',
    tip: '💡 You can switch between Goal and Task while using AI Assist.',
    accent: '#3da9fc',
    dark: false,
    id: 'create-modes',
  },
  {
    emoji: '🔗',
    title: 'Link tasks to goals your way',
    desc: 'When you create a task, assign it to an existing goal, start a new goal, or leave it unassigned. Goals can be saved alone or with selected starter tasks.',
    tip: '💡 Progress stays in sync whether you work from Goals or Tasks.',
    accent: '#22c55e',
    dark: false,
    id: 'relationships',
  },
  {
    emoji: '🪄',
    title: 'Simplify for Me',
    desc: 'Stuck on a big task? Simplify for Me breaks an existing task into smaller, actionable steps you can edit before saving.',
    tip: '💡 Find it on a task card when you need a clearer next move.',
    accent: '#f5a623',
    dark: false,
    id: 'simplify',
  },
  {
    emoji: '🔥',
    title: 'Check in and keep your streak',
    desc: 'Home shows your streak and what to do next. Complete tasks and check in regularly to keep momentum visible.',
    tip: '💡 Tap ? anytime for a page tour or this product overview.',
    accent: C.primary,
    dark: false,
    id: 'streak',
  },
  {
    emoji: '📱',
    title: 'Install for the best experience',
    desc: 'Add Arbol Momentum to your home screen for a native feel and stronger notification support.',
    tip: 'Tap “Add to Home Screen” in Alerts for step-by-step instructions.',
    accent: '#3da9fc',
    dark: false,
    id: 'install',
  },
];

interface Props {
  onDone: () => void;
  profileId?: string;
}

export function CoachMarks({ onDone, profileId }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  useEffect(() => {
    if (!profileId) return;
    trackEvent(profileId, 'coaching_mark_viewed', {
      tourVersion: ONBOARDING_TOUR_VERSION,
      stepId: current.id,
    });
  }, [profileId, current.id]);

  const finish = (skipped: boolean) => {
    if (profileId) {
      trackEvent(profileId, skipped ? 'coaching_mark_skipped' : 'coaching_mark_completed', {
        tourVersion: ONBOARDING_TOUR_VERSION,
        stepId: current.id,
      });
    }
    onDone();
  };

  return (
    <div
      onClick={() => finish(true)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(5,30,55,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-marks-title"
        style={{
          width: '100%', maxWidth: 390,
          maxHeight: 'min(90vh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px))',
          background: C.bgCard,
          borderRadius: 28,
          boxShadow: '0 24px 64px rgba(5,30,55,0.45), 0 4px 16px rgba(5,30,55,0.2)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          height: 5,
          background: `linear-gradient(90deg, ${current.accent}, ${current.accent}88)`,
          transition: 'background 0.3s',
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: current.accent, letterSpacing: 0.5 }}>
            STEP {step + 1} OF {STEPS.length}
          </span>
          <button
            type="button"
            aria-label="Close product overview"
            onClick={() => finish(true)}
            style={{
              background: C.bgAlt, border: 'none', cursor: 'pointer',
              width: 30, height: 30, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.secondary, fontSize: 16, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ margin: '12px 20px 0', height: 4, background: C.bgAlt, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${pct}%`,
            background: current.accent,
            transition: 'width 0.35s ease, background 0.3s',
          }} />
        </div>

        <div style={{
          padding: '28px 28px 0', textAlign: 'center',
          flex: 1, overflowY: 'auto', minHeight: 0,
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: `${current.accent}18`,
            border: `2px solid ${current.accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, margin: '0 auto 20px', lineHeight: 1,
          }}>
            {current.emoji}
          </div>

          <h2 id="coach-marks-title" style={{
            margin: '0 0 12px', fontSize: 20, fontWeight: 800,
            color: C.headline, lineHeight: 1.25,
          }}>
            {current.title}
          </h2>

          <p style={{
            margin: '0 0 20px', fontSize: 14, lineHeight: 1.65,
            color: C.body,
          }}>
            {current.desc}
          </p>

          {current.tip && (
            <div style={{
              background: `${current.accent}10`,
              border: `1px solid ${current.accent}30`,
              borderRadius: 14, padding: '11px 16px',
              color: C.headline, fontSize: 13, lineHeight: 1.55,
              textAlign: 'left', marginBottom: 4,
            }}>
              {current.tip}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', gap: 7,
          padding: '22px 0 4px', flexShrink: 0,
        }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 22 : 8, height: 8, borderRadius: 4,
                background: i === step ? current.accent : C.bgAlt,
                border: `1.5px solid ${i === step ? current.accent : C.border}`,
                cursor: 'pointer', padding: 0, transition: 'all 0.3s',
              }}
            />
          ))}
        </div>

        <div style={{
          padding: '16px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', gap: 10, flexShrink: 0,
          borderTop: '1px solid rgba(9,64,103,0.06)',
          background: C.bgCard,
        }}>
          {!isFirst && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, height: 50, borderRadius: 14, cursor: 'pointer',
                background: C.bgAlt, border: `1.5px solid ${C.border}`,
                color: C.body, fontSize: 14, fontWeight: 600,
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={isLast ? () => finish(false) : () => setStep(s => s + 1)}
            style={{
              flex: 2, height: 50, borderRadius: 14, cursor: 'pointer', border: 'none',
              background: current.accent,
              color: '#fff', fontSize: 15, fontWeight: 700,
              boxShadow: `0 4px 18px ${current.accent}50`,
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          >
            {isLast ? 'Get Started' : 'Next →'}
          </button>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={() => finish(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.secondary, fontSize: 12,
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
              width: '100%', textAlign: 'center', flexShrink: 0,
              minHeight: 44,
            }}
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
