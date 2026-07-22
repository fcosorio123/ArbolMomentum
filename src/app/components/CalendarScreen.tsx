import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, InputNumber, Switch, message } from 'antd';
import {
  CalendarOutlined,
  SettingOutlined,
  BellOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { C } from '../data/colors';
import type { Profile } from '../data/profiles';
import {
  CALENDAR_PROVIDER_OPTIONS,
  DEFAULT_CALENDAR_PREFS,
  collectTodayCalendarEvents,
  formatShortDateKey,
  getCalendarPrefs,
  getDaySyncContext,
  prepareTaskCalendarExport,
  prepareTodayCalendarExport,
  prepareWeekCalendarExport,
  saveCalendarPrefs,
  type CalendarExportPrefs,
} from '../data/calendarExport';
import { useCalendarExport } from '../hooks/useCalendarExport';
import { PageTour, TOUR_KEYS, tourStorageKey, areToursDismissedForProfile, resetLiveToursForProfile } from './AppTour';
import { HelpTourMenu } from './HelpTourMenu';
import { trackEvent } from '../data/deviceAnalytics';
import { ONBOARDING_TOUR_VERSION } from '../data/productOnboarding';

interface Props {
  profile: Profile;
  onOpenReminders?: () => void;
  onProductTour?: () => void;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${suffix}`;
}

export function CalendarScreen({ profile, onOpenReminders, onProductTour }: Props) {
  const [showTimes, setShowTimes] = useState(false);
  const [prefs, setPrefs] = useState<CalendarExportPrefs>(DEFAULT_CALENDAR_PREFS);
  const [exporting, setExporting] = useState<'week' | 'today' | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const { requestExport, modal, savedProvider, clearSavedProvider } = useCalendarExport(profile.id);

  const daySync = useMemo(
    () => getDaySyncContext(profile.id),
    [profile.id, prefs.eveningHour, prefs.afterEveningTarget, refreshTick],
  );

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

  useEffect(() => {
    if (areToursDismissedForProfile(profile.id)) return;
    if (!localStorage.getItem(tourStorageKey(TOUR_KEYS.calendar, profile.id))) {
      const t = setTimeout(() => setShowTour(true), 700);
      return () => clearTimeout(t);
    }
  }, [profile.id]);

  const weekEvents = useMemo(
    () => prepareWeekCalendarExport(profile.id, profile.name).events,
    [profile.id, profile.name, refreshTick],
  );
  const dayEvents = useMemo(
    () => collectTodayCalendarEvents(profile.id, daySync.dateKey),
    [profile.id, daySync.dateKey, refreshTick],
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
        : prepareTodayCalendarExport(profile.id, profile.name, daySync.dateKey);
      if (prepared.events.length === 0) {
        message.info(mode === 'week'
          ? 'No open tasks this week to export.'
          : `No open tasks for ${daySync.calendarDayLabel} to export.`);
        return;
      }
      requestExport(prepared.events, prepared.filename);
    } catch {
      message.error('Could not export to calendar. Try again.');
    } finally {
      setExporting(null);
    }
  }, [daySync.calendarDayLabel, daySync.dateKey, profile.id, profile.name, requestExport]);

  const addOneTask = (taskId: string) => {
    try {
      const { events, filename } = prepareTaskCalendarExport(
        profile.id, taskId, profile.name, 'day', daySync.dateKey,
      );
      if (events.length === 0) {
        message.info(`This task is not scheduled for ${daySync.calendarDayLabel}.`);
        return;
      }
      requestExport(events, filename);
    } catch {
      message.error('Could not add task to calendar.');
    }
  };

  const savedLabel = CALENDAR_PROVIDER_OPTIONS.find(o => o.id === savedProvider)?.label;
  const dayLabel = formatShortDateKey(daySync.dateKey);
  const dayButtonLabel = daySync.calendarDayLabel === 'tomorrow' ? 'Sync tomorrow' : 'Sync today';

  return (
    <div style={{
      padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px calc(100px + env(safe-area-inset-bottom, 0px))',
      background: C.bg,
      minHeight: '100dvh',
    }}>
      {modal}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>Calendar</h2>
          <p style={{ margin: '4px 0 0', color: C.body, fontSize: 13 }}>
            Put funding tasks on your real calendar - reminders even when Arbol is closed
          </p>
        </div>
        <HelpTourMenu
          onPageTour={() => {
            trackEvent(profile.id, 'onboarding_tour_started', {
              tourVersion: ONBOARDING_TOUR_VERSION,
              entryPage: 'calendar',
            });
            setShowTour(true);
          }}
          onProductTour={onProductTour}
          onRestartTours={() => {
            trackEvent(profile.id, 'onboarding_tour_restarted', {
              tourVersion: ONBOARDING_TOUR_VERSION,
              entryPage: 'calendar',
            });
            resetLiveToursForProfile(profile.id);
            setShowTour(true);
          }}
        />
      </div>

      {daySync.rolledForward && (
        <div style={{
          background: `${C.streak}15`, border: `1.5px solid ${C.streak}40`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: C.body, lineHeight: 1.45,
        }}>
          It&apos;s past {formatHour(daySync.eveningHour)} - we&apos;re syncing <strong>tomorrow</strong> so
          calendar alerts still fire. Change this under Times &amp; alarms.
        </div>
      )}

      {/* Hero */}
      <div
        data-tour-id="calendar-hero"
        style={{
          background: `linear-gradient(135deg, ${C.headline}, ${C.primaryPressed})`,
          borderRadius: 16,
          padding: '18px 16px',
          marginBottom: 16,
          boxShadow: '0 4px 20px rgba(39,39,42,0.22)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <CalendarOutlined style={{ color: '#fff', fontSize: 22 }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Sync your tasks</div>
        </div>

        <div style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5,
        }}>
          <strong style={{ color: '#fff' }}>How it works:</strong> Pick Google, Outlook, or Apple →
          import the file (or save the event) → your phone reminds you
        </div>

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
            Sync this week - {weekEvents.length} {weekEvents.length === 1 ? 'task' : 'tasks'}
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
            {dayButtonLabel} - {dayEvents.length} {dayEvents.length === 1 ? 'task' : 'tasks'}
          </Button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
          Re-sync when your plan changes (this week only)
        </p>
      </div>

      {/* Times + provider */}
      <div
        data-tour-id="calendar-times"
        style={{
          background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16,
          padding: '14px 16px', marginBottom: 16, boxShadow: C.shadow,
        }}
      >
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
            {prefs.afterEveningTarget === 'tomorrow' ? ' · after evening → tomorrow' : ''}
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
        {showTimes && (
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.headline }}>
                After {formatHour(prefs.eveningHour)}, sync tomorrow
              </div>
              <div style={{ fontSize: 11, color: C.secondary, marginTop: 4, lineHeight: 1.45 }}>
                Avoids adding events that are already in the past so reminders still work.
              </div>
            </div>
            <Switch
              checked={prefs.afterEveningTarget === 'tomorrow'}
              onChange={checked => persistPrefs({
                ...prefs,
                afterEveningTarget: checked ? 'tomorrow' : 'today',
              })}
            />
          </div>
        )}
      </div>

      {/* Day tasks */}
      <div data-tour-id="calendar-day-tasks" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
          color: C.secondary, marginBottom: 10, fontWeight: 600,
        }}>
          {daySync.calendarDayLabel === 'tomorrow' ? 'Tomorrow' : 'Today'} - {dayLabel}
        </div>
        {dayEvents.length === 0 ? (
          <div style={{
            background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16,
            padding: '20px 16px', textAlign: 'center', color: C.secondary, fontSize: 13,
          }}>
            No open tasks for {daySync.calendarDayLabel}. You can still sync the full week above.
          </div>
        ) : (
          dayEvents.map(event => (
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
                {' '}
                {formatHour(event.timeOfDay === 'morning' ? prefs.morningHour : prefs.eveningHour)}
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
              Alerts while Arbol is open - Profile → Alerts & Reminders
            </div>
          </div>
          <RightOutlined style={{ color: C.secondary, fontSize: 12 }} />
        </button>
      )}

      <PageTour
        open={showTour}
        onClose={() => setShowTour(false)}
        storageKey={tourStorageKey(TOUR_KEYS.calendar, profile.id)}
        profileId={profile.id}
        pageLabel="Calendar"
        doneEmoji="📅"
        doneMessage="You're set! Sync tasks to your phone calendar and get reminders even when Arbol is closed."
        steps={[
          {
            title: '📅 Sync your week',
            description: 'Tap Sync this week to download all open tasks. Pick Google, Outlook, or Apple - then import the file once.',
            targetId: 'calendar-hero',
            placement: 'bottom',
          },
          {
            title: '⏰ Times & reminders',
            description: 'Set morning/evening times and alarms. After evening, Arbol can auto-sync tomorrow so alerts are not missed.',
            targetId: 'calendar-times',
            placement: 'bottom',
          },
          {
            title: '➕ Add one task',
            description: 'Or add tasks one at a time. Each exports with a calendar alarm at your chosen time.',
            targetId: 'calendar-day-tasks',
            placement: 'top',
          },
        ]}
      />
    </div>
  );
}
