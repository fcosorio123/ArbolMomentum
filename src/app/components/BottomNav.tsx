import type { ReactNode } from 'react';
import { HomeOutlined, CheckSquareOutlined, CalendarOutlined, UserOutlined, TrophyOutlined } from '@ant-design/icons';
import { C } from '../data/colors';

type Tab = 'home' | 'goals' | 'tasks' | 'week' | 'reminders' | 'profile';

const TABS: { key: Tab; icon: ReactNode; label: string }[] = [
  { key: 'home',    icon: <HomeOutlined />,       label: 'Home' },
  { key: 'goals',   icon: <TrophyOutlined />,      label: 'Goals' },
  { key: 'tasks',   icon: <CheckSquareOutlined />, label: 'Tasks' },
  { key: 'week',    icon: <CalendarOutlined />,    label: 'Week' },
  { key: 'profile', icon: <UserOutlined />,        label: 'Profile' },
];

export function BottomNav({ activeTab, onChange, pendingCount = 0, isDesktop = false }: {
  activeTab: Tab;
  onChange: (t: Tab) => void;
  pendingCount?: number;
  isDesktop?: boolean;
}) {
  // ── Desktop: left sidebar nav
  if (isDesktop) {
    return (
      <div style={{
        width: 220,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100dvh',
        background: C.headline,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '4px 0 24px rgba(9,64,103,0.10)',
      }}>
        {/* Logo */}
        <div style={{ padding: '32px 24px 28px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
            🌿 Arbol
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, letterSpacing: 0.5 }}>
            MOMENTUM
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  borderRadius: 10,
                  background: active ? 'rgba(61,169,252,0.18)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: 14, fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                  width: '100%', textAlign: 'left',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 20, borderRadius: '0 2px 2px 0', background: C.primary,
                  }} />
                )}
                <span style={{ fontSize: 16, display: 'inline-flex', position: 'relative' }}>
                  {tab.icon}
                  {tab.key === 'tasks' && pendingCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -8,
                      minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px',
                      background: C.tertiary, color: '#fff',
                      fontSize: 8, fontWeight: 700, lineHeight: '14px', textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
            Arbol Momentum<br />Your daily companion
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile: bottom bar
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 430,
      background: 'rgba(255,255,254,0.96)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${C.border}`,
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      boxShadow: '0 -4px 20px rgba(9,64,103,0.06)',
    }}>
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '9px 0 7px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? C.primary : C.secondary,
              fontSize: 18,
              transition: 'color 0.2s',
              position: 'relative',
            }}
          >
            {active && (
              <span style={{
                position: 'absolute',
                top: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: 28, height: 3,
                borderRadius: '0 0 4px 4px',
                background: C.primary,
              }} />
            )}
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon}
              {tab.key === 'tasks' && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -8,
                  minWidth: 16, height: 16, borderRadius: 8, padding: '0 3px',
                  background: C.tertiary, color: '#fff',
                  fontSize: 9, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </span>
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
