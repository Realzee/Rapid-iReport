
-- 0. Admin Access Upgrade: Admins must always have access to all guarding data.
-- This applies to vehicle_reports, crime_reports, and emergency_reports.

-- Update policies for vehicle_reports
DROP POLICY IF EXISTS "Staff read global vehicle reports" ON public.vehicle_reports;
CREATE POLICY "Staff read global vehicle reports" ON public.vehicle_reports FOR SELECT USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (
        (is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
        AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
    )
);

-- Update policies for crime_reports
DROP POLICY IF EXISTS "Staff read global crime reports" ON public.crime_reports;
CREATE POLICY "Staff read global crime reports" ON public.crime_reports FOR SELECT USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (
        (is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
        AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
    )
);

-- Update policies for emergency_reports
DROP POLICY IF EXISTS "Staff read global emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff read global emergency reports" ON public.emergency_reports FOR SELECT USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (
        (is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
        AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
    )
);
