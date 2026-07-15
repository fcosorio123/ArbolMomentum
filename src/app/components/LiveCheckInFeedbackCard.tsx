import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button } from 'antd';
import { SoundOutlined, CaretDownOutlined, CaretUpOutlined, InfoCircleOutlined } from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Label,
} from 'recharts';
import {
  type ReportEntry,
  getLatestReport,
  getRecentReports,
  getTodayChartData,
  ADJUSTMENT_LABELS,
} from '../data/liveCheckInFeedback';
import { isVoicePlaybackEnabled } from '../data/liveCheckInSettings';
import { C } from '../data/colors';
import { ACCENT_MODAL_STYLES, ModalAccentBar } from '../styles/modalChrome';

interface Props {
  profileId: string;
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

function LiveCheckInHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      centered
      width="min(420px, calc(100vw - 24px))"
      destroyOnClose
      styles={ACCENT_MODAL_STYLES}
    >
      <ModalAccentBar gradient={`linear-gradient(90deg, ${C.primary}, #3da9fc)`} />
      <div style={{ padding: '16px 24px 24px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: C.headline }}>
          How to read Live check-in
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: C.body, lineHeight: 1.5 }}>
          Each time you mark a task Done, Arbol logs a check-in and updates this chart for today.
        </p>

        <div style={{ fontSize: 13, color: C.body, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: C.headline, marginBottom: 4 }}>X axis: Check-ins today</div>
            <div style={{ color: C.secondary, fontSize: 12 }}>
              Left to right follows your completions in order today.
              <strong> Done 1</strong> is the first task you finished, then <strong>Done 2</strong>, and so on.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: C.headline, marginBottom: 4 }}>Y axis: Score (0-100)</div>
            <div style={{ color: C.secondary, fontSize: 12 }}>
              Higher is better. Both lines share this scale.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: C.primary, marginBottom: 4 }}>Solid line: Progress %</div>
            <div style={{ color: C.secondary, fontSize: 12 }}>
              How much of today&apos;s task list is already Done at that moment. Climbing means you are closing work.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: C.headline, marginBottom: 4 }}>Dashed line: Momentum</div>
            <div style={{ color: C.secondary, fontSize: 12 }}>
              A 0-100 score based on progress plus recent action (and penalties for too many open tasks, blockers, or slips).
              Rising momentum usually means your pace and focus are healthy.
            </div>
          </div>

          <div style={{
            padding: '10px 12px', borderRadius: 12, background: C.bgAlt, border: `1px solid ${C.border}`,
            fontSize: 12, color: C.body,
          }}>
            Tip: if Progress rises but Momentum drops, you may have too many tasks In progress or friction in your notes.
            Narrow to one next action.
          </div>
        </div>

        <Button
          type="primary"
          block
          onClick={onClose}
          style={{
            marginTop: 18, height: 46, borderRadius: 12, fontWeight: 700, border: 'none',
            background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
          }}
        >
          Got it
        </Button>
      </div>
    </Modal>
  );
}

export function LiveCheckInFeedbackCard({ profileId }: Props) {
  const [latest, setLatest] = useState<ReportEntry | null>(() => getLatestReport(profileId));
  const [ledger, setLedger] = useState<ReportEntry[]>(() => getRecentReports(profileId, 5));
  const [chartData, setChartData] = useState(() => getTodayChartData(profileId));
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const refresh = useCallback(() => {
    setLatest(getLatestReport(profileId));
    setLedger(getRecentReports(profileId, 5));
    setChartData(getTodayChartData(profileId));
  }, [profileId]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('arbol-live-feedback-updated', handler);
    return () => window.removeEventListener('arbol-live-feedback-updated', handler);
  }, [refresh]);

  const voiceSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    isVoicePlaybackEnabled();

  const showUrgent = latest?.warningType === 'urgent_safety';

  const chartHasData = chartData.length > 0;
  const displayChart = useMemo(
    () => (chartHasData ? chartData : [{ label: '-', progress: 0, momentum: 0 }]),
    [chartData, chartHasData],
  );
  const pointCount = displayChart.length;
  const manyTicks = pointCount > 5;
  // Never show every tick when crowded — Recharts interval=0 caused overlapping "Done N" labels
  const xTickInterval = pointCount <= 3
    ? 0
    : pointCount <= 6
      ? 1
      : Math.max(1, Math.ceil(pointCount / 4) - 1);


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

      <div style={cardStyle} id="live-check-in-card" data-tour-id="tasks-live-checkin">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.headline }}>Live check-in</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {latest && (
              <span style={{ fontSize: 11, color: C.secondary }}>{formatRelativeTime(latest.timestamp)}</span>
            )}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="How to read Live check-in chart"
              title="How to read this chart"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: C.primary, fontSize: 16, display: 'inline-flex', alignItems: 'center',
              }}
            >
              <InfoCircleOutlined />
            </button>
          </div>
        </div>

        {/* Today's progress chart */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 6, gap: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.secondary }}>
              Today&apos;s momentum
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 11, fontWeight: 700, color: C.primary,
              }}
            >
              How to read
            </button>
          </div>
          <div style={{ width: '100%', height: manyTicks ? 172 : 158 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayChart} margin={{ top: 8, right: 12, left: 4, bottom: manyTicks ? 36 : 22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: manyTicks ? 9 : 10, fill: C.secondary }}
                  interval={xTickInterval}
                  minTickGap={manyTicks ? 28 : 16}
                  height={manyTicks ? 52 : 36}
                  angle={manyTicks ? -35 : 0}
                  textAnchor={manyTicks ? 'end' : 'middle'}
                  tickFormatter={(v: string) => {
                    const m = String(v).match(/^Done\s+(\d+)$/i);
                    if (m) return `#${m[1]}`;
                    return String(v).length > 10 ? `${String(v).slice(0, 8)}…` : String(v);
                  }}
                >
                  <Label
                    value="Check-ins today →"
                    position="insideBottom"
                    offset={manyTicks ? -2 : -2}
                    style={{ fontSize: 10, fill: C.secondary, fontWeight: 600 }}
                  />
                </XAxis>
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: C.secondary }}
                  width={40}
                  ticks={[0, 25, 50, 75, 100]}
                >
                  <Label
                    value="Score (0-100)"
                    angle={-90}
                    position="insideLeft"
                    offset={10}
                    style={{ fontSize: 10, fill: C.secondary, fontWeight: 600, textAnchor: 'middle' }}
                  />
                </YAxis>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
                  labelFormatter={(label) => `Check-in: ${label}`}
                  formatter={(value: number, name: string) => [
                    `${value}`,
                    name === 'progress' ? 'Progress %' : 'Momentum',
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 10, paddingBottom: 4 }}
                  formatter={(value) => (value === 'progress' ? 'Progress %' : 'Momentum')}
                />
                {chartHasData && (
                  <>
                    <Line type="monotone" dataKey="progress" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} name="progress" />
                    <Line type="monotone" dataKey="momentum" stroke={C.headline} strokeWidth={2} dot={{ r: 3 }} name="momentum" strokeDasharray="4 2" />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!chartHasData && (
            <div style={{ fontSize: 11, color: C.secondary, textAlign: 'center', marginTop: -8 }}>
              Complete a task to start the chart.
            </div>
          )}
        </div>

        {!latest ? (
          <div style={{ fontSize: 13, color: C.secondary, lineHeight: 1.5, padding: '8px 0' }}>
            Mark a task Done to get your live check-in feedback.
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
              {latest.recommendedNextAction.adjustment && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                  background: '#fff7e6', color: '#d48806',
                }}>
                  Coach: {ADJUSTMENT_LABELS[latest.recommendedNextAction.adjustment]}
                </span>
              )}
              {latest.recommendedNextAction.reason && (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 8,
                  background: C.bgAlt, color: C.secondary,
                }}>
                  {latest.recommendedNextAction.reason}
                </span>
              )}
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

        {ledger.length > 0 && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <button
              onClick={() => setLedgerOpen(o => !o)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                fontWeight: 600, color: C.secondary,
              }}
            >
              Recent completions ({ledger.length})
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

      <LiveCheckInHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
