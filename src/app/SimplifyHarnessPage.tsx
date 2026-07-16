/**
 * Local browser harness: open http://127.0.0.1:5175/ArbolMomentum/#simplify-harness
 * Used to acceptance-test Simplify for Me without full task setup.
 */
import { useState } from 'react';
import { SimplifyTaskModal } from './components/SimplifyTaskModal';
import type { SimplifiedTaskSuggestion } from './data/aiTaskCreation';
import { C } from './data/colors';

const CASES: Record<string, { taskLabel: string; goalTitle?: string; hint: string }> = {
  A: {
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    goalTitle: 'Renew Living Room Artwork',
    hint: 'Hard: I forget. → expect detail suggestions about bedtime/reminders',
  },
  B: {
    taskLabel: 'Call the insurance company about the denied claim',
    hint: 'Hard: I do not know what to do. → expect claim/questions suggestions',
  },
  C: {
    taskLabel: 'Organize the documents needed for my tax appointment',
    hint: 'Q3 constraint: I do not have much time. → expect ten minutes / lunch',
  },
  D: {
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    hint: 'Hard: I usually ignore reminders once they appear on my iPhone. → no assist UI',
  },
  E: {
    taskLabel: 'Set a phone-down reminder 30 minutes before bed',
    hint: 'Hard: I forget. → Show different suggestions, then type custom detail',
  },
};

export function SimplifyHarnessPage() {
  const [open, setOpen] = useState(true);
  const [confirmed, setConfirmed] = useState<SimplifiedTaskSuggestion[] | null>(null);
  const [caseId, setCaseId] = useState('A');
  const current = CASES[caseId];

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: C.headline, fontSize: 20 }}>Simplify for Me - browser harness</h1>
      <p style={{ color: C.body, fontSize: 13 }}>
        Task: <strong>{current.taskLabel}</strong>
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.keys(CASES).map(id => (
          <button
            key={id}
            type="button"
            onClick={() => { setCaseId(id); setOpen(true); setConfirmed(null); }}
            style={{
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: caseId === id ? C.primary : '#fff', color: caseId === id ? '#fff' : C.headline,
              cursor: 'pointer', fontWeight: 700,
            }}
          >
            Open case {id}
          </button>
        ))}
      </div>
      <pre style={{ fontSize: 11, background: '#fff', padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>
        {current.hint}
      </pre>
      {confirmed && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 14 }}>Confirmed replacements</h2>
          <ol>
            {confirmed.map((t, i) => (
              <li key={i}>{t.label}</li>
            ))}
          </ol>
        </div>
      )}
      <SimplifyTaskModal
        open={open}
        onClose={() => setOpen(false)}
        taskId={`harness-${caseId}-${current.taskLabel.slice(0, 12)}`}
        taskLabel={current.taskLabel}
        goalTitle={current.goalTitle}
        profileId="harness"
        onConfirm={(reps) => { setConfirmed(reps); setOpen(false); }}
      />
    </div>
  );
}
