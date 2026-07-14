import { useState, useEffect } from 'react';
import { Modal, Input, Button } from 'antd';
import { C } from '../data/colors';
import type { PersonalGoal } from '../data/personalGoals';

interface Props {
  open: boolean;
  goal?: PersonalGoal | null;
  onSave: (data: { title: string; deepWhy: string }) => void;
  onCancel: () => void;
  /** Opens the unified AI Assist flow (new goals only). */
  onOpenAiAssist?: () => void;
}

type NewGoalStep = 'choose' | 'manual';

export function ManageGoalModal({ open, goal, onSave, onCancel, onOpenAiAssist }: Props) {
  const isEdit = !!goal;
  const [title, setTitle] = useState('');
  const [deepWhy, setDeepWhy] = useState('');
  const [step, setStep] = useState<NewGoalStep>('choose');

  useEffect(() => {
    if (open) {
      setTitle(goal?.title ?? '');
      setDeepWhy(goal?.deepWhy ?? '');
      // New goals always start with Manual vs AI — same idea as Tasks FAB menu
      setStep(goal ? 'manual' : (onOpenAiAssist ? 'choose' : 'manual'));
    }
  }, [open, goal, onOpenAiAssist]);

  const valid = title.trim().length > 0;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      title={null}
      width="min(400px, calc(100vw - 24px))"
      destroyOnClose
      styles={{
        content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ height: 5, background: `linear-gradient(90deg, ${C.primary}, #3da9fc)` }} />
      <div style={{ padding: '22px 24px 24px' }}>
        {!isEdit && step === 'choose' && onOpenAiAssist ? (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.headline }}>
              Add Goal
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
              Same AI Assist as Tasks — pick how you want to create this goal.
            </p>
            <button
              type="button"
              onClick={() => onOpenAiAssist()}
              style={{
                width: '100%', textAlign: 'left', marginBottom: 10, padding: '14px 16px',
                borderRadius: 14, border: `1.5px solid ${C.primary}50`, background: `${C.primary}12`,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>✨ AI Assist</div>
              <div style={{ fontSize: 12, color: C.body, marginTop: 4, lineHeight: 1.4 }}>
                Describe an outcome — we&apos;ll draft a Goal and starter Tasks. You can also add Tasks and link them to Goals.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStep('manual')}
              style={{
                width: '100%', textAlign: 'left', marginBottom: 16, padding: '14px 16px',
                borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.bgCard,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.headline }}>Type it myself</div>
              <div style={{ fontSize: 12, color: C.body, marginTop: 4 }}>
                Enter a goal name and why it matters.
              </div>
            </button>
            <Button
              block
              onClick={onCancel}
              style={{ borderRadius: 12, height: 46, border: `1px solid ${C.border}`, color: C.secondary }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.headline }}>
                {isEdit ? 'Edit Goal' : 'Add Goal'}
              </h3>
              {!isEdit && onOpenAiAssist && (
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  style={{
                    border: 'none', background: 'none', color: C.primary,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
                  }}
                >
                  ← Options
                </button>
              )}
            </div>

            {!isEdit && onOpenAiAssist && (
              <button
                type="button"
                onClick={() => onOpenAiAssist()}
                style={{
                  width: '100%', marginBottom: 16, padding: '12px 14px', borderRadius: 12,
                  border: `1.5px solid ${C.primary}40`, background: `${C.primary}10`,
                  color: C.primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                }}
              >
                ✨ Switch to AI Assist
                <div style={{ fontSize: 11, fontWeight: 500, color: C.body, marginTop: 4 }}>
                  Draft this goal with AI instead
                </div>
              </button>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
                Goal name <span style={{ color: C.tertiary }}>*</span>
              </label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Save ₱20,000 by December"
                size="large"
                style={{ borderRadius: 12 }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
                Goal reason <span style={{ fontSize: 11, fontStyle: 'italic', fontWeight: 400 }}>Why does this matter?</span>
              </label>
              <Input.TextArea
                value={deepWhy}
                onChange={e => setDeepWhy(e.target.value)}
                placeholder="e.g. Financial security for my family and peace of mind."
                rows={3}
                style={{ borderRadius: 12, resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                block
                onClick={onCancel}
                style={{ borderRadius: 12, height: 46, border: `1px solid ${C.border}`, color: C.secondary }}
              >
                Cancel
              </Button>
              <Button
                block
                type="primary"
                disabled={!valid}
                onClick={() => onSave({ title, deepWhy })}
                style={{
                  borderRadius: 12, height: 46, flex: 2,
                  background: valid ? `linear-gradient(135deg, ${C.primary}, #1a6da8)` : undefined,
                  border: 'none', fontWeight: 700,
                }}
              >
                {isEdit ? 'Save Changes' : 'Save Goal'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
