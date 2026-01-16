# RAPID iREPORT - Database Schema

This file contains the complete, idempotent SQL script for setting up the Supabase database for the RAPID iREPORT application. This script can be run safely in the Supabase SQL Editor to create all necessary types, tables, functions, and Row Level Security policies.

For detailed setup instructions, refer to `DATABASE_SETUP.md`.

```sql
BEGIN;

-- This is a comprehensive permissions reset for the public schema.
-- It ensures that all Supabase roles can interact with the schema and its objects.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- 0. Make sure the 'uuid-ossp' extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 1. Create ENUM types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'moderator', 'controller', 'responder', 'user');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('active', 'pending', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'assigned', 'in_progress', 'on_scene', 'resolved', 'rejected', 'recovered', 'closed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN
        CREATE TYPE public.severity AS ENUM ('critical', 'high', 'medium', 'low');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN
        CREATE TYPE public.responder_status AS ENUM ('available', 'en_route', 'on_scene', 'off_duty');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
        CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END$$;


-- 2. Create Tables

-- Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    CONSTRAINT companies_pkey PRIMARY KEY (id)
);

-- Profiles Table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
    status public.user_status NOT NULL DEFAULT 'pending'::public.user_status,
    company_id uuid,
    avatar_url text,
    last_seen_at timestamp with time zone,
    responder_status public.responder_status,
    location_coords jsonb,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL
);

-- Vehicle Reports Table
CREATE TABLE IF NOT EXISTS public.vehicle_reports (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    ob_number text NOT NULL UNIQUE,
    license_plate text NOT NULL,
    vehicle_make text NOT NULL,
    vehicle_model text NOT NULL,
    vehicle_color text NOT NULL,
    last_seen_location text NOT NULL,
    description text NOT NULL,
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL,
    assigned_to uuid,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    location_coords jsonb,
    evidence_images text[],
    location_boundary jsonb,
    location_boundingbox real[4],
    CONSTRAINT vehicle_reports_pkey PRIMARY KEY (id),
    CONSTRAINT vehicle_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT vehicle_reports_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Crime Reports Table
CREATE TABLE IF NOT EXISTS public.crime_reports (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    crime_type text NOT NULL,
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL,
    assigned_to uuid,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    location_coords jsonb,
    evidence_images text[],
    location_boundary jsonb,
    location_boundingbox real[4],
    CONSTRAINT crime_reports_pkey PRIMARY KEY (id),
    CONSTRAINT crime_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT crime_reports_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Report Updates Table
CREATE TABLE IF NOT EXISTS public.report_updates (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    report_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT report_updates_pkey PRIMARY KEY (id),
    CONSTRAINT report_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    recipient_user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    is_read boolean NOT NULL DEFAULT false,
    reference_id uuid,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Registration Requests Table
CREATE TABLE IF NOT EXISTS public.registration_requests (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    full_name text NOT NULL,
    email text NOT NULL,
    phone_number text,
    requested_role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
    company_name text,
    company_address text,
    company_reg_number text,
    message text,
    status public.request_status NOT NULL DEFAULT 'pending'::public.request_status,
    CONSTRAINT registration_requests_pkey PRIMARY KEY (id)
);


-- 3. Create Helper Functions & Triggers

-- Function to create notifications for relevant staff
CREATE OR REPLACE FUNCTION public.create_staff_notification(
    notification_type text,
    notification_title text,
    notification_message text,
    ref_id uuid,
    target_roles text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_user_id, type, title, message, reference_id)
  SELECT id, notification_type, notification_title, notification_message, ref_id
  FROM public.profiles
  WHERE role::text = ANY(target_roles);
END;
$$;

-- Trigger Function to create a profile and notification for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_full_name text;
BEGIN
  -- Use COALESCE to provide a fallback for full_name, preventing NOT NULL violations if metadata is missing.
  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.email);

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    user_full_name,
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'user'::public.user_role)
  );

  PERFORM public.create_staff_notification(
    'new_user',
    'New User Registered',
    'A new user (' || user_full_name || ') has signed up.',
    new.id,
    ARRAY['admin', 'moderator']
  );
  
  RETURN new;
END;
$$;

-- Trigger function for new reports
CREATE OR REPLACE FUNCTION public.handle_new_report_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  report_title text;
BEGIN
  IF TG_TABLE_NAME = 'vehicle_reports' THEN
    report_title := 'Stolen Vehicle: ' || new.license_plate;
  ELSE
    report_title := 'Crime Incident: ' || new.title;
  END IF;

  PERFORM public.create_staff_notification(
    'new_report',
    report_title,
    'A new incident has been filed and requires attention.',
    new.id,
    ARRAY['admin', 'moderator', 'controller']
  );
  RETURN new;
END;
$$;

-- Trigger function for new registration requests
CREATE OR REPLACE FUNCTION public.handle_new_registration_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  notification_msg text;
BEGIN
  notification_msg := new.full_name || ' has requested a "' || new.requested_role::text || '" account.';
  
  IF new.company_name IS NOT NULL THEN
    notification_msg := notification_msg || ' For company: ' || new.company_name;
  END IF;

  PERFORM public.create_staff_notification(
    'new_registration_request',
    'New Account Request: ' || new.requested_role::text,
    notification_msg,
    new.id,
    ARRAY['admin', 'moderator']
  );
  RETURN new;
END;
$$;

-- 4. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_new_vehicle_report_notify ON public.vehicle_reports;
CREATE TRIGGER on_new_vehicle_report_notify
  AFTER INSERT ON public.vehicle_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_report_notification();

DROP TRIGGER IF EXISTS on_new_crime_report_notify ON public.crime_reports;
CREATE TRIGGER on_new_crime_report_notify
  AFTER INSERT ON public.crime_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_report_notification();

DROP TRIGGER IF EXISTS on_new_registration_request_notify ON public.registration_requests;
CREATE TRIGGER on_new_registration_request_notify
  AFTER INSERT ON public.registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_registration_request();


-- 5. Row Level Security (RLS) Policies

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to view profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT
  WITH CHECK ( (auth.uid() = id) OR (current_role = 'postgres') );
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins and moderators can manage all profiles" ON public.profiles;
CREATE POLICY "Admins and moderators can manage all profiles" ON public.profiles FOR ALL
  USING ((( SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator'))) WITH CHECK ((( SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator')));

-- COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.companies;
CREATE POLICY "Allow authenticated users to view companies" ON public.companies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins and moderators can manage companies" ON public.companies;
CREATE POLICY "Admins and moderators can manage companies" ON public.companies FOR ALL
  USING ((( SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator'))) WITH CHECK ((( SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator')));

-- VEHICLE REPORTS
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.vehicle_reports;
CREATE POLICY "Allow view access to relevant users" ON public.vehicle_reports FOR SELECT
  USING ( ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator', 'controller')) OR (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'responder') AND (assigned_to = auth.uid())) OR (reported_by = auth.uid()) );
DROP POLICY IF EXISTS "Allow users to create reports" ON public.vehicle_reports;
CREATE POLICY "Allow users to create reports" ON public.vehicle_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow admins, moderators, controllers to manage reports" ON public.vehicle_reports;
CREATE POLICY "Allow admins, moderators, controllers to manage reports" ON public.vehicle_reports FOR ALL
  USING (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator', 'controller'))) WITH CHECK (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator', 'controller')));
DROP POLICY IF EXISTS "Allow assigned responders to update status" ON public.vehicle_reports;
CREATE POLICY "Allow assigned responders to update status" ON public.vehicle_reports FOR UPDATE
  USING ((((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'responder') AND (assigned_to = auth.uid())));

-- CRIME REPORTS
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.crime_reports;
CREATE POLICY "Allow view access to relevant users" ON public.crime_reports FOR SELECT
  USING ( ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator', 'controller')) OR (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'responder') AND (assigned_to = auth.uid())) OR (reported_by = auth.uid()) );
DROP POLICY IF EXISTS "Allow users to create reports" ON public.crime_reports;
CREATE POLICY "Allow users to create reports" ON public.crime_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow admins, moderators, controllers to manage reports" ON public.crime_reports;
CREATE POLICY "Allow admins, moderators, controllers to manage reports" ON public.crime_reports FOR ALL
  USING (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator', 'controller'))) WITH CHECK (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator', 'controller')));
DROP POLICY IF EXISTS "Allow assigned responders to update status" ON public.crime_reports;
CREATE POLICY "Allow assigned responders to update status" ON public.crime_reports FOR UPDATE
  USING ((((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'responder') AND (assigned_to = auth.uid())));

-- REPORT UPDATES
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow relevant users to see updates" ON public.report_updates;
CREATE POLICY "Allow relevant users to see updates" ON public.report_updates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow relevant users to add updates" ON public.report_updates;
CREATE POLICY "Allow relevant users to add updates" ON public.report_updates FOR INSERT
  WITH CHECK ( ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator', 'controller')) OR (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'responder')) );

-- REGISTRATION REQUESTS
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to submit registration requests" ON public.registration_requests;
CREATE POLICY "Allow users to submit registration requests" ON public.registration_requests FOR INSERT
  WITH CHECK (auth.role() = 'anon');
DROP POLICY IF EXISTS "Admins and moderators can manage registration requests" ON public.registration_requests;
CREATE POLICY "Admins and moderators can manage registration requests" ON public.registration_requests FOR ALL
  USING (((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'moderator')));

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
CREATE POLICY "Users can see their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_user_id);
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);
DROP POLICY IF EXISTS "Allow system to insert new user notifications" ON public.notifications;
CREATE POLICY "Allow system to insert new user notifications" ON public.notifications
  FOR INSERT WITH CHECK ( type = 'new_user' AND (SELECT role::text FROM public.profiles WHERE id = recipient_user_id) IN ('admin', 'moderator') );
DROP POLICY IF EXISTS "Allow system to insert new report notifications" ON public.notifications;
CREATE POLICY "Allow system to insert new report notifications" ON public.notifications
  FOR INSERT WITH CHECK ( type = 'new_report' AND (SELECT role::text FROM public.profiles WHERE id = recipient_user_id) IN ('admin', 'moderator', 'controller') );
DROP POLICY IF EXISTS "Allow system to insert new registration notifications" ON public.notifications;
CREATE POLICY "Allow system to insert new registration notifications" ON public.notifications
  FOR INSERT WITH CHECK ( type = 'new_registration_request' AND (SELECT role::text FROM public.profiles WHERE id = recipient_user_id) IN ('admin', 'moderator') );

COMMIT;

```