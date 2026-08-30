-- Comprehensive Schema Fix for emergency_reports table
-- Run this in your Supabase SQL Editor to ensure all fields are available

CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ob_number text UNIQUE NOT NULL,
    emergency_type text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    location_coords jsonb,
    location_boundary jsonb,
    location_boundingbox numeric[],
    severity text NOT NULL,
    status text NOT NULL DEFAULT 'Active',
    reported_by uuid REFERENCES public.profiles(id) NOT NULL,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    assigned_to uuid REFERENCES public.profiles(id),
    company_id uuid REFERENCES public.companies(id) NOT NULL,
    image_url text,
    evidence_images text[],
    assistance_type text,
    card_number text,
    car_number text,
    driver_name text,
    drop_off_location text,
    drop_off_location_coords jsonb,
    rollback boolean DEFAULT false,
    recovery boolean DEFAULT false,
    dreamtec boolean DEFAULT false,
    family_run boolean DEFAULT false,
    incident_time text,
    date_of_incident text,
    cas_number text,
    station_name text,
    vin_number text,
    engine_number text,
    vehicle_involved boolean DEFAULT false,
    vehicles_involved integer DEFAULT 0,
    license_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    injuries_reported boolean DEFAULT false,
    fatalities_reported boolean DEFAULT false,
    crime_outcome text,
    cit_success boolean DEFAULT false,
    arrests integer DEFAULT 0,
    guns_recovered integer DEFAULT 0,
    other_recoveries text,
    recovered_location_coords jsonb,
    recovered_at timestamp with time zone,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}',
    is_public boolean DEFAULT false
);

-- Ensure all columns exist even if the table was created earlier
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS assistance_type text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS card_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS car_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS drop_off_location text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS drop_off_location_coords jsonb;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS rollback boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS recovery boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS dreamtec boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS family_run boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS incident_time text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS date_of_incident text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS cas_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS station_name text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS engine_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_involved boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicles_involved integer DEFAULT 0;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS license_plate text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_make text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_color text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS injuries_reported boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS fatalities_reported boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS crime_outcome text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS other_recoveries text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS recovered_at timestamp with time zone;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS location_boundary jsonb;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS location_boundingbox numeric[];
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Ensure user_role enum includes extra roles safely if enum exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'technician';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'guard';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'supervisor';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;

-- Policies for emergency_reports
DROP POLICY IF EXISTS "Users read own emergency reports" ON public.emergency_reports;
CREATE POLICY "Users read own emergency reports" ON public.emergency_reports FOR SELECT USING (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Users create emergency reports" ON public.emergency_reports;
CREATE POLICY "Users create emergency reports" ON public.emergency_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Staff manage company emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff manage company emergency reports" ON public.emergency_reports FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      (role::text IN ('admin', 'super_admin', 'controller', 'technician', 'moderator') 
        AND (company_id = emergency_reports.company_id 
             OR emergency_reports.is_global = true 
             OR (emergency_reports.shared_with_company_ids IS NOT NULL AND company_id = ANY(emergency_reports.shared_with_company_ids))))
      OR (role::text = 'responder' 
        AND (assigned_to = auth.uid() 
             OR company_id = emergency_reports.company_id 
             OR emergency_reports.is_global = true))
    )
  )
);

DROP POLICY IF EXISTS "Users update own emergency reports" ON public.emergency_reports;
CREATE POLICY "Users update own emergency reports" ON public.emergency_reports FOR UPDATE USING (auth.uid() = reported_by);

-- Drop all overloaded variations of get_next_ob_sequence
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, date);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, timestamp without time zone);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, text);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence();

-- Create single canonical get_next_ob_sequence function
CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(
    p_company_id uuid DEFAULT NULL, 
    p_report_date timestamp with time zone DEFAULT now()
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    report_month integer := extract(month from p_report_date);
    report_year integer := extract(year from p_report_date);
    max_seq integer;
BEGIN
    SELECT MAX(seq) INTO max_seq
    FROM (
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.vehicle_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
        UNION ALL
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.crime_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
        UNION ALL
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.emergency_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
    ) AS combined;
    
    RETURN COALESCE(max_seq, 0) + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_ob_sequence(uuid, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_ob_sequence(uuid, timestamp with time zone) TO anon;
GRANT EXECUTE ON FUNCTION public.get_next_ob_sequence(uuid, timestamp with time zone) TO service_role;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
