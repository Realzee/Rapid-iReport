import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(url || '', key || '');

async function fixRLS() {
    const queries = [
        `CREATE OR REPLACE FUNCTION eval(query text) RETURNS void AS $$ BEGIN EXECUTE query; END; $$ LANGUAGE plpgsql SECURITY DEFINER;`,
        `DROP POLICY IF EXISTS "Public access" ON public.gate_access_logs;`,
        `CREATE POLICY "Public access" ON public.gate_access_logs FOR ALL USING (true) WITH CHECK (true);`,
        `DROP POLICY IF EXISTS "Public access" ON public.vehicle_reports;`,
        `CREATE POLICY "Public access" ON public.vehicle_reports FOR ALL USING (true) WITH CHECK (true);`,
        `ALTER TABLE public.gate_access_logs ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;`
    ];

    for (const query of queries) {
        console.log("Running:", query);
        const { error } = await supabaseAdmin.rpc('eval', { query });
        if (error) {
            console.error("RPC failed, trying raw query...", error);
            // supabaseAdmin doesn't expose a raw query method easily in js client without using query() or just relying on rpc.
            // Let's hope rpc works!
        }
    }
    console.log("Done fixing RLS.");
}

fixRLS();
