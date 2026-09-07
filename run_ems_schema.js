import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: { fetch: fetch }
});

async function main() {
    console.log("Creating ems_assessments table...");
    const queries = [
        `CREATE TABLE IF NOT EXISTS public.ems_assessments (
            id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            report_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
            patient_name text,
            patient_age text,
            patient_gender text,
            patient_contact text,
            chief_complaint text,
            medical_history text,
            allergies text,
            vital_bp text,
            vital_pulse text,
            vital_resp text,
            vital_spo2 text,
            vital_temp text,
            vital_gcs text,
            treatment_provided text,
            medications_administered text,
            transport_decision text,
            receiving_facility text,
            handover_notes text,
            assessed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            assessed_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );`,
        `ALTER TABLE public.ems_assessments ENABLE ROW LEVEL SECURITY;`,
        `DROP POLICY IF EXISTS "Allow staff to read ems assessments" ON public.ems_assessments;`,
        `CREATE POLICY "Allow staff to read ems assessments" ON public.ems_assessments 
            FOR SELECT 
            USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder', 'ras_driver'));`,
        `DROP POLICY IF EXISTS "Allow staff to insert ems assessments" ON public.ems_assessments;`,
        `CREATE POLICY "Allow staff to insert ems assessments" ON public.ems_assessments 
            FOR INSERT 
            WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder', 'ras_driver'));`,
        `DROP POLICY IF EXISTS "Allow author to update ems assessments" ON public.ems_assessments;`,
        `CREATE POLICY "Allow author to update ems assessments" ON public.ems_assessments 
            FOR UPDATE 
            USING (assessed_by = auth.uid());`,
        `NOTIFY pgrst, 'reload schema';`
    ];
    for (const q of queries) {
        let res = await supabaseAdmin.rpc('eval', { query: q });
        if (res.error) {
            console.log("eval failed for:", q.substring(0, 50), res.error);
        } else {
            console.log("Success:", q.substring(0, 50));
        }
    }
}
main();
