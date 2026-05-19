import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// use Anon Key to simulate frontend!
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url || 'dummy', key || 'dummy');

async function check() {
    const { data, error } = await supabase.from('gate_access_logs').select('*');
    console.log("Anon user select result:", data?.length, error);
}
check();
