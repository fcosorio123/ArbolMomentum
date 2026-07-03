import { useCallback, useState } from 'react';
import { App } from 'antd';
import {
  CALENDAR_EXPORTED_KEY,
  clearSavedCalendarProvider,
  deliverEventsToCalendar,
  getCalendarDeliveryMessage,
  getSavedCalendarProvider,
  type CalendarEventRow,
  type CalendarProvider,
} from '../data/calendarExport';
import { CalendarProviderModal, persistCalendarProviderChoice } from '../components/CalendarProviderModal';

interface PendingExport {
  events: CalendarEventRow[];
  filename: string;
}

export function useCalendarExport(profileId: string) {
  const { message } = App.useApp();
  const [pending, setPending] = useState<PendingExport | null>(null);
  const [savedProvider, setSavedProvider] = useState<CalendarProvider | null>(
    () => getSavedCalendarProvider(profileId),
  );

  const finishExport = useCallback((
    provider: CalendarProvider,
    events: CalendarEventRow[],
    filename: string,
    remember: boolean,
  ) => {
    persistCalendarProviderChoice(profileId, provider, remember);
    if (remember) setSavedProvider(provider);
    const isFirst = !localStorage.getItem(CALENDAR_EXPORTED_KEY(profileId));
    const result = deliverEventsToCalendar(provider, profileId, events, filename);
    if (result.eventCount > 0) {
      localStorage.setItem(CALENDAR_EXPORTED_KEY(profileId), 'true');
      message.success({
        content: getCalendarDeliveryMessage(result, isFirst),
        duration: result.method === 'download' ? 7 : 5,
      });
    }
  }, [message, profileId]);

  const requestExport = useCallback((events: CalendarEventRow[], filename: string) => {
    if (events.length === 0) return false;

    const saved = getSavedCalendarProvider(profileId);
    if (saved) {
      finishExport(saved, events, filename, true);
      return true;
    }

    setPending({ events, filename });
    return true;
  }, [finishExport, profileId]);

  const handleProviderSelect = useCallback((provider: CalendarProvider, remember: boolean) => {
    if (!pending) return;
    finishExport(provider, pending.events, pending.filename, remember);
    setPending(null);
  }, [finishExport, pending]);

  const modal = (
    <CalendarProviderModal
      open={!!pending}
      eventCount={pending?.events.length ?? 0}
      onSelect={handleProviderSelect}
      onCancel={() => setPending(null)}
    />
  );

  return {
    requestExport,
    modal,
    savedProvider,
    clearSavedProvider: () => {
      clearSavedCalendarProvider(profileId);
      setSavedProvider(null);
    },
  };
}
