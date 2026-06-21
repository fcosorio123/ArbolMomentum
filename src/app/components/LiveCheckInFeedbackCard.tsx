import { useState, useEffect, useCallback } from 'react';
import { SoundOutlined, CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons';
import {
  type ReportEntry,
  getLatestReport,
  getRecentReports,
  LOADER_MESSAGES,
} from '../data/liveCheckInFeedback';
import { isVoicePlaybackEnabled } from '../data/liveCheckInSettings';
import { C } from '../data/colors';

interface Props {
  profileId: string;
  isProcessing: boolean;
  processingMessage: string;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const MOVEMENT_META = {
  up: { icon: '↑', label: 'Up', color: C.primary },
  flat: { icon: '→', label: 'Flat', color: C.secondary },
  down: { icon: '↓', label: 'Down', color: C.tertiary },
};

function speakText(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

export function LiveCheckInFeedbackCard({ profileId, isProcessing, processingMessage }: Props) {
  const [latest, setLatest] = useState<ReportEntry | null>(() => getLatestReport(profileId));
  const [ledger, setLedger] = useState<ReportEntry[]>(() => getRecentReports(profileId, 5));
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const refresh = useCallback(() => {
    setLatest(getLatestReport(profileId));
    setLedger(getRecentReports(profileId, 5));
  }, [profileId]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('arbol-live-feedback-updated', handler);
    return () => window.removeEventListener('arbol-live-feedback-updated', handler);
  }, [refresh]);

  useEffect(() => {
    if (!isProcessing) refresh();
  }, [isProcessing, refresh]);

  const voiceSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    isVoicePlaybackEnabled();

  const showUrgent = latest?.warningType === 'urgent_safety' && !isProcessing;

  const cardStyle = {
    background: C.bgCard,
    border: `1.5px solid ${C.border}`,
    borderRadius: 16,
    padding: '14px 18px',
    marginBottom: 16,
    boxShadow: C.shadow,
  };

  return (
    <>
      {showUrgent && (
        <div style={{
          background: '#fff1f0',
          border: '1.5px solid #ffccc7',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 12,
          fontSize: 13,
          color: '#cf1322',
          lineHeight: 1.5,
        }}>
          <strong>Urgent safety notice</strong>
          <div style={{ marginTop: 4 }}>{latest!.responseText}</div>
        </div>
      )}

      <div style={cardStyle} id="live-check-in-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>Live check-in</span>
          {latest && !isProcessing && (
            <span style={{ fontSize: 11, color: C.secondary }}>{formatRelativeTime(latest.timestamp)}</span>
          )}
        </div>

        {isProcessing ? (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `3px solid ${C.border}`, borderTopColor: C.primary,
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 13, color: C.body, lineHeight: 1.5 }}>
              {processingMessage || LOADER_MESSAGES[0]}
            </div>
          </div>
        ) : !latest ? (
          <div style={{ fontSize: 13, color: C.secondary, lineHeight: 1.5, padding: '8px 0' }}>
            Report your first update to start the ledger.
          </div>
        ) : (
          <>
            {latest.warningType !== 'urgent_safety' && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: C.body, lineHeight: 1.55 }}>
                {latest.responseText}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                background: `${C.primary}12`, color: C.primary,
              }}>
                Next: {latest.recommendedNextAction.label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                background: C.bgAlt, color: MOVEMENT_META[latest.movementState].color,
              }}>
                {MOVEMENT_META[latest.movementState].icon} {MOVEMENT_META[latest.movementState].label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                background: C.bgAlt, color: C.headline,
              }}>
                {latest.progressAtTime}% progress
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                background: C.bgAlt, color: C.headline,
              }}>
                Momentum {latest.momentumScore}
              </span>
            </div>

            {voiceSupported && latest.warningType !== 'urgent_safety' && (
              <button
                onClick={() => {
                  if (speaking) {
                    window.speechSynthesis.cancel();
                    setSpeaking(false);
                  } else {
                    setSpeaking(true);
                    speakText(latest.responseText);
                    setTimeout(() => setSpeaking(false), latest.responseText.length * 45);
                  }
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: C.body,
                }}
              >
                <SoundOutlined /> {speaking ? 'Stop' : 'Read aloud'}
              </button>
            )}
          </>
        )}

        {ledger.length > 0 && !isProcessing && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <button
              onClick={() => setLedgerOpen(o => !o)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                fontWeight: 600, color: C.secondary,
              }}
            >
              Recent updates ({ledger.length})
              {ledgerOpen ? <CaretUpOutlined /> : <CaretDownOutlined />}
            </button>
            {ledgerOpen && (
              <div style={{ marginTop: 8 }}>
                {ledger.map(entry => (
                  <div key={entry.id} style={{
                    padding: '8px 0', borderBottom: `1px solid ${C.border}`,
                    fontSize: 12, color: C.body, lineHeight: 1.45,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: C.headline }}>{entry.taskTitle}</span>
                      <span style={{ color: C.secondary, fontSize: 11 }}>{formatRelativeTime(entry.timestamp)}</span>
                    </div>
                    <div style={{ color: C.secondary, fontSize: 11 }}>
                      {entry.progressAtTime}% · Momentum {entry.momentumScore}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
