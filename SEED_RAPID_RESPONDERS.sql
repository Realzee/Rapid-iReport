-- RAPID iREPORT - Bootstrapping SQL Script
-- ==========================================================
-- INSTRUCTIONS:
-- 1. Copy the entire contents of this script.
-- 2. Open your Supabase Dashboard (https://supabase.com).
-- 3. Click on the "SQL Editor" tab in the left-hand menu.
-- 4. Click "+ New query" or paste this code into any active query editor window.
-- 5. Click the "Run" button at the bottom right.
-- ==========================================================

-- 1. Insert "Rapid Responders SA" company if it does not already exist.
-- We use a fixed, deterministic ID so that it is consistent across references.
INSERT INTO public.companies (id, name, alias, allowed_modules, psira_number)
SELECT 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 
    'Rapid Responders SA', 
    'rapid-responders', 
    ARRAY['controller', 'tech_ops', 'fleet_management', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives'],
    'PSIRA-RAPID911'
WHERE NOT EXISTS (
    SELECT 1 FROM public.companies WHERE name = 'Rapid Responders SA'
);

-- 2. Link all unassigned user profiles to "Rapid Responders SA".
-- Any users who registered while the database was unseeded (which bypasses the 400 foreign key constraint by sending a NULL company_id)
-- will be automatically associated with the newly seeded default company.
UPDATE public.profiles
SET company_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
WHERE company_id IS NULL;

-- 3. Notify Schema Reload
-- Signals to PostgREST to reload its schema cache and make any changes active immediately.
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- 4. Log Success
SELECT 'Database successfully seeded with default company "Rapid Responders SA"!' as status;
