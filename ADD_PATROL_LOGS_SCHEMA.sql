-- 6. Patrol Logs
CREATE TABLE IF NOT EXISTS public.patrol_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    checkpoint_id uuid NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
    guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    scanned_at timestamptz NOT NULL DEFAULT now(),
    location_coords jsonb NOT NULL, -- {lat, lng}
    verification_status text NOT NULL DEFAULT 'valid', -- 'valid', 'invalid'
    qr_code_scanned text,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE
);

ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;

-- Policies for patrol_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_logs' AND policyname = 'Enable read access for authenticated users') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.patrol_logs FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_logs' AND policyname = 'Enable insert access for authenticated guards') THEN
        -- Allow guards to insert their own logs
        CREATE POLICY "Enable insert access for authenticated guards" ON public.patrol_logs FOR INSERT TO authenticated WITH CHECK (
            exists (
                SELECT 1 FROM public.guards 
                WHERE guards.id = patrol_logs.guard_id 
                AND guards.profile_id = auth.uid()
            )
        );
    END IF;
END $$;
