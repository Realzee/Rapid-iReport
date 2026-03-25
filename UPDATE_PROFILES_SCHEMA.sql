-- Add new fields to profiles table for controllers and responders

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_aid_policy_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_company text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_policy_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_contact text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicles jsonb DEFAULT '[]'::jsonb;

-- Create assignment_logs table
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    report_id uuid NOT NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for assignment_logs
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

-- Policies for assignment_logs
CREATE POLICY "Allow staff to read assignment logs" ON public.assignment_logs
    FOR SELECT
    USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

CREATE POLICY "Allow staff to insert assignment logs" ON public.assignment_logs
    FOR INSERT
    WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller'));
