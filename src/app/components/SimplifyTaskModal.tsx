import { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button } from 'antd';
import { C } from '../data/colors';
import {
  simplifyTaskFromEdge,
  isGoalRelevantToTask,
  type SimplifyTaskResult,
  type SimplifiedTaskSuggestion,
} from '../data/aiTaskCreation';
import { ACCENT_MODAL_STYLES, ModalAccentBar } from '../styles/modalChrome';

const { TextArea } = Input;

/** Question prompts (form) — display labels for review use SIMPLIFY_QUESTION_META semantics. */
const QUESTIONS = [
  'What feels difficult?',
  'What would make this easier?',
  'Anything we should work around?',
] as const;

const QUESTION_FALLBACK_LABELS = QUESTIONS;

interface Props {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskLabel: string;
  goalTitle?: string;
  goalWhy?: string;
  onConfirm: (replacements: SimplifiedTaskSuggestion[]) => void;
}

function friendlySimplifyError(reason?: string): string {
  if (reason === 'network_error') return 'Could not reach the server. Check your connection and try again.';
  if (reason === 'input_too_short') return 'Add a bit more about what makes this hard, then try again.';
  if (reason === 'no_suggestions') return "Couldn't build smaller steps for this task. Try adding a bit more detail, then retry.";
  return "Couldn't simplify. Try again.";
}

function newRequestId(): string {
  return `simp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function SimplifyTaskModal({
  open, onClose, taskId, taskLabel, goalTitle, goalWhy, onConfirm,
}: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimplifyTaskResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedHowTo, setExpandedHowTo] = useState<Set<number>>(new Set());
  const requestSeq = useRef(0);
  const activeRequestId = useRef<string | null>(null);
  const openTaskIdRef = useRef(taskId);
  const openTaskLabelRef = useRef(taskLabel);

  const relevantGoal = goalTitle && isGoalRelevantToTask(taskLabel, goalTitle) ? goalTitle : undefined;
  const relevantGoalWhy = relevantGoal ? goalWhy : undefined;

  const resetSoft = () => {
    setLoading(false);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setExpandedHowTo(new Set());
    activeRequestId.current = null;
  };

  const resetFull = () => {
    setStep(0);
    setAnswers(['', '', '']);
    resetSoft();
  };

  useEffect(() => {
    if (!open) {
      requestSeq.current += 1;
      resetFull();
      return;
    }
    // New task open: wipe prior answers/results
    openTaskIdRef.current = taskId;
    openTaskLabelRef.current = taskLabel;
    requestSeq.current += 1;
    resetFull();
  }, [open, taskId, taskLabel]);

  const handleClose = () => {
    requestSeq.current += 1;
    resetFull();
    onClose();
  };

  const canNext = step === 0 ? answers[0].trim().length >= 3 : true;
  const isLastQuestion = step >= QUESTIONS.length - 1;

  const handleNext = async () => {
    if (!isLastQuestion) {
      setStep(s => s + 1);
      return;
    }
    const seq = ++requestSeq.current;
    const reqId = newRequestId();
    activeRequestId.current = reqId;
    const boundTaskId = taskId;
    const boundTaskLabel = taskLabel;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await simplifyTaskFromEdge({
        taskLabel: boundTaskLabel,
        taskId: boundTaskId,
        requestId: reqId,
        goalTitle: relevantGoal,
        goalWhy: relevantGoalWhy,
        blocker: answers[0] ?? '',
        motivation: answers[1] ?? '',
        constraint: answers[2] ?? '',
      });
      // Stale: different request, task, or modal closed/replaced
      if (
        seq !== requestSeq.current
        || openTaskIdRef.current !== boundTaskId
        || openTaskLabelRef.current !== boundTaskLabel
        || activeRequestId.current !== reqId
        || (res.requestId && res.requestId !== reqId)
        || (res.taskId && res.taskId !== boundTaskId)
      ) {
        return;
      }
      if (!res.ok || res.tasks.length === 0) {
        setError(friendlySimplifyError(res.reason));
        return;
      }
      const mergedAnswers = QUESTIONS.map((label, i) => {
        const fromServer = res.answers?.find(a => a.questionLabel === label)
          ?? res.answers?.[i];
        const localRaw = (answers[i] ?? '').trim();
        return {
          questionId: fromServer?.questionId ?? (['hard_part', 'what_would_help', 'constraints'] as const)[i],
          questionLabel: fromServer?.questionLabel ?? QUESTION_FALLBACK_LABELS[i],
          rawAnswer: localRaw || fromServer?.rawAnswer || '',
          usageStatus: fromServer?.usageStatus ?? (localRaw ? 'not_applicable' as const : 'empty' as const),
          influenceTypes: fromServer?.influenceTypes ?? [],
        };
      });
      setResult({ ...res, answers: mergedAnswers });
      setSelected(new Set(res.tasks.map((_, i) => i)));
      setStep(QUESTIONS.length);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    const picks = result.tasks.filter((_, i) => selected.has(i));
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

  const toggleHowTo = (idx: number) => {
    setExpandedHowTo(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const reviewing = step >= QUESTIONS.length && result;

  const displayAnswers = reviewing && result
    ? result.answers.filter(a => a.rawAnswer.trim().length > 0)
    : [];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={null}
      centered
      width="min(420px, calc(100vw - 24px))"
      destroyOnClose
      styles={ACCENT_MODAL_STYLES}
    >
      <ModalAccentBar gradient="linear-gradient(90deg, #7c3aed, #3da9fc)" />
      <div style={{ padding: '16px 24px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          Simplify for me
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.headline }}>
          {reviewing ? 'Pick simpler tasks' : QUESTIONS[step]}
        </h3>
        {!reviewing && (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
            Your answers help us break this exact task into smaller steps: <strong>{taskLabel}</strong>
            {relevantGoal && <> (related goal: {relevantGoal})</>}
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
              placeholder={step === 0 ? 'e.g. Too big, not sure where to start...' : 'Optional. Press Next to skip'}
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
                {isLastQuestion ? (error ? 'Retry' : 'Suggest simpler tasks') : 'Next'}
              </Button>
            </div>
          </>
        )}

        {reviewing && result && (
          <>
            <div style={{
              marginBottom: 12, padding: '10px 12px', borderRadius: 10,
              background: C.bgAlt, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.45, textTransform: 'uppercase', color: C.secondary, marginBottom: 4 }}>
                Simplifying this task
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.headline, overflowWrap: 'anywhere' }}>{taskLabel}</div>
              {relevantGoal && (
                <div style={{ fontSize: 11, color: C.body, marginTop: 4 }}>
                  Related goal: {relevantGoal}
                </div>
              )}
            </div>

            {/* Answer review — exact user text */}
            <div style={{
              marginBottom: 14, padding: '10px 12px', borderRadius: 10,
              background: '#f8f7fc', border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.45, textTransform: 'uppercase', color: C.secondary, marginBottom: 8 }}>
                Your answers
              </div>
              {displayAnswers.length === 0 ? (
                <div style={{ fontSize: 12, color: C.secondary }}>Not answered</div>
              ) : (
                displayAnswers.map((a, i) => (
                  <div key={a.questionId} style={{ marginBottom: i < displayAnswers.length - 1 ? 10 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.secondary, marginBottom: 2 }}>
                      {a.questionLabel}
                    </div>
                    <div style={{ fontSize: 13, color: C.headline, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {a.rawAnswer}
                    </div>
                  </div>
                ))
              )}
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 12, color: C.body }}>
              Choose the tiny actions that replace the original. Uncheck any you don&apos;t want.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {result.tasks.map((t, i) => (
                <div
                  key={`${result.requestId}-${i}`}
                  style={{
                    padding: '10px 12px', borderRadius: 12,
                    background: selected.has(i) ? `${C.primary}10` : C.bgAlt,
                    border: `1.5px solid ${selected.has(i) ? C.primary : C.border}`,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => togglePick(i)}
                      style={{ width: 16, height: 16, marginTop: 2 }}
                    />
                    <span style={{ flex: 1, fontSize: 13, color: C.headline, fontWeight: 600 }}>{t.label}</span>
                    <span style={{ fontSize: 10, color: C.secondary }}>{t.timeOfDay === 'morning' ? '☀️' : '🌙'}</span>
                  </label>
                  {(t.howTo?.length || t.resourceLink?.url) && (
                    <div style={{ marginLeft: 26, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => toggleHowTo(i)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          fontSize: 11, fontWeight: 700, color: C.primary,
                        }}
                      >
                        {expandedHowTo.has(i) ? 'Hide how to get this done' : 'How to get this done'}
                      </button>
                      {expandedHowTo.has(i) && (
                        <div style={{ marginTop: 6 }}>
                          {t.resourceLink?.url && (
                            <a
                              href={t.resourceLink.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, fontWeight: 700, color: C.primary, display: 'block', marginBottom: 4 }}
                            >
                              {t.resourceLink.label || 'Open guide'}
                            </a>
                          )}
                          {t.howTo && t.howTo.length > 0 && (
                            <ol style={{ margin: 0, paddingLeft: 18 }}>
                              {t.howTo.map((s, si) => (
                                <li key={si} style={{ fontSize: 11, color: C.body, lineHeight: 1.4 }}>{s}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                block
                onClick={() => {
                  setStep(QUESTIONS.length - 1);
                  setResult(null);
                  setExpandedHowTo(new Set());
                  activeRequestId.current = null;
                }}
                style={{ borderRadius: 12, height: 46 }}
              >
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
