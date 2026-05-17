import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Database functionality will NOT work. Please check your environment variables.");
}

// Only initialize if we have the key, otherwise export a placeholder or null to avoid crashing at module load
export const supabase = supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // We'll cast to any or handle it in components, but most components expect it to be there. 
    // Ideally we should use a custom hook or context, but changing all imports is too much.
    // By providing null as any, the crash will happen when they actually USE it, not at load time.
    // Unless the SDK itself handles null? No, it expects a string.
