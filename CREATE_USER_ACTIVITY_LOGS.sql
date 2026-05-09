-- USER ACTIVITY LOGS SCHEMA
-- This table tracks all important user actions in the system for auditing purposes.

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action text NOT NULL,
    details text NOT NULL,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow staff to read activity logs" ON public.user_activity_logs;
CREATE POLICY "Allow staff to read activity logs" ON public.user_activity_logs 
FOR SELECT USING (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

-- Note: We allow all authenticated users to INSERT logs (via the logger utility)
-- but they can only READ them if they are staff.
DROP POLICY IF EXISTS "Allow all users to insert activity logs" ON public.user_activity_logs;
CREATE POLICY "Allow all users to insert activity logs" ON public.user_activity_logs 
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON public.user_activity_logs(action);
