import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('profiles').select('id, first_name, surname, role, email, company:companies(name, allowed_modules)');
    console.log(JSON.stringify(data, null, 2));
}
run();
