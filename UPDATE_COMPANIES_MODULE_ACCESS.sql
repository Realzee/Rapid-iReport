-- UPDATE COMPANIES TABLE SCHEMA
-- Adds allowed_modules column to keep track of accessible system modules per company.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS allowed_modules text[];

-- Initialize all existing companies to have full access:
UPDATE public.companies 
SET allowed_modules = ARRAY['controller', 'ems_dispatch', 'tech_ops', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives'] 
WHERE allowed_modules IS NULL;

-- Remove 'fleet_management' from existing allowed_modules arrays:
UPDATE public.companies 
SET allowed_modules = array_remove(allowed_modules, 'fleet_management') 
WHERE allowed_modules IS NOT NULL 
  AND ('fleet_management' = ANY(allowed_modules));
