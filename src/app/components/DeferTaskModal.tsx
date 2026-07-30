/**
 * Work on this later — intentional deferral sheet.
 * Does not complete, skip, delete, or reset the task.
 */

import { useState } from 'react';
import { Modal, Button, Radio, Space, Typography } from 'antd';
import { C } from '../data/colors';
import {
  deferTask,
  type DeferResumePreset,
  type DeferReasonCode,
  DEFER_REASON_NEXT_ACTION,
} from '../data/taskDeferral';
import {
  isDeferralReasonCaptureEnabled,
  getEngagementControls,
} from '../data/engagementControls';
import { setTaskBlockedFlag } from '../data/liveCheckInFeedback';
import { getTodayKey } from '../data/profiles';

const { Text } = Typography;

const PRESETS: { id: DeferResumePreset; label: string }[] = [
  { id: 'later_today', label: 'Later today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'datetime', label: 'Choose a date and time' },
  { id: 'unsure', label: 'I am not sure yet' },
];

const REASONS: { id: DeferReasonCode; label: string }[] = [
  { id: 'busy', label: 'I am busy' },
  { id: 'overwhelmed', label: 'I feel overwhelmed' },
  { id: 'need_info', label: 'I need more information' },
  { id: 'need_help', label: 'I need help' },
  { id: 'too_difficult', label: 'This feels too difficult' },
  { id: 'waiting', label: 'I am waiting on someone else' },
  { id: 'other', label: 'Something else' },
];

export interface DeferTaskModalProps {
  open: boolean;
  profileId: string;
  taskId: string;
  taskLabel: string;
  sourceNid?: string;
  onClose: () => void;
  onDeferred?: (nextHint?: string) => void;
  onRequestSimplify?: () => void;
}

export function DeferTaskModal({
  open,
  profileId,
  taskId,
  taskLabel,
  sourceNid,
  onClose,
  onDeferred,
  onRequestSimplify,
}: DeferTaskModalProps) {
  const [preset, setPreset] = useState<DeferResumePreset>('tomorrow');
  const [whenLocal, setWhenLocal] = useState('');
  const [reason, setReason] = useState<DeferReasonCode | undefined>();
  const [step, setStep] = useState<'when' | 'reason'>('when');
  const captureReason = isDeferralReasonCaptureEnabled(profileId);
  const hyp = getEngagementControls().hypotheses;

  const reset = () => {
    setPreset('tomorrow');
    setWhenLocal('');
    setReason(undefined);
    setStep('when');
  };

  const finish = (withReason?: DeferReasonCode) => {
    const datetimeMs = preset === 'datetime' && whenLocal
      ? new Date(whenLocal).getTime()
      : undefined;
    const record = deferTask({
      profileId,
      taskId,
      taskLabel,
      resumePreset: preset,
      datetimeMs: datetimeMs && !Number.isNaN(datetimeMs) ? datetimeMs : undefined,
      reason: withReason,
      sourceNid,
    });

    let hint: string | undefined;
    if (withReason) {
      const next = DEFER_REASON_NEXT_ACTION[withReason];
      if (next === 'blocked') {
        setTaskBlockedFlag(profileId, taskId, getTodayKey(), true);
        hint = 'Marked as waiting for today. We will check back later.';
      } else if (next === 'simplify') {
        hint = 'Try breaking this into a smaller step.';
        onRequestSimplify?.();
      } else if (next === 'support') {
        hint = 'Reach out to a trusted person or advisor if you need help.';
      } else if (next === 'reminder') {
        hint = 'Reminder set for when you want to return.';
      }
    }

    if (record.deferCountInWindow >= hyp.repeatedDeferralCount) {
      hint = (hint ? `${hint} ` : '')
        + 'You have deferred this several times — consider Simplify or asking for help.';
      onRequestSimplify?.();
    }

    reset();
    onDeferred?.(hint);
    onClose();
  };

  const onConfirmWhen = () => {
    if (preset === 'datetime' && !whenLocal) return;
    if (captureReason) {
      setStep('reason');
      return;
    }
    finish();
  };

  return (
    <Modal
      open={open}
      title="Work on this later"
      onCancel={() => { reset(); onClose(); }}
      footer={null}
      destroyOnHidden
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        This keeps “{taskLabel}” open. It will not mark it done or skipped.
      </Text>

      {step === 'when' && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Radio.Group
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {PRESETS.map((p) => (
              <Radio key={p.id} value={p.id} style={{ color: C.headline }}>{p.label}</Radio>
            ))}
          </Radio.Group>
          {preset === 'datetime' && (
            <input
              type="datetime-local"
              value={whenLocal}
              onChange={(e) => setWhenLocal(e.target.value)}
              style={{
                width: '100%',
                minHeight: 44,
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 15,
              }}
            />
          )}
          <Button
            type="primary"
            block
            onClick={onConfirmWhen}
            disabled={preset === 'datetime' && !whenLocal}
            style={{ minHeight: 44 }}
          >
            {captureReason ? 'Continue' : 'Save reminder'}
          </Button>
        </Space>
      )}

      {step === 'reason' && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text strong style={{ color: C.headline }}>What is getting in the way right now? (optional)</Text>
          <Radio.Group
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {REASONS.map((r) => (
              <Radio key={r.id} value={r.id}>{r.label}</Radio>
            ))}
          </Radio.Group>
          <Button type="primary" block onClick={() => finish(reason)} style={{ minHeight: 44 }}>
            Save
          </Button>
          <Button block onClick={() => finish()} style={{ minHeight: 44 }}>
            Skip reason
          </Button>
        </Space>
      )}
    </Modal>
  );
}
