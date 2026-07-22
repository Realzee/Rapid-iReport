import { useEffect, useRef, useState, useCallback } from 'react';

export const useWakeLock = () => {
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const requestWakeLock = useCallback(async () => {
    if (document.visibilityState !== 'visible') {
      return;
    }
    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await navigator.wakeLock.request('screen');
        wakeLock.current.addEventListener('release', () => {
          setIsLocked(false);
          console.log('Wake Lock released');
        });
        setIsLocked(true);
        console.log('Wake Lock active');
      }
    } catch (err: any) {
      // Screen Wake Lock can be restricted by permissions policy in sandboxed iframes or user settings
      if (err?.name === 'NotAllowedError') {
        console.warn('Wake Lock disallowed by permissions policy or user settings:', err.message);
      } else {
        console.warn('Wake Lock request failed:', err?.message || err);
      }
      setIsLocked(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLock.current) {
      await wakeLock.current.release();
      wakeLock.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-request lock when returning to the tab
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  return { isLocked, requestWakeLock, releaseWakeLock };
};
