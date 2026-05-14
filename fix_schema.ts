import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log("Triggering fix-schema directly...");
    const queries = [
        "CREATE TABLE IF NOT EXISTS public.report_updates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL, user_id uuid NOT NULL, content text NOT NULL, created_at timestamptz DEFAULT now());",
        "DO $$ BEGIN ALTER TABLE public.report_updates ADD CONSTRAINT report_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;",
        "ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;",
        "DROP POLICY IF EXISTS \"Enable all for authenticated on updates\" ON public.report_updates;",
        "CREATE POLICY \"Enable all for authenticated on updates\" ON public.report_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);",
        "NOTIFY pgrst, 'reload schema';",
        "SELECT pg_notify('pgrst', 'reload schema');"
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
