import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Database functionality will be limited.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || '');
