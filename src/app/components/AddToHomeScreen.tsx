import { Modal } from 'antd';
import { C } from '../data/colors';

interface Props {
  open: boolean;
  onClose: () => void;
  installPrompt?: any;
  onInstall?: () => void;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Chromium/.test(ua);
  const isSamsung = /SamsungBrowser/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return { isIOS, isAndroid, isChrome, isSamsung, isFirefox, isSafari };
}

const IOS_STEPS = [
  { icon: '⬆️', title: 'Tap the Share button', desc: 'Find the share icon at the bottom of Safari (square with arrow pointing up).' },
  { icon: '📲', title: 'Tap "Add to Home Screen"', desc: 'Scroll down in the share sheet and tap "Add to Home Screen".' },
  { icon: '✅', title: 'Tap "Add"', desc: 'Confirm by tapping "Add" in the top right corner.' },
];

const ANDROID_CHROME_STEPS = [
  { icon: '⋮', title: 'Open the browser menu', desc: 'Tap the three-dot menu (⋮) in the top right corner of Chrome.' },
  { icon: '📲', title: 'Tap "Add to Home screen"', desc: 'Select "Add to Home screen" from the menu. You may see an "Install app" option instead.' },
  { icon: '✅', title: 'Tap "Add"', desc: 'Confirm by tapping "Add" in the dialog that appears.' },
];

const ANDROID_SAMSUNG_STEPS = [
  { icon: '⋮', title: 'Open the browser menu', desc: 'Tap the three-line menu at the bottom of Samsung Internet.' },
  { icon: '📲', title: 'Tap "Add page to"', desc: 'Select "Add page to" then choose "Home screen".' },
  { icon: '✅', title: 'Tap "Add"', desc: 'Confirm by tapping "Add" in the dialog.' },
];

export function AddToHomeScreen({ open, onClose, installPrompt, onInstall }: Props) {
  const { isIOS, isAndroid, isSamsung } = detectPlatform();

  const steps = isIOS ? IOS_STEPS : isSamsung ? ANDROID_SAMSUNG_STEPS : ANDROID_CHROME_STEPS;
  const platformName = isIOS ? 'iOS Safari' : isSamsung ? 'Samsung Internet' : 'Chrome / Android';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      styles={{
        content: { borderRadius: 24, padding: 0, overflow: 'hidden', border: `1px solid ${C.border}` },
        mask: { background: 'rgba(9,64,103,0.5)', backdropFilter: 'blur(8px)' },
      }}
    >
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.headline} 0%, #1a6da8 100%)`,
        padding: '28px 24px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: '0 0 8px' }}>
          Add to Home Screen
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Install Arbol Momentum for push notifications and a native app experience
        </p>
        <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Detected:</span>
          <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{platformName}</span>
        </div>
      </div>

      <div style={{ padding: '20px 24px 28px', background: C.bg }}>
        {/* Native install prompt (Android Chrome) */}
        {installPrompt && (
          <button onClick={onInstall} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            background: `linear-gradient(135deg, ${C.primary}20, ${C.bgAlt})`,
            border: `1.5px solid ${C.primary}50`, borderRadius: 14,
            padding: '14px 16px', marginBottom: 20, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.headline }}>Quick Install</div>
              <div style={{ color: C.body, fontSize: 12 }}>Your browser supports one-tap installation</div>
            </div>
            <span style={{ color: C.primary, fontWeight: 700, marginLeft: 'auto', fontSize: 14 }}>Install →</span>
          </button>
        )}

        {/* Step-by-step */}
        <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
          Step-by-step guide
        </p>

        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < steps.length - 1 ? 16 : 0 }}>
            {/* Step number + connector */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: C.bgAlt, border: `1.5px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {s.icon}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 2, flex: 1, background: C.border, margin: '6px 0', minHeight: 20 }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 8 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: C.headline, marginBottom: 4 }}>
                <span style={{ color: C.primary, marginRight: 6 }}>{i + 1}.</span>{s.title}
              </div>
              <div style={{ fontSize: 13, color: C.body, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          </div>
        ))}

        {/* Push notification note */}
        <div style={{
          background: `${C.primary}12`, border: `1px solid ${C.primary}30`,
          borderRadius: 12, padding: '12px 14px', marginTop: 20,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
          <div style={{ fontSize: 12, color: C.body, lineHeight: 1.5 }}>
            <strong style={{ color: C.headline }}>After installing,</strong> open the app and go to the Alerts tab to enable push notifications.
          </div>
        </div>

        <button onClick={onClose} style={{
          display: 'block', width: '100%', marginTop: 16, padding: '12px',
          background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 12,
          color: C.body, fontSize: 14, cursor: 'pointer', textAlign: 'center',
        }}>
          Close
        </button>
      </div>
    </Modal>
  );
}
