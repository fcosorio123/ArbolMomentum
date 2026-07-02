import { message } from 'antd';
import type { MouseEvent } from 'react';
import { CalendarOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import { exportTaskToCalendar, type CalendarExportScope } from '../data/calendarExport';

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

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      const count = exportTaskToCalendar(profileId, taskId, profileName, scope, dateKey);
      if (count === 0) {
        message.info('This task is done, skipped, or not scheduled for export.');
        return;
      }
      message.success(
        count === 1
          ? 'Downloaded 1 event. Edit time or repeat in your calendar if needed.'
          : `Downloaded ${count} events for this task this week. Re-export from Week when your plan changes.`,
        4,
      );
    } catch {
      message.error('Could not create calendar file. Try again.');
    }
  };

  return (
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
  );
}
