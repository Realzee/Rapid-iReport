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
        
        // Ensure vehicle_reports columns exist
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS date_of_incident date;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS tracker_company text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS evidence_images text[];",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cas_number text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS station_name text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS vin_number text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS engine_number text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cos_name text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cos_contact_number text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS io_name text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS io_contact text;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS has_tracker boolean DEFAULT false;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;",
        "ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';",

        // Ensure crime_reports columns exist
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS date_of_incident date;",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS evidence_images text[];",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS cas_number text;",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS station_name text;",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;",
        "ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';",

        // Ensure emergency_reports columns exist
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS date_of_incident date;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS evidence_images text[];",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS cas_number text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS station_name text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS license_plate text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_make text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_model text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_color text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vin_number text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS engine_number text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_involved boolean DEFAULT false;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicles_involved integer DEFAULT 1;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS injuries_reported boolean DEFAULT false;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS fatalities_reported boolean DEFAULT false;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS saps_13 text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS pound_name text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS has_arrests boolean DEFAULT false;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS has_firearms boolean DEFAULT false;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS other_recoveries text;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;",
        "ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';",

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
