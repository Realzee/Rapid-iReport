-- LATEST SYSTEM UPDATES (CONSOLIDATED)
-- Includes: Gate Access Fixes, Responder Permission Pathces (403), and Chat RLS.

-- 1. GATE ACCESS LOGS SCHEMA FIX
-- Ensures frontend queries match database columns
CREATE TABLE IF NOT EXISTS public.gate_access_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    license_plate text NOT NULL,
    direction text NOT NULL, -- 'in' or 'out'
    logged_by uuid REFERENCES public.profiles(id),
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_wanted boolean DEFAULT false,
    wanted_report_id uuid REFERENCES public.vehicle_reports(id) ON DELETE SET NULL
);

ALTER TABLE public.gate_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read access logs" ON public.gate_access_logs;
CREATE POLICY "Staff can read access logs" ON public.gate_access_logs 
FOR SELECT TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

DROP POLICY IF EXISTS "Staff can insert access logs" ON public.gate_access_logs;
CREATE POLICY "Staff can insert access logs" ON public.gate_access_logs 
FOR INSERT TO authenticated 
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

-- 2. RESPONDER PERMISSION PATCHES (FIXES 403 ERRORS)
-- Allows responders to update status and stand down properly

-- Report Updates Table
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to read report updates" ON public.report_updates;
CREATE POLICY "Allow staff to read report updates" ON public.report_updates 
FOR SELECT TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

DROP POLICY IF EXISTS "Allow staff to insert report updates" ON public.report_updates;
CREATE POLICY "Allow staff to insert report updates" ON public.report_updates 
FOR INSERT TO authenticated 
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

-- Assignment Logs Table
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to read assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to read assignment logs" ON public.assignment_logs 
FOR SELECT TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

DROP POLICY IF EXISTS "Allow staff to insert assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to insert assignment logs" ON public.assignment_logs 
FOR INSERT TO authenticated 
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

-- 3. CHAT MESSAGE PERMISSIONS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to access chats" ON public.chat_messages;
CREATE POLICY "Allow staff to access chats" ON public.chat_messages 
FOR ALL TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

DROP POLICY IF EXISTS "Allow owners to read chats" ON public.chat_messages;
CREATE POLICY "Allow owners to read chats" ON public.chat_messages 
FOR SELECT TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.vehicle_reports WHERE id = report_id AND reported_by = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.crime_reports WHERE id = report_id AND reported_by = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.emergency_reports WHERE id = report_id AND reported_by = auth.uid())
);
