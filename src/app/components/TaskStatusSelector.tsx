import { CheckOutlined } from '@ant-design/icons';
import type { TaskStatus } from '../data/profiles';
import { C } from '../data/colors';

export type TaskUpdateStatus = TaskStatus | null;

const OPTIONS: Array<{
  value: TaskUpdateStatus;
  label: string;
  emoji: string;
  color: string;
  bg: string;
}> = [
  { value: null, label: "Haven't yet", emoji: '🌱', color: C.secondary, bg: C.bgAlt },
  { value: 'inprogress', label: 'Working on it', emoji: '⚡', color: C.primary, bg: C.bgAlt2 },
  { value: 'done', label: 'Done', emoji: '✅', color: C.success, bg: C.successBg },
  { value: 'skipped', label: 'Skipped', emoji: '⏭️', color: C.secondary, bg: C.bgAlt },
];

interface Props {
  value: TaskUpdateStatus;
  onChange: (value: TaskUpdateStatus) => void;
}

export function TaskStatusSelector({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              textAlign: 'left', cursor: 'pointer',
              padding: '12px 14px', borderRadius: 12,
              background: selected ? opt.bg : C.bgCard,
              border: `1.5px solid ${selected ? opt.color + '55' : C.border}`,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</span>
            <span style={{
              flex: 1, fontSize: 14, fontWeight: selected ? 700 : 600,
              color: selected ? C.headline : C.body,
            }}>
              {opt.label}
            </span>
            {selected && (
              <CheckOutlined style={{ color: opt.color, fontSize: 14, flexShrink: 0 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

export const TASK_STATUS_DISPLAY = {
  null: { label: 'Not started', color: C.secondary, bg: C.bgAlt },
  inprogress: { label: 'In Progress', color: C.streakText, bg: C.warningBg },
  done: { label: 'Done', color: C.success, bg: C.successBg },
  skipped: { label: 'Skipped', color: C.secondary, bg: C.bgAlt },
} as const;
