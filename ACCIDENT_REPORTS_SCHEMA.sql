-- RAPID iREPORT - Accident Reports Database Schema
-- Run this in the Supabase SQL Editor to enable accident reporting.

-- 1. Create the accident_reports table
CREATE TABLE IF NOT EXISTS public.accident_reports (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    accident_type text NOT NULL, -- e.g., Head-on, Rear-end, Pedestrian, etc.
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    location_coords jsonb,
    evidence_images text[],
    cas_number text,
    station_name text,
    vehicles_involved integer DEFAULT 1,
    injuries_reported boolean DEFAULT false,
    fatalities_reported boolean DEFAULT false,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone
);

-- 2. Enable RLS
ALTER TABLE public.accident_reports ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Users read own accident reports" ON public.accident_reports;
CREATE POLICY "Users read own accident reports" ON public.accident_reports FOR SELECT USING (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Users create accident reports" ON public.accident_reports;
CREATE POLICY "Users create accident reports" ON public.accident_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Staff manage company accident reports" ON public.accident_reports;
CREATE POLICY "Staff manage company accident reports" ON public.accident_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

-- 4. Update the OB Sequence Function to include accident reports
CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(p_company_id uuid, p_report_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    report_month integer := extract(month from p_report_date);
    report_year integer := extract(year from p_report_date);
    total_count integer;
BEGIN
    SELECT count(*) INTO total_count
    FROM (
        SELECT id FROM public.vehicle_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        UNION ALL
        SELECT id FROM public.crime_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        UNION ALL
        SELECT id FROM public.accident_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
    ) AS combined;
    RETURN total_count + 1;
END;
$$;

-- 5. Add trigger for accident reports OB number company_id auto-set
DROP TRIGGER IF EXISTS on_accident_report_insert ON public.accident_reports;
CREATE TRIGGER on_accident_report_insert
  BEFORE INSERT ON public.accident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_report_company_id();

-- 6. Add trigger for notifications on new accident reports
DROP TRIGGER IF EXISTS on_accident_report_created ON public.accident_reports;
CREATE TRIGGER on_accident_report_created
  AFTER INSERT ON public.accident_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_report();
