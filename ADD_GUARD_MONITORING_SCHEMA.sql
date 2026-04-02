-- Create Guard Monitoring Tables

-- 1. Sites
CREATE TABLE IF NOT EXISTS public.sites (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    location jsonb NOT NULL, -- {lat, lng}
    boundary jsonb, -- GeoJSON
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE
);

-- 2. Routes
CREATE TABLE IF NOT EXISTS public.routes (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE
);

-- 3. Checkpoints
CREATE TABLE IF NOT EXISTS public.checkpoints (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    location jsonb NOT NULL -- {lat, lng}
);

-- 4. Supervisors
CREATE TABLE IF NOT EXISTS public.supervisors (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE
);

-- 5. Guards
CREATE TABLE IF NOT EXISTS public.guards (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'off_duty'
);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guards ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for admins" ON public.sites FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Enable read access for authenticated users" ON public.routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for admins" ON public.routes FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Enable read access for authenticated users" ON public.checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for admins" ON public.checkpoints FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Enable read access for authenticated users" ON public.supervisors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for admins" ON public.supervisors FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Enable read access for authenticated users" ON public.guards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for admins" ON public.guards FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');
