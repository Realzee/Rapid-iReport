
export const playNotificationSound = (type: 'default' | 'urgent' = 'urgent') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    if (type === 'urgent') {
      // Loud multi-tone emergency alarm for incoming reports
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      gain.connect(ctx.destination);
      osc.connect(gain);

      // Volume: 0.75 (loud and clear)
      gain.gain.setValueAtTime(0.75, now);

      // Rapid alternating siren frequencies (1400Hz and 900Hz)
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.setValueAtTime(900, now + 0.15);
      osc.frequency.setValueAtTime(1400, now + 0.30);
      osc.frequency.setValueAtTime(900, now + 0.45);
      osc.frequency.setValueAtTime(1400, now + 0.60);

      gain.gain.setValueAtTime(0.75, now + 0.75);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.start(now);
      osc.stop(now + 0.85);
    } else {
      // Standard chime
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
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const updateFaviconBadge = (count: number, faviconUrl: string) => {
  if (!faviconUrl) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = faviconUrl;

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 32; // Default to 32 if width is 0
    canvas.height = img.height || 32;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw original favicon
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (count > 0) {
      // Badge settings
      const size = canvas.width;
      const badgeRadius = size * 0.3;
      const badgeX = size - badgeRadius;
      const badgeY = badgeRadius;

      // Draw red circle background
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444'; // Tailwind red-500
      ctx.fill();
      
      // Draw white border
      ctx.lineWidth = size * 0.05;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Draw count text
      ctx.font = `bold ${Math.floor(size * 0.35)}px Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Adjust Y slightly for visual centering
      ctx.fillText(count > 9 ? '9+' : count.toString(), badgeX, badgeY + (size * 0.02));
    }

    // Update favicon link
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
