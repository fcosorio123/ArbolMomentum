import { useState, useEffect } from 'react';
import { isPublishedVersion } from '../data/environment';
import { C } from '../data/colors';

/**
 * Visual indicator showing Supabase sync status
 * Only shown on published version
 */
export function SupabaseSyncIndicator() {
  const [isVisible, setIsVisible] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    if (!isPublishedVersion()) return;

    // Listen for Supabase sync events (we'll dispatch these from sync functions)
    const handleSync = () => {
      setSyncCount(prev => prev + 1);
      setIsVisible(true);

      // Hide after 2 seconds
      setTimeout(() => {
        setIsVisible(false);
      }, 2000);
    };

    window.addEventListener('supabase-sync', handleSync);

    return () => {
      window.removeEventListener('supabase-sync', handleSync);
    };
  }, []);

  if (!isPublishedVersion() || !isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 8px)',
      right: 16,
      zIndex: 1000,
      background: '#22c55e',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
      animation: 'slideIn 0.3s ease-out',
    }}>
      <span style={{ fontSize: 14 }}>☁️</span>
      Synced to Cloud
    </div>
  );
}

// Add keyframe animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
