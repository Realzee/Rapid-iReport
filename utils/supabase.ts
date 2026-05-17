import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co').trim();
const supabaseAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'undefined' || supabaseAnonKey === 'undefined') {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid. Database functionality will NOT work. Please check your environment variables.");
}

// Only initialize if we have a valid-looking url and key, otherwise export null
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined' && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
