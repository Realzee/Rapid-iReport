import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { logoUrl as defaultLogoUrl, squareAppIconUrl } from '../assets/logo';

export const defaultFaviconUrl = squareAppIconUrl;

interface SettingsContextType {
  mainLogoUrl: string;
  setMainLogoUrl: (url: string) => void;
  defaultLogoUrl: string;
  faviconUrl: string;
  setFaviconUrl: (url: string) => void;
  defaultFaviconUrl: string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mainLogoUrl, setMainLogoUrl] = useState<string>(() => {
    return localStorage.getItem('app_main_logo_url') || defaultLogoUrl;
  });
  const [faviconUrl, setFaviconUrl] = useState<string>(() => {
    return localStorage.getItem('app_favicon_url') || defaultFaviconUrl;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mainLogoUrl) {
      try {
        localStorage.setItem('app_main_logo_url', mainLogoUrl);
      } catch (e) {
        console.warn('Failed to cache app_main_logo_url in localStorage (likely quota exceeded):', e);
      }
    }
  }, [mainLogoUrl]);

  useEffect(() => {
    if (faviconUrl) {
      try {
        localStorage.setItem('app_favicon_url', faviconUrl);
      } catch (e) {
        console.warn('Failed to cache app_favicon_url in localStorage (likely quota exceeded):', e);
      }
    }
  }, [faviconUrl]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value');

        if (error) {
            console.warn('Could not fetch app settings, using defaults. Error:', error.message);
        } else if (data) {
          const settingsMap = new Map(data.map(s => [s.key, s.value]));
          // FIX: The value from Supabase can be 'unknown'. Ensure it's a string before setting state.
          const dbLogoUrl = settingsMap.get('main_logo_url');
          if (typeof dbLogoUrl === 'string') {
              let logoStr = dbLogoUrl as string;
              if (logoStr.includes('/storage/v1/object/') && !logoStr.includes('/object/public/')) {
                  logoStr = logoStr.replace('/storage/v1/object/', '/storage/v1/object/public/');
              }
              if (logoStr.includes('.supabase.co') && !logoStr.startsWith('http')) {
                  logoStr = 'https://' + logoStr;
              }
              setMainLogoUrl(logoStr);
          } else {
              setMainLogoUrl(defaultLogoUrl);
          }

          // FIX: The value from Supabase can be 'unknown'. Ensure it's a string before setting state.
          const dbFaviconUrl = settingsMap.get('favicon_url');
          if (typeof dbFaviconUrl === 'string') {
              let faviconStr = dbFaviconUrl as string;
              if (faviconStr.includes('/storage/v1/object/') && !faviconStr.includes('/object/public/')) {
                  faviconStr = faviconStr.replace('/storage/v1/object/', '/storage/v1/object/public/');
              }
              if (faviconStr.includes('.supabase.co') && !faviconStr.startsWith('http')) {
                  faviconStr = 'https://' + faviconStr;
              }
              setFaviconUrl(faviconStr);
          } else {
              setFaviconUrl(defaultFaviconUrl);
          }
        }
      } catch(e) {
          console.error("Error in fetchSettings:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const value = useMemo(() => ({
    mainLogoUrl,
    setMainLogoUrl,
    defaultLogoUrl,
    faviconUrl,
    setFaviconUrl,
    defaultFaviconUrl,
  }), [mainLogoUrl, faviconUrl]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
