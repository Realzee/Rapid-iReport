/**
 * Safe local storage setter to prevent QuotaExceededError when caching large datasets.
 */
export const safeSetStorage = (key: string, data: any): void => {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.number === -2147024882) {
      console.warn(`[Storage] QuotaExceededError for key "${key}". Cleaning up storage or slimming payload.`);
      try {
        if (Array.isArray(data)) {
          // Keep only top 25 recent items and strip heavy media fields
          const slimmed = data.slice(0, 25).map((item: any) => {
            if (!item || typeof item !== 'object') return item;
            const { media_urls, photo_urls, voice_note_url, ...rest } = item;
            return rest;
          });
          localStorage.setItem(key, JSON.stringify(slimmed));
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // If storage is completely full, remove the key to avoid throwing
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }
  }
};
