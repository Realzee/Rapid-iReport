-- Add read_by column if it doesn't exist
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT '{}';

-- Create mark_message_as_read function
CREATE OR REPLACE FUNCTION public.mark_message_as_read(message_id uuid, reader_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_messages
  SET read_by = array_append(read_by, reader_id)
  WHERE id = message_id AND NOT (read_by @> ARRAY[reader_id]);
END;
$$;

-- Fix RLS policies for chat_messages
DROP POLICY IF EXISTS "Users read chat messages" ON public.chat_messages;
CREATE POLICY "Users read chat messages" ON public.chat_messages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicle_reports WHERE id = report_id) OR
    EXISTS (SELECT 1 FROM public.crime_reports WHERE id = report_id) OR
    EXISTS (SELECT 1 FROM public.emergency_reports WHERE id = report_id)
);

DROP POLICY IF EXISTS "Users insert chat messages" ON public.chat_messages;
CREATE POLICY "Users insert chat messages" ON public.chat_messages
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    (
        EXISTS (SELECT 1 FROM public.vehicle_reports WHERE id = report_id) OR
        EXISTS (SELECT 1 FROM public.crime_reports WHERE id = report_id) OR
        EXISTS (SELECT 1 FROM public.emergency_reports WHERE id = report_id)
    )
);

DROP POLICY IF EXISTS "Users update chat messages" ON public.chat_messages;
CREATE POLICY "Users update chat messages" ON public.chat_messages
FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    (user_id = auth.uid() OR get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'))
);

DROP POLICY IF EXISTS "Users delete chat messages" ON public.chat_messages;
CREATE POLICY "Users delete chat messages" ON public.chat_messages
FOR DELETE USING (
    auth.uid() IS NOT NULL AND
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);
