import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { logoUrl as defaultLogoUrl } from '../assets/logo';

interface SettingsContextType {
  mainLogoUrl: string;
  setMainLogoUrl: (url: string) => void;
  defaultLogoUrl: string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mainLogoUrl, setMainLogoUrl] = useState<string>(defaultLogoUrl);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogoSetting = async () => {
      // The `app_settings` table might not exist or might be restricted by RLS for anon users.
      // We try to fetch it, but fall back gracefully.
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'main_logo_url')
          .single();

        if (error) {
            // This is not a critical error, as we have a default.
            // It could be due to RLS or the table not existing.
            console.warn('Could not fetch main_logo_url setting, using default. Error:', error.message);
            setMainLogoUrl(defaultLogoUrl);
        } else if (data && data.value) {
            setMainLogoUrl(data.value);
        } else {
            setMainLogoUrl(defaultLogoUrl);
        }
      } catch(e) {
          console.error("Error in fetchLogoSetting:", e);
          setMainLogoUrl(defaultLogoUrl);
      } finally {
        setLoading(false);
      }
    };

    fetchLogoSetting();
  }, []);

  const value = useMemo(() => ({
    mainLogoUrl: loading ? defaultLogoUrl : mainLogoUrl, // Prevent flash of wrong logo
    setMainLogoUrl,
    defaultLogoUrl,
  }), [mainLogoUrl, loading]);

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
