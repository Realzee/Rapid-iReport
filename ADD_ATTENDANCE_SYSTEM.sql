
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    clock_in_time timestamp with time zone NOT NULL DEFAULT now(),
    clock_out_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for controller/admin/moderator" ON public.attendance FOR SELECT TO authenticated USING (
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller') OR auth.uid() = user_id
);

CREATE POLICY "Enable insert for guards" ON public.attendance FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role(auth.uid()) = 'guard'
);

CREATE POLICY "Enable update for guards self-clock-out" ON public.attendance FOR UPDATE TO authenticated USING (
    auth.uid() = user_id
);
