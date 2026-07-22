/**
 * Optional voice entry for Add Goal / Add Task.
 * Populates form callbacks only — never saves or persists.
 */
import { useEffect, useRef, useState } from 'react';
import { AudioOutlined, StopOutlined } from '@ant-design/icons';
import { C } from '../data/colors';
import { VoiceCaptureSession, isVoiceCaptureSupported, type VoiceCaptureStatus } from '../data/voiceSpeech';
import {
  extractVoiceFormDraft,
  VOICE_GOAL_INSTRUCTIONS,
  VOICE_TASK_INSTRUCTIONS,
  type VoiceRecordType,
  type VoiceGoalDraft,
  type VoiceTaskDraft,
  type VoiceExtractResult,
} from '../data/voiceExtract';
import type { PersonalGoal } from '../data/personalGoals';

interface Props {
  recordType: VoiceRecordType;
  /** Goals available for task→goal matching (ignored for goals). */
  goals?: ReadonlyArray<PersonalGoal>;
  onApplyGoal?: (draft: VoiceGoalDraft, meta: VoiceExtractResult) => void;
  onApplyTask?: (draft: VoiceTaskDraft, meta: VoiceExtractResult) => void;
  /** Reset when parent modal closes. */
  active: boolean;
}

export function VoiceInputPanel({
  recordType,
  goals = [],
  onApplyGoal,
  onApplyTask,
  active,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<VoiceCaptureStatus>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [hints, setHints] = useState<string[]>([]);
  const sessionRef = useRef<VoiceCaptureSession | null>(null);
  const requestGen = useRef(0);

  const instructions = recordType === 'goal' ? VOICE_GOAL_INSTRUCTIONS : VOICE_TASK_INSTRUCTIONS;
  const supported = isVoiceCaptureSupported();

  useEffect(() => {
    if (!active) {
      sessionRef.current?.cancel();
      sessionRef.current = null;
      setExpanded(false);
      setStatus('idle');
      setLiveTranscript('');
      setInterim('');
      setErrorMessage(undefined);
      setHints([]);
      requestGen.current += 1;
    }
  }, [active]);

  useEffect(() => () => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
  }, []);

  const ensureSession = () => {
    if (!sessionRef.current) {
      sessionRef.current = new VoiceCaptureSession((s) => {
        setStatus(s.status);
        setLiveTranscript(s.transcript);
        setInterim(s.interim);
        if (s.errorMessage) setErrorMessage(s.errorMessage);
      });
    }
    return sessionRef.current;
  };

  const applyTranscript = (text: string, gen: number) => {
    if (gen !== requestGen.current) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus('error');
      setErrorMessage('Nothing was captured. Try again, or type manually.');
      return;
    }
    const result = extractVoiceFormDraft(recordType, trimmed, goals);
    if (gen !== requestGen.current) return;

    const miss = result.missingRequiredFields;
    const nextHints: string[] = [];
    if (miss.length) {
      nextHints.push(
        recordType === 'goal'
          ? 'Goal name is still missing — type it or try voice again.'
          : 'Task name is still missing — type it or try voice again.',
      );
    }
    for (const u of result.uncertainFields) {
      nextHints.push(`Check “${u}” — it may need a manual edit.`);
    }
    setHints(nextHints);

    if (result.recordType === 'goal') {
      onApplyGoal?.(result.draft, result);
    } else {
      onApplyTask?.(result.draft, result);
    }
    setStatus('idle');
    setExpanded(false);
    setLiveTranscript('');
    setInterim('');
  };

  const startListening = () => {
    if (!supported) {
      setStatus('unsupported');
      setErrorMessage('Voice input is not supported in this browser. Type manually instead.');
      return;
    }
    setErrorMessage(undefined);
    setHints([]);
    setLiveTranscript('');
    setInterim('');
    requestGen.current += 1;
    ensureSession().start();
  };

  const stopAndApply = () => {
    const gen = ++requestGen.current;
    const text = ensureSession().stop();
    // Brief tick so UI shows processing, then extract locally (sync)
    window.setTimeout(() => applyTranscript(text, gen), 50);
  };

  const cancelRecording = () => {
    requestGen.current += 1;
    sessionRef.current?.cancel();
    setStatus('idle');
    setLiveTranscript('');
    setInterim('');
    setErrorMessage(undefined);
  };

  if (!expanded) {
    return (
      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setErrorMessage(undefined);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 12px',
            minHeight: 44,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.bgAlt,
            color: C.secondary,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-expanded={false}
        >
          <AudioOutlined aria-hidden />
          Add using voice
        </button>
      </div>
    );
  }

  const listening = status === 'listening';
  const processing = status === 'processing';

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.bgAlt,
      }}
      role="region"
      aria-label="Add using voice"
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: C.headline, marginBottom: 8 }}>
        Add using voice
      </div>
      <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12, color: C.secondary, lineHeight: 1.45 }}>
        {instructions.map((line) => (
          <li key={line} style={{ marginBottom: 4 }}>{line}</li>
        ))}
      </ul>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: C.body, lineHeight: 1.4 }}>
        Suggestions fill this form only. Nothing is saved until you tap{' '}
        {recordType === 'goal' ? 'Add goal' : 'Add task'}.
        {supported
          ? ' Speech is processed by your browser’s speech service; Arbol does not store the audio.'
          : ''}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {!listening && !processing && (
          <button
            type="button"
            onClick={startListening}
            disabled={!supported && status === 'unsupported'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryPressed})`,
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              minHeight: 44,
            }}
          >
            <AudioOutlined aria-hidden />
            Start recording
          </button>
        )}
        {listening && (
          <button
            type="button"
            onClick={stopAndApply}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 10, border: 'none',
              background: C.primary, color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', minHeight: 44,
            }}
          >
            <StopOutlined aria-hidden />
            Stop &amp; fill form
          </button>
        )}
        {(listening || processing) && (
          <button
            type="button"
            onClick={cancelRecording}
            style={{
              padding: '8px 12px', borderRadius: 10,
              border: `1px solid ${C.border}`, background: '#fff',
              color: C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 44,
            }}
          >
            Cancel
          </button>
        )}
        {!listening && !processing && (
          <button
            type="button"
            onClick={() => {
              cancelRecording();
              setExpanded(false);
            }}
            style={{
              padding: '8px 12px', borderRadius: 10,
              border: `1px solid ${C.border}`, background: '#fff',
              color: C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 44,
            }}
          >
            Type instead
          </button>
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        style={{ fontSize: 12, color: C.body, minHeight: 18 }}
      >
        {listening && (
          <span>
            Listening… {interim || liveTranscript ? `"${(interim || liveTranscript).slice(0, 120)}"` : 'Speak now.'}
          </span>
        )}
        {processing && <span>Filling the form…</span>}
        {status === 'permission_denied' && <span>{errorMessage}</span>}
        {status === 'unsupported' && <span>{errorMessage}</span>}
        {status === 'error' && errorMessage && <span>{errorMessage}</span>}
      </div>

      {hints.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 11, color: C.secondary }}>
          {hints.map((h) => <li key={h}>{h}</li>)}
        </ul>
      )}
    </div>
  );
}
