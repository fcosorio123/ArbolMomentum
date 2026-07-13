import { useState, useEffect } from 'react';
import { Modal, Input, Button } from 'antd';
import { C } from '../data/colors';
import { simplifyTaskFromEdge, type SimplifyTaskResult } from '../data/aiTaskCreation';

const { TextArea } = Input;

const QUESTIONS = [
  'What makes this task feel hard, vague, or overwhelming?',
  'What would "good enough" progress look like today?',
  'Any constraints? (time, energy, tools, dependencies)',
];

interface Props {
  open: boolean;
  onClose: () => void;
  taskLabel: string;
  goalTitle?: string;
  goalWhy?: string;
  onConfirm: (replacements: Array<{ label: string; timeOfDay: 'morning' | 'evening' }>) => void;
}

export function SimplifyTaskModal({
  open, onClose, taskLabel, goalTitle, goalWhy, onConfirm,
}: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimplifyTaskResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const reset = () => {
    setStep(0);
    setAnswers(['', '', '']);
    setLoading(false);
    setError(null);
    setResult(null);
    setSelected(new Set());
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const canNext = step === 0 ? answers[0].trim().length >= 3 : true;
  const isLastQuestion = step >= QUESTIONS.length - 1;

  const handleNext = async () => {
    if (!isLastQuestion) {
      setStep(s => s + 1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filled = answers.map(a => a.trim()).filter(Boolean);
      const res = await simplifyTaskFromEdge({
        taskLabel,
        goalTitle,
        goalWhy,
        answers: filled,
      });
      if (!res.ok || res.tasks.length === 0) {
        setError(res.reason === 'network_error'
          ? 'Could not reach the server. Try again.'
          : 'No simpler steps could be generated. Try adding more detail to your answers.');
        return;
      }
      setResult(res);
      setSelected(new Set(res.tasks.map((_, i) => i)));
      setStep(QUESTIONS.length);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    const picks = result.tasks
      .filter((_, i) => selected.has(i))
      .map(t => ({ label: t.label, timeOfDay: t.timeOfDay }));
    if (picks.length === 0) return;
    onConfirm(picks);
    handleClose();
  };

  const togglePick = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const reviewing = step >= QUESTIONS.length && result;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={null}
      centered
      width="min(400px, calc(100vw - 24px))"
      destroyOnClose
      styles={{
        content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ height: 5, background: `linear-gradient(90deg, #7c3aed, #3da9fc)` }} />
      <div style={{ padding: '22px 24px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          Simplify for me
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.headline }}>
          {reviewing ? 'Pick simpler steps' : QUESTIONS[step]}
        </h3>
        {!reviewing && (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
            Breaking down: <strong>{taskLabel}</strong>
            {goalTitle && <> · goal: {goalTitle}</>}
          </p>
        )}

        {!reviewing && (
          <>
            <TextArea
              value={answers[step]}
              onChange={e => {
                const next = [...answers];
                next[step] = e.target.value;
                setAnswers(next);
              }}
              placeholder={step === 0 ? 'e.g. Too big, not sure where to start...' : 'Optional — press Next to skip'}
              rows={4}
              style={{ marginBottom: 12, borderRadius: 12 }}
              autoFocus
            />
            <div style={{ fontSize: 11, color: C.secondary, marginBottom: 14 }}>
              Question {step + 1} of {QUESTIONS.length}
              {step > 0 && ' · optional'}
            </div>
            {error && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#c0392b' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && (
                <Button block onClick={() => setStep(s => s - 1)} style={{ borderRadius: 12, height: 46 }}>
                  Back
                </Button>
              )}
              <Button
                block
                type="primary"
                loading={loading}
                disabled={!canNext && step === 0}
                onClick={handleNext}
                style={{ borderRadius: 12, height: 46, flex: 2, fontWeight: 700, border: 'none', background: '#7c3aed' }}
              >
                {isLastQuestion ? 'Generate steps' : 'Next'}
              </Button>
            </div>
          </>
        )}

        {reviewing && result && (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body }}>
              Choose 2–5 smaller tasks to replace the original. You can uncheck any you don&apos;t want.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {result.tasks.map((t, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                    background: selected.has(i) ? `${C.primary}10` : C.bgAlt,
                    border: `1.5px solid ${selected.has(i) ? C.primary : C.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => togglePick(i)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: C.headline }}>{t.label}</span>
                  <span style={{ fontSize: 10, color: C.secondary }}>{t.timeOfDay === 'morning' ? '☀️' : '🌙'}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button block onClick={() => { setStep(QUESTIONS.length - 1); setResult(null); }} style={{ borderRadius: 12, height: 46 }}>
                Back
              </Button>
              <Button
                block
                type="primary"
                disabled={selected.size === 0}
                onClick={handleConfirm}
                style={{ borderRadius: 12, height: 46, flex: 2, fontWeight: 700, border: 'none', background: '#7c3aed' }}
              >
                Replace with {selected.size} task{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
