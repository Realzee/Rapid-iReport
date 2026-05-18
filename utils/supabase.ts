import { createClient } from '@supabase/supabase-js';

const getSafeUrl = () => {
  const envUrl = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL);
  const defaultUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
  if (!envUrl || envUrl === 'undefined' || envUrl.trim() === '') return defaultUrl;
  const trimmed = envUrl.trim();
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

const supabaseUrl = getSafeUrl();
const supabaseAnonKey = ((typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzU3ODksImV4cCI6MjA4Mzg1MTc4OX0.yj6Zdkqr_Wp6oVfg98Rok1ih5wxEvUGj6BwmM782xmU').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('undefined') || supabaseAnonKey === 'undefined') {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid. Database functionality will NOT work. Please check your environment variables.");
}

// Only initialize if we have a valid-looking url and key, otherwise export null
export const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('undefined') && supabaseAnonKey !== 'undefined' && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
