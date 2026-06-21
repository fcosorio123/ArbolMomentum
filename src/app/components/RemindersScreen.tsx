import { useState, useEffect } from 'react';
import { App, Button, Switch, Input, Modal } from 'antd';
import { BellOutlined, BellFilled, PlusOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SendOutlined, MobileOutlined } from '@ant-design/icons';
import { DEFAULT_REMINDERS, type Profile } from '../data/profiles';
import { C } from '../data/colors';
import { areNotificationsEnabled, fetchAppSettings } from '../data/appSettings';
import { showNotification } from '../data/notifications';

interface Reminder { id: string; label: string; time: string; days: string[]; enabled: boolean; }
interface Props { profile: Profile; swRegistration: ServiceWorkerRegistration | null; onShowInstallTutorial: () => void; }
type Permission = 'default' | 'granted' | 'denied';
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RemindersScreen({ profile, swRegistration, onShowInstallTutorial }: Props) {
  const { message } = App.useApp();
  const [permission, setPermission] = useState<Permission>('default');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newDays, setNewDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [sending, setSending] = useState(false);
  const [notifGloballyEnabled, setNotifGloballyEnabled] = useState(() => areNotificationsEnabled());

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission as Permission);
    const saved = localStorage.getItem(`reminders-${profile.id}`);
    setReminders(saved ? (JSON.parse(saved) as Reminder[]) : DEFAULT_REMINDERS);
    fetchAppSettings().then(() => setNotifGloballyEnabled(areNotificationsEnabled()));
  }, [profile.id]);

  const save = (updated: Reminder[]) => {
    setReminders(updated);
    localStorage.setItem(`reminders-${profile.id}`, JSON.stringify(updated));
  };

  const requestPermission = async () => {
    if (!notifGloballyEnabled) { message.warning('Notifications are currently disabled by admin'); return; }
    if (!('Notification' in window)) { message.error('Notifications not supported on this device'); return; }
    // If already granted just fire a test - re-requesting won't re-show the prompt
    // and Android may show a confusing "already allowed" state.
    if (Notification.permission === 'granted') { setPermission('granted'); showTest(); return; }
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    if (result === 'granted') { message.success('Notifications enabled! 🔔'); showTest(); }
    else if (result === 'denied') message.error('Blocked - open browser settings to allow notifications');
  };

  const showTest = async () => {
    if (!notifGloballyEnabled) { message.warning('Notifications are currently disabled by admin'); return; }
    if (Notification.permission !== 'granted') { message.warning('Enable notifications first'); return; }
    setSending(true);
    const title = 'Arbol Momentum 🌿';
    const body = `Hey ${profile.name.split(' ')[0]}! Time for your home reset. Keep that streak alive! 🔥`;
    try {
      await showNotification(swRegistration, title, body, 'test');
      message.success('Test notification sent!');
    } catch (err) {
      console.warn('Notification test failed:', err);
      message.error('Could not send notification - check device settings');
    }
    setSending(false);
  };

  const scheduleReminder = (r: Reminder) => {
    if (!notifGloballyEnabled) return;
    if (Notification.permission !== 'granted') return;
    const [h, m] = r.time.split(':').map(Number);
    const now = new Date(), target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    setTimeout(async () => {
      await showNotification(swRegistration, `${r.label} ⏰`, `Time for your ${r.label.toLowerCase()}! 🔥`, `r-${r.id}`);
    }, target.getTime() - now.getTime());
  };

  const toggle = (id: string) => {
    const updated = reminders.map(r => {
      if (r.id !== id) return r;
      const toggled = { ...r, enabled: !r.enabled };
      if (toggled.enabled && permission === 'granted') scheduleReminder(toggled);
      return toggled;
    });
    save(updated);
  };

  const add = () => {
    if (!newLabel.trim()) { message.warning('Please enter a label'); return; }
    if (!newDays.length) { message.warning('Select at least one day'); return; }
    const r: Reminder = { id: Date.now().toString(), label: newLabel, time: newTime, days: newDays, enabled: true };
    const updated = [...reminders, r];
    save(updated);
    if (permission === 'granted') scheduleReminder(r);
    setShowAdd(false); setNewLabel(''); setNewTime('09:00'); setNewDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    message.success('Reminder added!');
  };

  return (
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 16px', background: C.bg, minHeight: '100dvh' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>Alerts & Reminders</h2>
        <p style={{ margin: '4px 0 0', color: C.body, fontSize: 13 }}>Push notifications for your home routines</p>
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
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Install for push notifications on iOS & Android</div>
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
              {!notifGloballyEnabled ? 'Notifications disabled' : permission === 'granted' ? 'Notifications enabled' : permission === 'denied' ? 'Notifications blocked' : 'Enable notifications'}
            </div>
            <div style={{ color: C.body, fontSize: 12, marginTop: 2 }}>
              {!notifGloballyEnabled ? 'Notifications are turned off globally by admin'
                : permission === 'granted' ? "You'll receive timely home care reminders"
                : permission === 'denied' ? 'Open browser settings to allow notifications'
                : 'Get reminders for your home reset routines'}
            </div>
          </div>
          {notifGloballyEnabled && permission === 'default' && (
            <Button type="primary" size="small" icon={<BellOutlined />} onClick={requestPermission}
              style={{ background: C.primary, border: 'none', borderRadius: 8, fontSize: 12, flexShrink: 0 }}>
              Enable
            </Button>
          )}
          {notifGloballyEnabled && permission === 'granted' && (
            <Button size="small" icon={<SendOutlined />} onClick={showTest} loading={sending}
              style={{ background: `${C.primary}15`, border: `1px solid ${C.primary}40`, color: C.primary, borderRadius: 8, fontSize: 12, flexShrink: 0 }}>
              Test
            </Button>
          )}
        </div>
      </div>

      {/* Reminders list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Scheduled reminders</span>
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
            <Input placeholder="e.g. Morning Reset" value={newLabel} onChange={e => setNewLabel(e.target.value)}
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
