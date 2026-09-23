-- ==============================================================================
-- SUPABASE POST-OCTOBER 30 DATA API PERMISSIONS & GRANTS
-- ==============================================================================
-- Description:
-- Starting October 30, Supabase will no longer automatically grant Data API access 
-- to new tables created in the public schema. 
-- Running this script ensures:
--  1) All existing tables have explicit grants for anon, authenticated, and service_role.
--  2) Future tables automatically receive proper grants via ALTER DEFAULT PRIVILEGES.
--  3) Sequences are accessible for auto-incrementing / serial fields.
--  4) The PostgREST schema cache is reloaded immediately.
-- ==============================================================================

-- 1. UNIVERSAL PERMISSIONS ON ALL EXISTING TABLES IN PUBLIC SCHEMA
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant access on all sequences (for serial IDs / auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant execution on all functions (for RPCs like eval, custom functions)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;


-- 2. CONFIGURE DEFAULT PRIVILEGES FOR FUTURE TABLES
-- Any new table created in the public schema going forward will automatically inherit these grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;


-- 3. EXPLICIT GRANTS FOR ALL CORE APPLICATION TABLES
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'profiles',
        'companies',
        'vehicle_reports',
        'crime_reports',
        'emergency_reports',
        'ems_dispatches',
        'ems_assessments',
        'tech_jobs',
        'tech_chat_messages',
        'report_shares',
        'notifications',
        'report_updates',
        'assignment_logs',
        'patrol_logs',
        'sites',
        'tracking_units',
        'announcements',
        'attendance',
        'chat_messages',
        'user_activity_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (
            SELECT FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = tbl
        ) THEN
            EXECUTE format('GRANT SELECT ON public.%I TO anon;', tbl);
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', tbl);
            EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);
        END IF;
    END LOOP;
END $$;


-- 4. REFRESH POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
