import { useState, useEffect } from 'react';
import { Button, InputNumber, message } from 'antd';
import { CalendarOutlined, SettingOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import {
  CALENDAR_PROVIDER_OPTIONS,
  DEFAULT_CALENDAR_PREFS,
  getCalendarPrefs,
  prepareWeekCalendarExport,
  saveCalendarPrefs,
  type CalendarExportPrefs,
} from '../data/calendarExport';
import { useCalendarExport } from '../hooks/useCalendarExport';

interface Props {
  profileId: string;
  profileName: string;
}

export function CalendarExportCard({ profileId, profileName }: Props) {
  const [showTimes, setShowTimes] = useState(false);
  const [prefs, setPrefs] = useState<CalendarExportPrefs>(DEFAULT_CALENDAR_PREFS);
  const [exporting, setExporting] = useState(false);
  const { requestExport, modal, savedProvider, clearSavedProvider } = useCalendarExport(profileId);

  useEffect(() => {
    setPrefs(getCalendarPrefs(profileId));
  }, [profileId]);

  const persistPrefs = (next: CalendarExportPrefs) => {
    setPrefs(next);
    saveCalendarPrefs(profileId, next);
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const { events, filename } = prepareWeekCalendarExport(profileId, profileName);
      if (events.length === 0) {
        message.info('No open tasks this week to export. Mark tasks as not done/skipped, or check back later.');
        return;
      }
      requestExport(events, filename);
    } catch {
      message.error('Could not create calendar file. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const formatHour = (hour: number) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:00 ${suffix}`;
  };

  const savedLabel = CALENDAR_PROVIDER_OPTIONS.find(o => o.id === savedProvider)?.label;

  return (
    <>
      {modal}
      <div
        data-tour-id="week-calendar-export"
        style={{
          background: C.bgCard,
          border: `1.5px solid ${C.border}`,
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 16,
          boxShadow: C.shadow,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <CalendarOutlined style={{ color: C.primary, fontSize: 18, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>Sync to Calendar</div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.body, lineHeight: 1.45 }}>
              <strong style={{ fontWeight: 600 }}>Best for reminders when Arbol is closed.</strong>{' '}
              Pick Google, Outlook, Apple, or download a file for any calendar app.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: C.secondary, lineHeight: 1.45 }}>
              Tasks export at {formatHour(prefs.morningHour)} / {formatHour(prefs.eveningHour)} with calendar alarms
              {prefs.alarmMinutesBefore > 0 ? ` ${prefs.alarmMinutesBefore} min before` : ' at task time'}.
              Re-export when your plan changes (this week only).
            </p>
            {savedLabel && (
              <p style={{ margin: '8px 0 0', fontSize: 11, color: C.primary }}>
                Using {savedLabel}.{' '}
                <button
                  type="button"
                  onClick={clearSavedProvider}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: C.primary,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  Change
                </button>
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="primary"
            icon={<CalendarOutlined />}
            loading={exporting}
            onClick={handleExport}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            Add to Calendar
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setShowTimes(v => !v)}
            style={{ borderRadius: 10 }}
          >
            {showTimes ? 'Hide times' : 'Times'}
          </Button>
        </div>

        {showTimes && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${C.border}`,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.body }}>
              Morning start (hour)
              <InputNumber
                min={6}
                max={22}
                value={prefs.morningHour}
                onChange={value => {
                  if (typeof value === 'number') {
                    persistPrefs({ ...prefs, morningHour: value });
                  }
                }}
                style={{ width: '100%' }}
              />
              <span style={{ color: C.secondary, fontSize: 11 }}>{formatHour(prefs.morningHour)}</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.body }}>
              Evening start (hour)
              <InputNumber
                min={6}
                max={22}
                value={prefs.eveningHour}
                onChange={value => {
                  if (typeof value === 'number') {
                    persistPrefs({ ...prefs, eveningHour: value });
                  }
                }}
                style={{ width: '100%' }}
              />
              <span style={{ color: C.secondary, fontSize: 11 }}>{formatHour(prefs.eveningHour)}</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.body }}>
              Alarm (min before)
              <InputNumber
                min={0}
                max={120}
                step={5}
                value={prefs.alarmMinutesBefore}
                onChange={value => {
                  if (typeof value === 'number') {
                    persistPrefs({ ...prefs, alarmMinutesBefore: value });
                  }
                }}
                style={{ width: '100%' }}
              />
              <span style={{ color: C.secondary, fontSize: 11 }}>
                {prefs.alarmMinutesBefore === 0 ? 'At task time' : `${prefs.alarmMinutesBefore} min early`}
              </span>
            </label>
          </div>
        )}
      </div>
    </>
  );
}
