import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url || 'dummy', key || 'dummy');

async function check() {
    const { data, error } = await supabase.from('guards').select('*');
    console.log("Anon user select result:", data, error);
}
check();
