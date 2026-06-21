import { useState, useEffect } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { type TaskStatus, getTaskStatus, getTodayKey } from '../data/profiles';
import { getTaskNote } from '../data/liveCheckInFeedback';
import { C } from '../data/colors';

export interface ReportTask {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  task: ReportTask | null;
  profileId: string;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (params: { status: TaskStatus | null; note: string }) => void;
}

const STATUS_OPTIONS: { value: TaskStatus | null; label: string }[] = [
  { value: null, label: 'Not started' },
  { value: 'inprogress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export function ReportUpdateSheet({ open, task, profileId, disabled, onClose, onSubmit }: Props) {
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !task) return;
    const today = getTodayKey();
    setStatus(getTaskStatus(profileId, task.id, today));
    setNote(getTaskNote(profileId, task.id, today));
  }, [open, task, profileId]);

  if (!open || !task) return null;

  const handleSubmit = () => {
    if (disabled) return;
    onSubmit({ status, note });
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(9,64,103,0.35)',
          zIndex: 60, backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
        background: C.bgCard, borderRadius: '20px 20px 0 0',
        padding: '20px 18px calc(24px + env(safe-area-inset-bottom, 0px))',
        boxShadow: '0 -8px 32px rgba(9,64,103,0.15)',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.headline }}>Report update</div>
            <div style={{ fontSize: 13, color: C.secondary, marginTop: 2 }}>{task.label}</div>
          </div>
          <button onClick={onClose} style={{
            background: C.bgAlt, border: 'none', borderRadius: 10, width: 36, height: 36,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.secondary,
          }}>
            <CloseOutlined />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Status
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setStatus(opt.value)}
                style={{
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                  border: `1.5px solid ${status === opt.value ? C.primary : C.border}`,
                  background: status === opt.value ? `${C.primary}15` : C.bgAlt,
                  color: status === opt.value ? C.primary : C.body,
                  fontWeight: status === opt.value ? 700 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Note (optional)
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What happened on this task?"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', borderRadius: 12,
              border: `1.5px solid ${C.border}`, padding: '12px 14px',
              fontSize: 14, color: C.headline, background: C.bgAlt,
              resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45,
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={disabled}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12, border: 'none',
            background: disabled ? C.border : C.primary,
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.7 : 1,
          }}
        >
          Report Update
        </button>
      </div>
    </>
  );
}
