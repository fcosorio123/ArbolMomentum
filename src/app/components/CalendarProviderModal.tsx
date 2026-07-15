import { useEffect, useState } from 'react';
import { Modal, Checkbox } from 'antd';
import { C } from '../data/colors';
import {
  CALENDAR_PROVIDER_OPTIONS,
  saveCalendarProvider,
  suggestCalendarProvider,
  type CalendarProvider,
} from '../data/calendarExport';
import { detectOS } from '../data/deviceAnalytics';

interface Props {
  open: boolean;
  scopeDescription: string;
  eventCount: number;
  onSelect: (provider: CalendarProvider, remember: boolean) => void;
  onCancel: () => void;
}

export function CalendarProviderModal({ open, scopeDescription, eventCount, onSelect, onCancel }: Props) {
  const [remember, setRemember] = useState(true);
  const [highlight, setHighlight] = useState<CalendarProvider>('google');

  useEffect(() => {
    if (open) setHighlight(suggestCalendarProvider(detectOS()));
  }, [open]);

  const multiEvent = eventCount > 1;

  return (
    <Modal
      open={open}
      title={<span style={{ color: C.headline }}>Add to calendar</span>}
      onCancel={onCancel}
      footer={null}
      width="min(420px, calc(100vw - 24px))"
      destroyOnClose
    >
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: C.headline }}>
        {scopeDescription}
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.body, lineHeight: 1.5 }}>
        Pick your calendar app for {eventCount === 1 ? 'this task' : 'these tasks'}.
        {multiEvent && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: C.secondary }}>
            For multiple tasks, we&apos;ll download a file you can import into your calendar.
          </span>
        )}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CALENDAR_PROVIDER_OPTIONS.map(option => {
          const isHighlight = option.id === highlight;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id, remember)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1.5px solid ${isHighlight ? C.primary + '55' : C.border}`,
                background: isHighlight ? `${C.primary}10` : C.bgCard,
                cursor: 'pointer',
                boxShadow: isHighlight ? C.shadow : 'none',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{option.emoji}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: C.headline }}>
                  {option.label}
                </span>
                <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: C.secondary, lineHeight: 1.45 }}>
                  {multiEvent && (option.id === 'google' || option.id === 'outlook')
                    ? 'Downloads a file - then import into ' + option.label
                    : option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <Checkbox checked={remember} onChange={e => setRemember(e.target.checked)}>
          <span style={{ fontSize: 13, color: C.body }}>Remember my choice</span>
        </Checkbox>
      </div>
    </Modal>
  );
}

export function persistCalendarProviderChoice(
  profileId: string,
  provider: CalendarProvider,
  remember: boolean,
) {
  if (remember) saveCalendarProvider(profileId, provider);
}
