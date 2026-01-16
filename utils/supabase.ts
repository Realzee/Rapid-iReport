import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';

// --- CRITICAL SECURITY WARNING ---
// The placeholder key below MUST BE REPLACED with your actual key.
// Using an invalid key will cause all database operations to fail with a 401 Unauthorized error.
//
// HOW TO GET THE CORRECT KEY:
// 1. Go to your Supabase project dashboard.
// 2. In the left sidebar, click the "Settings" icon (the cogwheel).
// 3. Click "API" in the settings list.
// 4. In the "Project API keys" section, find the key labeled "anon" and "public".
// 5. This key is a very long string, often starting with "eyJ...". DO NOT use the 'service_role' secret key.
// 6. Click "Copy" and paste it below, replacing the entire example key.
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzU3ODksImV4cCI6MjA4Mzg1MTc4OX0.yj6Zdkqr_Wp6oVfg98Rok1ih5wxEvUGj6BwmM782xmU';

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('REPLACE_THIS')) {
    // This check remains valid for developers first setting up the project.
    throw new Error("Supabase URL and a valid PUBLIC ANON KEY must be provided in utils/supabase.ts. Do not use a secret key.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);