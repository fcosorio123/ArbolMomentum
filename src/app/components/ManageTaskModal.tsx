import { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from 'antd';
import { C } from '../data/colors';
import type { UserTask, Recurrence } from '../data/userTasks';
import type { PersonalGoal } from '../data/personalGoals';

type ApplyTo = 'this' | 'all';

interface SaveData extends Omit<UserTask, 'id' | 'profileId' | 'createdAt'> {
  applyTo?: ApplyTo;
}

interface Props {
  open: boolean;
  task?: UserTask | null;
  defaultGoalId?: string;
  goals: PersonalGoal[];
  /** currentDate is the YYYY-MM-DD occurrence date; needed for "This task only" edits */
  currentDate?: string;
  onSave: (data: SaveData) => void;
  onCancel: () => void;
}

// ── Weekday toggle ────────────────────────────────────────────────────
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {WEEKDAY_LABELS.map((lbl, i) => {
        const active = value.includes(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            style={{
              flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${active ? C.primary : C.border}`,
              background: active ? C.primary : C.bgAlt,
              color: active ? '#fff' : C.secondary,
              fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

// ── Month date picker ─────────────────────────────────────────────────
function MonthDatePicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
        const active = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            style={{
              height: 30, borderRadius: 7, border: `1.5px solid ${active ? C.primary : C.border}`,
              background: active ? C.primary : C.bgAlt,
              color: active ? '#fff' : C.secondary,
              fontWeight: 600, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

// ── Recurrence type label helper ──────────────────────────────────────
function isRecurring(rec?: Recurrence): boolean {
  return !!rec && rec.type !== 'daily' && rec.type !== 'one-time';
}

// ── Main modal ────────────────────────────────────────────────────────
export function ManageTaskModal({ open, task, defaultGoalId, goals, currentDate, onSave, onCancel }: Props) {
  const isEdit = !!task;

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening'>('morning');
  const [goalId, setGoalId] = useState<string | undefined>(undefined);

  // Recurrence
  const [recType, setRecType] = useState<Recurrence['type']>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthDates, setMonthDates] = useState<number[]>([]);
  const [specificDate, setSpecificDate] = useState('');

  // Edit scope (only relevant when editing a recurring task)
  const [applyTo, setApplyTo] = useState<ApplyTo>('all');

  useEffect(() => {
    if (open) {
      setLabel(task?.label ?? '');
      setDescription(task?.description ?? '');
      setTimeOfDay(task?.timeOfDay ?? 'morning');
      setGoalId(task?.goalId ?? (!task ? defaultGoalId : undefined));
      setApplyTo('all');

      const rec = task?.recurrence;
      setRecType(rec?.type ?? 'daily');
      setWeekdays(rec?.weekdays ?? []);
      setMonthDates(rec?.monthDates ?? []);
      setSpecificDate(rec?.specificDate ?? currentDate ?? '');
    }
  }, [open, task, defaultGoalId, currentDate]);

  const buildRecurrence = (): Recurrence | undefined => {
    if (recType === 'daily') return undefined; // no recurrence field = daily
    if (recType === 'one-time') return { type: 'one-time', specificDate: specificDate || undefined };
    if (recType === 'weekly') return { type: 'weekly', weekdays };
    if (recType === 'monthly') return { type: 'monthly', monthDates };
  };

  const isRecurrenceValid = (): boolean => {
    if (recType === 'daily') return true;
    if (recType === 'one-time') return !!specificDate;
    if (recType === 'weekly') return weekdays.length > 0;
    if (recType === 'monthly') return monthDates.length > 0;
    return true;
  };

  const valid = label.trim().length > 0 && isRecurrenceValid();

  const handleSave = () => {
    const recurrence = buildRecurrence();
    onSave({
      label: label.trim(),
      description: description.trim() || undefined,
      timeOfDay,
      type: goalId ? 'goal' : 'routine',
      goalId: goalId || undefined,
      recurrence,
      // Pass applyTo only when editing a recurring task
      applyTo: isEdit && isRecurring(task?.recurrence) ? applyTo : undefined,
    });
  };

  const recTypes: Array<{ value: Recurrence['type']; label: string }> = [
    { value: 'daily', label: '📅 Daily' },
    { value: 'weekly', label: '🗓 Weekly' },
    { value: 'monthly', label: '📆 Monthly' },
    { value: 'one-time', label: '🎯 One-time' },
  ];

  const editingRecurring = isEdit && isRecurring(task?.recurrence);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      title={null}
      width="min(420px, calc(100vw - 24px))"
      styles={{
        content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ height: 5, background: `linear-gradient(90deg, #ef4565, #f5a623)` }} />
      <div style={{ padding: '22px 24px 24px', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 800, color: C.headline }}>
          {isEdit ? 'Edit Task' : 'Add Task'}
        </h3>

        {/* Task name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
            Task name <span style={{ color: '#ef4565' }}>*</span>
          </label>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Review budget for the week"
            size="large"
            style={{ borderRadius: 12 }}
            autoFocus
            onPressEnter={() => valid && handleSave()}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
            Description <span style={{ fontSize: 11, fontStyle: 'italic', fontWeight: 400 }}>optional</span>
          </label>
          <Input.TextArea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Any additional details..."
            rows={2}
            style={{ borderRadius: 12, resize: 'none' }}
          />
        </div>

        {/* Time of day */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
            Time of day
          </label>
          <Select
            value={timeOfDay}
            onChange={v => setTimeOfDay(v)}
            style={{ width: '100%' }}
            size="large"
            options={[
              { value: 'morning', label: '☀️ Morning' },
              { value: 'evening', label: '🌙 Evening' },
            ]}
          />
        </div>

        {/* Goal */}
        {goals.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
              Connected goal <span style={{ fontSize: 11, fontStyle: 'italic', fontWeight: 400 }}>optional</span>
            </label>
            <Select
              value={goalId}
              onChange={v => setGoalId(v)}
              allowClear
              placeholder="Which goal does this support?"
              style={{ width: '100%' }}
              size="large"
              options={goals.map(g => ({ value: g.id, label: g.title }))}
            />
          </div>
        )}

        {/* ── Recurrence ─────────────────────────────────────────────── */}
        <div style={{
          background: C.bgAlt, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: '14px', marginBottom: 14,
        }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 10 }}>
            Schedule
          </label>

          {/* Type pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: recType !== 'daily' ? 14 : 0 }}>
            {recTypes.map(rt => (
              <button
                key={rt.value}
                type="button"
                onClick={() => setRecType(rt.value)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  border: `1.5px solid ${recType === rt.value ? C.primary : C.border}`,
                  background: recType === rt.value ? `${C.primary}15` : C.bgCard,
                  color: recType === rt.value ? C.primary : C.secondary,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {rt.label}
              </button>
            ))}
          </div>

          {/* Weekly — weekday picker */}
          {recType === 'weekly' && (
            <div>
              <div style={{ fontSize: 11, color: C.secondary, marginBottom: 8 }}>Select days</div>
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
              {weekdays.length === 0 && (
                <div style={{ fontSize: 11, color: '#ef4565', marginTop: 6 }}>Select at least one day</div>
              )}
            </div>
          )}

          {/* Monthly — date picker */}
          {recType === 'monthly' && (
            <div>
              <div style={{ fontSize: 11, color: C.secondary, marginBottom: 8 }}>Select dates of month</div>
              <MonthDatePicker value={monthDates} onChange={setMonthDates} />
              {monthDates.length === 0 && (
                <div style={{ fontSize: 11, color: '#ef4565', marginTop: 6 }}>Select at least one date</div>
              )}
              <div style={{ fontSize: 10, color: C.secondary, marginTop: 8, lineHeight: 1.4 }}>
                Note: if a month doesn't have a selected date (e.g. 31st), that month will be skipped.
              </div>
            </div>
          )}

          {/* One-time — date input */}
          {recType === 'one-time' && (
            <div>
              <div style={{ fontSize: 11, color: C.secondary, marginBottom: 8 }}>Date</div>
              <input
                type="date"
                value={specificDate}
                onChange={e => setSpecificDate(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 10,
                  border: `1.5px solid ${specificDate ? C.primary : C.border}`,
                  fontSize: 14, color: C.headline, background: C.bgCard, outline: 'none',
                }}
              />
              {!specificDate && (
                <div style={{ fontSize: 11, color: '#ef4565', marginTop: 6 }}>Pick a date</div>
              )}
            </div>
          )}
        </div>

        {/* Apply to — only shown when editing a weekly/monthly task */}
        {editingRecurring && (
          <div style={{
            background: `${C.primary}08`, border: `1px solid ${C.primary}25`,
            borderRadius: 12, padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.secondary, marginBottom: 10 }}>Apply changes to</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { value: 'this' as ApplyTo, label: 'This occurrence only', sub: 'Only affects today\'s task' },
                { value: 'all' as ApplyTo, label: 'All future tasks', sub: 'Updates the recurring template' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setApplyTo(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    background: applyTo === opt.value ? `${C.primary}10` : C.bgCard,
                    border: `1.5px solid ${applyTo === opt.value ? C.primary + '50' : C.border}`,
                    borderRadius: 10, padding: '9px 12px', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${applyTo === opt.value ? C.primary : C.secondary}`,
                    background: applyTo === opt.value ? C.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {applyTo === opt.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: applyTo === opt.value ? C.primary : C.headline }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: C.secondary, marginTop: 1 }}>{opt.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button block onClick={onCancel}
            style={{ borderRadius: 12, height: 46, border: `1px solid ${C.border}`, color: C.secondary }}>
            Cancel
          </Button>
          <Button block type="primary" disabled={!valid} onClick={handleSave}
            style={{
              borderRadius: 12, height: 46, flex: 2,
              background: valid ? `linear-gradient(135deg, #ef4565, #f5a623)` : undefined,
              border: 'none', fontWeight: 700,
            }}>
            {isEdit ? 'Save Changes' : 'Save Task'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
