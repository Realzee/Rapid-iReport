-- Add is_global and shared_with_company_ids columns to tables if not exists
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';

ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';

ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids uuid[] DEFAULT '{}';

-- Add policies for responders to manage assigned reports
DROP POLICY IF EXISTS "Responders manage assigned reports" ON public.vehicle_reports;
CREATE POLICY "Responders manage assigned reports" ON public.vehicle_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'responder' AND assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Responders manage assigned crime reports" ON public.crime_reports;
CREATE POLICY "Responders manage assigned crime reports" ON public.crime_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'responder' AND assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Responders manage assigned emergency reports" ON public.emergency_reports;
CREATE POLICY "Responders manage assigned emergency reports" ON public.emergency_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'responder' AND assigned_to = auth.uid()
);

-- Add policies for staff to read global and shared reports
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
