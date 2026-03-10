-- RAPID iREPORT - Emergency Reports Database Schema
-- Run this in the Supabase SQL Editor to enable emergency reporting.

-- 1. Create the emergency_reports table
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    emergency_type text NOT NULL, -- e.g., Head-on, Rear-end, Pedestrian, etc.
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    location_coords jsonb,
    evidence_images text[],
    vehicle_involved boolean DEFAULT false,
    vehicles_involved integer DEFAULT 1,
    injuries_reported boolean DEFAULT false,
    fatalities_reported boolean DEFAULT false,
    license_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    "vehicle_Involved" boolean DEFAULT false,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone
);

-- 2. Enable RLS
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Users read own emergency reports" ON public.emergency_reports;
CREATE POLICY "Users read own emergency reports" ON public.emergency_reports FOR SELECT USING (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Users create emergency reports" ON public.emergency_reports;
CREATE POLICY "Users create emergency reports" ON public.emergency_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Staff manage company emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff manage company emergency reports" ON public.emergency_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

-- 4. Update the OB Sequence Function to include emergency reports
CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(p_company_id uuid, p_report_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    report_month integer := extract(month from p_report_date);
    report_year integer := extract(year from p_report_date);
    max_seq integer;
BEGIN
    -- Use MAX instead of COUNT to avoid collisions if reports are deleted
    -- and to be more robust against race conditions.
    SELECT MAX(seq) INTO max_seq
    FROM (
        -- Extract the numeric part from the ob_number (e.g., 'P0001/03/2026' -> 1)
        -- We assume the format is [Initial][4-digit-sequence]/MM/YYYY
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

-- 5. Add trigger for emergency reports OB number company_id auto-set
DROP TRIGGER IF EXISTS on_emergency_report_insert ON public.emergency_reports;
CREATE TRIGGER on_emergency_report_insert
  BEFORE INSERT ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_report_company_id();

-- 6. Add trigger for notifications on new emergency reports
DROP TRIGGER IF EXISTS on_emergency_report_created ON public.emergency_reports;
CREATE TRIGGER on_emergency_report_created
  AFTER INSERT ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_report();
