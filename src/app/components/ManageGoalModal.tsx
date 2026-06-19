import { useState, useEffect } from 'react';
import { Modal, Input, Button } from 'antd';
import { C } from '../data/colors';
import type { PersonalGoal } from '../data/personalGoals';

interface Props {
  open: boolean;
  goal?: PersonalGoal | null;
  onSave: (data: { title: string; deepWhy: string }) => void;
  onCancel: () => void;
}

export function ManageGoalModal({ open, goal, onSave, onCancel }: Props) {
  const isEdit = !!goal;
  const [title, setTitle] = useState('');
  const [deepWhy, setDeepWhy] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(goal?.title ?? '');
      setDeepWhy(goal?.deepWhy ?? '');
    }
  }, [open, goal]);

  const valid = title.trim().length > 0;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      title={null}
      width="min(400px, calc(100vw - 24px))"
      styles={{
        content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ height: 5, background: `linear-gradient(90deg, ${C.primary}, #3da9fc)` }} />
      <div style={{ padding: '22px 24px 24px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 800, color: C.headline }}>
          {isEdit ? 'Edit Goal' : 'Add Goal'}
        </h3>

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
      </div>
    </Modal>
  );
}
