
-- Run this script to ensure all user roles exist in the database without enum casting errors

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'technician';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'guard';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'supervisor';
        EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;

