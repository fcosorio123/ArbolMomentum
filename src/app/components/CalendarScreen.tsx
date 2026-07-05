import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, InputNumber, message } from 'antd';
import {
  CalendarOutlined,
  SettingOutlined,
  BellOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { C } from '../data/colors';
import type { Profile } from '../data/profiles';
import { getTodayKey } from '../data/profiles';
import {
  CALENDAR_PROVIDER_OPTIONS,
  DEFAULT_CALENDAR_PREFS,
  collectTodayCalendarEvents,
  formatShortDateKey,
  getCalendarPrefs,
  prepareTaskCalendarExport,
  prepareTodayCalendarExport,
  prepareWeekCalendarExport,
  saveCalendarPrefs,
  type CalendarExportPrefs,
} from '../data/calendarExport';
import { useCalendarExport } from '../hooks/useCalendarExport';

// Re-export key from calendarExport - need to add CALENDAR_INTRO_KEY to calendarExport
interface Props {
  profile: Profile;
  onOpenReminders?: () => void;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${suffix}`;
}

export function CalendarScreen({ profile, onOpenReminders }: Props) {
  const [showTimes, setShowTimes] = useState(false);
  const [prefs, setPrefs] = useState<CalendarExportPrefs>(DEFAULT_CALENDAR_PREFS);
  const [exporting, setExporting] = useState<'week' | 'today' | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const { requestExport, modal, savedProvider, clearSavedProvider } = useCalendarExport(profile.id);

  const today = getTodayKey();
  const introKey = `arbol-calendar-intro-${profile.id}`;
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(introKey));

  useEffect(() => {
    setPrefs(getCalendarPrefs(profile.id));
  }, [profile.id]);

  useEffect(() => {
    const handler = () => setRefreshTick(n => n + 1);
    window.addEventListener('arbol-tasks-updated', handler);
    window.addEventListener('arbol-goals-updated', handler);
    return () => {
      window.removeEventListener('arbol-tasks-updated', handler);
      window.removeEventListener('arbol-goals-updated', handler);
    };
  }, []);

  const weekEvents = useMemo(
    () => prepareWeekCalendarExport(profile.id, profile.name).events,
    [profile.id, profile.name, refreshTick],
  );
  const todayEvents = useMemo(
    () => collectTodayCalendarEvents(profile.id, today),
    [profile.id, today, refreshTick],
  );

  const persistPrefs = (next: CalendarExportPrefs) => {
    setPrefs(next);
    saveCalendarPrefs(profile.id, next);
  };

  const runExport = useCallback((mode: 'week' | 'today') => {
    setExporting(mode);
    try {
      const prepared = mode === 'week'
        ? prepareWeekCalendarExport(profile.id, profile.name)
        : prepareTodayCalendarExport(profile.id, profile.name, today);
      if (prepared.events.length === 0) {
        message.info(mode === 'week'
          ? 'No open tasks this week to export.'
          : 'No open tasks for today to export.');
        return;
      }
      requestExport(prepared.events, prepared.filename);
      if (showIntro) {
        localStorage.setItem(introKey, 'true');
        setShowIntro(false);
      }
    } catch {
      message.error('Could not export to calendar. Try again.');
    } finally {
      setExporting(null);
    }
  }, [introKey, profile.id, profile.name, requestExport, showIntro, today]);

  const addOneTask = (taskId: string) => {
    try {
      const { events, filename } = prepareTaskCalendarExport(
        profile.id, taskId, profile.name, 'day', today,
      );
      if (events.length === 0) {
        message.info('This task is done or skipped for today.');
        return;
      }
      requestExport(events, filename);
    } catch {
      message.error('Could not add task to calendar.');
    }
  };

  const savedLabel = CALENDAR_PROVIDER_OPTIONS.find(o => o.id === savedProvider)?.label;
  const todayLabel = formatShortDateKey(today);

  return (
    <div style={{
      padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 16px',
      background: C.bg,
      minHeight: '100dvh',
    }}>
      {modal}

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>Calendar</h2>
        <p style={{ margin: '4px 0 0', color: C.body, fontSize: 13 }}>
          Put funding tasks on your real calendar — reminders even when Arbol is closed
        </p>
      </div>

      {/* Hero */}
      <div
        data-tour-id="calendar-hero"
        style={{
          background: `linear-gradient(135deg, ${C.headline}, #1a6da8)`,
          borderRadius: 16,
          padding: '18px 16px',
          marginBottom: 16,
          boxShadow: '0 4px 20px rgba(9,64,103,0.22)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <CalendarOutlined style={{ color: '#fff', fontSize: 22 }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Sync your tasks</div>
        </div>

        {showIntro && (
          <div style={{
            marginBottom: 14, padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5,
          }}>
            <strong style={{ color: '#fff' }}>3 steps:</strong> Pick your calendar app → Import or save → Phone reminds you
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            type="primary"
            size="large"
            loading={exporting === 'week'}
            onClick={() => runExport('week')}
            style={{
              borderRadius: 12, fontWeight: 700, height: 48,
              background: '#fff', color: C.headline, border: 'none',
            }}
          >
            Sync this week — {weekEvents.length} {weekEvents.length === 1 ? 'task' : 'tasks'}
          </Button>
          <Button
            size="large"
            loading={exporting === 'today'}
            onClick={() => runExport('today')}
            style={{
              borderRadius: 12, fontWeight: 600, height: 44,
              background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)',
            }}
          >
            Sync today — {todayEvents.length} {todayEvents.length === 1 ? 'task' : 'tasks'}
          </Button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
          Re-sync when your plan changes (this week only)
        </p>
      </div>

      {/* Times + provider */}
      <div style={{
        background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16,
        padding: '14px 16px', marginBottom: 16, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setShowTimes(v => !v)}
            style={{ borderRadius: 10 }}
          >
            {showTimes ? 'Hide times' : 'Times & alarms'}
          </Button>
          {savedLabel && (
            <span style={{ fontSize: 12, color: C.primary }}>
              Using {savedLabel}.{' '}
              <button
                type="button"
                onClick={clearSavedProvider}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: C.primary, textDecoration: 'underline', cursor: 'pointer', fontSize: 12,
                }}
              >
                Change
              </button>
            </span>
          )}
        </div>
        {!showTimes && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: C.secondary }}>
            Morning {formatHour(prefs.morningHour)} · Evening {formatHour(prefs.eveningHour)}
            {prefs.alarmMinutesBefore > 0 ? ` · alarm ${prefs.alarmMinutesBefore} min early` : ''}
          </p>
        )}
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
              Morning
              <InputNumber min={6} max={22} value={prefs.morningHour}
                onChange={v => { if (typeof v === 'number') persistPrefs({ ...prefs, morningHour: v }); }}
                style={{ width: '100%' }} />
              <span style={{ color: C.secondary, fontSize: 11 }}>{formatHour(prefs.morningHour)}</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.body }}>
              Evening
              <InputNumber min={6} max={22} value={prefs.eveningHour}
                onChange={v => { if (typeof v === 'number') persistPrefs({ ...prefs, eveningHour: v }); }}
                style={{ width: '100%' }} />
              <span style={{ color: C.secondary, fontSize: 11 }}>{formatHour(prefs.eveningHour)}</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.body }}>
              Alarm (min)
              <InputNumber min={0} max={120} step={5} value={prefs.alarmMinutesBefore}
                onChange={v => { if (typeof v === 'number') persistPrefs({ ...prefs, alarmMinutesBefore: v }); }}
                style={{ width: '100%' }} />
              <span style={{ color: C.secondary, fontSize: 11 }}>
                {prefs.alarmMinutesBefore === 0 ? 'At task time' : `${prefs.alarmMinutesBefore} min early`}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Today's tasks */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
          color: C.secondary, marginBottom: 10, fontWeight: 600,
        }}>
          Today — {todayLabel}
        </div>
        {todayEvents.length === 0 ? (
          <div style={{
            background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16,
            padding: '20px 16px', textAlign: 'center', color: C.secondary, fontSize: 13,
          }}>
            No open tasks today. You can still sync the full week above.
          </div>
        ) : (
          todayEvents.map((event, i) => (
            <div
              key={`${event.taskId}-${event.dateKey}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 14,
                padding: '12px 14px', marginBottom: 8, boxShadow: C.shadow,
              }}
            >
              <span style={{ fontSize: 14, flex: 1, fontWeight: 600, color: C.headline }}>
                {event.label}
              </span>
              <span style={{ fontSize: 10, color: C.secondary }}>
                {event.timeOfDay === 'morning' ? '☀️' : '🌙'}
              </span>
              <Button
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => addOneTask(event.taskId)}
                style={{ borderRadius: 8, fontWeight: 600, flexShrink: 0 }}
              >
                Add
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Reminders link */}
      {onOpenReminders && (
        <button
          type="button"
          onClick={onOpenReminders}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 14,
            padding: '14px 16px', cursor: 'pointer', boxShadow: C.shadow, textAlign: 'left',
          }}
        >
          <BellOutlined style={{ color: C.primary, fontSize: 18 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>In-app nudges</div>
            <div style={{ fontSize: 12, color: C.secondary, marginTop: 2 }}>
              Alerts while Arbol is open — Profile → Alerts & Reminders
            </div>
          </div>
          <RightOutlined style={{ color: C.secondary, fontSize: 12 }} />
        </button>
      )}
    </div>
  );
}
