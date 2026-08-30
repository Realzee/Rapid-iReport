-- Drop all overloaded variations of get_next_ob_sequence to fix candidate function ambiguity
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, date);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, timestamp without time zone);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid, text);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence(uuid);
DROP FUNCTION IF EXISTS public.get_next_ob_sequence();

-- Create a single, canonical get_next_ob_sequence function
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_next_ob_sequence(uuid, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_ob_sequence(uuid, timestamp with time zone) TO anon;
GRANT EXECUTE ON FUNCTION public.get_next_ob_sequence(uuid, timestamp with time zone) TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
