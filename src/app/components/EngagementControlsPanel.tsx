import { useEffect, useState } from 'react';
import { Button, Switch } from 'antd';
import { C } from '../data/colors';
import {
  fetchEngagementControls,
  saveEngagementControls,
  getEngagementControls,
  type EngagementControls,
} from '../data/engagementControls';

const TOGGLES: Array<{ key: keyof EngagementControls; label: string; help: string }> = [
  { key: 'attributionCollect', label: 'Attribution collection', help: 'Write nid funnel Entry events' },
  { key: 'adminNotifFunnel', label: 'Admin notification funnel', help: 'Show funnel panel on Analytics' },
  { key: 'taskDeferralUi', label: 'Work on this later UI', help: 'Student deferral sheet' },
  { key: 'deferralReminders', label: 'Deferral reminders', help: 'Schedule return reminders' },
  { key: 'deferralReasonCapture', label: 'Deferral reason capture', help: 'Privacy-sensitive — keep OFF until review' },
  { key: 'quickWinRecs', label: 'Quick-win recommendations', help: 'R2 — leave off until release' },
  { key: 'timingRecommendations', label: 'Timing recommendations', help: 'R3 — leave off until release' },
  { key: 'adaptiveTiming', label: 'Adaptive timing', help: 'R4 — leave off until evidence gates' },
];

export function EngagementControlsPanel() {
  const [controls, setControls] = useState<EngagementControls>(() => getEngagementControls());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchEngagementControls().then(setControls);
  }, []);

  const cardStyle = { background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', marginBottom: 14 };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        Adaptive engagement controls
      </div>
      {TOGGLES.map((t) => (
        <div key={t.key} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>{t.label}</div>
              <div style={{ color: C.body, fontSize: 12, marginTop: 4 }}>{t.help}</div>
            </div>
            <Switch
              checked={!!controls[t.key]}
              onChange={(v) => setControls((c) => ({ ...c, [t.key]: v }))}
              style={{ background: controls[t.key] ? C.primary : undefined }}
            />
          </div>
        </div>
      ))}
      <div style={{ ...cardStyle, fontSize: 12, color: C.body }}>
        Hypotheses (editable seeds — not validated product rules):
        repeat deferral {controls.hypotheses.repeatedDeferralCount} / {controls.hypotheses.deferralWindowDays}d;
        quick wins before priority {controls.hypotheses.quickWinsBeforePriority}.
        Disabling a control does not delete historical events or deferrals.
      </div>
      <Button
        type="primary"
        loading={saving}
        onClick={() => {
          setSaving(true);
          saveEngagementControls(controls);
          setSaving(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
        style={{ color: C.onPrimary, width: '100%', background: C.primary, border: 'none', borderRadius: 12, height: 44, fontWeight: 600 }}
      >
        {saved ? 'Engagement controls saved ✓' : 'Save engagement controls'}
      </Button>
    </div>
  );
}
