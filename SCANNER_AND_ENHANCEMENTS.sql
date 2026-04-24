-- Migration: Add Circulation Number to Vehicle Reports
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS circulation_number text;

-- Migration: Add Crime Report Enhancements
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS guns_stolen integer DEFAULT 0;

-- Migration: Gate Access Logging
CREATE TABLE IF NOT EXISTS public.gate_access_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    license_plate text NOT NULL,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    gate_name text,
    direction text CHECK (direction IN ('entry', 'exit')),
    logged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_wanted boolean DEFAULT false,
    wanted_report_id uuid REFERENCES public.vehicle_reports(id) ON DELETE SET NULL
);

ALTER TABLE public.gate_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for staff" ON public.gate_access_logs;
CREATE POLICY "Enable read for staff" ON public.gate_access_logs FOR SELECT USING (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

DROP POLICY IF EXISTS "Enable insert for staff" ON public.gate_access_logs;
CREATE POLICY "Enable insert for staff" ON public.gate_access_logs FOR INSERT WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);
