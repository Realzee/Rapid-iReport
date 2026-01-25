# RAPID iREPORT - Complete Supabase Backend Setup

This document provides all the necessary steps and SQL scripts to fully set up the Supabase backend for the RAPID iREPORT application. Follow these instructions carefully.

> [!IMPORTANT]
> **Common Error: "invalid input value for enum" or "schema cache"**
> If you are seeing errors like `invalid input value for enum report_status_enum: "deleted"` or `Could not find the column... in the schema cache`, it means your database is out of sync. Following the steps below, especially **Step 2**, will fix this. The scripts are idempotent and safe to run on an existing project.

---

## Step 1: Create Storage Buckets

You need to create four public buckets for storing images and assets.

1.  Navigate to your Supabase Project dashboard and go to **Storage** in the left sidebar.
2.  Create the following buckets, ensuring the **"Public bucket"** switch is toggled ON for each:
    *   `evidence` (for incident-related images)
    *   `avatars` (for user profile pictures)
    *   `company-logos` (for company branding)
    *   `app-assets` (for global application assets like the main logo)

---

## Step 2: Run the Database Schema Script (Two Parts)

This script creates and updates all necessary types, tables, functions, and triggers.

> [!DANGER]
> **CRITICAL SETUP INSTRUCTION: RUN IN TWO SEPARATE STEPS**
>
> The SQL script is divided into **Part 1** and **Part 2**. You **MUST** run these in two separate steps:
>
> 1.  Copy and run **Part 1** in the Supabase SQL Editor.
> 2.  Wait for it to complete successfully.
> 3.  Open a **NEW, SEPARATE** query window.
> 4.  Copy and run **Part 2** in the new window.
>
> Failing to do this will cause an error, because Part 1 (which updates the data types) must be completed *before* Part 2 (which uses those data types) is started.

### **Part 1: Update Data Types & Migrate Old Schema**
*(Copy and run this entire code block first)*

```sql
-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script migrates old data types and ensures all ENUM types are correct.
-- It MUST be run separately from Part 2.

-- 0. Make sure the 'uuid-ossp' extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 1. Drop dependencies, policies, and disable RLS to allow type alterations.
-- Using CASCADE will also drop dependent RLS policies and trigger functions. They will be recreated in Part 2.
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid, text[]) CASCADE;

-- Defensively drop legacy 'responders' view/table which creates a dependency lock on responder_status_enum.
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'v') THEN
      DROP VIEW public.responders CASCADE;
   END IF;
END $$;
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'r') THEN
      DROP TABLE public.responders CASCADE;
   END IF;
END $$;

-- Drop specific problematic policies from older schema versions that can cause a dependency lock.
DROP POLICY IF EXISTS "Allow system to insert new user notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow system to insert new report notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow system to insert new registration notifications" ON public.notifications;

-- Explicitly drop policies that depend on columns whose types are being altered.
-- These will be recreated correctly in Part 2.
DROP POLICY IF EXISTS "Allow authorized profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can delete profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.vehicle_reports;


-- Temporarily disable RLS on tables that will be altered or have dependencies.
-- This releases any remaining dependency locks. RLS will be re-enabled in Part 2.
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports DISABLE ROW LEVEL SECURITY;

-- 2. Robustly migrate ENUM types from old "_enum" suffix to new names.
-- This block handles renaming if possible, or migrating columns and dropping the old type if a name conflict exists.

-- Migrate user_role
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            RAISE NOTICE 'Conflict found for user_role. Migrating column...';
            ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
            ALTER TABLE public.profiles ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
            ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user'::public.user_role;
            DROP TYPE public.user_role_enum;
        ELSE
            ALTER TYPE public.user_role_enum RENAME TO user_role;
        END IF;
    END IF;
END $$;

-- Migrate user_status
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
            RAISE NOTICE 'Conflict found for user_status. Migrating column...';
            ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;
            ALTER TABLE public.profiles ALTER COLUMN status TYPE public.user_status USING status::text::public.user_status;
            ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending'::public.user_status;
            DROP TYPE public.user_status_enum;
        ELSE
            ALTER TYPE public.user_status_enum RENAME TO user_status;
        END IF;
    END IF;
END $$;

-- Migrate report_status
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
            RAISE NOTICE 'Conflict found for report_status. Migrating columns...';
            ALTER TABLE public.vehicle_reports ALTER COLUMN status DROP DEFAULT;
            ALTER TABLE public.crime_reports ALTER COLUMN status DROP DEFAULT;
            ALTER TABLE public.vehicle_reports ALTER COLUMN status TYPE public.report_status USING status::text::public.report_status;
            ALTER TABLE public.crime_reports ALTER COLUMN status TYPE public.report_status USING status::text::public.report_status;
            DROP TYPE public.report_status_enum;
        ELSE
            ALTER TYPE public.report_status_enum RENAME TO report_status;
        END IF;
    END IF;
END $$;

-- Migrate severity
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN
            RAISE NOTICE 'Conflict found for severity. Migrating columns...';
            ALTER TABLE public.vehicle_reports ALTER COLUMN severity DROP DEFAULT;
            ALTER TABLE public.crime_reports ALTER COLUMN severity DROP DEFAULT;
            ALTER TABLE public.vehicle_reports ALTER COLUMN severity TYPE public.severity USING severity::text::public.severity;
            ALTER TABLE public.crime_reports ALTER COLUMN severity TYPE public.severity USING severity::text::public.severity;
            DROP TYPE public.severity_enum;
        ELSE
            ALTER TYPE public.severity_enum RENAME TO severity;
        END IF;
    END IF;
END $$;

-- Migrate responder_status
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN
            RAISE NOTICE 'Conflict found for responder_status. Migrating column...';
            ALTER TABLE public.profiles ALTER COLUMN responder_status TYPE public.responder_status USING responder_status::text::public.responder_status;
            DROP TYPE public.responder_status_enum;
        ELSE
            ALTER TYPE public.responder_status_enum RENAME TO responder_status;
        END IF;
    END IF;
END $$;

-- Drop deprecated type if it exists
DROP TYPE IF EXISTS public.request_status_enum;


-- 3. Create ENUM types if they don't exist after the migration attempt.
-- This ensures that for a new setup, the types are created correctly.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN CREATE TYPE public.announcement_type AS ENUM ('notice'); END IF;
END$$;

-- 4. Add all possible values to ENUM types to ensure they are fully up-to-date.
-- This part is idempotent and safe to run multiple times. This will fix the "invalid input for enum" error.
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

-- For backward compatibility, also ensure all values exist on the legacy enum type if it hasn't been migrated yet.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_enum') THEN
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'active';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'assigned';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'in_progress';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'on_scene';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'resolved';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'rejected';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'recovered';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'closed';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'deleted';
    END IF;
END$$;

ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'critical';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'medium';

ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'on_scene';

ALTER TYPE public.announcement_type ADD VALUE IF NOT EXISTS 'alert';
ALTER TYPE public.announcement_type ADD VALUE IF NOT EXISTS 'safety_tip';

-- 5. Re-create the get_user_role function that was dropped.
-- The other dropped items (policies, triggers, etc.) will be recreated in Part 2.
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
```

### **Part 2: Setup Tables, Functions, and Policies**
*(After Part 1 completes, copy and run this entire code block in a NEW query window)*

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

-- App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text NOT NULL,
    value text,
    CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    title text NOT NULL,
    content text NOT NULL,
    type public.announcement_type NOT NULL DEFAULT 'notice'::public.announcement_type,
    expires_at timestamp with time zone,
    CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

-- Insert default settings if they don't exist
INSERT INTO public.app_settings (key, value)
VALUES ('main_logo_url', NULL)
ON CONFLICT (key) DO NOTHING;

-- Drop deprecated registration requests table
DROP TABLE IF EXISTS public.registration_requests;
DROP TYPE IF EXISTS public.request_status;

-- 4. Create Helper Functions & Triggers

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

-- FIX: Added a SECURITY DEFINER function to get the current user's company ID.
-- This breaks the infinite recursion loop in RLS policies.
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (SELECT company_id FROM public.profiles WHERE id = (select auth.uid()));
END;
$$;

-- FIX: Added a SECURITY DEFINER function to get any user's company ID.
-- This allows checking other users' companies in RLS policies without recursion.
CREATE OR REPLACE FUNCTION public.get_user_company_id(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (SELECT company_id FROM public.profiles WHERE id = p_user_id);
END;
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

-- Clean up legacy policies
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view companies." ON public.companies;
DROP POLICY IF EXISTS "Allow users to create their own vehicle reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow users to view their own vehicle reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Authenticated users can view all reports." ON public.vehicle_reports;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authenticated users to create their own reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to create their own crime reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to view their own crime reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Authenticated users can view all crime reports." ON public.crime_reports;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow relevant users to add updates" ON public.report_updates;
DROP POLICY IF EXISTS "Allow relevant users to see updates" ON public.report_updates;
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow relevant staff to view assignment logs" ON public.assignment_logs;
DROP POLICY IF EXISTS "Allow relevant users to view and send chat messages" ON public.chat_messages;

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authorized profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow authorized updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow authorized updates for responders and controllers" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can delete profiles" ON public.profiles;

CREATE POLICY "Allow authenticated users to view profiles" ON public.profiles
  FOR SELECT USING (
    ((select public.get_user_role((select auth.uid()))) = 'admin') OR
    (id = (select auth.uid())) OR
    (company_id IS NOT NULL AND company_id = (select public.get_my_company_id()))
  );
  
CREATE POLICY "Allow authorized profile updates" ON public.profiles
  FOR UPDATE USING (
    (id = (select auth.uid())) OR
    ((select public.get_user_role((select auth.uid()))) = 'admin') OR
    ((select public.get_user_role((select auth.uid()))) = 'moderator' AND company_id = (select public.get_my_company_id())) OR
    ((select public.get_user_role((select auth.uid()))) = 'controller' AND role::text = 'responder' AND company_id = (select public.get_my_company_id()))
  ) WITH CHECK (
    (id = (select auth.uid())) OR
    ((select public.get_user_role((select auth.uid()))) = 'admin') OR
    ((select public.get_user_role((select auth.uid()))) = 'moderator' AND company_id = (select public.get_my_company_id())) OR
    ((select public.get_user_role((select auth.uid()))) = 'controller' AND role::text = 'responder' AND company_id = (select public.get_my_company_id()))
  );

CREATE POLICY "Admins and moderators can delete profiles" ON public.profiles
  FOR DELETE USING (
      ((select public.get_user_role((select auth.uid()))) = 'admin') OR
      ((select public.get_user_role((select auth.uid()))) = 'moderator' AND (select public.get_user_company_id(id)) = (select public.get_my_company_id()))
  );

-- COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.companies;
DROP POLICY IF EXISTS "Admins and moderators can manage companies" ON public.companies;
CREATE POLICY "Allow authenticated users to view companies" ON public.companies
  FOR SELECT USING (
    ((select public.get_user_role((select auth.uid()))) = 'admin') OR
    (id = (select public.get_my_company_id()))
  );
CREATE POLICY "Admins and moderators can manage companies" ON public.companies
  FOR ALL USING (
    ((select public.get_user_role((select auth.uid()))) = 'admin') OR
    ((select public.get_user_role((select auth.uid()))) = 'moderator' AND id = (select public.get_my_company_id()))
  ) WITH CHECK (
    ((select public.get_user_role((select auth.uid()))) = 'admin') OR
    ((select public.get_user_role((select auth.uid()))) = 'moderator' AND id = (select public.get_my_company_id()))
  );

-- VEHICLE REPORTS
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow users to create reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow staff to delete reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.vehicle_reports;

CREATE POLICY "Allow view access to relevant users" ON public.vehicle_reports FOR SELECT USING (
  ((select public.get_user_role((select auth.uid()))) = 'admin') OR
  (reported_by = (select auth.uid())) OR
  (
    ((select public.get_my_company_id()) IS NOT NULL) AND
    (
      (select public.get_user_company_id(reported_by)) = (select public.get_my_company_id()) OR
      (select public.get_user_company_id(assigned_to)) = (select public.get_my_company_id())
    )
  )
);
CREATE POLICY "Allow users to create reports" ON public.vehicle_reports FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Allow authorized users to update reports" ON public.vehicle_reports FOR UPDATE USING (
  ((select public.get_user_role((select auth.uid()))) = 'admin') OR
  (reported_by = (select auth.uid()) AND status::text = 'pending') OR
  ((select public.get_user_role((select auth.uid()))) = 'responder' AND assigned_to = (select auth.uid())) OR
  (
    ((select public.get_user_role((select auth.uid()))) IN ('moderator', 'controller')) AND
    ((select public.get_my_company_id()) IS NOT NULL) AND
    (
      (select public.get_user_company_id(reported_by)) = (select public.get_my_company_id()) OR
      (select public.get_user_company_id(assigned_to)) = (select public.get_my_company_id())
    )
  )
);
CREATE POLICY "Allow staff to delete reports" ON public.vehicle_reports FOR DELETE USING ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller'));
CREATE POLICY "Allow public read access to recent, active reports" ON public.vehicle_reports FOR SELECT TO anon USING ( status::text IN ('active', 'resolved', 'recovered', 'on_scene') AND reported_at > (now() - interval '72 hours') );

-- CRIME REPORTS
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow view access to relevant users" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to create reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow staff to delete reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.crime_reports;

CREATE POLICY "Allow view access to relevant users" ON public.crime_reports FOR SELECT USING (
  ((select public.get_user_role((select auth.uid()))) = 'admin') OR
  (reported_by = (select auth.uid())) OR
  (
    ((select public.get_my_company_id()) IS NOT NULL) AND
    (
      (select public.get_user_company_id(reported_by)) = (select public.get_my_company_id()) OR
      (select public.get_user_company_id(assigned_to)) = (select public.get_my_company_id())
    )
  )
);
CREATE POLICY "Allow users to create reports" ON public.crime_reports FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Allow authorized users to update reports" ON public.crime_reports FOR UPDATE USING (
  ((select public.get_user_role((select auth.uid()))) = 'admin') OR
  (reported_by = (select auth.uid()) AND status::text = 'pending') OR
  ((select public.get_user_role((select auth.uid()))) = 'responder' AND assigned_to = (select auth.uid())) OR
  (
    ((select public.get_user_role((select auth.uid()))) IN ('moderator', 'controller')) AND
    ((select public.get_my_company_id()) IS NOT NULL) AND
    (
      (select public.get_user_company_id(reported_by)) = (select public.get_my_company_id()) OR
      (select public.get_user_company_id(assigned_to)) = (select public.get_my_company_id())
    )
  )
);
CREATE POLICY "Allow staff to delete reports" ON public.crime_reports FOR DELETE USING ((select public.get_user_role((select auth.uid()))) IN ('admin', 'moderator', 'controller'));
CREATE POLICY "Allow public read access to recent, active reports" ON public.crime_reports FOR SELECT TO anon USING ( status::text IN ('active', 'resolved', 'closed', 'on_scene') AND reported_at > (now() - interval '72 hours') );

-- REPORT UPDATES, ASSIGNMENT LOGS, CHAT MESSAGES
-- These policies defer to the parent report's RLS policies.
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow access based on parent report" ON public.report_updates;
CREATE POLICY "Allow access based on parent report" ON public.report_updates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.vehicle_reports vr WHERE vr.id = report_updates.report_id) OR
    EXISTS (SELECT 1 FROM public.crime_reports cr WHERE cr.id = report_updates.report_id)
);

ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow access based on parent report" ON public.assignment_logs;
CREATE POLICY "Allow access based on parent report" ON public.assignment_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicle_reports vr WHERE vr.id = assignment_logs.report_id) OR
    EXISTS (SELECT 1 FROM public.crime_reports cr WHERE cr.id = assignment_logs.report_id)
);
  
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow access based on parent report" ON public.chat_messages;
CREATE POLICY "Allow access based on parent report" ON public.chat_messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.vehicle_reports vr WHERE vr.id = chat_messages.report_id) OR
    EXISTS (SELECT 1 FROM public.crime_reports cr WHERE cr.id = chat_messages.report_id)
);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see and update their own notifications" ON public.notifications;
CREATE POLICY "Users can see and update their own notifications" ON public.notifications FOR ALL USING ((recipient_user_id = (select auth.uid())));

-- APP SETTINGS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow admins to update settings" ON public.app_settings;
CREATE POLICY "Allow public read access to settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow admins to update settings" ON public.app_settings FOR ALL USING (((select public.get_user_role((select auth.uid()))) = 'admin')) WITH CHECK (((select public.get_user_role((select auth.uid()))) = 'admin'));

-- ANNOUNCEMENTS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow admins to manage announcements" ON public.announcements;

CREATE POLICY "Allow public read access to announcements" ON public.announcements
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage announcements" ON public.announcements
  FOR ALL USING (((select public.get_user_role((select auth.uid()))) = 'admin'))
  WITH CHECK (((select public.get_user_role((select auth.uid()))) = 'admin'));

COMMIT;
```

---

## Step 3: Add Storage Security Policies (RLS)

After setting up the tables, you must secure your storage buckets with Row Level Security policies. This script is now idempotent, meaning you can run it multiple times without causing errors.

1.  Return to the **SQL Editor** in your Supabase dashboard.
2.  Run the following script to create the necessary policies for all three buckets.

```sql
-- Policies for 'avatars' bucket
DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
CREATE POLICY "Allow public read access to avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Allow authenticated users to upload their own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload their own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' AND owner = (select auth.uid()) );

DROP POLICY IF EXISTS "Allow authenticated users to update their own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated users to update their own avatar" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND owner = (select auth.uid()) );

-- FIX: Split admin/mod policy for security and performance
DROP POLICY IF EXISTS "Allow admins/mods to manage all avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to manage all avatars" ON storage.objects;
CREATE POLICY "Allow admins to manage all avatars" ON storage.objects FOR ALL TO authenticated USING ( bucket_id = 'avatars' AND (SELECT public.get_user_role((select auth.uid()))) = 'admin' ) WITH CHECK ( bucket_id = 'avatars' AND (SELECT public.get_user_role((select auth.uid()))) = 'admin' );

DROP POLICY IF EXISTS "Allow moderators to manage their company avatars" ON storage.objects;
CREATE POLICY "Allow moderators to manage their company avatars" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'avatars' AND
    (SELECT public.get_user_role((select auth.uid()))) = 'moderator' AND
    (SELECT public.get_user_company_id(((storage.foldername(name))[1])::uuid)) = (SELECT public.get_my_company_id())
) WITH CHECK (
    bucket_id = 'avatars' AND
    (SELECT public.get_user_role((select auth.uid()))) = 'moderator' AND
    (SELECT public.get_user_company_id(((storage.foldername(name))[1])::uuid)) = (SELECT public.get_my_company_id())
);


-- Policies for 'evidence' bucket
DROP POLICY IF EXISTS "Allow public read access to evidence" ON storage.objects;
CREATE POLICY "Allow public read access to evidence" ON storage.objects FOR SELECT USING ( bucket_id = 'evidence' );

DROP POLICY IF EXISTS "Allow authenticated users to upload evidence" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'evidence' );

DROP POLICY IF EXISTS "Allow admins/mods to manage all evidence" ON storage.objects;
CREATE POLICY "Allow admins/mods to manage all evidence" ON storage.objects FOR ALL TO authenticated USING ( bucket_id = 'evidence' AND (SELECT public.get_user_role((select auth.uid()))) IN ('admin', 'moderator') ) WITH CHECK ( bucket_id = 'evidence' AND (SELECT public.get_user_role((select auth.uid()))) IN ('admin', 'moderator') );


-- Policies for 'company-logos' bucket
DROP POLICY IF EXISTS "Allow public read access to company logos" ON storage.objects;
CREATE POLICY "Allow public read access to company logos" ON storage.objects FOR SELECT USING ( bucket_id = 'company-logos' );

-- FIX: Split admin/mod policy for security and performance
DROP POLICY IF EXISTS "Allow admins/mods to manage company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to manage company logos" ON storage.objects;
CREATE POLICY "Allow admins to manage company logos" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'company-logos' AND (SELECT public.get_user_role((select auth.uid()))) = 'admin'
) WITH CHECK (
    bucket_id = 'company-logos' AND (SELECT public.get_user_role((select auth.uid()))) = 'admin'
);

DROP POLICY IF EXISTS "Allow moderators to manage their company logo" ON storage.objects;
CREATE POLICY "Allow moderators to manage their company logo" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'company-logos' AND
    (SELECT public.get_user_role((select auth.uid()))) = 'moderator' AND
    (storage.foldername(name))[1] = (SELECT public.get_my_company_id())::text
) WITH CHECK (
    bucket_id = 'company-logos' AND
    (SELECT public.get_user_role((select auth.uid()))) = 'moderator' AND
    (storage.foldername(name))[1] = (SELECT public.get_my_company_id())::text
);

-- Policies for 'app-assets' bucket (NEW)
DROP POLICY IF EXISTS "Allow public read access to app assets" ON storage.objects;
CREATE POLICY "Allow public read access to app assets" ON storage.objects FOR SELECT USING ( bucket_id = 'app-assets' );

DROP POLICY IF EXISTS "Allow admins to manage app assets" ON storage.objects;
CREATE POLICY "Allow admins to manage app assets" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'app-assets' AND (SELECT public.get_user_role((select auth.uid()))) = 'admin'
) WITH CHECK (
    bucket_id = 'app-assets' AND (SELECT public.get_user_role((select auth.uid()))) = 'admin'
);
```
---

## Step 4: Deploy Supabase Edge Functions

These server-side functions are required for secure administrative actions. Follow these steps to deploy all required functions.

1.  **Install Supabase CLI:** If you haven't already, [install the Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

2.  **Link your project:** In your computer's terminal, navigate to your project folder and run `supabase login`, then `supabase link --project-ref <your-project-ref>`. Your `<project-ref>` is in your Supabase project's URL (`<project-ref>.supabase.co`).

3.  **Deploy `reset-password` Function:**
    *   Create the function: `supabase functions new reset-password`.
    *   Open the new file `supabase/functions/reset-password/index.ts` and replace its content with the code below.
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
      if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
      try {
        // 1. Create a Supabase client with the user's auth token to check their role
        const userSupabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("User not found.");

        const { data: profile, error: profileError } = await userSupabaseClient.from('profiles').select('role').eq('id', user.id).single();
        if (profileError) throw profileError;
        if (!['admin', 'moderator'].includes(profile.role)) {
          throw new Error("Unauthorized: You do not have permission to reset passwords.");
        }

        // 2. If authorized, proceed with the main logic using the admin client
        const { userId, password } = await req.json()
        if (!userId || !password) throw new Error("A userId and new password must be provided.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
        
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: password })
        if (error) throw error
        
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      } catch (error) {
        const status = error.message.startsWith('Unauthorized') ? 401 : 400;
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy reset-password --no-verify-jwt`.

4.  **Deploy `create-user` Function:**
    *   Create the function: `supabase functions new create-user`.
    *   Open `supabase/functions/create-user/index.ts` and replace its content with this code:
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
      if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
      try {
        // 1. Authorization check: Ensure the caller is an admin or moderator.
        const userSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
        const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("User not found.");
        const { data: profile, error: profileError } = await userSupabaseClient.from('profiles').select('role, company_id').eq('id', user.id).single();
        if (profileError) throw profileError;
        if (!['admin', 'moderator'].includes(profile.role)) {
            throw new Error("Unauthorized: You do not have permission to create users.");
        }
        
        // 2. Main logic: Create the user using the admin client.
        const { email, password, user_metadata } = await req.json()
        if (!email || !password || !user_metadata?.full_name) {
          throw new Error('Email, password, and full_name are required.')
        }
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }

        // 3. Moderator scope check
        if (profile.role === 'moderator') {
            if (!profile.company_id) {
                throw new Error("Unauthorized: Moderators must belong to a company to create users.");
            }
            if (user_metadata?.company_id !== profile.company_id) {
                throw new Error("Unauthorized: Moderators can only create users for their own company.");
            }
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: user_metadata // This metadata will be read by the `handle_new_user` trigger
        });

        if (authError) {
            throw new Error(`Auth user creation failed: ${authError.message}`);
        }
        
        // The `handle_new_user` trigger will automatically create the profile.
        // We just return the auth user data.
        return new Response(JSON.stringify(authData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        console.error("CREATE-USER-FUNCTION-ERROR:", error.message);
        const status = error.message.startsWith('Unauthorized') ? 401 : 400;
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status,
        })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy create-user --no-verify-jwt`.
    
5.  **Deploy `delete-user` Function:**
    *   Create the function: `supabase functions new delete-user`.
    *   Open `supabase/functions/delete-user/index.ts` and replace its content with this code:
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
      if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
      try {
        // 1. Authorization check
        const userSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
        const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("User not found.");
        const { data: profile, error: profileError } = await userSupabaseClient.from('profiles').select('role, company_id').eq('id', user.id).single();
        if (profileError) throw profileError;
        if (!['admin', 'moderator'].includes(profile.role)) {
            throw new Error("Unauthorized: You do not have permission to delete users.");
        }

        // 2. Main logic
        const { userId } = await req.json()
        if (!userId) throw new Error('A userId must be provided.')
        
        // 3. Moderator scope check
        if (profile.role === 'moderator') {
            const { data: targetUserProfile, error: targetUserError } = await userSupabaseClient.from('profiles').select('company_id').eq('id', userId).single();
            if (targetUserError) throw new Error(`Could not verify target user's company: ${targetUserError.message}`);
            
            if (!profile.company_id || profile.company_id !== targetUserProfile?.company_id) {
                throw new Error("Unauthorized: Moderators can only delete users from their own company.");
            }
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) throw error

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        const status = error.message.startsWith('Unauthorized') ? 401 : 400;
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status,
        })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy delete-user --no-verify-jwt`.

## Step 5: (New) Deploy Schema Migration Function

This function allows administrators to fix database schema issues directly from the application's error modal.

1.  **Deploy `migrate-schema` Function:**
    *   Create the function: `supabase functions new migrate-schema`.
    *   Open `supabase/functions/migrate-schema/index.ts` and replace its content with this code:
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }
    
    // The idempotent SQL script from Part 1 of the schema setup.
    const MIGRATION_SQL = `
    -- 0. Make sure the 'uuid-ossp' extension is enabled
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

    -- 1. Drop dependencies, policies, and disable RLS to allow type alterations.
    DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
    DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid, text[]) CASCADE;
    
    -- Defensively drop legacy 'responders' view/table which creates a dependency lock on responder_status_enum.
    DO $$
    BEGIN
       IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'v') THEN
          DROP VIEW public.responders CASCADE;
       END IF;
    END $$;
    DO $$
    BEGIN
       IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'r') THEN
          DROP TABLE public.responders CASCADE;
       END IF;
    END $$;

    DROP POLICY IF EXISTS "Allow system to insert new user notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Allow system to insert new report notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Allow system to insert new registration notifications" ON public.notifications;
    
    -- Explicitly drop policies that depend on columns whose types are being altered.
    DROP POLICY IF EXISTS "Allow authorized profile updates" ON public.profiles;
    DROP POLICY IF EXISTS "Admins and moderators can delete profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.crime_reports;
    DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.crime_reports;
    DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.vehicle_reports;
    DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.vehicle_reports;

    -- Temporarily disable RLS on tables that will be altered or have dependencies.
    ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.vehicle_reports DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.crime_reports DISABLE ROW LEVEL SECURITY;

    -- 2. Robustly migrate ENUM types from old "_enum" suffix to new names.
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
                ALTER TABLE public.profiles ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
                ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user'::public.user_role;
                DROP TYPE public.user_role_enum;
            ELSE
                ALTER TYPE public.user_role_enum RENAME TO user_role;
            END IF;
        END IF;
    END $$;
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
                ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;
                ALTER TABLE public.profiles ALTER COLUMN status TYPE public.user_status USING status::text::public.user_status;
                ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending'::public.user_status;
                DROP TYPE public.user_status_enum;
            ELSE
                ALTER TYPE public.user_status_enum RENAME TO user_status;
            END IF;
        END IF;
    END $$;
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_enum') THEN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
                ALTER TABLE public.vehicle_reports ALTER COLUMN status DROP DEFAULT;
                ALTER TABLE public.crime_reports ALTER COLUMN status DROP DEFAULT;
                ALTER TABLE public.vehicle_reports ALTER COLUMN status TYPE public.report_status USING status::text::public.report_status;
                ALTER TABLE public.crime_reports ALTER COLUMN status TYPE public.report_status USING status::text::public.report_status;
                DROP TYPE public.report_status_enum;
            ELSE
                ALTER TYPE public.report_status_enum RENAME TO report_status;
            END IF;
        END IF;
    END $$;
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_enum') THEN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN
                ALTER TABLE public.vehicle_reports ALTER COLUMN severity DROP DEFAULT;
                ALTER TABLE public.crime_reports ALTER COLUMN severity DROP DEFAULT;
                ALTER TABLE public.vehicle_reports ALTER COLUMN severity TYPE public.severity USING severity::text::public.severity;
                ALTER TABLE public.crime_reports ALTER COLUMN severity TYPE public.severity USING severity::text::public.severity;
                DROP TYPE public.severity_enum;
            ELSE
                ALTER TYPE public.severity_enum RENAME TO severity;
            END IF;
        END IF;
    END $$;
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status_enum') THEN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN
                ALTER TABLE public.profiles ALTER COLUMN responder_status TYPE public.responder_status USING responder_status::text::public.responder_status;
                DROP TYPE public.responder_status_enum;
            ELSE
                ALTER TYPE public.responder_status_enum RENAME TO responder_status;
            END IF;
        END IF;
    END $$;
    DROP TYPE IF EXISTS public.request_status_enum;

    -- 3. Create ENUM types if they don't exist after the migration attempt.
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user'); END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending'); END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending'); END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low'); END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty'); END IF;
    END$$;

    -- 4. Add all possible values to ENUM types to ensure they are fully up-to-date.
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
    
    -- 5. Re-create the get_user_role function that was dropped.
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
    `;

    async function checkAdminAuth(req: Request, supabaseClient: SupabaseClient): Promise<void> {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Authentication failed: User not found.");
      
      const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
      if (profileError) throw profileError;
      
      if (!['admin', 'moderator'].includes(profile.role)) {
        throw new Error("Authorization failed: You must be an administrator or moderator to perform this action.");
      }
    }

    serve(async (req) => {
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
      }

      try {
        // 1. Authorization: Only allow admins to run this function.
        const userSupabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
        await checkAdminAuth(req, userSupabaseClient);

        // 2. Main Logic: Run the migration script using the admin client.
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { error: rpcError } = await supabaseAdmin.rpc('eval', { 'query': MIGRATION_SQL });
        if (rpcError) {
          // Check if the error is a known "type already exists" which can be ignored
          if (rpcError.message.includes('type "user_role" already exists')) {
            console.warn("Migration SQL produced a 'type already exists' notice, which is safe to ignore.");
          } else {
            throw rpcError;
          }
        }
        
        // 3. API Schema Reload: After changing the schema, we must tell PostgREST to reload its cache.
        // We do this by sending a NOTIFY signal. This is a critical step.
        const { error: notifyError } = await supabaseAdmin.rpc('eval', { 'query': 'NOTIFY pgrst, "reload schema"' });
        if (notifyError) {
            throw new Error(`Migration successful, but failed to reload API schema cache: ${notifyError.message}. Please restart the project in the Supabase dashboard.`);
        }

        return new Response(JSON.stringify({ message: "Database schema migration successful. The API schema cache has been reloaded." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (error) {
        console.error("MIGRATE-SCHEMA-FUNCTION-ERROR:", error.message);
        const status = error.message.startsWith('Authorization') ? 401 : 500;
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status,
        });
      }
    });
    ```
    *   Deploy it: `supabase functions deploy migrate-schema --no-verify-jwt`.

---

This completes the setup for all application features. Your application should now function correctly.