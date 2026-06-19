import { useState } from 'react';
import { Button, Progress } from 'antd';
import { LogoutOutlined, SettingOutlined, FireOutlined, TrophyOutlined, ThunderboltOutlined, HomeOutlined, BellOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { type Profile, PROFILES, getEarnedBadges, computeLiveStreak } from '../data/profiles';
import { BadgesSection } from './BadgesSection';
import { C } from '../data/colors';

interface Props { profile: Profile; onSwitch: () => void; onAdmin: () => void; onAlerts?: () => void; }

export function ProfileScreen({ profile, onSwitch, onAdmin, onAlerts }: Props) {
  const [tab, setTab] = useState<'stats' | 'badges'>('stats');
  const rank = [...PROFILES].sort((a, b) => b.streak - a.streak).findIndex(p => p.id === profile.id) + 1;
  const earned = getEarnedBadges(profile);
  const liveStreak = computeLiveStreak(profile.id);

  const stats = [
    { icon: <FireOutlined style={{ color: C.streak }} />, label: 'Current Streak', value: `${liveStreak} days` },
    { icon: <TrophyOutlined style={{ color: C.streak }} />, label: 'Best Streak', value: `${profile.bestStreak} days` },
    { icon: <ThunderboltOutlined style={{ color: C.primary }} />, label: 'Avg. Completion', value: `${profile.completionRate}%` },
    { icon: <HomeOutlined style={{ color: C.primary }} />, label: 'Week on Program', value: `Week ${profile.joinedWeek}` },
  ];

  return (
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 16px', background: C.bg, minHeight: '100dvh' }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg, ${C.headline} 0%, #1a6da8 100%)`,
        borderRadius: 24, padding: '28px 20px 24px', marginBottom: 16,
        textAlign: 'center', boxShadow: C.shadowMd,
      }}>
        <div style={{
          width: 72, height: 72, background: 'rgba(255,255,255,0.15)', borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
          margin: '0 auto 10px', border: '2px solid rgba(255,255,255,0.3)',
        }}>
          {profile.avatar}
        </div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#fff' }}>{profile.name}</h2>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{profile.role}</div>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: '8px 0 12px', lineHeight: 1.5 }}>{profile.bio}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '3px 10px', color: '#fff', fontSize: 12 }}>
            🌿 Arbol Momentum
          </span>
          <span style={{ background: `${C.streak}30`, borderRadius: 8, padding: '3px 10px', color: C.streak, fontSize: 12, fontWeight: 600 }}>
            #{rank} leaderboard
          </span>
          <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '3px 10px', color: '#fff', fontSize: 12 }}>
            🏅 {earned.length} badges
          </span>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            <span>Streak to best</span>
            <span style={{ color: C.streak }}>{liveStreak}/{profile.bestStreak}</span>
          </div>
          <Progress percent={Math.min(100, Math.round((liveStreak / profile.bestStreak) * 100))}
            strokeColor={{ '0%': C.primary, '100%': C.streak }}
            railColor="rgba(255,255,255,0.15)" showInfo={false} size={['100%', 6]} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.bgAlt, borderRadius: 14, padding: 4, marginBottom: 16, border: `1px solid ${C.border}` }}>
        {(['stats', 'badges'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
            background: tab === t ? C.bgCard : 'transparent',
            color: tab === t ? C.headline : C.secondary,
            fontWeight: tab === t ? 700 : 400, fontSize: 14,
            boxShadow: tab === t ? C.shadow : 'none', transition: 'all 0.2s',
          }}>
            {t === 'stats' ? '📊 Stats' : `🏅 Badges (${earned.length})`}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {stats.map(item => (
              <div key={item.label} style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', boxShadow: C.shadow }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: C.headline }}>{item.value}</div>
                <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', boxShadow: C.shadow, marginBottom: 12 }}>
            {onAlerts && (
              <button
                onClick={onAlerts}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  background: C.bgAlt, border: `1px solid ${C.border}`,
                  borderRadius: 10, height: 44, padding: '0 14px', cursor: 'pointer',
                  marginBottom: 10, color: C.headline, fontSize: 14,
                }}
              >
                <BellOutlined style={{ color: C.primary, fontSize: 16 }} />
                <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Alerts &amp; Reminders</span>
                <ArrowRightOutlined style={{ color: C.secondary, fontSize: 12 }} />
              </button>
            )}
            <Button block icon={<SettingOutlined />} onClick={onAdmin} style={{
              background: C.bgAlt, border: `1px solid ${C.border}`, color: C.headline,
              borderRadius: 10, height: 44, marginBottom: 10,
            }}>View All Profiles (Admin)</Button>
            <Button block icon={<LogoutOutlined />} onClick={onSwitch} style={{
              background: `${C.tertiary}10`, border: `1px solid ${C.tertiary}30`,
              color: C.tertiary, borderRadius: 10, height: 44,
            }}>Switch Profile</Button>
          </div>
        </>
      )}

      {tab === 'badges' && <BadgesSection profile={profile} />}

      <p style={{ textAlign: 'center', color: C.secondary, fontSize: 11, marginTop: 8 }}>
        Arbol Momentum · Your daily companion
      </p>
    </div>
  );
}
