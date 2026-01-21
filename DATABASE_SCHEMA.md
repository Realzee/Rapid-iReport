# RAPID iREPORT - Database Schema

This file contains the complete, idempotent SQL script for setting up the Supabase database for the RAPID iREPORT application. This script can be run safely in the Supabase SQL Editor to create all necessary types, tables, functions, and Row Level Security policies.

For detailed setup instructions, refer to `DATABASE_SETUP.md`.

> [!DANGER]
> **CRITICAL SETUP INSTRUCTION: DO NOT RUN SCRIPTS TOGETHER**
>
> The setup script is divided into **Part 1** and **Part 2**. You **MUST** run these in two separate steps:
>
> 1.  Copy and run **Part 1** in the Supabase SQL Editor.
> 2.  Wait for it to complete successfully.
> 3.  Open a **NEW, SEPARATE** query window.
> 4.  Copy and run **Part 2** in the new window.
>
> Failing to do this will result in an `invalid input value for enum` error, because Part 1 (which updates the data types) must be completed *before* Part 2 (which uses those data types) is started.

---

### **Part 1: Update Data Types & Migrate Old Schema**
Copy and run the code block below first. This part is non-transactional and now includes a migration step to fix older database setups.

```sql
-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script migrates old data types and ensures all ENUM types are correct.
-- It MUST be run separately from Part 2.

-- 0. Make sure the 'uuid-ossp' extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 1. MIGRATION: Attempt to rename old '_enum' suffixed types to the correct names.
-- This handles databases created with an older script. It will do nothing if the old types don't exist.
DO $$ BEGIN ALTER TYPE public.user_role_enum RENAME TO user_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename user_role_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.user_status_enum RENAME TO user_status; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename user_status_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.report_status_enum RENAME TO report_status; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename report_status_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.severity_enum RENAME TO severity; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename severity_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.responder_status_enum RENAME TO responder_status; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename responder_status_enum (likely OK).'; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS public.request_status_enum; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not drop request_status_enum (likely OK).'; END $$;


-- 2. Create ENUM types if they don't exist after the migration attempt.
-- This ensures that for a new setup, the types are created correctly.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty'); END IF;
END$$;

-- 3. Add all possible values to ENUM types to ensure they are fully up-to-date.
-- This part is idempotent and safe to run multiple times.
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
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'deleted';

ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'critical';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'medium';

ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'on_scene';
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
    logo_url text,
    CONSTRAINT companies_pkey PRIMARY KEY (id)
);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;


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

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    report_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
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

-- Drop deprecated registration requests table
DROP TABLE IF EXISTS public.registration_requests;
DROP TYPE IF EXISTS public.request_status;

-- 4. Create Helper Functions & Triggers

-- Function to get a user's role, bypassing RLS. SECURITY DEFINER is crucial.
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

-- Trigger Function to create a profile and notification for new users (IDEMPOTENT)
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
  -- Self-service users should be active by default after email confirmation.
  user_status_text := COALESCE(new.raw_user_meta_data->>'status', 'active');
  
  -- Safely cast company_id to uuid
  BEGIN
    user_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  EXCEPTION WHEN others THEN
    user_company_id := NULL;
  END;

  user_responder_status_text := new.raw_user_meta_data->>'responder_status';

  -- Insert into profiles table, but do nothing if a profile for this ID already exists.
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
  ) ON CONFLICT (id) DO NOTHING;

  -- The notification should only be sent if the profile was actually inserted.
  IF FOUND THEN
    PERFORM public.create_staff_notification(
      'new_user', 'New User Registered', 'A new user (' || user_full_name || ') has signed up.', new.id, ARRAY['admin', 'moderator']
    );
  END IF;
  
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

-- Trigger function for assignment changes
CREATE OR REPLACE FUNCTION public.log_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.assignment_logs (report_id, assigned_from, assigned_to, assigned_by)
    VALUES (NEW.id, OLD.assigned_to, NEW.assigned_to, (select auth.uid()));
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

DROP TRIGGER IF EXISTS on_vehicle_report_assignment_change ON public.vehicle_reports;
CREATE TRIGGER on_vehicle_report_assignment_change AFTER UPDATE OF assigned_to ON public.vehicle_reports FOR EACH ROW EXECUTE FUNCTION public.log_assignment_change();

DROP TRIGGER IF EXISTS on_crime_report_assignment_change ON public.crime_reports;
CREATE TRIGGER on_crime_report_assignment_change AFTER UPDATE OF assigned_to ON public.crime_reports FOR EACH ROW EXECUTE FUNCTION public.log_assignment_change();


-- 6. Row Level Security (RLS) Policies

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authorized profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow authorized updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow authorized updates for responders and controllers" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can delete profiles" ON public.profiles;

CREATE POLICY "Allow authenticated users to view profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');
  
CREATE POLICY "Allow authorized profile updates" ON public.profiles
  FOR UPDATE USING (
    (id = auth.uid()) OR 
    (public.get_user_role(auth.uid()) IN ('admin', 'moderator')) OR
    (public.get_user_role(auth.uid()) = 'controller' AND role::text = 'responder')
  ) WITH CHECK (
    (id = auth.uid()) OR
    (public.get_user_role(auth.uid()) IN ('admin', 'moderator')) OR
    (public.get_user_role(auth.uid()) = 'controller' AND role::text = 'responder')
  );

CREATE POLICY "Admins and moderators can delete profiles" ON public.profiles
  FOR DELETE USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.companies;
DROP POLICY IF EXISTS "Admins and moderators can manage companies" ON public.companies;
CREATE POLICY "Allow authenticated users to view companies" ON public.companies
  FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Admins and moderators can manage companies" ON public.companies
  FOR ALL USING ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator')) 
  WITH CHECK ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator'));

-- VEHICLE REPORTS
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow users to create reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow staff to delete reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.vehicle_reports;
CREATE POLICY "Allow view access to relevant users" ON public.vehicle_reports FOR SELECT USING ( ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')) OR ((select public.get_user_role((select auth.uid()))) = 'responder' AND assigned_to = (select auth.uid())) OR (reported_by = (select auth.uid())) );
CREATE POLICY "Allow users to create reports" ON public.vehicle_reports FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Allow authorized users to update reports" ON public.vehicle_reports FOR UPDATE USING ( ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')) OR ((select public.get_user_role((select auth.uid()))) = 'responder' AND assigned_to = (select auth.uid())) OR (reported_by = (select auth.uid()) AND status::text = 'pending') );
CREATE POLICY "Allow staff to delete reports" ON public.vehicle_reports FOR DELETE USING (((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')));
CREATE POLICY "Allow public read access to recent, active reports" ON public.vehicle_reports FOR SELECT TO anon USING ( status::text IN ('active', 'resolved', 'recovered', 'on_scene') AND reported_at > (now() - interval '72 hours') );


-- CRIME REPORTS
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to create reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow staff to delete reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.crime_reports;
CREATE POLICY "Allow view access to relevant users" ON public.crime_reports FOR SELECT USING ( ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')) OR ((select public.get_user_role((select auth.uid()))) = 'responder' AND assigned_to = (select auth.uid())) OR (reported_by = (select auth.uid())) );
CREATE POLICY "Allow users to create reports" ON public.crime_reports FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Allow authorized users to update reports" ON public.crime_reports FOR UPDATE USING ( ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')) OR ((select public.get_user_role((select auth.uid()))) = 'responder' AND assigned_to = (select auth.uid())) OR (reported_by = (select auth.uid()) AND status::text = 'pending') );
CREATE POLICY "Allow staff to delete reports" ON public.crime_reports FOR DELETE USING (((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')));
CREATE POLICY "Allow public read access to recent, active reports" ON public.crime_reports FOR SELECT TO anon USING ( status::text IN ('active', 'resolved', 'closed', 'on_scene') AND reported_at > (now() - interval '72 hours') );

-- REPORT UPDATES
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow relevant users to see updates" ON public.report_updates;
DROP POLICY IF EXISTS "Allow relevant users to add updates" ON public.report_updates;
CREATE POLICY "Allow relevant users to see updates" ON public.report_updates FOR SELECT USING (
    EXISTS ( SELECT 1 FROM public.vehicle_reports vr WHERE vr.id = report_updates.report_id AND ( ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')) OR (vr.assigned_to = (select auth.uid())) OR (vr.reported_by = (select auth.uid())) ) ) OR
    EXISTS ( SELECT 1 FROM public.crime_reports cr WHERE cr.id = report_updates.report_id AND ( ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')) OR (cr.assigned_to = (select auth.uid())) OR (cr.reported_by = (select auth.uid())) ) )
);
CREATE POLICY "Allow relevant users to add updates" ON public.report_updates FOR INSERT WITH CHECK ( ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')) OR ( (EXISTS (SELECT 1 FROM vehicle_reports vr WHERE vr.id = report_updates.report_id AND vr.assigned_to = (select auth.uid()))) OR (EXISTS (SELECT 1 FROM crime_reports cr WHERE cr.id = report_updates.report_id AND cr.assigned_to = (select auth.uid()))) ) );
  
-- ASSIGNMENT LOGS
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow relevant staff to view assignment logs" ON public.assignment_logs;
CREATE POLICY "Allow relevant staff to view assignment logs" ON public.assignment_logs FOR SELECT USING (((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller')));

-- CHAT MESSAGES
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow relevant users to view and send chat messages" ON public.chat_messages;
CREATE POLICY "Allow relevant users to view and send chat messages" ON public.chat_messages
FOR ALL USING (
    (select auth.role()) = 'authenticated' AND (
        -- Admins, moderators, controllers can access any chat
        (select public.get_user_role(auth.uid())) IN ('admin', 'moderator', 'controller') OR
        -- Check if the user is the reporter or assigned responder for the report
        EXISTS (
            SELECT 1 FROM public.vehicle_reports vr
            WHERE vr.id = chat_messages.report_id AND (vr.reported_by = auth.uid() OR vr.assigned_to = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM public.crime_reports cr
            WHERE cr.id = chat_messages.report_id AND (cr.reported_by = auth.uid() OR cr.assigned_to = auth.uid())
        )
    )
);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see and update their own notifications" ON public.notifications;
CREATE POLICY "Users can see and update their own notifications" ON public.notifications FOR ALL USING ((recipient_user_id = (select auth.uid())));

COMMIT;
```