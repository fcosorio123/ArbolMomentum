import { useState } from 'react';
import { Modal } from 'antd';
import {
  RATING_EMOJIS, RATING_LABELS, WHAT_WORKED_OPTIONS, WHAT_DIDNT_OPTIONS,
  saveFeedback, recordNudge, type FeedbackEntry,
} from '../data/feedback';
import { getTodayKey } from '../data/profiles';
import { C } from '../data/colors';

interface Props {
  open: boolean;
  profileId: string;
  onSubmit: () => void;
  onLater: () => void;
}

export function FeedbackModal({ open, profileId, onSubmit, onLater }: Props) {
  const [rating, setRating] = useState<1|2|3|4|5|null>(null);
  const [worked, setWorked] = useState<Set<string>>(new Set());
  const [didnt, setDidnt] = useState<Set<string>>(new Set());
  const [suggestion, setSuggestion] = useState('');
  const [step, setStep] = useState<'prompt' | 'form'>('prompt');

  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  const handleSubmit = () => {
    if (!rating) return;
    const entry: FeedbackEntry = {
      profileId, date: getTodayKey(),
      rating, whatWorked: [...worked], whatDidnt: [...didnt],
      suggestion: suggestion.trim(), timestamp: Date.now(),
    };
    saveFeedback(entry);
    onSubmit();
  };

  const handleLater = () => {
    recordNudge(profileId);
    onLater();
  };

  const reset = () => {
    setRating(null); setWorked(new Set()); setDidnt(new Set());
    setSuggestion(''); setStep('prompt');
  };

  const handleClose = () => { reset(); handleLater(); };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      centered
      closable={false}
      styles={{
        content: { borderRadius: 24, padding: 0, overflow: 'hidden', maxWidth: 360, margin: '0 auto' },
        mask: { backdropFilter: 'blur(6px)', background: 'rgba(9,64,103,0.25)' },
      }}
    >
      {step === 'prompt' ? (
        /* ── Prompt step ── */
        <div style={{ padding: '32px 24px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: C.headline }}>
            Quick check-in!
          </h3>
          <p style={{ color: C.body, fontSize: 14, margin: '0 0 28px', lineHeight: 1.5 }}>
            How was your experience today?<br />Takes less than 30 seconds.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setStep('form')}
              style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg, ${C.headline}, #1a6da8)`,
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Answer Now ✨
            </button>
            <button
              onClick={handleLater}
              style={{
                width: '100%', padding: 12, borderRadius: 14,
                border: `1px solid ${C.border}`, background: 'none',
                color: C.body, fontSize: 14, cursor: 'pointer',
              }}
            >
              Remind me later
            </button>
          </div>
        </div>
      ) : (
        /* ── Full form step ── */
        <div>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${C.headline} 0%, #1a6da8 100%)`,
            padding: '20px 24px 18px',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
              How was your experience?
            </h3>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              Your feedback shapes Arbol Momentum
            </p>
          </div>

          <div style={{ padding: '20px 24px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Rating */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                Overall rating
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                {RATING_EMOJIS.map((emoji, i) => {
                  const val = (i + 1) as 1|2|3|4|5;
                  const isSelected = rating === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setRating(val)}
                      style={{
                        flex: 1, padding: '10px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: isSelected ? `${C.primary}18` : C.bgAlt,
                        outline: isSelected ? `2px solid ${C.primary}` : '2px solid transparent',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{emoji}</span>
                      <span style={{ fontSize: 9, color: isSelected ? C.primary : C.secondary, fontWeight: isSelected ? 700 : 400 }}>
                        {RATING_LABELS[i]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What worked */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                ✅ What worked
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WHAT_WORKED_OPTIONS.map(opt => {
                  const selected = worked.has(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggle(worked, opt, setWorked)}
                      style={{
                        padding: '7px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                        border: `1.5px solid ${selected ? C.primary : C.border}`,
                        background: selected ? `${C.primary}12` : C.bgCard,
                        color: selected ? C.primary : C.body,
                        fontWeight: selected ? 700 : 400, transition: 'all 0.15s',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What didn't work */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                ❌ What didn't work
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WHAT_DIDNT_OPTIONS.map(opt => {
                  const selected = didnt.has(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggle(didnt, opt, setDidnt)}
                      style={{
                        padding: '7px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                        border: `1.5px solid ${selected ? C.tertiary : C.border}`,
                        background: selected ? `${C.tertiary}10` : C.bgCard,
                        color: selected ? C.tertiary : C.body,
                        fontWeight: selected ? 700 : 400, transition: 'all 0.15s',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Suggestion */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                💡 Suggestion (optional)
              </div>
              <textarea
                value={suggestion}
                onChange={e => setSuggestion(e.target.value)}
                placeholder="What would make Arbol Momentum better for you?"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 12, fontSize: 13,
                  border: `1.5px solid ${C.border}`, background: C.bgAlt,
                  color: C.headline, resize: 'none', outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = C.primary}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>

            {/* Actions */}
            <button
              onClick={handleSubmit}
              disabled={!rating}
              style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: rating ? 'pointer' : 'not-allowed',
                background: rating ? `linear-gradient(135deg, ${C.headline}, #1a6da8)` : C.bgAlt,
                color: rating ? '#fff' : C.secondary, fontSize: 15, fontWeight: 700, marginBottom: 10,
                transition: 'all 0.2s',
              }}
            >
              Submit Feedback
            </button>
            <button
              onClick={handleLater}
              style={{
                width: '100%', padding: 12, borderRadius: 14,
                border: `1px solid ${C.border}`, background: 'none',
                color: C.body, fontSize: 14, cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
