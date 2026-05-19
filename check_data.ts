import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url || 'dummy', key || 'dummy');

async function check() {
    const { data } = await supabase.from('sites').select('*');
    console.log(JSON.stringify(data, null, 2));
}
check();
