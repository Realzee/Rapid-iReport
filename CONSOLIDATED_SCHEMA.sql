-- RAPID iREPORT - CONSOLIDATED DATABASE SCHEMA
-- Run this in the Supabase SQL Editor to set up or update your database.

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM Types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'moderator', 'controller', 'responder'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'assigned', 'in_progress', 'on_scene', 'resolved', 'rejected', 'recovered', 'closed', 'deleted'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty', 'available', 'en_route', 'on_scene'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN CREATE TYPE public.announcement_type AS ENUM ('notice', 'alert', 'safety_tip'); END IF;
END$$;

-- 2. Core Tables
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    logo_url text,
    owners_name text,
    address text,
    contact_person text,
    cell_number text,
    psira_number text,
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
    ice_no text,
    medical_aid text,
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
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    location_coords jsonb,
    evidence_images text[],
    cas_number text,
    station_name text,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone
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
    total_count integer;
BEGIN
    SELECT count(*) INTO total_count
    FROM (
        SELECT id FROM public.vehicle_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        UNION ALL
        SELECT id FROM public.crime_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
    ) AS combined;
    RETURN total_count + 1;
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
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Admin manage companies" ON public.companies FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Profiles
CREATE POLICY "Self read profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Self update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Staff read all profiles" ON public.profiles FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller'));
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Reports (Simplified for brevity, but functional)
CREATE POLICY "Users read own reports" ON public.vehicle_reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Users create reports" ON public.vehicle_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Staff manage company reports" ON public.vehicle_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

CREATE POLICY "Users read own reports" ON public.crime_reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Users create reports" ON public.crime_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Staff manage company reports" ON public.crime_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

-- Announcements
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Staff manage announcements" ON public.announcements FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- App Settings
CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin manage settings" ON public.app_settings FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- 6. Storage Policies (Run these if you have issues with uploads)
-- Note: These assume buckets 'avatars', 'evidence', 'company-logos', 'app-assets' exist.

-- Allow public read access to all buckets
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'evidence', 'company-logos', 'app-assets'));

-- Allow authenticated users to upload to avatars and evidence
CREATE POLICY "Authenticated Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated Upload Evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidence');

-- Allow admins and staff to upload to company-logos and app-assets
CREATE POLICY "Staff Upload Company Logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'company-logos' AND 
    (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller'))
);

CREATE POLICY "Admin Upload App Assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'app-assets' AND 
    (public.get_user_role(auth.uid()) = 'admin')
);

-- Allow users to update/delete their own uploads (simplified)
CREATE POLICY "Users Manage Own Uploads" ON storage.objects FOR ALL TO authenticated USING (auth.uid() = owner);
