// Comprehensive Emergency Audio & Notification Utilities

let globalAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

// Auto-unlock AudioContext on first user interaction to comply with modern browser autoplay policies
export const unlockAudioContext = () => {
  if (isAudioUnlocked && globalAudioCtx && globalAudioCtx.state === 'running') return;

  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    if (!globalAudioCtx) {
      globalAudioCtx = new AudioCtxClass();
    }

    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().then(() => {
        isAudioUnlocked = true;
      }).catch(() => {});
    } else if (globalAudioCtx.state === 'running') {
      isAudioUnlocked = true;
    }
  } catch (e) {
    console.warn('Could not unlock AudioContext:', e);
  }
};

// Register user gesture listeners once
if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    unlockAudioContext();
    window.removeEventListener('click', handleInteraction);
    window.removeEventListener('keydown', handleInteraction);
    window.removeEventListener('touchstart', handleInteraction);
  };

  window.addEventListener('click', handleInteraction, { passive: true, once: true });
  window.addEventListener('keydown', handleInteraction, { passive: true, once: true });
  window.addEventListener('touchstart', handleInteraction, { passive: true, once: true });
}

// Alarm Mute state management
export const isAlarmMuted = (): boolean => {
  try {
    return localStorage.getItem('rapid_alarm_muted') === 'true';
  } catch {
    return false;
  }
};

export const setAlarmMuted = (muted: boolean) => {
  try {
    localStorage.setItem('rapid_alarm_muted', muted ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('alarm-mute-changed', { detail: { muted } }));
  } catch (e) {
    console.error('Failed to set alarm mute state:', e);
  }
};

export const toggleAlarmMute = (): boolean => {
  const current = isAlarmMuted();
  setAlarmMuted(!current);
  return !current;
};

export interface AlarmReportDetails {
  id?: string;
  ob_number?: string;
  title?: string;
  type?: 'crime' | 'vehicle' | 'emergency' | 'roadside' | string;
  category?: string;
  location?: string;
  severity?: string;
}

/**
 * Plays a loud, attention-grabbing emergency dispatch alarm siren.
 * Designed with dual oscillators (carrier siren + harmonic undertone)
 * and dynamic compressor for maximum clean psychoacoustic loudness.
 */
export const playLoudReportAlarm = (details?: AlarmReportDetails) => {
  // Fire visual dispatch event even if audio is muted so the UI visual flash still fires
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('new-report-alarm', { detail: details || {} }));
  }

  // Check if user has explicitly muted the alarms
  if (isAlarmMuted()) {
    console.log('Loud alarm skipped: Alarm is currently muted by user.');
    return;
  }

  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
      globalAudioCtx = new AudioCtxClass();
    }

    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }

    const ctx = globalAudioCtx;
    const now = ctx.currentTime;

    // Master Dynamics Compressor: Prevents clipping distortion while boosting low/high transients
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(20, now);
    compressor.ratio.setValueAtTime(12, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.25, now);
    compressor.connect(ctx.destination);

    // Master Gain (loud & punchy at 0.95)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.95, now);
    masterGain.connect(compressor);

    // --- OSCILLATOR 1: Piercing Tactical Siren (Sawtooth) ---
    const carrierOsc = ctx.createOscillator();
    const carrierGain = ctx.createGain();
    carrierOsc.type = 'sawtooth';

    carrierGain.connect(masterGain);
    carrierOsc.connect(carrierGain);

    // --- OSCILLATOR 2: Deep Harmonic Sub-Horn (Square / Triangle) ---
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';

    subGain.connect(masterGain);
    subOsc.connect(subGain);

    // Pulsing 4-burst tactical siren sequence (~1.8 seconds)
    // Pulse 1: 0.0s - 0.38s
    carrierOsc.frequency.setValueAtTime(1600, now);
    subOsc.frequency.setValueAtTime(520, now);
    carrierGain.gain.setValueAtTime(0.85, now);
    subGain.gain.setValueAtTime(0.55, now);

    carrierOsc.frequency.exponentialRampToValueAtTime(950, now + 0.18);
    subOsc.frequency.exponentialRampToValueAtTime(360, now + 0.18);

    carrierGain.gain.setValueAtTime(0.85, now + 0.32);
    carrierGain.gain.linearRampToValueAtTime(0.001, now + 0.38);
    subGain.gain.setValueAtTime(0.55, now + 0.32);
    subGain.gain.linearRampToValueAtTime(0.001, now + 0.38);

    // Pulse 2: 0.44s - 0.82s
    const p2 = now + 0.44;
    carrierOsc.frequency.setValueAtTime(1750, p2);
    subOsc.frequency.setValueAtTime(560, p2);
    carrierGain.gain.setValueAtTime(0.9, p2);
    subGain.gain.setValueAtTime(0.6, p2);

    carrierOsc.frequency.exponentialRampToValueAtTime(980, p2 + 0.18);
    subOsc.frequency.exponentialRampToValueAtTime(380, p2 + 0.18);

    carrierGain.gain.setValueAtTime(0.9, p2 + 0.32);
    carrierGain.gain.linearRampToValueAtTime(0.001, p2 + 0.38);
    subGain.gain.setValueAtTime(0.6, p2 + 0.32);
    subGain.gain.linearRampToValueAtTime(0.001, p2 + 0.38);

    // Pulse 3: 0.88s - 1.26s
    const p3 = now + 0.88;
    carrierOsc.frequency.setValueAtTime(1850, p3);
    subOsc.frequency.setValueAtTime(600, p3);
    carrierGain.gain.setValueAtTime(0.95, p3);
    subGain.gain.setValueAtTime(0.65, p3);

    carrierOsc.frequency.exponentialRampToValueAtTime(1020, p3 + 0.18);
    subOsc.frequency.exponentialRampToValueAtTime(400, p3 + 0.18);

    carrierGain.gain.setValueAtTime(0.95, p3 + 0.32);
    carrierGain.gain.linearRampToValueAtTime(0.001, p3 + 0.38);
    subGain.gain.setValueAtTime(0.65, p3 + 0.32);
    subGain.gain.linearRampToValueAtTime(0.001, p3 + 0.38);

    // Pulse 4 (Extended Klaxon Finish): 1.32s - 1.85s
    const p4 = now + 1.32;
    carrierOsc.frequency.setValueAtTime(1950, p4);
    subOsc.frequency.setValueAtTime(640, p4);
    carrierGain.gain.setValueAtTime(1.0, p4);
    subGain.gain.setValueAtTime(0.7, p4);

    carrierOsc.frequency.exponentialRampToValueAtTime(800, p4 + 0.35);
    subOsc.frequency.exponentialRampToValueAtTime(320, p4 + 0.35);

    carrierGain.gain.setValueAtTime(1.0, p4 + 0.42);
    carrierGain.gain.exponentialRampToValueAtTime(0.0001, p4 + 0.53);
    subGain.gain.setValueAtTime(0.7, p4 + 0.42);
    subGain.gain.exponentialRampToValueAtTime(0.0001, p4 + 0.53);

    carrierOsc.start(now);
    subOsc.start(now);

    carrierOsc.stop(now + 1.9);
    subOsc.stop(now + 1.9);

    // Mobile vibration pattern (SOS pulse)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250, 100, 400]);
      } catch (_) {}
    }
  } catch (e) {
    console.error('Loud report alarm playback failed:', e);
  }
};

/**
 * Standard notification sound (gentle chime or alert)
 */
export const playNotificationSound = (type: 'default' | 'urgent' = 'urgent') => {
  if (type === 'urgent') {
    playLoudReportAlarm();
    return;
  }

  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    const ctx = globalAudioCtx || new AudioCtxClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

export const updateFaviconBadge = (count: number, faviconUrl: string) => {
  if (!faviconUrl) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = faviconUrl;

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 32;
    canvas.height = img.height || 32;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (count > 0) {
      const size = canvas.width;
      const badgeRadius = size * 0.3;
      const badgeX = size - badgeRadius;
      const badgeY = badgeRadius;

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      
      ctx.lineWidth = size * 0.05;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = `bold ${Math.floor(size * 0.35)}px Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : count.toString(), badgeX, badgeY + (size * 0.02));
    }

    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (link) {
      link.href = canvas.toDataURL('image/png');
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = canvas.toDataURL('image/png');
      document.head.appendChild(newLink);
    }
  };
};

export const updateDocumentTitle = (count: number, baseTitle: string = 'Rapid Report') => {
  if (count > 0) {
    document.title = `(${count}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
};
