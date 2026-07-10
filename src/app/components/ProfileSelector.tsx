import { useState } from 'react';
import { Button } from 'antd';
import { FireOutlined, RightOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { getActiveProfiles, type Profile, computeLiveStreak } from '../data/profiles';
import { C } from '../data/colors';
import { CreateProfileModal } from './CreateProfileModal';

interface Props {
  onSelect: (p: Profile) => void;
  onAdmin: () => void;
}

export function ProfileSelector({ onSelect, onAdmin }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [profileListKey, setProfileListKey] = useState(0);

  const profiles = getActiveProfiles();

  const handleCreated = (profile: Profile) => {
    setProfileListKey(k => k + 1);
    onSelect(profile);
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: C.bg,
      color: C.headline,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: 430,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.headline} 0%, #1a6da8 100%)`,
        padding: '56px 24px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(61,169,252,0.15)',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: 20,
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 30 }}>🌿</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>Arbol Momentum</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Your home care & streak tracker. Pick your profile to get started.
          </p>
        </div>
      </div>

      {/* Profiles */}
      <div style={{ padding: '24px 16px 100px' }} key={profileListKey}>
        <p style={{ color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4 }}>
          Select your profile
        </p>

        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => onSelect(profile)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '16px',
              marginBottom: 10,
              background: C.bgCard,
              border: `1.5px solid ${C.border}`,
              borderRadius: 16,
              color: C.headline,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: C.shadow,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.primary;
              e.currentTarget.style.boxShadow = C.shadowMd;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.boxShadow = C.shadow;
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: C.bgAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
              border: `1px solid ${C.border}`,
            }}>
              {profile.avatar}
            </div>
            <div style={{ flex: 1, marginLeft: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: C.headline }}>{profile.name}</div>
              <div style={{ color: C.body, fontSize: 12, marginTop: 2 }}>{profile.tagline}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}>
              <FireOutlined style={{ color: C.streak, fontSize: 14 }} />
              <span style={{ color: C.streak, fontSize: 14, fontWeight: 700 }}>{computeLiveStreak(profile.id)}</span>
            </div>
            <RightOutlined style={{ color: C.secondary, fontSize: 12 }} />
          </button>
        ))}

        {/* Create New Profile — only on this screen */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '16px',
            marginTop: 4,
            marginBottom: 10,
            background: `${C.primary}08`,
            border: `1.5px dashed ${C.primary}55`,
            borderRadius: 16,
            color: C.headline,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = C.primary;
            e.currentTarget.style.background = `${C.primary}14`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = `${C.primary}55`;
            e.currentTarget.style.background = `${C.primary}08`;
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: C.bgCard,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
            border: `1.5px dashed ${C.primary}40`,
            color: C.primary,
          }}>
            <PlusOutlined />
          </div>
          <div style={{ flex: 1, marginLeft: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.headline }}>Create New Profile</div>
            <div style={{ color: C.body, fontSize: 12, marginTop: 2 }}>
              Fresh slate or AI-assisted goal suggestions
            </div>
          </div>
          <RightOutlined style={{ color: C.secondary, fontSize: 12 }} />
        </button>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button type="text" icon={<SettingOutlined />} onClick={onAdmin}
            style={{ color: C.secondary, fontSize: 13 }}>
            Admin view
          </Button>
        </div>
      </div>

      <CreateProfileModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
