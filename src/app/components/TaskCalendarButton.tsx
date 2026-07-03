import { message } from 'antd';
import type { MouseEvent } from 'react';
import { CalendarOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import { prepareTaskCalendarExport, type CalendarExportScope } from '../data/calendarExport';
import { useCalendarExport } from '../hooks/useCalendarExport';

interface Props {
  profileId: string;
  profileName: string;
  taskId: string;
  scope: CalendarExportScope;
  dateKey?: string;
  size?: 'sm' | 'md';
  title?: string;
}

export function TaskCalendarButton({
  profileId,
  profileName,
  taskId,
  scope,
  dateKey,
  size = 'md',
  title = 'Add to calendar',
}: Props) {
  const dim = size === 'sm' ? 34 : 40;
  const fontSize = size === 'sm' ? 12 : 13;
  const { requestExport, modal } = useCalendarExport(profileId);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      const { events, filename } = prepareTaskCalendarExport(
        profileId, taskId, profileName, scope, dateKey,
      );
      if (events.length === 0) {
        message.info('This task is done, skipped, or not scheduled for export.');
        return;
      }
      requestExport(events, filename);
    } catch {
      message.error('Could not create calendar file. Try again.');
    }
  };

  return (
    <>
      {modal}
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={handleClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: C.secondary,
          fontSize,
          padding: size === 'sm' ? 6 : 10,
          borderRadius: 8,
          minWidth: dim,
          minHeight: dim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = C.primary;
          e.currentTarget.style.background = `${C.primary}12`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = C.secondary;
          e.currentTarget.style.background = 'none';
        }}
      >
        <CalendarOutlined />
      </button>
    </>
  );
}
