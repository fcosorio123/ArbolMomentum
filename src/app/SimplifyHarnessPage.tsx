/**
 * Local browser harness: open http://127.0.0.1:5173/#simplify-harness
 * Used to acceptance-test Simplify for Me without full task setup.
 */
import { useState } from 'react';
import { SimplifyTaskModal } from './components/SimplifyTaskModal';
import type { SimplifiedTaskSuggestion } from './data/aiTaskCreation';
import { C } from './data/colors';

export function SimplifyHarnessPage() {
  const [open, setOpen] = useState(true);
  const [confirmed, setConfirmed] = useState<SimplifiedTaskSuggestion[] | null>(null);
  const [caseId, setCaseId] = useState('A');

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: C.headline, fontSize: 20 }}>Simplify for Me — browser harness</h1>
      <p style={{ color: C.body, fontSize: 13 }}>
        Task: <strong>Set a phone-down reminder 30 minutes before bed</strong>
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['A', 'B', 'C', 'D'].map(id => (
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
{caseId === 'A' && `Hard: I do not know which app to use.\nHelp: Simple directions.\nAround: I have an iPhone.`}
{caseId === 'B' && `Hard: My bedtime changes every night.\nHelp: Something I can adjust quickly.\nAround: I use an Android phone.`}
{caseId === 'C' && `Hard: I keep putting this off.\nHelp: The fastest possible option.\nAround: I only have one minute.`}
{caseId === 'D' && `Hard: My favorite food is pizza.\nHelp: (blank)\nAround: (blank)`}
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
        taskId={`harness-phone-down-${caseId}`}
        taskLabel="Set a phone-down reminder 30 minutes before bed"
        goalTitle="Renew Living Room Artwork"
        onConfirm={(reps) => { setConfirmed(reps); setOpen(false); }}
      />
    </div>
  );
}
