import { Button, Modal } from 'antd';
import { C } from '../data/colors';

export type DeleteTaskChoice = 'today' | 'forever';

interface Props {
  open: boolean;
  taskLabel: string;
  choice: DeleteTaskChoice;
  onChoiceChange: (choice: DeleteTaskChoice) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const OPTIONS: Array<{ value: DeleteTaskChoice; label: string; sub: string }> = [
  {
    value: 'today',
    label: 'Skip Just Today',
    sub: 'Task will return on its next scheduled occurrence.',
  },
  {
    value: 'forever',
    label: 'Remove Forever',
    sub: 'Permanently remove this task from your plan.',
  },
];

export function DeleteTaskModal({
  open, taskLabel, choice, onChoiceChange, onConfirm, onCancel,
}: Props) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      closable
      centered
      width="min(360px, calc(100vw - 24px))"
      styles={{
        content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ padding: '20px 20px 18px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: C.headline }}>
          Delete task?
        </h3>
        <p style={{
          color: C.headline, fontSize: 14, fontWeight: 600, margin: '0 0 16px',
          lineHeight: 1.45, fontStyle: 'italic',
        }}>
          &ldquo;{taskLabel}&rdquo;
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChoiceChange(opt.value)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
                background: choice === opt.value ? `${C.primary}08` : C.bgCard,
                border: `1.5px solid ${choice === opt.value ? `${C.primary}50` : C.border}`,
                borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                border: `2px solid ${choice === opt.value ? C.primary : C.secondary}`,
                background: choice === opt.value ? C.primary : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {choice === opt.value && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.headline }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: C.secondary, marginTop: 3, lineHeight: 1.4 }}>{opt.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button block onClick={onCancel}
            style={{ borderRadius: 12, height: 44, border: `1px solid ${C.border}`, color: C.body, flex: 1 }}>
            Keep It
          </Button>
          <Button block type="primary" onClick={onConfirm}
            style={{
              borderRadius: 12, height: 44, flex: 1,
              background: choice === 'forever' ? C.tertiary : C.primary,
              border: 'none', fontWeight: 700,
            }}>
            {choice === 'today' ? 'Skip Today' : 'Remove Forever'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
