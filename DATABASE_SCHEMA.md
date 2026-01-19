
# RAPID iREPORT - Database Schema

This file contains the complete, idempotent SQL script for setting up the Supabase database for the RAPID iREPORT application. This script can be run safely in the Supabase SQL Editor to create all necessary types, tables, functions, and Row Level Security policies.

For detailed setup instructions, refer to `DATABASE_SETUP.md`.

> [!IMPORTANT]
> The script is now in two parts. You must copy and run each part **separately** in the Supabase SQL Editor for the setup to succeed. This is required because PostgreSQL cannot alter data types within a transaction.

---

### **Part 1: Update Data Types**
Copy and run the code block below first. This part is non-transactional.

```sql
-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script creates and updates custom ENUM types.
-- It MUST be run separately from Part 2.

-- 0. Make sure the 'uuid-ossp' extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 1. Create ENUM types if they don't exist (initial creation with a single placeholder value)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN CREATE TYPE public.request_status AS ENUM ('pending'); END IF;
END$$;

-- 2. Add all possible values to ENUM types to ensure they are up-to-date.
-- This section MUST be run outside of a transaction block.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'controller';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'responder';

ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'suspended';

ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'on_scene';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'recovered';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'closed';

ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'critical';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'medium';

ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'on_scene';

ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'rejected';
```
---

### **Part 2: Setup Tables, Functions, and Policies**
After Part 1 completes successfully, open a **new query** in the SQL Editor and run this second code block. This part is transactional.

```sql
-- RAPID iREPORT - Database Setup Script - PART 2
-- Description: This script sets up tables, functions, triggers, and RLS policies.
-- It MUST be run after Part 1 has completed successfully.
BEGIN;

-- This is a comprehensive permissions reset for the public schema.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- 3. Create Tables

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
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL
);

-- Ensure responder-specific columns exist for backward compatibility.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS responder_status public.responder_status;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_coords jsonb;

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

-- Assignment Logs Table
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    report_id uuid NOT NULL,
    assigned_from uuid,
    assigned_to uuid,
    assigned_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT assignment_logs_pkey PRIMARY KEY (id),
    CONSTRAINT assignment_logs_assigned_from_fkey FOREIGN KEY (assigned_from) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT assignment_logs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT assignment_logs_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE CASCADE
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
    company_name text,
    message text,
    status public.request_status NOT NULL DEFAULT 'pending'::public.request_status,
    CONSTRAINT registration_requests_pkey PRIMARY KEY (id)
);


-- 4. Create Helper Functions & Triggers

-- Function to get a user's role, bypassing RLS. SECURITY DEFINER is crucial.
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role_text text;
BEGIN
  SELECT role::text INTO user_role_text FROM public.profiles WHERE id = p_user_id;
  RETURN user_role_text;
END;
$$;

-- Function to get all values for a given ENUM type. Used for schema validation.
CREATE OR REPLACE FUNCTION public.get_enum_values(enum_type_name text)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[]
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = enum_type_name;
$$;

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
  user_role_text text;
  user_status_text text;
  user_company_id uuid;
  user_responder_status_text text;
BEGIN
  -- Extract metadata, providing sensible defaults
  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.email);
  user_role_text := COALESCE(new.raw_user_meta_data->>'role', 'user');
  user_status_text := COALESCE(new.raw_user_meta_data->>'status', 'pending');
  
  -- Safely cast company_id to uuid
  BEGIN
    user_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  EXCEPTION WHEN others THEN
    user_company_id := NULL;
  END;

  user_responder_status_text := new.raw_user_meta_data->>'responder_status';

  -- Insert into profiles table
  INSERT INTO public.profiles (id, full_name, email, role, status, company_id, responder_status)
  VALUES (
    new.id,
    user_full_name,
    new.email,
    user_role_text::public.user_role,
    user_status_text::public.user_status,
    user_company_id,
    CASE
      WHEN user_role_text = 'responder' THEN user_responder_status_text::public.responder_status
      ELSE NULL
    END
  );

  -- Create a notification for admins
  PERFORM public.create_staff_notification(
    'new_user', 'New User Registered', 'A new user (' || user_full_name || ') has signed up.', new.id, ARRAY['admin', 'moderator']
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
  IF TG_TABLE_NAME = 'vehicle_reports' THEN report_title := 'Stolen Vehicle: ' || new.license_plate;
  ELSE report_title := 'Crime Incident: ' || new.title;
  END IF;

  PERFORM public.create_staff_notification(
    'new_report', report_title, 'A new incident has been filed and requires attention.', new.id, ARRAY['admin', 'moderator', 'controller']
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
  notification_msg := new.full_name || ' has requested an account.';
  IF new.company_name IS NOT NULL THEN notification_msg := notification_msg || ' For company: ' || new.company_name; END IF;
  PERFORM public.create_staff_notification(
    'new_registration_request', 'New Account Request', notification_msg, new.id, ARRAY['admin', 'moderator']
  );
  RETURN new;
END;
$$;

-- Trigger function for assignment changes
CREATE OR REPLACE FUNCTION public.log_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.assignment_logs (report_id, assigned_from, assigned_to, assigned_by)
    VALUES (NEW.id, OLD.assigned_to, NEW.assigned_to, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;


-- 5. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_new_vehicle_report_notify ON public.vehicle_reports;
CREATE TRIGGER on_new_vehicle_report_notify AFTER INSERT ON public.vehicle_reports FOR EACH ROW EXECUTE FUNCTION public.handle_new_report_notification();

DROP TRIGGER IF EXISTS on_new_crime_report_notify ON public.crime_reports;
CREATE TRIGGER on_new_crime_report_notify AFTER INSERT ON public.crime_reports FOR EACH ROW EXECUTE FUNCTION public.handle_new_report_notification();

DROP TRIGGER IF EXISTS on_new_registration_request_notify ON public.registration_requests;
CREATE TRIGGER on_new_registration_request_notify AFTER INSERT ON public.registration_requests FOR EACH ROW EXECUTE FUNCTION public.handle_new_registration_request();

DROP TRIGGER IF EXISTS on_vehicle_report_assignment_change ON public.vehicle_reports;
CREATE TRIGGER on_vehicle_report_assignment_change AFTER UPDATE OF assigned_to ON public.vehicle_reports FOR EACH ROW EXECUTE FUNCTION public.log_assignment_change();

DROP TRIGGER IF EXISTS on_crime_report_assignment_change ON public.crime_reports;
CREATE TRIGGER on_crime_report_assignment_change AFTER UPDATE OF assigned_to ON public.crime_reports FOR EACH ROW EXECUTE FUNCTION public.log_assignment_change();


-- 6. Row Level Security (RLS) Policies

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to view profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK ( (auth.uid() = id) OR (current_role = 'postgres') );
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Admins and moderators can manage all profiles" ON public.profiles;
CREATE POLICY "Admins and moderators can manage all profiles" ON public.profiles FOR ALL USING ((public.get_user_role(auth.uid()) IN ('admin', 'moderator'))) WITH CHECK ((public.get_user_role(auth.uid()) IN ('admin', 'moderator')));
DROP POLICY IF EXISTS "Controllers can update responder profiles" ON public.profiles;
CREATE POLICY "Controllers can update responder profiles" ON public.profiles FOR UPDATE USING ( (public.get_user_role(auth.uid()) = 'controller') AND (role = 'responder') ) WITH CHECK ( (public.get_user_role(auth.uid()) = 'controller') AND (role = 'responder') );

-- COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.companies;
CREATE POLICY "Allow authenticated users to view companies" ON public.companies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins and moderators can manage companies" ON public.companies;
CREATE POLICY "Admins and moderators can manage companies" ON public.companies FOR ALL USING ((public.get_user_role(auth.uid()) IN ('admin', 'moderator'))) WITH CHECK ((public.get_user_role(auth.uid()) IN ('admin', 'moderator')));

-- VEHICLE REPORTS
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.vehicle_reports;
CREATE POLICY "Allow view access to relevant users" ON public.vehicle_reports FOR SELECT USING ( (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')) OR ((public.get_user_role(auth.uid()) = 'responder') AND (assigned_to = auth.uid())) OR (reported_by = auth.uid()) );
DROP POLICY IF EXISTS "Allow users to create reports" ON public.vehicle_reports;
CREATE POLICY "Allow users to create reports" ON public.vehicle_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow admins, moderators, controllers to manage reports" ON public.vehicle_reports;
CREATE POLICY "Allow admins, moderators, controllers to manage reports" ON public.vehicle_reports FOR ALL USING ((public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller'))) WITH CHECK ((public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')));
DROP POLICY IF EXISTS "Allow assigned responders to update their reports" ON public.vehicle_reports;
CREATE POLICY "Allow assigned responders to update their reports" ON public.vehicle_reports FOR UPDATE USING ( (public.get_user_role(auth.uid()) = 'responder') AND (assigned_to = auth.uid()) ) WITH CHECK ( (assigned_to = auth.uid()) OR (assigned_to IS NULL AND status IN ('resolved', 'recovered', 'closed')) );

-- CRIME REPORTS
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.crime_reports;
CREATE POLICY "Allow view access to relevant users" ON public.crime_reports FOR SELECT USING ( (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')) OR ((public.get_user_role(auth.uid()) = 'responder') AND (assigned_to = auth.uid())) OR (reported_by = auth.uid()) );
DROP POLICY IF EXISTS "Allow users to create reports" ON public.crime_reports;
CREATE POLICY "Allow users to create reports" ON public.crime_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow admins, moderators, controllers to manage reports" ON public.crime_reports;
CREATE POLICY "Allow admins, moderators, controllers to manage reports" ON public.crime_reports FOR ALL USING ((public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller'))) WITH CHECK ((public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')));
DROP POLICY IF EXISTS "Allow assigned responders to update their reports" ON public.crime_reports;
CREATE POLICY "Allow assigned responders to update their reports" ON public.crime_reports FOR UPDATE USING ( (public.get_user_role(auth.uid()) = 'responder') AND (assigned_to = auth.uid()) ) WITH CHECK ( (assigned_to = auth.uid()) OR (assigned_to IS NULL AND status IN ('resolved', 'closed')) );

-- REPORT UPDATES
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow relevant users to see updates" ON public.report_updates;
CREATE POLICY "Allow relevant users to see updates" ON public.report_updates FOR SELECT USING ( (EXISTS (SELECT 1 FROM public.vehicle_reports vr WHERE vr.id = report_updates.report_id)) OR (EXISTS (SELECT 1 FROM public.crime_reports cr WHERE cr.id = report_updates.report_id)) );
DROP POLICY IF EXISTS "Allow relevant users to add updates" ON public.report_updates;
CREATE POLICY "Allow relevant users to add updates" ON public.report_updates FOR INSERT WITH CHECK ( (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')) OR ( (public.get_user_role(auth.uid()) = 'responder') AND ((EXISTS (SELECT 1 FROM vehicle_reports vr WHERE vr.id = report_updates.report_id AND vr.assigned_to = auth.uid())) OR (EXISTS (SELECT 1 FROM crime_reports cr WHERE cr.id = report_updates.report_id AND cr.assigned_to = auth.uid()))) ) );
  
-- ASSIGNMENT LOGS
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow relevant staff to view assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow relevant staff to view assignment logs" ON public.assignment_logs FOR SELECT USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller'));

-- REGISTRATION REQUESTS
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to submit registration requests" ON public.registration_requests;
CREATE POLICY "Allow users to submit registration requests" ON public.registration_requests FOR INSERT WITH CHECK (auth.role() = 'anon');
DROP POLICY IF EXISTS "Admins and moderators can manage registration requests" ON public.registration_requests;
CREATE POLICY "Admins and moderators can manage registration requests" ON public.registration_requests FOR ALL USING ((public.get_user_role(auth.uid()) IN ('admin', 'moderator')));

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
CREATE POLICY "Users can see their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_user_id);
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);

COMMIT;
```