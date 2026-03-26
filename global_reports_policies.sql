-- Add is_global column to tables if not exists
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;

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

-- Add policies for staff to read global reports
DROP POLICY IF EXISTS "Staff read global vehicle reports" ON public.vehicle_reports;
CREATE POLICY "Staff read global vehicle reports" ON public.vehicle_reports FOR SELECT USING (
    is_global = true AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

DROP POLICY IF EXISTS "Staff read global crime reports" ON public.crime_reports;
CREATE POLICY "Staff read global crime reports" ON public.crime_reports FOR SELECT USING (
    is_global = true AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

DROP POLICY IF EXISTS "Staff read global emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff read global emergency reports" ON public.emergency_reports FOR SELECT USING (
    is_global = true AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);
