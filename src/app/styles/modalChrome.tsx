/** Shared Ant Design Modal chrome - keep close (X) clear of accent bars. */
export const ACCENT_MODAL_STYLES = {
  content: {
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden' as const,
  },
  mask: { backdropFilter: 'blur(4px)' },
};

/** Top spacer so the default close icon sits above the accent strip, not on it. */
export function ModalAccentBar({ gradient }: { gradient: string }) {
  return (
    <div aria-hidden style={{ height: 36, position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 5,
          background: gradient,
        }}
      />
    </div>
  );
}
