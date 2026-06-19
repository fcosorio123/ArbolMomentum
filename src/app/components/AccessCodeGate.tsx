import { useState, useRef } from 'react';
import { Input, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { C } from '../data/colors';

const ACCESS_CODE = 'Arbol123';

interface Props {
  onUnlock: () => void;
  onCancel?: () => void;
}

export function AccessCodeGate({ onUnlock, onCancel }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<any>(null);

  const handleSubmit = () => {
    if (value === ACCESS_CODE) {
      onUnlock();
    } else {
      setError('Incorrect code. Please try again.');
      setValue('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: C.bgCard, borderRadius: 24,
        border: `1.5px solid ${C.border}`,
        boxShadow: '0 8px 32px rgba(9,64,103,0.12)',
        overflow: 'hidden',
        animation: shake ? 'shake 0.4s ease' : undefined,
      }}>
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-6px)}
            40%{transform:translateX(6px)}
            60%{transform:translateX(-4px)}
            80%{transform:translateX(4px)}
          }
        `}</style>

        {/* Top accent */}
        <div style={{ height: 5, background: `linear-gradient(90deg, ${C.primary}, #3da9fc)` }} />

        <div style={{ padding: '32px 28px 28px', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `${C.primary}12`,
            border: `2px solid ${C.primary}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <LockOutlined style={{ fontSize: 30, color: C.primary }} />
          </div>

          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: C.headline }}>
            Enter access code
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: C.body, lineHeight: 1.55 }}>
            This page is restricted because it contains tester profile information.
          </p>

          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.secondary, display: 'block', marginBottom: 6 }}>
              Access code
            </label>
            <Input
              ref={inputRef}
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              onPressEnter={handleSubmit}
              type="password"
              size="large"
              placeholder="Enter code"
              status={error ? 'error' : undefined}
              style={{ borderRadius: 12 }}
              autoFocus
            />
            {error && (
              <div style={{ fontSize: 12, color: '#ef4565', marginTop: 6, fontWeight: 500 }}>
                {error}
              </div>
            )}
          </div>

          <Button
            type="primary"
            block
            size="large"
            onClick={handleSubmit}
            style={{
              borderRadius: 14, height: 50, fontSize: 15, fontWeight: 700,
              background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
              border: 'none', boxShadow: `0 4px 16px ${C.primary}40`,
            }}
          >
            Continue
          </Button>

          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                marginTop: 14, background: 'none', border: 'none',
                color: C.secondary, fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
