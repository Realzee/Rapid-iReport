-- Guarding Module Extensions
-- To be run in Supabase SQL Editor

-- 1. Patrol Logs
CREATE TABLE IF NOT EXISTS public.patrol_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
    checkpoint_id uuid REFERENCES public.checkpoints(id) ON DELETE SET NULL,
    scanned_at timestamptz NOT NULL DEFAULT now(),
    location_coords jsonb NOT NULL, -- {lat, lng}
    verification_status text NOT NULL DEFAULT 'valid' CHECK (verification_status IN ('valid', 'invalid')),
    qr_code_scanned text,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    verification_details text
);

-- 2. Guard Heartbeats (GPS History & Welfare Checks)
CREATE TABLE IF NOT EXISTS public.guard_heartbeats (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
    timestamp timestamptz NOT NULL DEFAULT now(),
    location_coords jsonb NOT NULL, -- {lat, lng}
    status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'welfare_check_pending', 'panic')),
    battery_level smallint,
    signal_strength smallint
);

-- Enable RLS
ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_heartbeats ENABLE ROW LEVEL SECURITY;

-- Policies for Patrol Logs
CREATE POLICY "Enable read access for authenticated users" ON public.patrol_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.patrol_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for Heartbeats
CREATE POLICY "Enable read access for authenticated users" ON public.guard_heartbeats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.guard_heartbeats FOR INSERT TO authenticated WITH CHECK (true);

-- Function to handle Geofencing trigger (pseudo-code/placeholder)
-- This would typically be handled via a Supabase EDGE Function or Database Trigger
-- that checks heartbeats against site boundaries.
