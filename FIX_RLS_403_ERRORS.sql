-- FIX RLS 403 ERRORS FOR REPORT UPDATES AND ASSIGNMENT LOGS
-- This script fixes the permission issues when responders try to update report status or stand down.

-- 1. FIX report_updates POLICIES
-- RLS is enabled, but policies were missing.
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to read report updates" ON public.report_updates;
CREATE POLICY "Allow staff to read report updates" ON public.report_updates 
FOR SELECT TO authenticated 
USING (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

DROP POLICY IF EXISTS "Allow users to read own report updates" ON public.report_updates;
CREATE POLICY "Allow users to read own report updates" ON public.report_updates 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.vehicle_reports WHERE id = report_id AND reported_by = auth.uid()
        UNION ALL
        SELECT 1 FROM public.crime_reports WHERE id = report_id AND reported_by = auth.uid()
        UNION ALL
        SELECT 1 FROM public.emergency_reports WHERE id = report_id AND reported_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Allow staff to insert report updates" ON public.report_updates;
CREATE POLICY "Allow staff to insert report updates" ON public.report_updates 
FOR INSERT TO authenticated 
WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

-- 2. FIX assignment_logs POLICIES
-- Responders were missing from the insert policy, which caused errors during 'stand down'.
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to read assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to read assignment logs" ON public.assignment_logs 
FOR SELECT TO authenticated 
USING (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

DROP POLICY IF EXISTS "Allow staff to insert assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to insert assignment logs" ON public.assignment_logs 
FOR INSERT TO authenticated 
WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

-- 3. ENSURE chat_messages POLICIES ARE ROBUST
-- Based on FIX_CHAT_MESSAGES_RLS_V2.sql but ensuring responder access.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to read chat messages" ON public.chat_messages;
CREATE POLICY "Allow staff to read chat messages" ON public.chat_messages 
FOR SELECT TO authenticated 
USING (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

DROP POLICY IF EXISTS "Allow staff to insert chat messages" ON public.chat_messages;
CREATE POLICY "Allow staff to insert chat messages" ON public.chat_messages 
FOR INSERT TO authenticated 
WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);
