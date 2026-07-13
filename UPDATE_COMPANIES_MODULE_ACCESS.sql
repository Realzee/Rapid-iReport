-- UPDATE COMPANIES TABLE SCHEMA
-- Adds allowed_modules column to keep track of accessible system modules per company.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS allowed_modules text[];

-- Initialize all existing companies to have full access including the new fleet_management module:
UPDATE public.companies 
SET allowed_modules = ARRAY['controller', 'tech_ops', 'fleet_management', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives'] 
WHERE allowed_modules IS NULL;

-- Safely append 'fleet_management' to existing allowed_modules arrays if it is not already present:
UPDATE public.companies 
SET allowed_modules = array_append(allowed_modules, 'fleet_management') 
WHERE allowed_modules IS NOT NULL 
  AND NOT ('fleet_management' = ANY(allowed_modules));
