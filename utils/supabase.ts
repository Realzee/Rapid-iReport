import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjIyMjExMjYsImV4cCI6MjAzNzc5NzEyNn0.sb_publishable_71zAPcEoyZKsogU3BdJMhQ_jkyKEN-R';

// In a real production app, these would be loaded from environment variables.
// For this environment, we are initializing with the provided credentials.
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
