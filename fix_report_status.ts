import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log("Triggering fix-schema directly...");
    const queries = [
        "ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'stolen';",
        "ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'suspicious';",
        "ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'bolo';",
        "ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'sought';",
        "ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'hijacked';",
        "ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'used_in_commission_of_crime';"
    ];

    for (const q of queries) {
        let res = await supabaseAdmin.rpc('eval', { query: q });
        if (res.error) {
            console.log("eval failed for:", q, res.error);
        } else {
            console.log("Success:", q);
        }
    }
}
main();
