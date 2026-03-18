-- Fix RLS policies for chat_messages
DROP POLICY IF EXISTS "Users read chat messages" ON public.chat_messages;
CREATE POLICY "Users read chat messages" ON public.chat_messages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicle_reports WHERE id = report_id AND (reported_by = auth.uid() OR (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder') AND (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NULL OR company_id IS NULL)))) OR
    EXISTS (SELECT 1 FROM public.crime_reports WHERE id = report_id AND (reported_by = auth.uid() OR (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder') AND (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NULL OR company_id IS NULL)))) OR
    EXISTS (SELECT 1 FROM public.emergency_reports WHERE id = report_id AND (reported_by = auth.uid() OR (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder') AND (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NULL OR company_id IS NULL))))
);

DROP POLICY IF EXISTS "Users insert chat messages" ON public.chat_messages;
CREATE POLICY "Users insert chat messages" ON public.chat_messages
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    (
        EXISTS (SELECT 1 FROM public.vehicle_reports WHERE id = report_id AND (reported_by = auth.uid() OR (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder') AND (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NULL OR company_id IS NULL)))) OR
        EXISTS (SELECT 1 FROM public.crime_reports WHERE id = report_id AND (reported_by = auth.uid() OR (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder') AND (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NULL OR company_id IS NULL)))) OR
        EXISTS (SELECT 1 FROM public.emergency_reports WHERE id = report_id AND (reported_by = auth.uid() OR (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder') AND (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NULL OR company_id IS NULL))))
    )
);
