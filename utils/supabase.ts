import { createClient } from '@supabase/supabase-js';

const getSafeUrl = () => {
  const envUrl = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL);
  const defaultUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
  if (!envUrl || envUrl === 'undefined' || envUrl.trim() === '') return defaultUrl;
  const trimmed = envUrl.trim();
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

export const supabaseUrl = getSafeUrl();
export const supabaseAnonKey = ((typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzU3ODksImV4cCI6MjA4Mzg1MTc4OX0.yj6Zdkqr_Wp6oVfg98Rok1ih5wxEvUGj6BwmM782xmU').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('undefined') || supabaseAnonKey === 'undefined') {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid. Database functionality will NOT work. Please check your environment variables.");
}

// Only initialize if we have a valid-looking url and key, otherwise export null
export const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('undefined') && supabaseAnonKey !== 'undefined' && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Utility to parse PostgREST or Postgres schema mismatch errors to detect missing columns.
 */
export function extractMissingColumn(errorMessage: string): string | null {
  if (!errorMessage || typeof errorMessage !== 'string') return null;
  
  // PostgREST: "Could not find the 'column_name' column of 'table_name' in the schema cache"
  const match1 = errorMessage.match(/Could not find the ['"]([^'"]+)['"] column/i);
  if (match1 && match1[1]) return match1[1];

  // Postgres: column "column_name" of relation "table_name" does not exist
  const match2 = errorMessage.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation/i);
  if (match2 && match2[1]) return match2[1];

  // column table.column does not exist or column "column" does not exist
  const match3 = errorMessage.match(/column ["']?([a-zA-Z0-9_.]+)["']? does not exist/i);
  if (match3 && match3[1]) {
      const parts = match3[1].split('.');
      return parts[parts.length - 1];
  }

  return null;
}
