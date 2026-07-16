import { useState, useMemo } from 'react';
import { Modal, Input, Button, Checkbox, Switch } from 'antd';
import { ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import type { Profile } from '../data/profiles';
import type { CustomProfileType } from '../data/customProfiles';
import { createCustomProfile } from '../data/customProfiles';
import { saveProfileEmail, isValidProfileEmail } from '../data/profileContact';
import { parseContextTasksFromEdge } from '../data/aiTaskCreation';
import { recurrenceSummary, type SeedSuggestionGroup } from '../data/profileSeedParser';
import type { ParseContextSource } from '../data/aiTaskCreation';

const { TextArea } = Input;

const AVATAR_OPTIONS = ['🌱', '🎓', '📚', '💰', '🏃', '✈️', '🎨', '💪', '📋', '🧑‍💻', '✨', '🌿'];

type Step = 'type' | 'describe' | 'review' | 'name';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (profile: Profile) => void;
}

const card: React.CSSProperties = {
  background: C.bgCard,
  border: `1.5px solid ${C.border}`,
  borderRadius: 16,
  padding: '16px 18px',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

export function CreateProfileModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('type');
  const [profileType, setProfileType] = useState<CustomProfileType | null>(null);
  const [goalText, setGoalText] = useState('');
  const [suggestions, setSuggestions] = useState<SeedSuggestionGroup[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('🌱');
  const [creating, setCreating] = useState(false);
  const [useAiAssist, setUseAiAssist] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseSource, setParseSource] = useState<ParseContextSource | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const suggestedName = useMemo(() => {
    if (profileType === 'fresh') return 'Student - Fall 2026';
    const firstGoal = suggestions.find(g => g.selected)?.goal.title;
    return firstGoal ? `${firstGoal.slice(0, 24)}` : 'My Profile';
  }, [profileType, suggestions]);

  const reset = () => {
    setStep('type');
    setProfileType(null);
    setGoalText('');
    setSuggestions([]);
    setName('');
    setEmail('');
    setAvatar('🌱');
    setCreating(false);
    setUseAiAssist(true);
    setParsing(false);
    setParseSource(null);
    setParseError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePickType = (type: CustomProfileType) => {
    setProfileType(type);
    if (type === 'fresh') {
      setName('Student - Fall 2026');
      setStep('name');
    } else {
      setStep('describe');
    }
  };

  const handleGenerate = async () => {
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseContextTasksFromEdge(goalText, { preferRules: !useAiAssist });
      if (!result.ok || result.groups.length === 0) {
        const reason = result.reason === 'network_error'
          ? 'Could not reach the server. Check your connection and try again.'
          : result.reason === 'input_too_short'
            ? 'Please add a bit more detail about your goals.'
            : 'No suggestions could be generated. Try rephrasing your goals.';
        setParseError(reason);
        return;
      }
      setSuggestions(result.groups);
      setParseSource(result.source);
      setName(result.groups[0]?.goal.title ? `${result.groups[0].goal.title} Profile` : 'My Profile');
      setStep('review');
    } finally {
      setParsing(false);
    }
  };

  const toggleGoal = (goalId: string, selected: boolean) => {
    setSuggestions(prev => prev.map(g => g.id === goalId ? { ...g, selected } : g));
  };

  const toggleTask = (goalId: string, taskId: string, selected: boolean) => {
    setSuggestions(prev => prev.map(g =>
      g.id === goalId
        ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, selected } : t) }
        : g,
    ));
  };

  const removeGoal = (goalId: string) => {
    setSuggestions(prev => prev.filter(g => g.id !== goalId));
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmed || !profileType) return;
    if (!trimmedEmail || !isValidProfileEmail(trimmedEmail)) return;
    setCreating(true);
    try {
      const profile = createCustomProfile({
        name: trimmed,
        avatar,
        profileType,
        suggestions: profileType === 'seeded' ? suggestions : undefined,
      });
      saveProfileEmail(profile.id, trimmedEmail, { profileName: profile.name });
      reset();
      onCreated(profile);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const selectedTaskCount = suggestions
    .filter(g => g.selected)
    .reduce((n, g) => n + g.tasks.filter(t => t.selected).length, 0);

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={null}
      closable
      centered
      width={400}
      destroyOnClose
      styles={{ body: { padding: '20px 20px 16px' } }}
    >
      {step === 'type' && (
        <>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.headline }}>
            Create New Profile
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: C.body, lineHeight: 1.45 }}>
            What kind of profile would you like to create?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button type="button" style={card} onClick={() => handlePickType('fresh')}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🌱</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.headline }}>Fresh Profile</div>
              <div style={{ fontSize: 12, color: C.body, marginTop: 4 }}>
                Empty slate - no goals or tasks. Build everything yourself.
              </div>
            </button>
            <button type="button" style={card} onClick={() => handlePickType('seeded')}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>✨</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.headline }}>Seeded Profile</div>
              <div style={{ fontSize: 12, color: C.body, marginTop: 4 }}>
                Describe your goals and we&apos;ll suggest tasks you can edit before creating.
              </div>
            </button>
          </div>
        </>
      )}

      {step === 'describe' && (
        <>
          <button
            type="button"
            onClick={() => setStep('type')}
            style={{ border: 'none', background: 'none', padding: 0, marginBottom: 12, color: C.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <ArrowLeftOutlined /> Back
          </button>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.headline }}>
            Describe your goals
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
            Use a paragraph or bullet list - e.g. &quot;Complete FAFSA, track monthly expenses, exercise MWF.&quot;
          </p>
          <TextArea
            value={goalText}
            onChange={e => setGoalText(e.target.value)}
            placeholder="Complete FAFSA, track monthly expenses, exercise MWF, review tuition bill weekly..."
            rows={6}
            style={{ marginBottom: 12, fontSize: 14 }}
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
            disabled={goalText.trim().length < 8 || parsing}
            onClick={handleGenerate}
            style={{ background: C.primary, fontWeight: 600 }}
          >
            Generate suggestions
          </Button>
        </>
      )}

      {step === 'review' && (
        <>
          <button
            type="button"
            onClick={() => setStep('describe')}
            style={{ border: 'none', background: 'none', padding: 0, marginBottom: 12, color: C.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <ArrowLeftOutlined /> Back
          </button>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.headline }}>
            Review suggestions
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body }}>
            {selectedTaskCount} task{selectedTaskCount !== 1 ? 's' : ''} selected · uncheck anything you don&apos;t need
            {parseSource && (
              <span style={{ display: 'block', marginTop: 4, color: C.secondary }}>
                Parsed with {parseSource === 'llm' ? 'AI' : 'rules'}
              </span>
            )}
          </p>
          <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
            {suggestions.map(group => (
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
          <Button type="primary" block size="large" onClick={() => setStep('name')} style={{ background: C.primary, fontWeight: 600 }}>
            Continue
          </Button>
        </>
      )}

      {step === 'name' && (
        <>
          <button
            type="button"
            onClick={() => setStep(profileType === 'seeded' ? 'review' : 'type')}
            style={{ border: 'none', background: 'none', padding: 0, marginBottom: 12, color: C.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <ArrowLeftOutlined /> Back
          </button>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.headline }}>
            Name your profile
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body }}>
            Pick an avatar and name - you&apos;ll switch to this profile right away.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {AVATAR_OPTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatar(emoji)}
                style={{
                  width: 44, height: 44, borderRadius: 12, fontSize: 22,
                  border: avatar === emoji ? `2px solid ${C.primary}` : `1.5px solid ${C.border}`,
                  background: avatar === emoji ? `${C.primary}12` : C.bgCard,
                  cursor: 'pointer',
                }}
                aria-label={`Avatar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={suggestedName}
            size="large"
            style={{ marginBottom: 12 }}
            maxLength={48}
          />
          <label style={{ display: 'block', fontSize: 12, color: C.body, marginBottom: 6 }}>
            Email for reminders <span style={{ color: C.tertiary }}>*</span>
          </label>
          <Input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            size="large"
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            block
            size="large"
            icon={<CheckOutlined />}
            loading={creating}
            disabled={!name.trim() || !email.trim() || !isValidProfileEmail(email.trim())}
            onClick={handleCreate}
            style={{ background: C.primary, fontWeight: 600 }}
          >
            Create profile
          </Button>
        </>
      )}
    </Modal>
  );
}
