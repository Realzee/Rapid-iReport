-- UPDATE COMPANIES TABLE SCHEMA
-- Adds allowed_modules column to keep track of accessible system modules per company.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS allowed_modules text[];

-- Optional: Set default modules for any pre-existing companies so they retain all features
-- UPDATE public.companies 
-- SET allowed_modules = ARRAY['controller', 'tech_ops', 'guard_monitoring', 'gate_access', 'attendance', 'analytics', 'archives']
-- WHERE allowed_modules IS NULL;
