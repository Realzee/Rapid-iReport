import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://yglwdwhwpbqawunbkzyy.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const SERVICE_ROLE_KEY_VAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHdkd2h3cGJxYXd1bmJrenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI3NTc4OSwiZXhwIjoyMDgzODUxNzg5fQ.h8tD0STrVfQ7-eSXYJmDGoGGWKoNDr4o0SmGsYy0KRo';
const supabase = createClient(url, key || SERVICE_ROLE_KEY_VAL);

async function check() {
    console.log("Fetching all companies and allowed_modules...");
    const { data, error } = await supabase
        .from('companies')
        .select('id, name, allowed_modules');
        
    if (error) {
        console.error("Fetch companies failed:", error);
    } else {
        console.log("Companies:", JSON.stringify(data, null, 2));
    }
}
check();
