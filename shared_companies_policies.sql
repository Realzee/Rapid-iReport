-- Add shared_with_company_ids column to tables
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';

-- Update global read policies to also check shared_with_company_ids
DROP POLICY IF EXISTS "Staff read global vehicle reports" ON public.vehicle_reports;
CREATE POLICY "Staff read global vehicle reports" ON public.vehicle_reports FOR SELECT USING (
    get_user_role(auth.uid()) = 'admin' OR
    ((is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
    AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'))
);

DROP POLICY IF EXISTS "Staff read global crime reports" ON public.crime_reports;
CREATE POLICY "Staff read global crime reports" ON public.crime_reports FOR SELECT USING (
    get_user_role(auth.uid()) = 'admin' OR
    ((is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
    AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'))
);

DROP POLICY IF EXISTS "Staff read global emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff read global emergency reports" ON public.emergency_reports FOR SELECT USING (
    get_user_role(auth.uid()) = 'admin' OR
    ((is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
    AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'))
);
