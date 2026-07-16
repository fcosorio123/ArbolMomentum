import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { C } from '../data/colors';

interface Props {
  /** Start/restart the page spotlight tour. */
  onPageTour: () => void;
  /** Open the product overview (coach marks). */
  onProductTour?: () => void;
  /** Clear tour progress and start page tour again. */
  onRestartTours?: () => void;
  /** When true, ask before launching (unsaved work). */
  hasUnsavedWork?: boolean;
  profileId?: string;
}

function confirmIfUnsaved(hasUnsavedWork?: boolean): boolean {
  if (!hasUnsavedWork) return true;
  return window.confirm('You have unsaved work open. Start the tour and leave this draft?');
}

/**
 * Compact header help control: ? opens a small menu with tour actions.
 * Desktop and mobile share the same pattern to avoid overcrowding.
 */
export function HelpTourMenu({ onPageTour, onProductTour, onRestartTours, hasUnsavedWork }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const run = (action: () => void) => {
    if (!confirmIfUnsaved(hasUnsavedWork)) return;
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Help and product tour"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Help & tour"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${C.border}`,
          background: open ? `${C.primary}15` : C.bgCard, color: C.secondary,
          fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        ?
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 40, right: 0, zIndex: 60, minWidth: 180,
            background: C.bgCard, border: `1.5px solid ${C.border}`, borderRadius: 12,
            boxShadow: C.shadow, overflow: 'hidden',
          }}
        >
          <button type="button" role="menuitem" onClick={() => run(onPageTour)} style={menuItemStyle}>
            Take a tour
          </button>
          {onProductTour && (
            <button type="button" role="menuitem" onClick={() => run(onProductTour)} style={menuItemStyle}>
              Product overview
            </button>
          )}
          {onRestartTours && (
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onRestartTours)}
              style={{ ...menuItemStyle, borderTop: `1px solid ${C.border}` }}
            >
              Restart tour
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle: CSSProperties = {
  display: 'block', width: '100%', padding: '12px 14px', border: 'none', background: 'none',
  textAlign: 'left', fontSize: 13, fontWeight: 600, color: C.headline, cursor: 'pointer',
  minHeight: 44,
};
