/**
 * LEGACY - quarantined AI Assist V1 (brain dump → SeedSuggestionGroup packages → confirm).
 * Not imported by GoalsPage / TaskList. CreateProfile uses parse-context-tasks directly.
 * Do not rewire this modal. AI Assist Creation V2 lives in AiAssistCreationModal.
 * Delete only after V2 fully passes acceptance and rollback no longer needs this file.
 */
import { useState, useEffect } from 'react';
import { Modal, Input, Button, Checkbox, Switch, Select } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import { parseContextTasksFromEdge, type ParseContextSource } from '../data/aiTaskCreation';
import { recurrenceSummary, type SeedSuggestionGroup } from '../data/profileSeedParser';
import { ACCENT_MODAL_STYLES, ModalAccentBar } from '../styles/modalChrome';

const { TextArea } = Input;

type Step = 'kind' | 'taskLink' | 'paste' | 'review';
type AssistMode = 'profile' | 'goals' | 'tasks';
type AssistKind = 'goal' | 'task';
type TaskLinkMode = 'existing' | 'new';

export interface AssistGoalOption {
  id: string;
  title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  profileId?: string;
  /** Legacy entry hint - unified flow still asks Goal vs Task unless profile mode. */
  mode: AssistMode;
  existingGoals?: AssistGoalOption[];
  onConfirm: (groups: SeedSuggestionGroup[]) => void;
}

const MODE_COPY: Record<'goals' | 'tasks', { title: string; hint: string; placeholder: string; confirm: string }> = {
  goals: {
    title: 'Describe your goal',
    hint: 'Paste an outcome, deadline, or brain dump - we\'ll turn it into a Goal (outcome) plus starter Tasks (actions).',
    placeholder: 'Save $2k by December, finish capstone proposal, gym 3x/week...',
    confirm: 'Create goals & tasks',
  },
  tasks: {
    title: 'Describe your tasks',
    hint: 'Paste actions or a routine - we\'ll suggest Tasks you can attach to a Goal.',
    placeholder: 'Review budget every Sunday, call advisor Tuesday, submit lab report Friday...',
    confirm: 'Add selected tasks',
  },
};

export function ContextAssistModal({ open, onClose, mode, existingGoals = [], onConfirm }: Props) {
  const unified = mode !== 'profile';
  const [step, setStep] = useState<Step>(unified ? 'kind' : 'paste');
  const [kind, setKind] = useState<AssistKind>(mode === 'tasks' ? 'task' : 'goal');
  const [taskLink, setTaskLink] = useState<TaskLinkMode>(existingGoals.length > 0 ? 'existing' : 'new');
  const [existingGoalId, setExistingGoalId] = useState<string>(existingGoals[0]?.id ?? '');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalWhy, setNewGoalWhy] = useState('');
  const [text, setText] = useState('');
  const [groups, setGroups] = useState<SeedSuggestionGroup[]>([]);
  const [useAiAssist, setUseAiAssist] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseSource, setParseSource] = useState<ParseContextSource | null>(null);
  const [parseReason, setParseReason] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const activeMode: 'goals' | 'tasks' = kind === 'goal' ? 'goals' : 'tasks';
  const copy = MODE_COPY[activeMode];

  const reset = () => {
    setStep(unified ? 'kind' : 'paste');
    setKind(mode === 'tasks' ? 'task' : 'goal');
    setTaskLink(existingGoals.length > 0 ? 'existing' : 'new');
    setExistingGoalId(existingGoals[0]?.id ?? '');
    setNewGoalTitle('');
    setNewGoalWhy('');
    setText('');
    setGroups([]);
    setUseAiAssist(true);
    setParsing(false);
    setParseSource(null);
    setParseReason(null);
    setParseError(null);
    setLinkError(null);
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && existingGoals.length > 0 && !existingGoalId) {
      setExistingGoalId(existingGoals[0].id);
    }
  }, [open, existingGoals, existingGoalId]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const continueFromKind = (next: AssistKind) => {
    setKind(next);
    if (next === 'task') {
      setStep('taskLink');
    } else {
      setStep('paste');
    }
  };

  const continueFromTaskLink = () => {
    setLinkError(null);
    if (taskLink === 'existing') {
      if (!existingGoalId) {
        setLinkError('Pick a goal, or create a new one.');
        return;
      }
    } else if (newGoalTitle.trim().length < 3) {
      setLinkError('Enter a short outcome-style goal name (at least 3 characters).');
      return;
    }
    setStep('paste');
  };

  const handleParse = async () => {
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseContextTasksFromEdge(text, {
        preferRules: !useAiAssist,
        mode: activeMode,
      });
      if (!result.ok || result.groups.length === 0) {
        const reason = result.reason === 'network_error'
          ? 'Could not reach the server. Check your connection and try again.'
          : result.reason === 'input_too_short'
            ? 'Please add a bit more detail.'
            : 'No suggestions could be generated. Try rephrasing.';
        setParseError(reason);
        return;
      }
      setGroups(result.groups);
      setParseSource(result.source);
      setParseReason(result.reason ?? null);
      setStep('review');
    } finally {
      setParsing(false);
    }
  };

  const toggleGoal = (goalId: string, selected: boolean) => {
    setGroups(prev => prev.map(g => g.id === goalId ? { ...g, selected } : g));
  };

  const toggleTask = (goalId: string, taskId: string, selected: boolean) => {
    setGroups(prev => prev.map(g =>
      g.id === goalId
        ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, selected } : t) }
        : g,
    ));
  };

  const removeGoal = (goalId: string) => {
    setGroups(prev => prev.filter(g => g.id !== goalId));
  };

  const updateGoalTitle = (goalId: string, title: string) => {
    setGroups(prev => prev.map(g =>
      g.id === goalId ? { ...g, goal: { ...g.goal, title } } : g,
    ));
  };

  const updateGoalWhy = (goalId: string, deepWhy: string) => {
    setGroups(prev => prev.map(g =>
      g.id === goalId ? { ...g, goal: { ...g.goal, deepWhy } } : g,
    ));
  };

  const updateTaskLabel = (goalId: string, taskId: string, label: string) => {
    setGroups(prev => prev.map(g =>
      g.id === goalId
        ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, label } : t) }
        : g,
    ));
  };

  const removeTask = (goalId: string, taskId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === goalId ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) } : g,
    ));
  };

  const handleRegenerate = async () => {
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseContextTasksFromEdge(text, {
        preferRules: !useAiAssist,
        mode: activeMode,
      });
      if (!result.ok || result.groups.length === 0) {
        setParseError('Could not regenerate. Try editing your input or try again.');
        return;
      }
      setGroups(result.groups);
      setParseSource(result.source);
      setParseReason(result.reason ?? null);
    } finally {
      setParsing(false);
    }
  };

  const selectedTaskCount = groups
    .filter(g => g.selected)
    .reduce((n, g) => n + g.tasks.filter(t => t.selected).length, 0);

  const aiFallbackWarning = useAiAssist && parseSource === 'rules';

  const finalizeGroups = (raw: SeedSuggestionGroup[]): SeedSuggestionGroup[] => {
    if (kind !== 'task') return raw;

    if (taskLink === 'existing') {
      const eg = existingGoals.find(g => g.id === existingGoalId);
      if (!eg) return raw;
      const tasks = raw
        .filter(g => g.selected)
        .flatMap(g => g.tasks.filter(t => t.selected));
      if (tasks.length === 0) return [];
      return [{
        id: `link-${eg.id}`,
        selected: true,
        goal: {
          title: eg.title,
          deepWhy: 'Existing goal - tasks added from AI Assist.',
        },
        tasks: tasks.map((t, i) => ({ ...t, id: t.id || `t-${i}`, selected: true })),
      }];
    }

    // New goal created during task flow
    const title = newGoalTitle.trim();
    const deepWhy = newGoalWhy.trim() || 'Goal created while adding tasks with AI Assist.';
    const tasks = raw
      .filter(g => g.selected)
      .flatMap(g => g.tasks.filter(t => t.selected));
    if (tasks.length === 0) {
      return [{
        id: 'new-goal',
        selected: true,
        goal: { title, deepWhy },
        tasks: [],
      }];
    }
    return [{
      id: 'new-goal',
      selected: true,
      goal: { title, deepWhy },
      tasks: tasks.map((t, i) => ({ ...t, id: t.id || `t-${i}`, selected: true })),
    }];
  };

  const handleConfirm = () => {
    const selected = groups
      .filter(g => g.selected)
      .map(g => ({
        ...g,
        tasks: g.tasks.filter(t => t.selected),
      }))
      .filter(g => g.tasks.length > 0 || activeMode !== 'tasks');

    const finalized = finalizeGroups(selected);
    if (finalized.length === 0) return;
    if (kind === 'goal' && finalized.every(g => g.tasks.length === 0) && finalized.every(g => !g.goal.title.trim())) {
      return;
    }
    onConfirm(finalized);
    handleClose();
  };

  const sourceBadge = parseSource === 'llm' ? 'AI' : 'Rules';

  const backFromPaste = () => {
    if (!unified) return;
    if (kind === 'task') setStep('taskLink');
    else setStep('kind');
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={null}
      closable
      centered
      width="min(420px, calc(100vw - 24px))"
      destroyOnClose
      styles={ACCENT_MODAL_STYLES}
    >
      <ModalAccentBar gradient={`linear-gradient(90deg, ${C.primary}, ${C.primaryPressed})`} />
      <div style={{ padding: '16px 22px 18px' }}>
        {step === 'kind' && (
          <>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.headline }}>
              What are you creating?
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
              Goals are outcomes. Tasks are actions. We&apos;ll guide you based on what you pick.
            </p>
            <button
              type="button"
              onClick={() => continueFromKind('goal')}
              style={{
                width: '100%', textAlign: 'left', marginBottom: 10, padding: '14px 16px',
                borderRadius: 14, border: `1.5px solid ${C.primary}40`, background: `${C.primary}10`,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.headline }}>Goal</div>
              <div style={{ fontSize: 12, color: C.body, marginTop: 4 }}>
                An outcome you want - we&apos;ll also suggest starter tasks.
              </div>
            </button>
            <button
              type="button"
              onClick={() => continueFromKind('task')}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 16px',
                borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.bgCard,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.headline }}>Task</div>
              <div style={{ fontSize: 12, color: C.body, marginTop: 4 }}>
                Actions to do - we&apos;ll ask which Goal they belong to.
              </div>
            </button>
          </>
        )}

        {step === 'taskLink' && (
          <>
            <button
              type="button"
              onClick={() => setStep('kind')}
              style={{ border: 'none', background: 'none', padding: 0, marginBottom: 12, color: C.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <ArrowLeftOutlined /> Back
            </button>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.headline }}>
              Link tasks to a Goal
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
              Associate these tasks with an existing Goal, or create a new Goal (it syncs to the Goals page).
            </p>
            <label style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10,
              padding: '12px', borderRadius: 12, border: `1.5px solid ${taskLink === 'existing' ? C.primary : C.border}`,
              background: taskLink === 'existing' ? `${C.primary}10` : C.bgCard, cursor: existingGoals.length ? 'pointer' : 'not-allowed',
              opacity: existingGoals.length ? 1 : 0.55,
            }}>
              <input
                type="radio"
                name="task-link"
                checked={taskLink === 'existing'}
                disabled={existingGoals.length === 0}
                onChange={() => setTaskLink('existing')}
                style={{ marginTop: 3 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.headline }}>Existing goal</div>
                {existingGoals.length === 0 ? (
                  <div style={{ fontSize: 11, color: C.secondary, marginTop: 4 }}>No goals yet - create one below.</div>
                ) : (
                  <Select
                    value={existingGoalId || undefined}
                    onChange={setExistingGoalId}
                    onClick={e => e.stopPropagation()}
                      options={existingGoals.map(g => ({ value: g.id, label: g.title }))}
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Choose a goal"
                  />
                )}
              </div>
            </label>
            <label style={{
              display: 'block', marginBottom: 14, padding: '12px', borderRadius: 12,
              border: `1.5px solid ${taskLink === 'new' ? C.primary : C.border}`,
              background: taskLink === 'new' ? `${C.primary}10` : C.bgCard, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input
                  type="radio"
                  name="task-link"
                  checked={taskLink === 'new'}
                  onChange={() => setTaskLink('new')}
                  style={{ marginTop: 3 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.headline }}>Create a new goal</div>
                  <div style={{ fontSize: 11, color: C.body, marginTop: 2 }}>Saved on Goals when you confirm.</div>
                </div>
              </div>
              {taskLink === 'new' && (
                <div style={{ marginTop: 10, marginLeft: 26 }}>
                  <Input
                    value={newGoalTitle}
                    onChange={e => setNewGoalTitle(e.target.value)}
                    placeholder="Goal outcome (e.g. Eat well & feel nourished)"
                    style={{ borderRadius: 8, marginBottom: 8 }}
                    onClick={e => e.stopPropagation()}
                  />
                  <Input
                    value={newGoalWhy}
                    onChange={e => setNewGoalWhy(e.target.value)}
                    placeholder="Why this matters (optional)"
                    style={{ borderRadius: 8 }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}
            </label>
            {linkError && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#c0392b' }}>{linkError}</p>
            )}
            <Button
              type="primary"
              block
              size="large"
              onClick={continueFromTaskLink}
              style={{ color: C.onPrimary, borderRadius: 12, height: 46, background: C.primary, fontWeight: 700, border: 'none' }}
            >
              Continue
            </Button>
          </>
        )}

        {step === 'paste' && (
          <>
            {unified && (
              <button
                type="button"
                onClick={backFromPaste}
                style={{ border: 'none', background: 'none', padding: 0, marginBottom: 12, color: C.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <ArrowLeftOutlined /> Back
              </button>
            )}
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.headline }}>
              {copy.title}
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
              {copy.hint}
            </p>
            <TextArea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={copy.placeholder}
              rows={6}
              style={{ marginBottom: 12, fontSize: 14, borderRadius: 12 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.headline }}>AI assist</div>
                <div style={{ fontSize: 11, color: C.body, marginTop: 2 }}>
                  {useAiAssist ? 'Uses AI when available; falls back to rules on the server.' : 'Rule-based parsing only.'}
                </div>
              </div>
              <Switch checked={useAiAssist} onChange={setUseAiAssist} />
            </div>
            {parseError && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#c0392b', lineHeight: 1.4 }}>
                {parseError}
              </p>
            )}
            <Button
              type="primary"
              block
              size="large"
              loading={parsing}
              disabled={text.trim().length < 8 || parsing}
              onClick={handleParse}
              style={{ color: C.onPrimary, borderRadius: 12, height: 46, background: C.primary, fontWeight: 700, border: 'none' }}
            >
              Parse suggestions
            </Button>
          </>
        )}

        {step === 'review' && (
          <>
            <button
              type="button"
              onClick={() => setStep('paste')}
              style={{ border: 'none', background: 'none', padding: 0, marginBottom: 12, color: C.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <ArrowLeftOutlined /> Back
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.headline }}>
                Review suggestions
              </h2>
              {parseSource && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                  background: parseSource === 'llm' ? `${C.primary}18` : `${C.secondary}18`,
                  color: parseSource === 'llm' ? C.primary : C.secondary,
                  textTransform: 'uppercase', letterSpacing: 0.4,
                }}>
                  {sourceBadge}
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.body }}>
              {selectedTaskCount} task{selectedTaskCount !== 1 ? 's' : ''} selected · uncheck anything you don&apos;t need
            </p>
            {aiFallbackWarning && (
              <div style={{
                marginBottom: 12, padding: '10px 12px', borderRadius: 10,
                background: '#fff8e6', border: '1px solid #E9A10050', fontSize: 12, color: '#8a6d00', lineHeight: 1.45,
              }}>
                {parseReason === 'llm_unavailable' || parseReason === 'rate_limited'
                  ? 'AI assist is temporarily unavailable (missing key, rate limit, or model error). Showing rule-based suggestions - review carefully, then confirm.'
                  : 'AI was enabled but the server used rule-based parsing. Results may be less tailored - you can go back and try again.'}
              </div>
            )}
            <p style={{ margin: '0 0 10px', fontSize: 11, color: C.secondary, lineHeight: 1.4 }}>
              <strong style={{ color: C.headline }}>Goal</strong> = the outcome you want ·{' '}
              <strong style={{ color: C.headline }}>Tasks</strong> = the actions that get you there
            </p>
            <div style={{ maxHeight: 'min(52vh, 360px)', overflowY: 'auto', marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
              {groups.map(group => (
                <div key={group.id} style={{ marginBottom: 14, padding: 12, background: C.bgAlt, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <Checkbox
                      checked={group.selected}
                      onChange={e => toggleGoal(group.id, e.target.checked)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                        color: C.primary, marginBottom: 4,
                      }}>
                        Goal (outcome)
                      </div>
                      <Input
                        value={group.goal.title}
                        onChange={e => updateGoalTitle(group.id, e.target.value)}
                        placeholder="Outcome you want…"
                        style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, borderRadius: 8 }}
                        disabled={kind === 'task'}
                      />
                      <Input
                        value={group.goal.deepWhy}
                        onChange={e => updateGoalWhy(group.id, e.target.value)}
                        placeholder="Why this matters…"
                        style={{ fontSize: 12, borderRadius: 8 }}
                        disabled={kind === 'task'}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGoal(group.id)}
                      style={{ border: 'none', background: 'none', color: C.tertiary, fontSize: 11, cursor: 'pointer', flexShrink: 0, padding: '4px 0' }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                    color: C.secondary, margin: '0 0 6px 28px',
                  }}>
                    Tasks (actions)
                  </div>
                  {group.tasks.map(task => (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, marginBottom: 8,
                      flexWrap: 'wrap',
                    }}>
                      <Checkbox
                        checked={task.selected}
                        onChange={e => toggleTask(group.id, task.id, e.target.checked)}
                      />
                      <Input
                        value={task.label}
                        onChange={e => updateTaskLabel(group.id, task.id, e.target.value)}
                        placeholder="Action to do…"
                        style={{ flex: '1 1 140px', minWidth: 0, fontSize: 13, borderRadius: 8 }}
                      />
                      <span style={{ fontSize: 10, color: C.secondary, whiteSpace: 'nowrap' }}>{recurrenceSummary(task.recurrence)}</span>
                      <button
                        type="button"
                        onClick={() => removeTask(group.id, task.id)}
                        style={{ border: 'none', background: 'none', color: C.secondary, fontSize: 11, cursor: 'pointer', minWidth: 28, minHeight: 28 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <Button block onClick={handleRegenerate} loading={parsing} style={{ borderRadius: 12, height: 46, flex: '1 1 120px' }}>
                Regenerate
              </Button>
              <Button
                type="primary"
                block
                size="large"
                disabled={(selectedTaskCount === 0 && kind === 'task') || parsing}
                onClick={handleConfirm}
                style={{ color: C.onPrimary, borderRadius: 12, height: 46, background: C.primary, fontWeight: 700, border: 'none', flex: '1.4 1 160px' }}
              >
                {copy.confirm}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
