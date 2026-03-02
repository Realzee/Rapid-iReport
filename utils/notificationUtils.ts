
export const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
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

export const updateDocumentTitle = (count: number, baseTitle: string = 'Rapid iReport') => {
  if (count > 0) {
    document.title = `(${count}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
};
