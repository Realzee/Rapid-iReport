import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url || 'dummy', key || 'dummy');

async function check() {
    console.log("Fetching all profiles...");
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, company_id');
        
    if (error) {
        console.error("Fetch failed:", error);
    } else {
        console.log("Profiles:", JSON.stringify(data, null, 2));
    }
}
check();
