import { useEffect, useState } from 'react';
import { Modal, Button } from 'antd';
import type { TaskStatus } from '../data/profiles';
import { TaskStatusSelector, type TaskUpdateStatus } from './TaskStatusSelector';
import { getTaskNote } from '../data/liveCheckInFeedback';
import { C } from '../data/colors';

const REFLECTION_CHIPS = [
  'Felt energized',
  'Too busy today',
  'Schedule for tomorrow',
  'Hit a blocker',
  'Made good progress',
];

export interface TaskUpdateContext {
  taskId: string;
  taskLabel: string;
  timeOfDay: 'morning' | 'evening';
  goalTitle?: string;
  goalWhy?: string;
  goalProgressPct?: number;
  goalDoneCount?: number;
  goalTotalCount?: number;
}

interface Props {
  open: boolean;
  context: TaskUpdateContext | null;
  profileId: string;
  dateKey: string;
  initialStatus: TaskStatus | null;
  onClose: () => void;
  onSubmit: (status: TaskUpdateStatus, note: string) => void;
}

export function TaskUpdateModal({
  open, context, profileId, dateKey, initialStatus, onClose, onSubmit,
}: Props) {
  const [status, setStatus] = useState<TaskUpdateStatus>(initialStatus);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !context) return;
    setStatus(initialStatus);
    setNote(getTaskNote(profileId, context.taskId, dateKey));
  }, [open, context, profileId, dateKey, initialStatus]);

  if (!context) return null;

  const timeLabel = context.timeOfDay === 'morning' ? '☀️ Morning' : '🌙 Evening';

  const appendChip = (chip: string) => {
    setNote(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) return prev;
      return `${trimmed} ${chip}`;
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
      width="min(420px, calc(100vw - 24px))"
      styles={{
        content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)', background: 'rgba(9,64,103,0.4)' },
      }}
    >
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.primary}, #1a6da8)` }} />
      <div style={{ padding: '18px 20px 20px', maxHeight: 'min(85vh, 640px)', overflowY: 'auto' }}>
        {context.goalTitle && (
          <div style={{
            background: `${C.primary}08`, border: `1px solid ${C.primary}22`,
            borderRadius: 12, padding: '10px 12px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              🎯 {context.goalTitle}
            </div>
            {(context.goalProgressPct !== undefined && context.goalTotalCount !== undefined) && (
              <div style={{ fontSize: 12, color: C.body, marginTop: 4 }}>
                {context.goalProgressPct}% · {context.goalDoneCount}/{context.goalTotalCount} tasks
              </div>
            )}
            {context.goalWhy && (
              <div style={{ fontSize: 11, color: C.secondary, marginTop: 6, lineHeight: 1.45, fontStyle: 'italic' }}>
                {context.goalWhy}
              </div>
            )}
          </div>
        )}

        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: C.headline, lineHeight: 1.35 }}>
          {context.taskLabel}
        </h3>
        <div style={{ fontSize: 12, color: C.secondary, marginBottom: 16 }}>{timeLabel}</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          How&apos;s it going?
        </div>
        <TaskStatusSelector value={status} onChange={setStatus} />

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Quick reflection <span style={{ fontWeight: 500, textTransform: 'none' }}>(optional)</span>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="How did it go? Any blockers?"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: `1.5px solid ${C.border}`, borderRadius: 12,
              padding: '12px 14px', fontSize: 13, lineHeight: 1.5,
              color: C.headline, background: C.bgCard, resize: 'vertical',
              fontFamily: 'inherit', outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = `${C.primary}60`; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {REFLECTION_CHIPS.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => appendChip(chip)}
                style={{
                  background: C.bgAlt, border: `1px solid ${C.border}`,
                  borderRadius: 20, padding: '5px 10px',
                  fontSize: 11, fontWeight: 600, color: C.body, cursor: 'pointer',
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button block onClick={onClose}
            style={{ borderRadius: 12, height: 46, border: `1px solid ${C.border}`, color: C.body, flex: 1 }}>
            Cancel
          </Button>
          <Button
            block
            type="primary"
            onClick={() => onSubmit(status, note)}
            style={{
              borderRadius: 12, height: 46, flex: 1.4, fontWeight: 700,
              background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
              border: 'none', fontSize: 14,
            }}
          >
            Tell the app
          </Button>
        </div>
      </div>
    </Modal>
  );
}
