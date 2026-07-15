import { useMemo, useState } from 'react';
import { C } from '../data/colors';
import { getTodayKey, getTaskStatus, type TaskStatus } from '../data/profiles';
import {
  countTasksOnDate,
  getInventoryTasksForDate,
  hasOverdueOnDate,
  type InventoryTask,
} from '../data/tasksInventory';
import { getPersonalGoals } from '../data/personalGoals';
import { MIN_TOUCH, touchPrimaryButton } from '../styles/touchTargets';
import { TASK_STATUS_DISPLAY } from './TaskStatusSelector';
import { getDisplayPotentialValue } from '../data/potentialValue';

interface Props {
  profileId: string;
  onManageTask: (task: InventoryTask) => void;
  onGoAllTasks: () => void;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dateKeyFrom(y: number, m0: number, d: number) {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
}

export function TasksMonthView({ profileId, onManageTask, onGoAllTasks }: Props) {
  const todayKey = getTodayKey();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return { year: y, month0: m - 1 };
  });
  const [selectedDay, setSelectedDay] = useState(todayKey);

  const monthLabel = useMemo(() => {
    const d = new Date(cursor.year, cursor.month0, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [cursor]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month0, 1);
    const daysInMonth = new Date(cursor.year, cursor.month0 + 1, 0).getDate();
    const startOffset = first.getDay(); // Sun=0
    const out: Array<{ key: string; dateKey: string | null; day: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      out.push({ key: `pad-${i}`, dateKey: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = dateKeyFrom(cursor.year, cursor.month0, d);
      out.push({ key: dk, dateKey: dk, day: d });
    }
    return out;
  }, [cursor]);

  const dayTasks = selectedDay ? getInventoryTasksForDate(profileId, selectedDay) : [];
  const goals = getPersonalGoals(profileId);

  const shiftMonth = (delta: number) => {
    setCursor(prev => {
      const d = new Date(prev.year, prev.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 8,
      }}>
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          style={{
            ...touchPrimaryButton,
            minWidth: MIN_TOUCH,
            border: `1.5px solid ${C.border}`,
            background: C.bgCard,
            color: C.headline,
            fontWeight: 700,
          }}
          aria-label="Previous month"
        >
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.headline }}>{monthLabel}</div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          style={{
            ...touchPrimaryButton,
            minWidth: MIN_TOUCH,
            border: `1.5px solid ${C.border}`,
            background: C.bgCard,
            color: C.headline,
            fontWeight: 700,
          }}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
        marginBottom: 6, fontSize: 11, fontWeight: 700, color: C.secondary, textAlign: 'center',
      }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16,
      }}>
        {cells.map(cell => {
          if (!cell.dateKey) {
            return <div key={cell.key} style={{ minHeight: 48 }} />;
          }
          const count = countTasksOnDate(profileId, cell.dateKey);
          const overdue = hasOverdueOnDate(profileId, cell.dateKey, todayKey);
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedDay;
          const density = Math.min(count, 4);
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => setSelectedDay(cell.dateKey!)}
              style={{
                minHeight: 48,
                borderRadius: 10,
                border: isSelected
                  ? `2px solid ${C.primary}`
                  : isToday
                    ? `1.5px solid ${C.primary}80`
                    : `1px solid ${C.border}`,
                background: isSelected ? `${C.primary}12` : C.bgCard,
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 2,
              }}
            >
              <span style={{
                fontSize: 12,
                fontWeight: isToday || isSelected ? 800 : 600,
                color: overdue ? C.tertiary : C.headline,
              }}>
                {cell.day}
              </span>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', minHeight: 8 }}>
                {Array.from({ length: density }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: overdue ? C.tertiary : C.primary,
                    }}
                  />
                ))}
              </div>
              {count > 4 && (
                <span style={{ fontSize: 9, color: C.secondary, fontWeight: 700 }}>+{count - 4}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{
        background: C.bgCard,
        border: `1.5px solid ${C.border}`,
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.headline }}>
            {selectedDay === todayKey ? 'Today' : selectedDay}
          </div>
          <button
            type="button"
            onClick={onGoAllTasks}
            style={{
              ...touchPrimaryButton,
              border: `1.5px solid ${C.primary}`,
              background: `${C.primary}10`,
              color: C.primary,
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 12px',
            }}
          >
            Manage in All Tasks
          </button>
        </div>

        {dayTasks.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: C.secondary }}>
            No scheduled user tasks this day. Seed/routine tasks appear under All Tasks and Today.
          </p>
        ) : (
          dayTasks.map(task => {
            const status = getTaskStatus(profileId, task.id, selectedDay) as TaskStatus | null;
            const display = status ? TASK_STATUS_DISPLAY[status] : TASK_STATUS_DISPLAY.null;
            const goalTitle = task.goalId
              ? goals.find(g => g.id === task.goalId)?.title
              : undefined;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onManageTask(task)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: C.bgAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 8,
                  cursor: 'pointer',
                  minHeight: MIN_TOUCH,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: C.headline }}>{task.label}</div>
                <div style={{ fontSize: 11, color: C.secondary, marginTop: 4 }}>
                  {task.timeOfDay === 'morning' ? '☀️ Morning' : '🌙 Evening'}
                  {goalTitle ? ` · ${goalTitle}` : ' · Unassigned'}
                  {task.scheduleLabel ? ` · ${task.scheduleLabel}` : ''}
                  {' · '}
                  <span style={{ color: display.color, fontWeight: 700 }}>{display.label}</span>
                  {' · '}
                  <span
                    style={{ color: C.primary, fontWeight: 700 }}
                    title={`Potential Value: ${getDisplayPotentialValue(task.potentialValue).label}`}
                  >
                    Potential Value: {getDisplayPotentialValue(task.potentialValue).label}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
