-- RAPID iREPORT - CONSOLIDATED DATABASE SCHEMA
-- Run this in the Supabase SQL Editor to set up or update your database.

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM Types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'moderator', 'controller', 'responder'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'assigned', 'in_progress', 'on_scene', 'resolved', 'rejected', 'recovered', 'closed', 'deleted', 'stolen', 'suspicious', 'bolo', 'sought', 'hijacked', 'used_in_commission_of_crime'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty', 'available', 'en_route', 'on_scene'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN CREATE TYPE public.announcement_type AS ENUM ('notice', 'alert', 'safety_tip'); END IF;
END$$;

-- Ensure new report_status values are added if the ENUM already exists
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'stolen';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'suspicious';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'bolo';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'sought';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'hijacked';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'used_in_commission_of_crime';

-- 2. Core Tables
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    alias text,
    logo_url text,
    bolo_background_url text,
    owners_name text,
    address text,
    contact_person text,
    cell_number text,
    psira_number text,
    allowed_modules text[],
    created_at timestamp with time zone DEFAULT now()
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
    responder_status public.responder_status DEFAULT 'off_duty'::public.responder_status,
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
    psira_number text,
    created_at timestamp with time zone DEFAULT now()
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
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    location_coords jsonb,
    evidence_images text[],
    cas_number text,
    station_name text,
    vin_number text,
    engine_number text,
    cos_name text,
    cos_contact_number text,
    io_name text,
    io_contact text,
    has_tracker boolean DEFAULT false,
    date_of_incident date,
    tracker_company text,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}',
    vehicle_involved boolean DEFAULT true,
    suspect_license_plate text,
    suspect_vehicle_make text,
    suspect_vehicle_model text,
    suspect_vehicle_color text
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
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    location_coords jsonb,
    evidence_images text[],
    cas_number text,
    station_name text,
    date_of_incident date,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.report_updates (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    report_id uuid NOT NULL, -- Can be from either vehicle or crime reports
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    report_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    report_id uuid NOT NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    reference_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    type public.announcement_type NOT NULL DEFAULT 'notice'::public.announcement_type,
    image_url text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Helper Functions
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

-- 4. Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, surname, role, status, company_id, cell, vehicle_reg, home_address, ice_no, medical_aid, psira_number)
  VALUES (
    new.id, new.email,
    COALESCE(new.raw_user_meta_data ->> 'first_name', 'New'),
    COALESCE(new.raw_user_meta_data ->> 'surname', 'User'),
    'user', 'pending',
    (new.raw_user_meta_data ->> 'company_id')::uuid,
    new.raw_user_meta_data ->> 'cell',
    new.raw_user_meta_data ->> 'vehicle_reg',
    new.raw_user_meta_data ->> 'home_address',
    new.raw_user_meta_data ->> 'ice_no',
    new.raw_user_meta_data ->> 'medical_aid',
    new.raw_user_meta_data ->> 'psira_number'
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET email = new.email WHERE id = new.id;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated AFTER UPDATE OF email ON auth.users FOR EACH ROW WHEN (old.email IS DISTINCT FROM new.email) EXECUTE FUNCTION public.update_profile_email();

-- 5. RLS Policies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Companies
DROP POLICY IF EXISTS "Public read companies" ON public.companies;
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage companies" ON public.companies;
CREATE POLICY "Admin manage companies" ON public.companies FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Profiles
DROP POLICY IF EXISTS "Self read profile" ON public.profiles;
CREATE POLICY "Self read profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Self update profile" ON public.profiles;
CREATE POLICY "Self update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Staff read all profiles" ON public.profiles;
CREATE POLICY "Staff read all profiles" ON public.profiles FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller'));
DROP POLICY IF EXISTS "Admin manage profiles" ON public.profiles;
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Reports (Simplified for brevity, but functional)
DROP POLICY IF EXISTS "Users read own reports" ON public.vehicle_reports;
CREATE POLICY "Users read own reports" ON public.vehicle_reports FOR SELECT USING (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Users create reports" ON public.vehicle_reports;
CREATE POLICY "Users create reports" ON public.vehicle_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Staff manage company reports" ON public.vehicle_reports;
CREATE POLICY "Staff manage company reports" ON public.vehicle_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "Responders manage assigned reports" ON public.vehicle_reports;
CREATE POLICY "Responders manage assigned reports" ON public.vehicle_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'responder' AND assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Staff read global vehicle reports" ON public.vehicle_reports;
CREATE POLICY "Staff read global vehicle reports" ON public.vehicle_reports FOR SELECT USING (
    (is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
    AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);

DROP POLICY IF EXISTS "Users read own crime reports" ON public.crime_reports;
CREATE POLICY "Users read own crime reports" ON public.crime_reports FOR SELECT USING (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Users create crime reports" ON public.crime_reports;
CREATE POLICY "Users create crime reports" ON public.crime_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Staff manage company crime reports" ON public.crime_reports;
CREATE POLICY "Staff manage company crime reports" ON public.crime_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "Responders manage assigned crime reports" ON public.crime_reports;
CREATE POLICY "Responders manage assigned crime reports" ON public.crime_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'responder' AND assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Staff read global crime reports" ON public.crime_reports;
CREATE POLICY "Staff read global crime reports" ON public.crime_reports FOR SELECT USING (
    (is_global = true OR (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = ANY(shared_with_company_ids))
    AND get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder')
);



-- Announcements
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff manage announcements" ON public.announcements;
CREATE POLICY "Staff manage announcements" ON public.announcements FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- App Settings
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;
CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage settings" ON public.app_settings;
CREATE POLICY "Admin manage settings" ON public.app_settings FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Assignment Logs
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow staff to read assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to read assignment logs" ON public.assignment_logs FOR SELECT USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));
DROP POLICY IF EXISTS "Allow staff to insert assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow staff to insert assignment logs" ON public.assignment_logs FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder'));

-- Notifications
DROP POLICY IF EXISTS "Allow select for authenticated notifications" ON public.notifications;
CREATE POLICY "Allow select for authenticated notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = recipient_user_id);
DROP POLICY IF EXISTS "Allow insert for authenticated notifications" ON public.notifications;
CREATE POLICY "Allow insert for authenticated notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update for authenticated notifications" ON public.notifications;
CREATE POLICY "Allow update for authenticated notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);
DROP POLICY IF EXISTS "Allow delete for authenticated notifications" ON public.notifications;
CREATE POLICY "Allow delete for authenticated notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = recipient_user_id);

-- 6. Storage Policies (Run these if you have issues with uploads)
-- Note: These assume buckets 'avatars', 'evidence', 'company-logos', 'app-assets' exist.

-- Allow public read access to all buckets
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'evidence', 'company-logos', 'app-assets'));

-- Allow authenticated users to upload to evidence and avatars
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
CREATE POLICY "Authenticated Upload Access" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id IN ('avatars', 'evidence'));

-- Allow users to update their own avatars
DROP POLICY IF EXISTS "Users Update Own Avatars" ON storage.objects;
CREATE POLICY "Users Update Own Avatars" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'avatars');

-- Allow admins to manage all storage
DROP POLICY IF EXISTS "Admins Manage All Storage" ON storage.objects;
CREATE POLICY "Admins Manage All Storage" ON storage.objects FOR ALL USING (get_user_role(auth.uid()) = 'admin');
