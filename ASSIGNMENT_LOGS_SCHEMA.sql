-- RAPID iREPORT - Assignment Logs Database Schema
-- Run this in the Supabase SQL Editor to enable tracking of report assignments.

-- 1. Create the assignment_logs table
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    report_id uuid NOT NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow staff (admin, moderator, controller, responder) to read logs
DROP POLICY IF EXISTS "Allow staff to read assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to read assignment logs" ON public.assignment_logs FOR SELECT USING (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

-- Allow staff (admin, moderator, controller) to insert logs
DROP POLICY IF EXISTS "Allow staff to insert assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to insert assignment logs" ON public.assignment_logs FOR INSERT WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

-- 4. Add foreign key aliases for easier joining (optional but helpful for the queries in the code)
-- Note: Supabase/PostgREST uses these to know how to join when multiple FKs exist to the same table.
COMMENT ON COLUMN public.assignment_logs.assigned_from IS '{"alias": "assigned_from_profile"}';
COMMENT ON COLUMN public.assignment_logs.assigned_to IS '{"alias": "assigned_to_profile"}';
COMMENT ON COLUMN public.assignment_logs.assigned_by IS '{"alias": "assigned_by_profile"}';
