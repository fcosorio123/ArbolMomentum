import { useState, useEffect } from 'react';
import { Button, InputNumber, message } from 'antd';
import { CalendarOutlined, SettingOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import {
  CALENDAR_EXPORTED_KEY,
  DEFAULT_CALENDAR_PREFS,
  exportWeekToCalendar,
  getCalendarPrefs,
  saveCalendarPrefs,
  type CalendarExportPrefs,
} from '../data/calendarExport';

interface Props {
  profileId: string;
  profileName: string;
}

export function CalendarExportCard({ profileId, profileName }: Props) {
  const [showTimes, setShowTimes] = useState(false);
  const [prefs, setPrefs] = useState<CalendarExportPrefs>(DEFAULT_CALENDAR_PREFS);
  const [exporting, setExporting] = useState(false);

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
      const isFirst = !localStorage.getItem(CALENDAR_EXPORTED_KEY(profileId));
      const count = exportWeekToCalendar(profileId, profileName);
      if (count === 0) {
        message.info('No open tasks this week to export. Mark tasks as not done/skipped, or check back later.');
        return;
      }
      localStorage.setItem(CALENDAR_EXPORTED_KEY(profileId), 'true');
      message.success({
        content: isFirst
          ? `Downloaded ${count} events for this week. Times use your morning/evening defaults — edit in Times or in your calendar. Re-export when tasks change.`
          : `Downloaded ${count} events for this week.`,
        duration: isFirst ? 6 : 4,
      });
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

  return (
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
            Export this week&apos;s open tasks, or tap the calendar icon on any task.
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: C.secondary, lineHeight: 1.45 }}>
            Morning tasks export at {formatHour(prefs.morningHour)}, evening at {formatHour(prefs.eveningHour)} (30 min each).
            Change defaults in <strong style={{ fontWeight: 600 }}>Times</strong>, or edit events in your calendar after import.
            This file covers <strong style={{ fontWeight: 600 }}>this week only</strong> — re-export when your plan changes.
          </p>
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
            gridTemplateColumns: '1fr 1fr',
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
        </div>
      )}
    </div>
  );
}
