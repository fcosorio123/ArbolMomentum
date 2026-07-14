import { useState, useEffect } from 'react';
import { App, Button, Switch, Input, Modal } from 'antd';
import { BellOutlined, BellFilled, PlusOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SendOutlined, MobileOutlined, ReloadOutlined, CalendarOutlined, RightOutlined } from '@ant-design/icons';
import { DEFAULT_REMINDERS, type Profile } from '../data/profiles';
import { C } from '../data/colors';
import { areNotificationsEnabled, fetchAppSettings } from '../data/appSettings';
import { fetchEmailSettings } from '../data/emailSettings';
import { getProfileEmail } from '../data/profileContact';
import {
  getProfileAlertPrefs,
  saveProfileAlertPrefs,
  getEffectiveSmartSlots,
  formatSlotTime,
  toHtmlTimeValue,
  parseSlotTime,
  type ProfileAlertPrefs,
} from '../data/profileAlertPrefs';
import type { SmartSlotsConfig } from '../data/emailSettings';
import { showNotification } from '../data/notifications';
import { rebuildDailySchedule } from '../data/nudgeScheduler';
import {
  getPushPlatformInfo,
  requestNotificationPermission,
  ensurePushSubscription,
  VAPID_PUBLIC_KEY,
} from '../data/pushNotifications';
import { getFiredNudgesToday } from '../data/deviceAnalytics';

interface Reminder { id: string; label: string; time: string; days: string[]; enabled: boolean; }
interface Props {
  profile: Profile;
  swRegistration: ServiceWorkerRegistration | null;
  onShowInstallTutorial: () => void;
  onGoToCalendar: () => void;
}
type Permission = 'default' | 'granted' | 'denied';
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RemindersScreen({ profile, swRegistration, onShowInstallTutorial, onGoToCalendar }: Props) {
  const { message } = App.useApp();
  const [permission, setPermission] = useState<Permission>('default');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newDays, setNewDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [sending, setSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [notifGloballyEnabled, setNotifGloballyEnabled] = useState(() => areNotificationsEnabled());
  const [alertPrefs, setAlertPrefs] = useState<ProfileAlertPrefs>(() => getProfileAlertPrefs(profile.id));
  const [smartSlots, setSmartSlots] = useState<SmartSlotsConfig>(() => getEffectiveSmartSlots(profile.id));
  const platform = getPushPlatformInfo();

  const persistPrefs = (next: ProfileAlertPrefs) => {
    setAlertPrefs(next);
    saveProfileAlertPrefs(profile.id, next);
    const slots = getEffectiveSmartSlots(profile.id);
    setSmartSlots(slots);
    rebuildDailySchedule(profile.id);
  };

  const updateUserSlot = (key: keyof SmartSlotsConfig, patch: { enabled?: boolean; hour?: number; minute?: number }) => {
    const next: ProfileAlertPrefs = {
      ...alertPrefs,
      smartSlots: {
        ...(alertPrefs.smartSlots ?? {}),
        [key]: { ...(alertPrefs.smartSlots?.[key] ?? {}), ...patch },
      },
    };
    persistPrefs(next);
  };

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission as Permission);
    const saved = localStorage.getItem(`reminders-${profile.id}`);
    setReminders(saved ? (JSON.parse(saved) as Reminder[]) : DEFAULT_REMINDERS);
    fetchAppSettings().then(() => setNotifGloballyEnabled(areNotificationsEnabled()));
    fetchEmailSettings().then(() => {
      setAlertPrefs(getProfileAlertPrefs(profile.id));
      setSmartSlots(getEffectiveSmartSlots(profile.id));
    });
    rebuildDailySchedule(profile.id);
  }, [profile.id]);

  const save = (updated: Reminder[]) => {
    setReminders(updated);
    localStorage.setItem(`reminders-${profile.id}`, JSON.stringify(updated));
    rebuildDailySchedule(profile.id);
  };

  const requestPermission = async () => {
    if (!notifGloballyEnabled) { message.warning('Notifications are currently disabled by admin'); return; }
    if (platform.needsHomeScreenInstall) {
      message.info('Add Arbol to your Home Screen first, then enable notifications.');
      onShowInstallTutorial();
      return;
    }
    if (!platform.canRequestPermission && permission !== 'granted') {
      message.error(platform.troubleshootingHint ?? 'Notifications are not available on this device');
      return;
    }
    setEnabling(true);
    const result = await requestNotificationPermission(profile.id, swRegistration, profile.name);
    setPermission(result.permission as Permission);
    setEnabling(false);
    if (result.granted) {
      message.success(result.pushSubscribed
        ? 'Notifications enabled with background push! 🔔'
        : 'In-app reminders enabled while Arbol is open. For alerts when the app is closed, use the Calendar tab.');
      showTest();
    } else if (result.permission === 'denied') {
      message.error('Blocked — open browser or device settings to allow notifications');
    }
  };

  const retryPushSubscribe = async () => {
    setEnabling(true);
    await ensurePushSubscription(profile.id, swRegistration);
    setEnabling(false);
    message.success('Push subscription refreshed');
  };

  const showTest = async () => {
    setTestFeedback(null);
    if (!notifGloballyEnabled) {
      const msg = 'Notifications are currently disabled by admin.';
      setTestFeedback(msg);
      message.warning(msg);
      return;
    }
    if (!('Notification' in window)) {
      const msg = 'This browser does not support notifications.';
      setTestFeedback(msg);
      message.error(msg);
      return;
    }
    if (Notification.permission !== 'granted') {
      const msg = 'Enable notifications first, then tap Test again.';
      setTestFeedback(msg);
      message.warning(msg);
      return;
    }
    setSending(true);
    const firstName = profile.name.split(' ')[0];
    const title = 'Arbol Momentum 🌿';
    const body = `Hey ${firstName}! Test alert from Alerts & Reminders.`;
    try {
      const result = await showNotification(
        swRegistration,
        title,
        body,
        `test-${Date.now()}`,
        { skipDedupe: true },
      );
      if (result.ok) {
        const msg = 'Test notification sent — check your system notification tray.';
        setTestFeedback(msg);
        message.success(msg);
      } else {
        const msg = result.reason ?? 'Could not send test notification.';
        setTestFeedback(msg);
        message.error(msg);
      }
    } catch (err) {
      console.warn('Notification test failed:', err);
      const msg = 'Could not send notification — check device settings.';
      setTestFeedback(msg);
      message.error(msg);
    }
    setSending(false);
  };

  const toggle = (id: string) => {
    const updated = reminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    save(updated);
  };

  const add = () => {
    if (!newLabel.trim()) { message.warning('Please enter a label'); return; }
    if (!newDays.length) { message.warning('Select at least one day'); return; }
    const r: Reminder = { id: Date.now().toString(), label: newLabel, time: newTime, days: newDays, enabled: true };
    save([...reminders, r]);
    setShowAdd(false); setNewLabel(''); setNewTime('09:00'); setNewDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    message.success('Reminder added!');
  };

  const firedToday = getFiredNudgesToday(profile.id);

  return (
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px calc(100px + env(safe-area-inset-bottom, 0px))', background: C.bg, minHeight: '100dvh' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>Alerts & Reminders</h2>
        <p style={{ margin: '4px 0 0', color: C.body, fontSize: 13 }}>
          In-app nudges while you use Arbol, or calendar alarms when the app is closed
        </p>
      </div>

      {/* Add to Home Screen tutorial banner */}
      <button onClick={onShowInstallTutorial} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        background: `linear-gradient(135deg, ${C.headline}, #1a6da8)`,
        border: 'none', borderRadius: 16, padding: '14px 16px', marginBottom: 14, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(9,64,103,0.2)', textAlign: 'left',
      }}>
        <MobileOutlined style={{ color: '#fff', fontSize: 22 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Add to Home Screen</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            {platform.os === 'iOS'
              ? 'Required on iPhone for in-app notification alerts'
              : 'Install for a full-screen app experience on Android'}
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>›</span>
      </button>

      {/* Permission status */}
      <div style={{
        background: permission === 'granted' ? `${C.primary}12` : `${C.streak}12`,
        border: `1.5px solid ${permission === 'granted' ? C.primary + '40' : C.streak + '50'}`,
        borderRadius: 16, padding: '16px 18px', marginBottom: 16, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {permission === 'granted'
            ? <CheckCircleOutlined style={{ color: C.primary, fontSize: 22 }} />
            : <ExclamationCircleOutlined style={{ color: C.streak, fontSize: 22 }} />
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>
              {!notifGloballyEnabled ? 'Notifications disabled'
                : permission === 'granted' ? 'Notifications enabled'
                : permission === 'denied' ? 'Notifications blocked'
                : platform.needsHomeScreenInstall ? 'Install app first'
                : 'Enable notifications'}
            </div>
            <div style={{ color: C.body, fontSize: 12, marginTop: 2 }}>
              {!notifGloballyEnabled ? 'Notifications are turned off globally by admin'
                : permission === 'granted'
                  ? `${platform.os} · ${platform.isPwa ? 'Installed PWA' : 'Browser tab'} · ${firedToday.length} nudge${firedToday.length === 1 ? '' : 's'} sent today`
                : permission === 'denied' ? (platform.troubleshootingHint ?? 'Open browser settings to allow notifications')
                : platform.needsHomeScreenInstall
                  ? 'On iOS, add to Home Screen before enabling alerts'
                : 'Get FAFSA, TAP, and scholarship task reminders'}
            </div>
          </div>
          {notifGloballyEnabled && permission === 'default' && !platform.needsHomeScreenInstall && (
            <Button type="primary" size="small" icon={<BellOutlined />} onClick={requestPermission} loading={enabling}
              style={{ background: C.primary, border: 'none', borderRadius: 8, fontSize: 12, flexShrink: 0 }}>
              Enable
            </Button>
          )}
          {notifGloballyEnabled && permission === 'granted' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
              <Button size="small" icon={<SendOutlined />} onClick={showTest} loading={sending}
                style={{ background: `${C.primary}15`, border: `1px solid ${C.primary}40`, color: C.primary, borderRadius: 8, fontSize: 12 }}>
                Test
              </Button>
              {platform.pushSupported && VAPID_PUBLIC_KEY && (
                <Button size="small" icon={<ReloadOutlined />} onClick={retryPushSubscribe} loading={enabling}
                  style={{ fontSize: 11, borderRadius: 8 }}>
                  Sync push
                </Button>
              )}
            </div>
          )}
          {notifGloballyEnabled && platform.needsHomeScreenInstall && (
            <Button size="small" onClick={onShowInstallTutorial}
              style={{ borderRadius: 8, fontSize: 12, flexShrink: 0 }}>
              How to install
            </Button>
          )}
        </div>
        {testFeedback && (
          <div style={{
            marginTop: 10, fontSize: 12, lineHeight: 1.4, fontWeight: 600,
            color: testFeedback.toLowerCase().includes('sent') ? C.primary : C.tertiary,
          }}>
            {testFeedback}
          </div>
        )}
        {platform.troubleshootingHint && permission !== 'granted' && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10,
            background: C.bgAlt, fontSize: 12, color: C.body, lineHeight: 1.5,
          }}>
            💡 {platform.troubleshootingHint}
          </div>
        )}
      </div>

      {/* Reminder options comparison */}
      <div style={{
        background: C.bgCard, border: `1.5px solid ${C.primary}35`, borderRadius: 16,
        padding: '14px 16px', marginBottom: 16, boxShadow: C.shadow,
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.headline, marginBottom: 10 }}>
          Which reminders work when Arbol is closed?
        </div>
        {[
          {
            label: 'In-app nudges',
            closed: 'No — while Arbol is open',
            highlight: false,
          },
          {
            label: 'Calendar sync + alarms',
            closed: 'Yes — via Google or Apple Calendar',
            highlight: true,
          },
          {
            label: 'Web push',
            closed: 'Yes — needs backend (not live yet)',
            highlight: false,
          },
        ].map(row => (
          <div
            key={row.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              padding: '8px 0',
              borderBottom: `1px solid ${C.border}`,
              alignItems: 'start',
            }}
          >
            <span style={{
              fontSize: 12,
              fontWeight: row.highlight ? 700 : 600,
              color: row.highlight ? C.primary : C.headline,
            }}>
              {row.label}
            </span>
            <span style={{
              fontSize: 11,
              color: row.highlight ? C.headline : C.secondary,
              textAlign: 'right',
              maxWidth: 168,
              lineHeight: 1.4,
            }}>
              {row.closed}
            </span>
          </div>
        ))}
        <p style={{ margin: '10px 0 12px', fontSize: 11, color: C.secondary, lineHeight: 1.45 }}>
          Open the Calendar tab to sync tasks — your phone reminds you even when Arbol is closed.
        </p>
        <Button
          type="primary"
          icon={<CalendarOutlined />}
          onClick={onGoToCalendar}
          style={{ borderRadius: 10, fontWeight: 600, width: '100%' }}
        >
          Open Calendar tab
          <RightOutlined style={{ fontSize: 11, marginLeft: 4 }} />
        </Button>
      </div>

      {/* Email reminders */}
      <div style={{
        background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16,
        padding: '14px 16px', marginBottom: 16, boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.headline }}>Email reminders</div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.secondary, lineHeight: 1.45 }}>
              {getProfileEmail(profile.id)
                ? 'Scheduled emails send from the server — even when Arbol is closed.'
                : 'Add your email on the Profile tab to enable email reminders.'}
            </p>
          </div>
          <Switch
            checked={alertPrefs.emailEnabled !== false}
            disabled={!getProfileEmail(profile.id)}
            onChange={enabled => persistPrefs({ ...alertPrefs, emailEnabled: enabled })}
            style={{ background: alertPrefs.emailEnabled !== false ? C.primary : undefined }}
          />
        </div>
      </div>

      {/* Daily nudge schedule */}
      <div style={{
        background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16,
        padding: '14px 16px', marginBottom: 16, boxShadow: C.shadow,
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.headline, marginBottom: 4 }}>Daily smart nudges</div>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: C.secondary }}>
          Customize times for your profile. Emails use these times server-side; in-app alerts while Arbol is open.
        </p>
        {([
          ['morning', 'Morning overview', 'Key open tasks for today'],
          ['midday', 'Midday check-in', 'Goal-linked task progress'],
          ['evening', 'Evening summary', 'Celebrate progress or last-chance reminder'],
          ['streakRisk', 'Streak-at-risk', 'Protect your streak before day ends'],
        ] as [keyof SmartSlotsConfig, string, string][]).map(([key, label, desc]) => {
          const slot = smartSlots[key];
          return (
            <div key={key} style={{
              display: 'flex', gap: 12, padding: '10px 0',
              borderBottom: `1px solid ${C.border}`,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              <Switch
                checked={slot.enabled}
                onChange={enabled => updateUserSlot(key, { enabled })}
                style={{ background: slot.enabled ? C.primary : undefined }}
              />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.headline }}>{label}</div>
                <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.headline }}>{formatSlotTime(slot)}</span>
                <Input
                  type="time"
                  value={toHtmlTimeValue(slot)}
                  disabled={!slot.enabled}
                  onChange={e => {
                    const { hour, minute } = parseSlotTime(e.target.value);
                    updateUserSlot(key, { hour, minute });
                  }}
                  style={{ width: 110, borderRadius: 8 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Reminders list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Custom reminders</span>
        <Button type="text" icon={<PlusOutlined />} size="small" onClick={() => setShowAdd(true)} style={{ color: C.primary, fontSize: 13 }}>Add</Button>
      </div>

      {reminders.map(r => (
        <div key={r.id} style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, marginBottom: 10, overflow: 'hidden', boxShadow: C.shadow }}>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, background: r.enabled ? `${C.primary}15` : C.bgAlt, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${r.enabled ? C.primary + '30' : C.border}` }}>
                  {r.enabled ? <BellFilled style={{ color: C.primary, fontSize: 18 }} /> : <BellOutlined style={{ color: C.secondary, fontSize: 18 }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: r.enabled ? C.headline : C.secondary }}>{r.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: r.enabled ? C.primary : C.secondary, lineHeight: 1.2 }}>{r.time}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Switch checked={r.enabled} onChange={() => toggle(r.id)} style={{ background: r.enabled ? C.primary : undefined }} />
                <Button type="text" icon={<DeleteOutlined />} size="small" onClick={() => save(reminders.filter(x => x.id !== r.id))}
                  style={{ color: C.secondary, padding: 4 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
              {ALL_DAYS.map(day => (
                <span key={day} style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 6,
                  background: r.days.includes(day) ? `${C.primary}15` : C.bgAlt,
                  color: r.days.includes(day) ? C.primary : C.secondary,
                  fontWeight: r.days.includes(day) ? 600 : 400,
                  border: `1px solid ${r.days.includes(day) ? C.primary + '40' : C.border}`,
                }}>{day}</span>
              ))}
            </div>
          </div>
        </div>
      ))}

      <Modal open={showAdd} title={<span style={{ color: C.headline }}>New Reminder</span>}
        onCancel={() => setShowAdd(false)} onOk={add} okText="Save Reminder"
        width="min(400px, calc(100vw - 24px))"
        okButtonProps={{ style: { background: C.primary, border: 'none' } }}>
        <div style={{ paddingTop: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: C.body, fontSize: 12, marginBottom: 6 }}>Label</label>
            <Input placeholder="e.g. FAFSA deadline check" value={newLabel} onChange={e => setNewLabel(e.target.value)}
              style={{ borderRadius: 8 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: C.body, fontSize: 12, marginBottom: 6 }}>Time</label>
            <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ display: 'block', color: C.body, fontSize: 12, marginBottom: 8 }}>Days</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL_DAYS.map(day => (
                <button key={day} onClick={() => setNewDays(p => p.includes(day) ? p.filter(d => d !== day) : [...p, day])} style={{
                  padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                  border: `1.5px solid ${newDays.includes(day) ? C.primary : C.border}`,
                  background: newDays.includes(day) ? `${C.primary}15` : C.bgAlt,
                  color: newDays.includes(day) ? C.primary : C.body,
                  fontWeight: newDays.includes(day) ? 700 : 400,
                }}>{day}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
