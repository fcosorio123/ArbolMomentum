import { useState, useEffect } from 'react';
import { Modal, Input, Button } from 'antd';
import { C } from '../data/colors';
import type { PersonalGoal } from '../data/personalGoals';
import { ACCENT_MODAL_STYLES, ModalAccentBar } from '../styles/modalChrome';
import { VoiceInputPanel } from './VoiceInputPanel';

export interface GoalDraftValues {
  title?: string;
  deepWhy?: string;
}

interface Props {
  open: boolean;
  goal?: PersonalGoal | null;
  /** Create-mode prefill (AI Assist). Ignored when `goal` is set (edit). */
  draft?: GoalDraftValues | null;
  /** Override primary button label (e.g. Continue for AI draft capture). */
  confirmLabel?: string;
  onSave: (data: { title: string; deepWhy: string }) => void;
  onCancel: () => void;
}

export function ManageGoalModal({ open, goal, draft, confirmLabel, onSave, onCancel }: Props) {
  const isEdit = !!goal;
  const [title, setTitle] = useState('');
  const [deepWhy, setDeepWhy] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(goal?.title ?? draft?.title ?? '');
      setDeepWhy(goal?.deepWhy ?? draft?.deepWhy ?? '');
    }
  }, [open, goal, draft]);

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
      styles={ACCENT_MODAL_STYLES}
    >
      <ModalAccentBar gradient={`linear-gradient(90deg, ${C.primary}, #8E1533)`} />
      <div style={{
        padding: '16px 24px 24px',
        maxHeight: 'min(85dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 48px))',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 800, color: C.headline }}>
          {isEdit ? 'Edit Goal' : 'Add Goal'}
        </h3>

        {!isEdit && (
          <VoiceInputPanel
            recordType="goal"
            active={open}
            onApplyGoal={(d) => {
              if (d.title != null) setTitle(d.title);
              if (d.deepWhy != null) setDeepWhy(d.deepWhy);
            }}
          />
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
            style={{ borderRadius: 12 }}
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
            onClick={() => onSave({ title: title.trim(), deepWhy: deepWhy.trim() })}
            style={{
              color: C.onPrimary,
              borderRadius: 12, height: 46, fontWeight: 700, border: 'none',
              background: valid ? `linear-gradient(135deg, ${C.primary}, ${C.primaryPressed})` : undefined,
            }}
          >
            {confirmLabel ?? (isEdit ? 'Save' : 'Add goal')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
