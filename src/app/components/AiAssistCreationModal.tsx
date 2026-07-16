import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Input, Button, message } from 'antd';
import { C } from '../data/colors';
import { ACCENT_MODAL_STYLES, ModalAccentBar } from '../styles/modalChrome';
import type { PersonalGoal } from '../data/personalGoals';
import { getUserTasks } from '../data/userTasks';
import {
  newAiAssistId,
  type AiAssistCreationType,
  type AiAssistEntryPage,
  type AiAssistGenerationSource,
  type AiAssistSaveResult,
  type AiAssistSession,
  type CandidateDraft,
  type GoalStarterTaskDraft,
  type SelectedGoalDraft,
  type SelectedTaskDraft,
  type TaskCandidate,
} from '../data/aiAssistCreationTypes';
import {
  acceptGeneration,
  bumpRequest,
  createAiAssistSession,
  invalidateInFlight,
  priorTitles,
  resetHistoryForDumpChange,
  resetHistoryForTypeChange,
  setStep,
} from '../data/aiAssistSession';
import { generateAssistCandidates, generateAssistStarters } from '../data/aiAssistGenerate';
import { persistAiAssistGoal, persistAiAssistTask } from '../data/aiAssistPersist';
import {
  defaultPotentialValue,
  normalizePotentialValue,
  type PotentialValueScore,
} from '../data/potentialValue';
import { trackEvent } from '../data/deviceAnalytics';
import { ManageGoalModal } from './ManageGoalModal';
import { ManageTaskModal, AI_NEW_GOAL_OPTION, type TaskDraftValues } from './ManageTaskModal';

interface Props {
  open: boolean;
  onClose: () => void;
  profileId: string;
  entryPage: AiAssistEntryPage;
  goals: PersonalGoal[];
  /** Called after a successful (or partial) save so parents can refresh lists. */
  onSaved: (result: AiAssistSaveResult) => void;
}

function textLengthBucket(n: number): string {
  if (n < 50) return '0-49';
  if (n < 150) return '50-149';
  if (n < 400) return '150-399';
  return '400+';
}

function sourceLabel(source: AiAssistGenerationSource | undefined): string {
  if (source === 'llm') return 'AI suggestions';
  if (source === 'server_rules') return 'Suggested outlines';
  return 'Offline suggestions';
}

function confirmIfDirty(dirty: boolean, action: string): boolean {
  if (!dirty) return true;
  return window.confirm(`You have unsaved edits. ${action}?`);
}

export function AiAssistCreationModal({
  open, onClose, profileId, entryPage, goals, onSaved,
}: Props) {
  const [session, setSession] = useState<AiAssistSession>(() => createAiAssistSession(entryPage));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<AiAssistGenerationSource | null>(null);
  const [saveResult, setSaveResult] = useState<AiAssistSaveResult | null>(null);
  const [editingStarterId, setEditingStarterId] = useState<string | null>(null);
  const [starterEditLabel, setStarterEditLabel] = useState('');
  const openRef = useRef(open);
  const sessionRef = useRef(session);
  openRef.current = open;
  sessionRef.current = session;

  // Reset session whenever the modal opens
  useEffect(() => {
    if (open) {
      const s = createAiAssistSession(entryPage);
      setSession(s);
      setLoading(false);
      setError(null);
      setLastSource(null);
      setSaveResult(null);
      setEditingStarterId(null);
      trackEvent(profileId, 'ai_assist_opened', {
        entryPage,
        defaultCreationType: s.creationType,
      });
    } else {
      setSession(s => invalidateInFlight(s));
    }
  }, [open, entryPage, profileId]);

  const closeWithGuard = useCallback(() => {
    const s = sessionRef.current;
    const hasProgress = !!(s.candidates?.length || s.goalDraft || s.taskDraft || s.dirty);
    if (hasProgress && !confirmIfDirty(true, 'Close AI Assist and discard this draft')) return;
    if (hasProgress) {
      trackEvent(profileId, 'ai_assist_abandoned', { step: s.step });
    }
    setSession(invalidateInFlight(s));
    onClose();
  }, [onClose, profileId]);

  const setCreationType = (next: AiAssistCreationType) => {
    if (next === session.creationType) return;
    const hasWork = !!(session.candidates?.length || session.goalDraft || session.taskDraft || session.dirty);
    if (hasWork && !confirmIfDirty(true, 'Switch type and clear generated candidates')) return;
    setSession(resetHistoryForTypeChange(session, next));
    setError(null);
    setLastSource(null);
    trackEvent(profileId, 'ai_assist_type_selected', { creationType: next });
  };

  const onDumpChange = (text: string) => {
    if (session.candidates?.length || session.history.length) {
      setSession(resetHistoryForDumpChange(session, text));
      setLastSource(null);
    } else {
      setSession({
        ...session,
        brainDump: { text, updatedAt: Date.now() },
        dirty: text.trim().length > 0,
      });
    }
  };

  const runGenerate = async (isRegen: boolean) => {
    const text = session.brainDump.text.trim();
    if (text.length < 8) {
      setError('Add a bit more detail (at least a short sentence) before generating.');
      return;
    }
    if (session.dirty && session.goalDraft && !confirmIfDirty(true, 'Regenerate and discard draft edits')) {
      return;
    }

    const requestId = newAiAssistId('aireq');
    const attempt = session.history.length + 1;
    const bumped = bumpRequest(session, requestId);
    sessionRef.current = bumped;
    setSession(bumped);
    setLoading(true);
    setError(null);
    trackEvent(profileId, isRegen ? 'ai_assist_regenerate' : 'ai_assist_generate_submitted', {
      creationType: session.creationType,
      textLengthBucket: textLengthBucket(text.length),
      attempt,
      priorSetCount: session.history.length,
    });

    const existingGoals = goals.map(g => g.title);
    const existingTaskLabels = getUserTasks(profileId).map(t => t.label).slice(0, 40);

    const res = await generateAssistCandidates({
      requestId,
      sessionId: bumped.sessionId,
      creationType: bumped.creationType,
      text,
      priorCandidateTitles: priorTitles(bumped),
      context: { existingGoalTitles: existingGoals, existingTaskLabels },
    });

    if (!openRef.current) return;
    const current = sessionRef.current;
    if (current.activeRequestId !== requestId) return;
    if (current.sessionId !== session.sessionId) return;
    if (res.requestId && res.requestId !== requestId) return;

    setLoading(false);

    if (!res.ok || res.candidates.length < 2) {
      setError(
        res.reason === 'rate_limited'
          ? 'Too many requests - try again in a bit, or use the offline suggestions below.'
          : res.reason === 'input_too_short'
            ? 'Add a bit more detail before generating.'
            : 'Could not build candidates. Showing offline suggestions if available.',
      );
      trackEvent(profileId, 'ai_assist_generate_failed', {
        reason: res.reason ?? 'no_candidates',
        creationType: session.creationType,
      });
      if (res.candidates.length >= 2) {
        const accepted = acceptGeneration(current, {
          requestId,
          creationType: res.creationType,
          source: res.source,
          candidates: res.candidates,
        });
        if (accepted) {
          setSession(accepted);
          setLastSource(res.source);
        }
      } else {
        setSession({ ...current, activeRequestId: null });
      }
      return;
    }

    const accepted = acceptGeneration(current, {
      requestId,
      creationType: res.creationType,
      source: res.source,
      candidates: res.candidates,
    });
    if (!accepted) return;
    setSession(accepted);
    setLastSource(res.source);
    trackEvent(profileId, 'ai_assist_generate_succeeded', {
      source: res.source,
      candidateCount: res.candidates.length,
      creationType: res.creationType,
      requestSeq: accepted.requestSeq,
    });
  };

  const selectCandidate = (c: CandidateDraft) => {
    const idx = session.candidates?.findIndex(x => x.id === c.id) ?? -1;
    trackEvent(profileId, 'ai_assist_candidate_selected', {
      creationType: session.creationType,
      candidateIndex: idx,
    });

    if (c.type === 'goal') {
      const draft: SelectedGoalDraft = {
        title: c.title,
        deepWhy: c.suggestedFields?.deepWhy ?? c.description ?? '',
        starterMode: 'goal_only',
        starterTasks: [],
        clientKey: newAiAssistId('goalkey'),
      };
      setSession({
        ...session,
        selectedCandidateId: c.id,
        goalDraft: draft,
        dirty: true,
        step: 'edit_goal',
      });
    } else {
      const tc = c as TaskCandidate;
      const score = tc.suggestedFields?.potentialValueScore as PotentialValueScore | undefined;
      const draft: SelectedTaskDraft = {
        label: c.title,
        description: tc.suggestedFields?.description ?? c.description,
        timeOfDay: tc.suggestedFields?.timeOfDay ?? 'morning',
        potentialValue: score
          ? normalizePotentialValue({
              ...defaultPotentialValue('manual'),
              score,
              updatedAt: Date.now(),
            }) ?? defaultPotentialValue('manual')
          : defaultPotentialValue('manual'),
        recurrence: tc.suggestedFields?.recurrence,
        goalRelationship: tc.suggestedFields?.recommendedGoalId
          ? { kind: 'existing', goalId: tc.suggestedFields.recommendedGoalId }
          : { kind: 'none' },
        clientKey: newAiAssistId('taskkey'),
      };
      setSession({
        ...session,
        selectedCandidateId: c.id,
        taskDraft: draft,
        dirty: true,
        step: 'edit_task',
      });
      if (draft.goalRelationship.kind === 'existing') {
        trackEvent(profileId, 'ai_assist_goal_relationship', { relationship: 'existing' });
      }
    }
  };

  const taskDraftToForm = (d: SelectedTaskDraft): TaskDraftValues => ({
    label: d.label,
    description: d.description,
    timeOfDay: d.timeOfDay,
    potentialValue: d.potentialValue,
    recurrence: d.recurrence,
    goalId: d.goalRelationship.kind === 'existing'
      ? d.goalRelationship.goalId
      : d.goalRelationship.kind === 'new'
        ? AI_NEW_GOAL_OPTION
        : undefined,
  });

  const pendingNewGoal =
    session.taskDraft?.goalRelationship.kind === 'new'
      ? session.taskDraft.goalRelationship.goalDraft
      : null;

  const handleTaskEditorSave = (data: {
    label: string;
    description?: string;
    timeOfDay: 'morning' | 'evening';
    goalId?: string;
    potentialValue?: SelectedTaskDraft['potentialValue'];
    recurrence?: SelectedTaskDraft['recurrence'];
    pendingNewGoal?: boolean;
  }) => {
    const current = sessionRef.current;
    if (!current.taskDraft) return;
    const pending =
      current.taskDraft.goalRelationship.kind === 'new'
        ? current.taskDraft.goalRelationship.goalDraft
        : null;
    let goalRelationship: SelectedTaskDraft['goalRelationship'] = { kind: 'none' };
    if (data.pendingNewGoal && pending) {
      goalRelationship = current.taskDraft.goalRelationship.kind === 'new'
        ? current.taskDraft.goalRelationship
        : {
            kind: 'new',
            goalDraft: pending,
            clientKey: newAiAssistId('newgoalkey'),
          };
      trackEvent(profileId, 'ai_assist_goal_relationship', { relationship: 'new' });
    } else if (data.goalId && data.goalId !== AI_NEW_GOAL_OPTION) {
      goalRelationship = { kind: 'existing', goalId: data.goalId };
      trackEvent(profileId, 'ai_assist_goal_relationship', { relationship: 'existing' });
    } else {
      trackEvent(profileId, 'ai_assist_goal_relationship', { relationship: 'none' });
    }

    const next: SelectedTaskDraft = {
      ...current.taskDraft,
      label: data.label,
      description: data.description,
      timeOfDay: data.timeOfDay,
      potentialValue: data.potentialValue,
      recurrence: data.recurrence,
      goalRelationship,
    };
    trackEvent(profileId, 'ai_assist_draft_edited', { creationType: 'task' });
    const updated = { ...current, taskDraft: next, dirty: true, step: 'final_review' as const };
    sessionRef.current = updated;
    setSession(updated);
  };

  const handleGoalEditorSave = (data: { title: string; deepWhy: string }) => {
    const current = sessionRef.current;
    if (current.step === 'edit_new_goal_for_task') {
      const goalDraft = { title: data.title, deepWhy: data.deepWhy };
      const taskDraft: SelectedTaskDraft = current.taskDraft ?? {
        label: '',
        timeOfDay: 'morning',
        goalRelationship: { kind: 'none' },
        clientKey: newAiAssistId('taskkey'),
      };
      const updated = {
        ...current,
        taskDraft: {
          ...taskDraft,
          goalRelationship: {
            kind: 'new' as const,
            goalDraft,
            clientKey: newAiAssistId('newgoalkey'),
          },
        },
        dirty: true,
        step: 'edit_task' as const,
      };
      sessionRef.current = updated;
      setSession(updated);
      trackEvent(profileId, 'ai_assist_goal_relationship', { relationship: 'new' });
      trackEvent(profileId, 'ai_assist_draft_edited', { creationType: 'goal' });
      return;
    }

    const draft: SelectedGoalDraft = {
      title: data.title,
      deepWhy: data.deepWhy,
      starterMode: current.goalDraft?.starterMode ?? 'goal_only',
      starterTasks: current.goalDraft?.starterTasks ?? [],
      clientKey: current.goalDraft?.clientKey ?? newAiAssistId('goalkey'),
    };
    trackEvent(profileId, 'ai_assist_draft_edited', { creationType: 'goal' });
    const updated = { ...current, goalDraft: draft, dirty: true, step: 'starter_choice' as const };
    sessionRef.current = updated;
    setSession(updated);
  };

  const chooseStarterMode = async (mode: 'goal_only' | 'goal_with_tasks') => {
    if (!session.goalDraft) return;
    trackEvent(profileId, 'ai_assist_goal_mode', { mode });
    if (mode === 'goal_only') {
      setSession({
        ...session,
        goalDraft: { ...session.goalDraft, starterMode: 'goal_only', starterTasks: [] },
        step: 'final_review',
      });
      return;
    }

    const requestId = newAiAssistId('aireq');
    const bumped = bumpRequest({
      ...session,
      goalDraft: { ...session.goalDraft, starterMode: 'goal_with_tasks' },
    }, requestId);
    sessionRef.current = bumped;
    setSession(bumped);
    setLoading(true);
    setError(null);

    const res = await generateAssistStarters({
      requestId,
      sessionId: bumped.sessionId,
      text: bumped.brainDump.text,
      goalTitle: bumped.goalDraft!.title,
      goalDeepWhy: bumped.goalDraft!.deepWhy,
      priorStarterTitles: bumped.goalDraft!.starterTasks.map(t => t.label),
    });

    if (!openRef.current) return;
    const current = sessionRef.current;
    if (current.activeRequestId !== requestId) return;
    setLoading(false);

    const tasks: GoalStarterTaskDraft[] = (res.tasks ?? []).map(t => ({
      ...t,
      selected: t.selected !== false,
      clientKey: t.clientKey || newAiAssistId('starterkey'),
    }));
    trackEvent(profileId, 'ai_assist_starters_generated', {
      count: tasks.length,
      source: res.source,
    });
    setSession({
      ...current,
      activeRequestId: null,
      goalDraft: current.goalDraft
        ? { ...current.goalDraft, starterMode: 'goal_with_tasks', starterTasks: tasks }
        : null,
      step: 'starter_review',
      dirty: true,
    });
  };

  const toggleStarter = (id: string) => {
    if (!session.goalDraft) return;
    setSession({
      ...session,
      goalDraft: {
        ...session.goalDraft,
        starterTasks: session.goalDraft.starterTasks.map(t =>
          t.id === id ? { ...t, selected: !t.selected } : t,
        ),
      },
      dirty: true,
    });
  };

  const removeStarter = (id: string) => {
    if (!session.goalDraft) return;
    setSession({
      ...session,
      goalDraft: {
        ...session.goalDraft,
        starterTasks: session.goalDraft.starterTasks.filter(t => t.id !== id),
      },
      dirty: true,
    });
  };

  const commitStarterEdit = () => {
    if (!session.goalDraft || !editingStarterId) return;
    const label = starterEditLabel.trim();
    if (!label) return;
    setSession({
      ...session,
      goalDraft: {
        ...session.goalDraft,
        starterTasks: session.goalDraft.starterTasks.map(t =>
          t.id === editingStarterId ? { ...t, label } : t,
        ),
      },
      dirty: true,
    });
    setEditingStarterId(null);
  };

  const runPersist = (retryFailedOnly = false) => {
    const started = Date.now();
    const creationType = session.creationType;
    trackEvent(profileId, 'ai_assist_save_attempted', {
      creationType,
      withStarters: creationType === 'goal'
        && session.goalDraft?.starterMode === 'goal_with_tasks'
        && (session.goalDraft.starterTasks.some(t => t.selected) ?? false),
    });

    let result: AiAssistSaveResult;
    let nextSession = session;

    if (creationType === 'task' && session.taskDraft) {
      const out = persistAiAssistTask(profileId, session, session.taskDraft);
      result = out.result;
      nextSession = out.session;
    } else if (creationType === 'goal' && session.goalDraft) {
      const onlyKeys = retryFailedOnly && saveResult?.failed.length
        ? saveResult.failed.filter(f => f.role === 'task').map(f => f.clientKey)
        : undefined;
      const out = persistAiAssistGoal(profileId, session, session.goalDraft, onlyKeys);
      result = out.result;
      nextSession = out.session;
    } else {
      message.error('Nothing to save yet.');
      return;
    }

    setSession(nextSession);
    setSaveResult(result);
    onSaved(result);

    if (result.ok) {
      trackEvent(profileId, 'ai_assist_save_succeeded', {
        createdGoalCount: result.createdGoalIds.length,
        createdTaskCount: result.createdTaskIds.length,
        durationMs: Date.now() - started,
      });
      message.success(
        creationType === 'goal'
          ? `Saved ${result.createdGoalIds.length} goal${result.createdTaskIds.length ? ` and ${result.createdTaskIds.length} task(s)` : ''}.`
          : `Saved task${result.createdGoalIds.length ? ' and new goal' : ''}.`,
      );
      onClose();
    } else if (result.partial) {
      trackEvent(profileId, 'ai_assist_save_partial', {
        createdGoalCount: result.createdGoalIds.length,
        createdTaskCount: result.createdTaskIds.length,
        failedCount: result.failed.length,
      });
      message.warning('Partially saved - some items failed. You can retry without duplicating successes.');
      setSession(setStep(nextSession, 'final_review', true));
    } else {
      trackEvent(profileId, 'ai_assist_save_failed', {
        failedCount: result.failed.length,
        creationType,
      });
      message.error('Save failed. Nothing new was created - try again.');
    }
  };

  const showAssistShell = open && (
    session.step === 'capture'
    || session.step === 'candidates'
    || session.step === 'starter_choice'
    || session.step === 'starter_review'
    || session.step === 'final_review'
  );

  const candidates = session.candidates ?? [];

  return (
    <>
      <Modal
        open={showAssistShell}
        onCancel={closeWithGuard}
        footer={null}
        centered
        title={null}
        width="min(440px, calc(100vw - 24px))"
        destroyOnClose
        styles={ACCENT_MODAL_STYLES}
        aria-labelledby="ai-assist-title"
      >
        <ModalAccentBar gradient={`linear-gradient(90deg, ${C.primary}, #3da9fc)`} />
        <div style={{ padding: '16px 20px 22px', maxHeight: 'min(78dvh, 640px)', overflowY: 'auto' }}>
          <h3 id="ai-assist-title" style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.headline }}>
            Create with AI
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.secondary, lineHeight: 1.45 }}>
            Brain dump → pick a candidate → edit in the normal form → save only when you confirm.
          </p>

          {/* Type toggle */}
          {(session.step === 'capture' || session.step === 'candidates') && (
            <div
              role="group"
              aria-label="What are you creating?"
              style={{ display: 'flex', gap: 8, marginBottom: 14 }}
            >
              {(['goal', 'task'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={session.creationType === t}
                  onClick={() => setCreationType(t)}
                  style={{
                    flex: 1, minHeight: 44, borderRadius: 12, fontWeight: 700, fontSize: 13,
                    border: `1.5px solid ${session.creationType === t ? C.primary : C.border}`,
                    background: session.creationType === t ? `${C.primary}12` : C.bgAlt,
                    color: session.creationType === t ? C.primary : C.secondary,
                    cursor: 'pointer',
                  }}
                >
                  {t === 'goal' ? 'Goal' : 'Task'}
                </button>
              ))}
            </div>
          )}

          {session.step === 'capture' && (
            <>
              <label htmlFor="ai-assist-dump" style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
                Brain dump
              </label>
              <Input.TextArea
                id="ai-assist-dump"
                value={session.brainDump.text}
                onChange={e => onDumpChange(e.target.value)}
                placeholder={
                  session.creationType === 'goal'
                    ? 'e.g. I want to feel healthier after work without wrecking family evenings…'
                    : 'e.g. I need to call the insurance company about the denied claim…'
                }
                rows={5}
                style={{ borderRadius: 12, marginBottom: 10 }}
                aria-describedby={error ? 'ai-assist-error' : undefined}
              />
              {error && (
                <div id="ai-assist-error" role="alert" style={{ color: C.tertiary, fontSize: 12, marginBottom: 10 }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <Button block onClick={closeWithGuard} style={{ borderRadius: 12, height: 46 }}>
                  Close
                </Button>
                <Button
                  block
                  type="primary"
                  loading={loading}
                  disabled={session.brainDump.text.trim().length < 8}
                  onClick={() => void runGenerate(false)}
                  style={{
                    borderRadius: 12, height: 46, flex: 2, fontWeight: 700, border: 'none',
                    background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
                  }}
                >
                  Generate
                </Button>
              </div>
            </>
          )}

          {session.step === 'candidates' && (
            <>
              <div
                aria-live="polite"
                style={{ fontSize: 12, color: C.secondary, marginBottom: 10 }}
              >
                {loading
                  ? 'Generating alternatives…'
                  : `${candidates.length} ${session.creationType} ideas · ${sourceLabel(lastSource ?? undefined)}`}
              </div>
              {error && (
                <div role="alert" style={{ color: C.tertiary, fontSize: 12, marginBottom: 10 }}>{error}</div>
              )}
              <div
                role="listbox"
                aria-label={`${session.creationType} candidates`}
                style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, opacity: loading ? 0.65 : 1 }}
              >
                {candidates.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={session.selectedCandidateId === c.id}
                    aria-label={`${c.type} candidate ${i + 1}: ${c.title}`}
                    disabled={loading}
                    onClick={() => selectCandidate(c)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', cursor: loading ? 'wait' : 'pointer',
                      padding: '14px 14px', borderRadius: 14, minHeight: 56,
                      border: `1.5px solid ${C.border}`, background: C.bgCard,
                      boxShadow: C.shadow,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 4, textTransform: 'uppercase' }}>
                      {c.type}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.headline, lineHeight: 1.35 }}>{c.title}</div>
                    {(c.description || c.previewReason) && (
                      <div style={{ fontSize: 12, color: C.secondary, marginTop: 6, lineHeight: 1.4 }}>
                        {c.previewReason || c.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  onClick={() => setSession(setStep(session, 'capture'))}
                  style={{ borderRadius: 12, height: 44, flex: 1 }}
                >
                  Back
                </Button>
                <Button
                  loading={loading}
                  onClick={() => void runGenerate(true)}
                  style={{ borderRadius: 12, height: 44, flex: 1 }}
                >
                  Regenerate
                </Button>
                <Button onClick={closeWithGuard} style={{ borderRadius: 12, height: 44 }}>
                  Close
                </Button>
              </div>
            </>
          )}

          {session.step === 'starter_choice' && session.goalDraft && (
            <>
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: C.bgAlt, border: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700, color: C.headline }}>{session.goalDraft.title}</div>
                {session.goalDraft.deepWhy && (
                  <div style={{ fontSize: 12, color: C.secondary, marginTop: 4 }}>{session.goalDraft.deepWhy}</div>
                )}
              </div>
              <p style={{ fontSize: 13, color: C.body, marginBottom: 14 }}>
                Save this goal alone, or generate optional starter tasks you can edit first.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Button
                  type="primary"
                  block
                  onClick={() => void chooseStarterMode('goal_only')}
                  style={{
                    borderRadius: 12, height: 48, fontWeight: 700, border: 'none',
                    background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
                  }}
                >
                  Goal only
                </Button>
                <Button
                  block
                  loading={loading}
                  onClick={() => void chooseStarterMode('goal_with_tasks')}
                  style={{ borderRadius: 12, height: 48, fontWeight: 700 }}
                >
                  Suggest starter tasks
                </Button>
                <Button
                  block
                  onClick={() => setSession(setStep(session, 'edit_goal', true))}
                  style={{ borderRadius: 12, height: 44 }}
                >
                  Edit goal again
                </Button>
              </div>
            </>
          )}

          {session.step === 'starter_review' && session.goalDraft && (
            <>
              <p style={{ fontSize: 13, color: C.body, marginBottom: 10 }}>
                Select the tasks you want. Edit labels, or remove any you do not want.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {session.goalDraft.starterTasks.map(t => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
                      borderRadius: 12, border: `1.5px solid ${t.selected ? C.primary : C.border}`,
                      background: t.selected ? `${C.primary}08` : C.bgCard,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={t.selected}
                      onChange={() => toggleStarter(t.id)}
                      aria-label={`Include task: ${t.label}`}
                      style={{ marginTop: 4, width: 18, height: 18 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingStarterId === t.id ? (
                        <Input
                          value={starterEditLabel}
                          onChange={e => setStarterEditLabel(e.target.value)}
                          onPressEnter={commitStarterEdit}
                          onBlur={commitStarterEdit}
                          autoFocus
                          size="small"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingStarterId(t.id); setStarterEditLabel(t.label); }}
                          style={{
                            border: 'none', background: 'none', padding: 0, textAlign: 'left',
                            fontWeight: 600, fontSize: 13, color: C.headline, cursor: 'pointer',
                          }}
                        >
                          {t.label}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStarter(t.id)}
                      aria-label={`Remove ${t.label}`}
                      style={{
                        border: 'none', background: 'none', color: C.secondary, cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, minHeight: 44, padding: '0 6px',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  block
                  onClick={() => setSession(setStep(session, 'starter_choice'))}
                  style={{ borderRadius: 12, height: 46 }}
                >
                  Back
                </Button>
                <Button
                  block
                  type="primary"
                  onClick={() => setSession(setStep(session, 'final_review', true))}
                  style={{
                    borderRadius: 12, height: 46, flex: 2, fontWeight: 700, border: 'none',
                    background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
                  }}
                >
                  Review & save
                </Button>
              </div>
            </>
          )}

          {session.step === 'final_review' && (
            <>
              <div
                style={{
                  padding: 14, borderRadius: 14, border: `1.5px solid ${C.border}`,
                  background: C.bgAlt, marginBottom: 14,
                }}
              >
                {session.creationType === 'goal' && session.goalDraft && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 4 }}>GOAL</div>
                    <div style={{ fontWeight: 800, color: C.headline }}>{session.goalDraft.title}</div>
                    {session.goalDraft.deepWhy && (
                      <div style={{ fontSize: 12, color: C.secondary, marginTop: 6 }}>{session.goalDraft.deepWhy}</div>
                    )}
                    {session.goalDraft.starterMode === 'goal_with_tasks' && (
                      <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: C.body }}>
                        {session.goalDraft.starterTasks.filter(t => t.selected).map(t => (
                          <li key={t.id}>{t.label}</li>
                        ))}
                        {session.goalDraft.starterTasks.filter(t => t.selected).length === 0 && (
                          <li style={{ listStyle: 'none', marginLeft: -18, color: C.secondary }}>
                            No starter tasks selected - goal only will be created.
                          </li>
                        )}
                      </ul>
                    )}
                  </>
                )}
                {session.creationType === 'task' && session.taskDraft && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 4 }}>TASK</div>
                    <div style={{ fontWeight: 800, color: C.headline }}>{session.taskDraft.label}</div>
                    {session.taskDraft.description && (
                      <div style={{ fontSize: 12, color: C.secondary, marginTop: 6 }}>{session.taskDraft.description}</div>
                    )}
                    <div style={{ fontSize: 12, color: C.body, marginTop: 10 }}>
                      Goal:{' '}
                      {session.taskDraft.goalRelationship.kind === 'none' && 'None (unassigned)'}
                      {session.taskDraft.goalRelationship.kind === 'existing' && (
                        goals.find(g => g.id === (
                          session.taskDraft!.goalRelationship as { kind: 'existing'; goalId: string }
                        ).goalId)?.title ?? 'Existing goal'
                      )}
                      {session.taskDraft.goalRelationship.kind === 'new' && (
                        <>New - {session.taskDraft.goalRelationship.goalDraft.title}</>
                      )}
                    </div>
                  </>
                )}
              </div>

              {saveResult && (saveResult.partial || !saveResult.ok) && (
                <div role="alert" style={{ fontSize: 12, color: C.tertiary, marginBottom: 12 }}>
                  {saveResult.createdGoalIds.length > 0 && (
                    <div>Created goal id(s): {saveResult.createdGoalIds.join(', ')}</div>
                  )}
                  {saveResult.createdTaskIds.length > 0 && (
                    <div>Created task id(s): {saveResult.createdTaskIds.join(', ')}</div>
                  )}
                  {saveResult.failed.map(f => (
                    <div key={f.clientKey}>Failed {f.role}: {f.message}</div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 11, color: C.secondary, marginBottom: 12 }}>
                Nothing is saved until you confirm. Refresh will keep only what you save here.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  block
                  onClick={() => {
                    if (session.creationType === 'task') {
                      setSession(setStep(session, 'edit_task', true));
                    } else if (session.goalDraft?.starterMode === 'goal_with_tasks') {
                      setSession(setStep(session, 'starter_review', true));
                    } else {
                      setSession(setStep(session, 'starter_choice', true));
                    }
                  }}
                  style={{ borderRadius: 12, height: 46 }}
                >
                  Back
                </Button>
                {saveResult?.partial ? (
                  <Button
                    block
                    type="primary"
                    onClick={() => runPersist(true)}
                    style={{
                      borderRadius: 12, height: 46, flex: 2, fontWeight: 700, border: 'none',
                      background: `linear-gradient(135deg, #ef4565, #f5a623)`,
                    }}
                  >
                    Retry failed
                  </Button>
                ) : (
                  <Button
                    block
                    type="primary"
                    onClick={() => runPersist(false)}
                    style={{
                      borderRadius: 12, height: 46, flex: 2, fontWeight: 700, border: 'none',
                      background: `linear-gradient(135deg, #ef4565, #f5a623)`,
                    }}
                  >
                    Save
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      <ManageGoalModal
        open={open && (session.step === 'edit_goal' || session.step === 'edit_new_goal_for_task')}
        draft={
          session.step === 'edit_new_goal_for_task'
            ? (session.taskDraft?.goalRelationship.kind === 'new'
                ? session.taskDraft.goalRelationship.goalDraft
                : { title: '', deepWhy: '' })
            : session.goalDraft
              ? { title: session.goalDraft.title, deepWhy: session.goalDraft.deepWhy }
              : null
        }
        confirmLabel="Continue"
        onSave={handleGoalEditorSave}
        onCancel={() => {
          if (session.step === 'edit_new_goal_for_task') {
            setSession(setStep(session, 'edit_task', true));
          } else if (!confirmIfDirty(session.dirty, 'Discard goal edits')) {
            return;
          } else {
            setSession(setStep(session, 'candidates'));
          }
        }}
      />

      <ManageTaskModal
        open={open && session.step === 'edit_task'}
        profileId={profileId}
        draft={session.taskDraft ? taskDraftToForm(session.taskDraft) : null}
        goals={goals}
        pendingNewGoal={pendingNewGoal}
        onRequestCreateGoal={() => {
          const updated = setStep(sessionRef.current, 'edit_new_goal_for_task', true);
          sessionRef.current = updated;
          setSession(updated);
        }}
        confirmLabel="Continue"
        onSave={handleTaskEditorSave}
        onCancel={() => {
          if (!confirmIfDirty(sessionRef.current.dirty, 'Discard task edits')) return;
          const updated = setStep(sessionRef.current, 'candidates');
          sessionRef.current = updated;
          setSession(updated);
        }}
      />
    </>
  );
}
