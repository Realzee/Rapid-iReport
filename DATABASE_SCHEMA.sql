
-- RAPID iREPORT - Complete Database SQL

-- 0. Migration/Edge Function Helper
CREATE OR REPLACE FUNCTION public.eval(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

DROP FUNCTION IF EXISTS public.get_enum_values(text);

CREATE OR REPLACE FUNCTION public.get_enum_values(enum_type_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enum_vals jsonb;
BEGIN
  SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO enum_vals
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = enum_type_name;
  
  RETURN enum_vals;
END;
$$;

-- 1. Create ENUM types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'moderator', 'controller', 'responder'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'assigned', 'in_progress', 'on_scene', 'resolved', 'rejected', 'recovered', 'closed', 'deleted'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty', 'available', 'en_route', 'on_scene'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN CREATE TYPE public.announcement_type AS ENUM ('notice', 'alert', 'safety_tip'); END IF;
END$$;

-- 2. Create Core Tables
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    name text NOT NULL,
    logo_url text,
    owners_name text,
    address text,
    contact_person text,
    cell_number text,
    psira_number text,
    CONSTRAINT companies_pkey PRIMARY KEY (id)
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Companies Policies
CREATE POLICY "Enable read access for all users" ON public.companies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for admins" ON public.companies FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Enable update for admins" ON public.companies FOR UPDATE TO authenticated USING (
    public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Enable delete for admins" ON public.companies FOR DELETE TO authenticated USING (
    public.get_user_role(auth.uid()) = 'admin'
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    first_name text NOT NULL,
    surname text NOT NULL,
    role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
    status public.user_status NOT NULL DEFAULT 'pending'::public.user_status,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    avatar_url text,
    last_seen_at timestamp with time zone,
    responder_status public.responder_status,
    location_coords jsonb,
    cell text,
    vehicle_reg text,
    home_address text,
    work_address text,
    ice_no text,
    medical_aid text,
    medical_aid_policy_number text,
    allergies text,
    insurance_company text,
    insurance_policy_number text,
    insurance_type text,
    insurance_contact text,
    vehicles jsonb DEFAULT '[]'::jsonb,
    psira_number text
);

CREATE TABLE IF NOT EXISTS public.vehicle_reports (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ob_number text NOT NULL UNIQUE,
    license_plate text NOT NULL,
    vehicle_make text NOT NULL,
    vehicle_model text NOT NULL,
    vehicle_color text NOT NULL,
    last_seen_location text NOT NULL,
    description text NOT NULL,
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    location_coords jsonb,
    evidence_images text[],
    location_boundary jsonb,
    location_boundingbox real[4],
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.crime_reports (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    crime_type text NOT NULL,
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    location_coords jsonb,
    evidence_images text[],
    location_boundary jsonb,
    location_boundingbox real[4],
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    report_id uuid NOT NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Utility Functions
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role::text FROM public.profiles WHERE id = p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(p_company_id uuid, p_report_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    report_month integer := extract(month from p_report_date);
    report_year integer := extract(year from p_report_date);
    max_seq integer;
BEGIN
    -- Use MAX instead of COUNT to avoid collisions if reports are deleted
    -- and to be more robust against race conditions.
    SELECT MAX(seq) INTO max_seq
    FROM (
        -- Extract the numeric part from the ob_number (e.g., 'P0001/03/2026' -> 1)
        -- We assume the format is [Initial][4-digit-sequence]/MM/YYYY
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.vehicle_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
        UNION ALL
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.crime_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
        UNION ALL
        -- Include emergency reports if the table exists
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.emergency_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
    ) AS combined;
    
    RETURN COALESCE(max_seq, 0) + 1;
EXCEPTION WHEN OTHERS THEN
    -- Fallback to a count-based approach if something fails (e.g. table doesn't exist yet)
    SELECT count(*) INTO max_seq
    FROM (
        SELECT id FROM public.vehicle_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        UNION ALL
        SELECT id FROM public.crime_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
    ) AS combined;
    RETURN max_seq + 1;
END;
$$;

-- 4. Public Panic Function
CREATE OR REPLACE FUNCTION public.create_public_panic_report(p_location text, p_coords jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    public_user_id uuid := '00000000-0000-0000-0000-000000000001';
    new_ob_number text;
    now_ts timestamptz := now();
BEGIN
    new_ob_number := 'P' || 
                     lpad((SELECT public.get_next_ob_sequence(NULL, now_ts::date))::text, 4, '0') ||
                     '/' || to_char(now_ts, 'MM/YYYY');

    INSERT INTO public.crime_reports (
        ob_number, title, crime_type, description, location, location_coords, 
        severity, status, reported_by, reported_at
    ) VALUES (
        new_ob_number, 'PANIC ALERT', 'PUBLIC_PANIC_ASSIST',
        'Public Panic Alert triggered via the community map.',
        p_location, p_coords, 'critical'::public.severity, 'active'::public.report_status,
        public_user_id, now_ts
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_panic_report(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_panic_report(text, jsonb) TO authenticated;

-- Ensure the special Public Reporter user exists
INSERT INTO auth.users (id, aud, role, email, instance_id, raw_app_meta_data, raw_user_meta_data)
SELECT '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'public-reporter@rapid.ireport', (SELECT id FROM auth.instances LIMIT 1), '{"provider":"email","providers":["email"]}', '{}'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, surname, role, status)
SELECT '00000000-0000-0000-0000-000000000001', 'public-reporter@rapid.ireport', 'Public', 'Reporter', 'user', 'active'
ON CONFLICT (id) DO NOTHING;
