import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'dummy';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'dummy';

console.log("Testing Supabase connection with URL:", url);
console.log("Using Anon Key:", key.substring(0, 10) + "...");

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    console.log("Anon user profiles select result:", data, error);
}
check();
