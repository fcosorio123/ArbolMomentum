import { useState } from 'react';
import { C } from '../data/colors';

const STEPS = [
  {
    emoji: '🌿',
    title: 'Welcome to Arbol Momentum!',
    desc: 'Your personal home care companion. Build daily habits, track streaks, and get timely reminders.',
    tip: null,
    accent: C.primary,
    dark: true,
  },
  {
    emoji: '✅',
    title: 'Tasks Are Your Primary Action',
    desc: 'Your tasks are the actions to complete. Goals define the outcome you are working toward. Categories group tasks by area of life. The Tasks tab always shows you what to do next.',
    tip: '💡 Completing all tasks today extends your streak!',
    accent: '#3da9fc',
    dark: false,
  },
  {
    emoji: '🎯',
    title: 'Goals Provide the Context',
    desc: 'Each goal is an outcome you want to achieve. Tasks are grouped by category - an area of life like Finance or Health. Each category lives under the goal it supports.',
    tip: '💡 Tap a goal header to collapse or expand its tasks.',
    accent: '#ef4565',
    dark: false,
  },
  {
    emoji: '📋',
    title: 'Complete Tasks, Make Progress',
    desc: 'Complete these tasks to make progress toward this goal. Each task you finish moves the goal forward - the progress ring updates in real time.',
    tip: '💡 Tap the circle button on any task to mark it in progress or done.',
    accent: '#f5a623',
    dark: false,
  },
  {
    emoji: '📖',
    title: 'Track Progress with Goal Logs',
    desc: 'Goal Logs show updates, progress, and what changed over time. Tap "View Goal Log" inside any goal section to see the full history.',
    tip: '💡 Use "Log →" on monetary goals to record amounts saved or earned.',
    accent: C.primary,
    dark: false,
  },
  {
    emoji: '🔄',
    title: 'Tasks and Goals Always Stay in Sync',
    desc: 'Completing a task on the Tasks page instantly updates the Goals page too - and vice versa. Both pages read from the same source, so your progress is always consistent no matter where you work.',
    tip: '💡 The goal progress ring updates in real time as you check off tasks each day.',
    accent: '#22c55e',
    dark: false,
  },
  {
    emoji: '➕',
    title: 'Add Tasks and Link Them to Goals',
    desc: 'Use the + button on the Tasks page to create your own tasks. Assign them to a goal so they show up under that goal and count toward your daily progress on both pages.',
    tip: '💡 Every task should have a goal - that is what gives it meaning.',
    accent: '#ef4565',
    dark: false,
  },
  {
    emoji: '🔥',
    title: 'Build Your Streak',
    desc: 'The Home tab shows your 7-day streak history. Come back every day to keep the chain alive!',
    tip: '💡 Your streak resets if you miss a day - be consistent.',
    accent: '#f5a623',
    dark: false,
  },
  {
    emoji: '📅',
    title: 'Plan Your Week',
    desc: 'The Week tab shows a 7-day planner so you can see what\'s ahead and track your overall momentum.',
    tip: '💡 Tap any day to see and complete its tasks.',
    accent: C.primary,
    dark: false,
  },
  {
    emoji: '📱',
    title: 'Install for the Best Experience',
    desc: 'Add Arbol Momentum to your home screen for a native-app feel with full push notification support.',
    tip: 'Tap "Add to Home Screen" in the Alerts tab for step-by-step instructions.',
    accent: '#3da9fc',
    dark: false,
  },
];

interface Props {
  onDone: () => void;
}

export function CoachMarks({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(5,30,55,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
      }}
    >
      {/* Card - stop click-through */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 390,
          background: C.bgCard,
          borderRadius: 28,
          boxShadow: '0 24px 64px rgba(5,30,55,0.45), 0 4px 16px rgba(5,30,55,0.2)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Coloured accent strip at top */}
        <div style={{
          height: 5,
          background: `linear-gradient(90deg, ${current.accent}, ${current.accent}88)`,
          transition: 'background 0.3s',
        }} />

        {/* Header row: step counter + close */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: current.accent, letterSpacing: 0.5 }}>
            STEP {step + 1} OF {STEPS.length}
          </span>
          <button
            onClick={onDone}
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

        {/* Progress bar */}
        <div style={{ margin: '12px 20px 0', height: 4, background: C.bgAlt, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${pct}%`,
            background: current.accent,
            transition: 'width 0.35s ease, background 0.3s',
          }} />
        </div>

        {/* Main content */}
        <div style={{ padding: '28px 28px 0', textAlign: 'center' }}>
          {/* Emoji in a tinted circle */}
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: `${current.accent}18`,
            border: `2px solid ${current.accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, margin: '0 auto 20px', lineHeight: 1,
          }}>
            {current.emoji}
          </div>

          <h2 style={{
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

        {/* Dot indicators */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 7,
          padding: '22px 0 4px',
        }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
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

        {/* Action buttons */}
        <div style={{ padding: '16px 20px 24px', display: 'flex', gap: 10 }}>
          {!isFirst && (
            <button
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
            onClick={isLast ? onDone : () => setStep(s => s + 1)}
            style={{
              flex: 2, height: 50, borderRadius: 14, cursor: 'pointer', border: 'none',
              background: current.accent,
              color: '#fff', fontSize: 15, fontWeight: 700,
              boxShadow: `0 4px 18px ${current.accent}50`,
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          >
            {isLast ? 'Get Started 🚀' : 'Next →'}
          </button>
        </div>

        {/* Skip link */}
        {!isLast && (
          <button
            onClick={onDone}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.secondary, fontSize: 12, paddingBottom: 20,
              width: '100%', textAlign: 'center',
            }}
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
