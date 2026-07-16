import { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button } from 'antd';
import { C } from '../data/colors';
import {
  simplifyTaskFromEdge,
  simplifyDetailAssistFromEdge,
  isGoalRelevantToTask,
  type SimplifyTaskResult,
  type SimplifiedTaskSuggestion,
  type DetailAssistResult,
  type DetailSuggestion,
} from '../data/aiTaskCreation';
import {
  evaluateAnswerSufficiency,
  mergeAnswerWithAddition,
  questionIdForStep,
  type SimplifyQuestionId,
} from '../data/simplifyDetailAssist';
import { trackEvent } from '../data/deviceAnalytics';
import { classifyTaskComplexity } from '../data/simplifyTaskCore';
import { ACCENT_MODAL_STYLES, ModalAccentBar } from '../styles/modalChrome';

const { TextArea } = Input;

/** Question prompts (form) - display labels for review use SIMPLIFY_QUESTION_META semantics. */
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
  profileId?: string;
  onConfirm: (replacements: SimplifiedTaskSuggestion[]) => void;
}

function friendlySimplifyError(reason?: string): string {
  if (reason === 'network_error') return 'Could not reach the server. Check your connection and try again.';
  if (reason === 'input_too_short') return 'Add a bit more about what makes this hard, then try again.';
  if (reason === 'no_suggestions') return "Couldn't build smaller steps for this task. Try adding a bit more detail, then retry.";
  return "Couldn't simplify. Try again.";
}

function newRequestId(prefix = 'simp'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function SimplifyTaskModal({
  open, onClose, taskId, taskLabel, goalTitle, goalWhy, profileId, onConfirm,
}: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimplifyTaskResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedHowTo, setExpandedHowTo] = useState<Set<number>>(new Set());

  // Detail-assist state
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailAssist, setDetailAssist] = useState<DetailAssistResult | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [baseAnswerBeforeAssist, setBaseAnswerBeforeAssist] = useState<string>('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  /** Questions accepted via a prevalidated system suggestion - skip re-assist. */
  const acceptedViaSuggestion = useRef<Set<SimplifyQuestionId>>(new Set());
  /** Questions that already showed assist once (custom text still validates). */
  const assistShownFor = useRef<Set<SimplifyQuestionId>>(new Set());
  const answerVersion = useRef(0);
  const detailRequestSeq = useRef(0);
  const activeDetailRequestId = useRef<string | null>(null);

  const requestSeq = useRef(0);
  const activeRequestId = useRef<string | null>(null);
  const openTaskIdRef = useRef(taskId);
  const openTaskLabelRef = useRef(taskLabel);

  const relevantGoal = goalTitle && isGoalRelevantToTask(taskLabel, goalTitle) ? goalTitle : undefined;
  const relevantGoalWhy = relevantGoal ? goalWhy : undefined;
  const analyticsId = profileId || 'anon';

  const clearDetailAssist = () => {
    setDetailLoading(false);
    setDetailError(null);
    setDetailAssist(null);
    setSelectedSuggestionId(null);
    setBaseAnswerBeforeAssist('');
    activeDetailRequestId.current = null;
  };

  const resetSoft = () => {
    setLoading(false);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setExpandedHowTo(new Set());
    activeRequestId.current = null;
    clearDetailAssist();
  };

  const resetFull = () => {
    setStep(0);
    setAnswers(['', '', '']);
    setRefreshNonce(0);
    acceptedViaSuggestion.current = new Set();
    assistShownFor.current = new Set();
    answerVersion.current = 0;
    detailRequestSeq.current += 1;
    resetSoft();
  };

  useEffect(() => {
    if (!open) {
      requestSeq.current += 1;
      detailRequestSeq.current += 1;
      resetFull();
      return;
    }
    openTaskIdRef.current = taskId;
    openTaskLabelRef.current = taskLabel;
    requestSeq.current += 1;
    detailRequestSeq.current += 1;
    resetFull();
  }, [open, taskId, taskLabel]);

  const handleClose = () => {
    requestSeq.current += 1;
    detailRequestSeq.current += 1;
    resetFull();
    onClose();
  };

  const updateAnswer = (value: string) => {
    answerVersion.current += 1;
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
    // Editing after a selection clears the chip selection but keeps base for re-merge.
    if (selectedSuggestionId) {
      setSelectedSuggestionId(null);
    }
  };

  const loadDetailAssist = async (opts?: { refresh?: boolean }) => {
    const qId = questionIdForStep(step);
    const current = (answers[step] ?? '').trim();
    const seq = ++detailRequestSeq.current;
    const reqId = newRequestId('det');
    const boundTaskId = taskId;
    const boundTaskLabel = taskLabel;
    const boundAnswerVersion = answerVersion.current;
    const boundStep = step;
    activeDetailRequestId.current = reqId;
    setDetailLoading(true);
    setDetailError(null);
    if (!opts?.refresh) {
      setDetailAssist(null);
      setSelectedSuggestionId(null);
      setBaseAnswerBeforeAssist(current);
    }
    const nonce = opts?.refresh ? refreshNonce + 1 : refreshNonce;
    if (opts?.refresh) setRefreshNonce(nonce);

    trackEvent(analyticsId, opts?.refresh ? 'simplify_detail_suggestions_refreshed' : 'simplify_detail_assist_shown', {
      questionId: qId,
      taskComplexity: classifyTaskComplexity(taskLabel),
      attempt: assistShownFor.current.has(qId) ? 2 : 1,
    });

    try {
      const res = await simplifyDetailAssistFromEdge({
        taskLabel: boundTaskLabel,
        taskId: boundTaskId,
        requestId: reqId,
        questionId: qId,
        currentAnswer: current,
        refreshNonce: nonce,
      });

      // Stale guard
      if (
        seq !== detailRequestSeq.current
        || openTaskIdRef.current !== boundTaskId
        || openTaskLabelRef.current !== boundTaskLabel
        || activeDetailRequestId.current !== reqId
        || answerVersion.current !== boundAnswerVersion
        || step !== boundStep
        || (res.requestId && res.requestId !== reqId)
        || (res.taskId && res.taskId !== boundTaskId)
        || res.questionId !== qId
      ) {
        return;
      }

      if (res.status === 'sufficient') {
        clearDetailAssist();
        trackEvent(analyticsId, 'simplify_detail_validation_passed', { questionId: qId });
        return;
      }

      assistShownFor.current.add(qId);
      setDetailAssist(res);
      if (!res.suggestions.length) {
        setDetailError('We couldn’t create suggestions right now. You can add one more detail in your own words.');
        trackEvent(analyticsId, 'simplify_detail_assist_failed', {
          questionId: qId,
          suggestionCount: 0,
          generationSource: res.source,
        });
      } else {
        trackEvent(analyticsId, 'simplify_detail_suggestions_loaded', {
          questionId: qId,
          suggestionCount: res.suggestions.length,
          generationSource: res.source,
        });
      }
    } catch {
      if (seq === detailRequestSeq.current) {
        setDetailError('We couldn’t create suggestions right now. You can add one more detail in your own words.');
        trackEvent(analyticsId, 'simplify_detail_assist_failed', { questionId: qId });
      }
    } finally {
      if (seq === detailRequestSeq.current) setDetailLoading(false);
    }
  };

  const selectSuggestion = (s: DetailSuggestion) => {
    const qId = questionIdForStep(step);
    const base = baseAnswerBeforeAssist || (answers[step] ?? '');
    const combined = s.validatedCombinedAnswer || mergeAnswerWithAddition(base, s.appendText);
    const check = evaluateAnswerSufficiency(qId, combined, taskLabel);
    if (check.status !== 'sufficient') {
      // Prevalidated mismatch - do not block; accept enriched answer.
      trackEvent(analyticsId, 'simplify_detail_validation_mismatch', { questionId: qId });
    } else {
      trackEvent(analyticsId, 'simplify_detail_validation_passed', { questionId: qId });
    }
    answerVersion.current += 1;
    const next = [...answers];
    next[step] = combined;
    setAnswers(next);
    setSelectedSuggestionId(s.id);
    acceptedViaSuggestion.current.add(qId);
    trackEvent(analyticsId, 'simplify_detail_suggestion_selected', {
      questionId: qId,
      suggestionCount: detailAssist?.suggestions.length ?? 0,
      generationSource: detailAssist?.source ?? 'server_rules',
    });
  };

  const deselectSuggestion = () => {
    if (!selectedSuggestionId) return;
    answerVersion.current += 1;
    const next = [...answers];
    next[step] = baseAnswerBeforeAssist;
    setAnswers(next);
    setSelectedSuggestionId(null);
    acceptedViaSuggestion.current.delete(questionIdForStep(step));
  };

  const canNext = step === 0 ? answers[0].trim().length >= 3 : true;
  const isLastQuestion = step >= QUESTIONS.length - 1;

  const advanceOrSubmit = async () => {
    if (!isLastQuestion) {
      clearDetailAssist();
      setStep(s => s + 1);
      return;
    }
    const seq = ++requestSeq.current;
    const reqId = newRequestId('simp');
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
      clearDetailAssist();
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const handleNext = async () => {
    const qId = questionIdForStep(step);
    const current = (answers[step] ?? '').trim();

    // Optional blank → skip without assist
    if (step > 0 && !current) {
      await advanceOrSubmit();
      return;
    }

    // System suggestion already accepted for this question → one cycle done
    if (acceptedViaSuggestion.current.has(qId)) {
      await advanceOrSubmit();
      return;
    }

    const evaluation = evaluateAnswerSufficiency(qId, current, taskLabel);

    if (evaluation.status === 'sufficient') {
      if (assistShownFor.current.has(qId) && !selectedSuggestionId) {
        trackEvent(analyticsId, 'simplify_detail_custom_text_used', { questionId: qId });
      }
      await advanceOrSubmit();
      return;
    }

    if (evaluation.status === 'irrelevant') {
      setDetailError('That answer does not seem related to this task. Add a detail about this task, or pick a suggestion.');
      if (!assistShownFor.current.has(qId) || !detailAssist) {
        await loadDetailAssist();
      }
      return;
    }

    // needs_detail
    if (detailAssist && selectedSuggestionId) {
      // Should already be marked accepted; safety continue
      acceptedViaSuggestion.current.add(qId);
      await advanceOrSubmit();
      return;
    }

    if (detailAssist && assistShownFor.current.has(qId)) {
      // Assist already visible - keep helping, do not generic-block
      setDetailError(null);
      return;
    }

    await loadDetailAssist();
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

  const showAssistPanel = !reviewing && (detailLoading || !!detailAssist || !!detailError);

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
      <div style={{ padding: '16px 24px 24px', maxHeight: 'min(80vh, 720px)', overflowY: 'auto' }}>
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
              onChange={e => updateAnswer(e.target.value)}
              placeholder={step === 0 ? 'e.g. Too big, not sure where to start...' : 'Optional. Press Next to skip'}
              rows={4}
              style={{ marginBottom: 12, borderRadius: 12 }}
              autoFocus
            />
            <div style={{ fontSize: 11, color: C.secondary, marginBottom: showAssistPanel ? 10 : 14 }}>
              Question {step + 1} of {QUESTIONS.length}
              {step > 0 && ' · optional'}
            </div>

            {showAssistPanel && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '12px 12px',
                  borderRadius: 12,
                  background: '#f8f7fc',
                  border: `1px solid ${C.border}`,
                }}
                data-testid="simplify-detail-assist"
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.headline, marginBottom: 4 }}>
                  A little more detail will help us personalize this.
                </div>
                <div style={{ fontSize: 12, color: C.body, marginBottom: 10 }}>
                  Choose one that fits, or add your own.
                </div>

                {detailLoading && (
                  <div style={{ fontSize: 12, color: C.secondary, marginBottom: 8 }}>
                    Finding a few details that may fit…
                  </div>
                )}

                {detailError && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#c0392b' }}>{detailError}</p>
                )}

                {detailAssist && detailAssist.suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {detailAssist.suggestions.map(s => {
                      const active = selectedSuggestionId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => (active ? deselectSuggestion() : selectSuggestion(s))}
                          style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: `1.5px solid ${active ? '#7c3aed' : C.border}`,
                            background: active ? '#7c3aed12' : '#fff',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: C.headline,
                            lineHeight: 1.4,
                            minHeight: 44,
                          }}
                        >
                          {s.appendText}
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => loadDetailAssist({ refresh: true })}
                  disabled={detailLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: detailLoading ? 'default' : 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.primary,
                  }}
                >
                  Show different suggestions
                </button>
              </div>
            )}

            {error && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#c0392b' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && (
                <Button
                  block
                  onClick={() => {
                    clearDetailAssist();
                    setStep(s => s - 1);
                  }}
                  style={{ borderRadius: 12, height: 46 }}
                >
                  Back
                </Button>
              )}
              <Button
                block
                type="primary"
                loading={loading || detailLoading}
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
