import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { logoUrl as defaultLogoUrl } from '../assets/logo';

export const defaultFaviconUrl = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛡️</text></svg>`;

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
  const [mainLogoUrl, setMainLogoUrl] = useState<string>(defaultLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState<string>(defaultFaviconUrl);
  const [loading, setLoading] = useState(true);

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
          let dbLogoUrl = settingsMap.get('main_logo_url');
          if (typeof dbLogoUrl === 'string') {
              if (dbLogoUrl.includes('/storage/v1/object/') && !dbLogoUrl.includes('/object/public/')) {
                  dbLogoUrl = dbLogoUrl.replace('/storage/v1/object/', '/storage/v1/object/public/');
              }
              if (dbLogoUrl.startsWith('yglwdwhwpbqawunbkzyy.supabase.co')) {
                  dbLogoUrl = 'https://' + dbLogoUrl;
              }
          }
          setMainLogoUrl(typeof dbLogoUrl === 'string' && dbLogoUrl ? dbLogoUrl : defaultLogoUrl);
          // FIX: The value from Supabase can be 'unknown'. Ensure it's a string before setting state.
          let dbFaviconUrl = settingsMap.get('favicon_url');
          if (typeof dbFaviconUrl === 'string') {
              if (dbFaviconUrl.includes('/storage/v1/object/') && !dbFaviconUrl.includes('/object/public/')) {
                  dbFaviconUrl = dbFaviconUrl.replace('/storage/v1/object/', '/storage/v1/object/public/');
              }
              if (dbFaviconUrl.startsWith('yglwdwhwpbqawunbkzyy.supabase.co')) {
                  dbFaviconUrl = 'https://' + dbFaviconUrl;
              }
          }
          setFaviconUrl(typeof dbFaviconUrl === 'string' && dbFaviconUrl ? dbFaviconUrl : defaultFaviconUrl);
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
    mainLogoUrl: loading ? defaultLogoUrl : mainLogoUrl,
    setMainLogoUrl,
    defaultLogoUrl,
    faviconUrl: loading ? defaultFaviconUrl : faviconUrl,
    setFaviconUrl,
    defaultFaviconUrl,
  }), [mainLogoUrl, faviconUrl, loading]);

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
