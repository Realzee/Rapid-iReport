import { createClient } from '@supabase/supabase-js';

const getSafeUrl = () => {
  const envUrl = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL);
  const defaultUrl = 'https://zbbsvtlnmjjkobfycudw.supabase.co';
  if (!envUrl || envUrl === 'undefined' || envUrl.trim() === '') return defaultUrl;
  const trimmed = envUrl.trim();
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

export const supabaseUrl = getSafeUrl();
export const supabaseAnonKey = ((typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnN2dGxubWpqa29iZnljdWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODI3MTMsImV4cCI6MjEwMDk1ODcxM30.PLeuqc3AKOq5QEFC2nxXIQ3MEEns5hxx7IkBYtzx43s').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('undefined') || supabaseAnonKey === 'undefined') {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid. Database functionality will NOT work. Please check your environment variables.");
}

// Only initialize if we have a valid-looking url and key, otherwise export null
export const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('undefined') && supabaseAnonKey !== 'undefined' && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
