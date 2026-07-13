import { useState, useEffect } from 'react';
import { Modal, Input, Button, Checkbox, Switch } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import { parseContextTasksFromEdge, type ParseContextSource } from '../data/aiTaskCreation';
import { recurrenceSummary, type SeedSuggestionGroup } from '../data/profileSeedParser';

const { TextArea } = Input;

type Step = 'paste' | 'review';
type AssistMode = 'profile' | 'goals' | 'tasks';

interface Props {
  open: boolean;
  onClose: () => void;
  profileId?: string;
  mode: AssistMode;
  onConfirm: (groups: SeedSuggestionGroup[]) => void;
}

const MODE_COPY: Record<AssistMode, { title: string; hint: string; placeholder: string; confirm: string }> = {
  profile: {
    title: 'Describe your goals',
    hint: 'Use a paragraph or bullet list — we\'ll suggest goals and tasks for your new profile.',
    placeholder: 'Complete FAFSA, track monthly expenses, exercise MWF...',
    confirm: 'Use selections',
  },
  goals: {
    title: 'Add goals with AI',
    hint: 'Paste goals, deadlines, or a brain dump — we\'ll turn it into goals and starter tasks.',
    placeholder: 'Save $2k by December, finish capstone proposal, gym 3x/week...',
    confirm: 'Create goals & tasks',
  },
  tasks: {
    title: 'Add tasks with AI',
    hint: 'Paste tasks, routines, or context — we\'ll suggest tasks you can link to goals.',
    placeholder: 'Review budget every Sunday, call advisor Tuesday, submit lab report Friday...',
    confirm: 'Add selected tasks',
  },
};

export function ContextAssistModal({ open, onClose, mode, onConfirm }: Props) {
  const copy = MODE_COPY[mode];
  const [step, setStep] = useState<Step>('paste');
  const [text, setText] = useState('');
  const [groups, setGroups] = useState<SeedSuggestionGroup[]>([]);
  const [useAiAssist, setUseAiAssist] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseSource, setParseSource] = useState<ParseContextSource | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const reset = () => {
    setStep('paste');
    setText('');
    setGroups([]);
    setUseAiAssist(true);
    setParsing(false);
    setParseSource(null);
    setParseError(null);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleParse = async () => {
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseContextTasksFromEdge(text, { preferRules: !useAiAssist });
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

  const selectedTaskCount = groups
    .filter(g => g.selected)
    .reduce((n, g) => n + g.tasks.filter(t => t.selected).length, 0);

  const aiFallbackWarning = useAiAssist && parseSource === 'rules';

  const handleConfirm = () => {
    const selected = groups
      .filter(g => g.selected)
      .map(g => ({
        ...g,
        tasks: g.tasks.filter(t => t.selected),
      }))
      .filter(g => g.tasks.length > 0 || mode !== 'tasks');
    if (selected.length === 0) return;
    onConfirm(selected);
    handleClose();
  };

  const sourceBadge = parseSource === 'llm' ? 'AI' : 'Rules';

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
      styles={{
        content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ height: 5, background: `linear-gradient(90deg, ${C.primary}, #1a6da8)` }} />
      <div style={{ padding: '20px 22px 18px' }}>
        {step === 'paste' && (
          <>
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
              style={{ borderRadius: 12, height: 46, background: C.primary, fontWeight: 700, border: 'none' }}
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
                background: '#fff8e6', border: '1px solid #f5a62350', fontSize: 12, color: '#8a6d00', lineHeight: 1.45,
              }}>
                AI was enabled but the server used rule-based parsing. Results may be less tailored — you can go back and try again.
              </div>
            )}
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
              {groups.map(group => (
                <div key={group.id} style={{ marginBottom: 14, padding: 12, background: C.bgAlt, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <Checkbox
                      checked={group.selected}
                      onChange={e => toggleGoal(group.id, e.target.checked)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>{group.goal.title}</div>
                      <div style={{ fontSize: 11, color: C.body, marginTop: 2 }}>{group.goal.deepWhy}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGoal(group.id)}
                      style={{ border: 'none', background: 'none', color: C.tertiary, fontSize: 11, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                  {group.tasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24, marginBottom: 6 }}>
                      <Checkbox
                        checked={task.selected}
                        onChange={e => toggleTask(group.id, task.id, e.target.checked)}
                      />
                      <div style={{ flex: 1, fontSize: 13, color: C.headline }}>{task.label}</div>
                      <span style={{ fontSize: 10, color: C.secondary }}>{recurrenceSummary(task.recurrence)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <Button
              type="primary"
              block
              size="large"
              disabled={selectedTaskCount === 0 && mode === 'tasks'}
              onClick={handleConfirm}
              style={{ borderRadius: 12, height: 46, background: C.primary, fontWeight: 700, border: 'none' }}
            >
              {copy.confirm}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
