
# RAPID iREPORT - Complete Supabase Backend Setup

This document provides all the necessary steps and SQL scripts to fully set up the Supabase backend for the RAPID iREPORT application. Follow these instructions carefully.

> [!IMPORTANT]
> **Common Error: "invalid input value for enum" or "schema cache" or "404 Not Found"**
> If you are seeing errors like `404 Not Found` for the Panic button or `invalid input value for enum`, it means your database is out of sync. Following the steps below, especially **Step 2**, will fix this. The scripts are idempotent and safe to run on an existing project.

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

## Step 2: Run the Database Schema Script (Three Parts)

This script creates and updates all necessary types, tables, functions, and triggers.

> [!DANGER]
> **CRITICAL SETUP INSTRUCTION: RUN IN THREE SEPARATE STEPS**
>
> The SQL script is divided into **Part 1**, **Part 2**, and **Part 3**. You **MUST** run these in three separate steps:
>
> 1.  Copy and run **Part 1** in the Supabase SQL Editor.
> 2.  Wait for it to complete successfully.
> 3.  Open a **NEW, SEPARATE** query window, copy and run **Part 2**.
> 4.  Open a **NEW, SEPARATE** query window, copy and run **Part 3**.

### **Part 1: Update Data Types & Migrate Old Schema**
*(Copy and run this entire code block first)*

```sql
-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script migrates old data types and ensures all ENUM types are correct.

-- 0. Helper function for Edge Function migrations
CREATE OR REPLACE FUNCTION public.eval(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- 1. Drop dependencies, policies, and disable RLS to allow type alterations.
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid, text[]) CASCADE;

-- Defensively drop legacy 'responders' view/table
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'v') THEN
      DROP VIEW public.responders CASCADE;
   END IF;
END $$;

-- Drop problematic policies
DROP POLICY IF EXISTS "Allow authorized profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.vehicle_reports;

-- Temporarily disable RLS
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports DISABLE ROW LEVEL SECURITY;

-- 2. Migrate ENUM types
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

-- 3. Create ENUM types if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'moderator', 'controller', 'responder'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'assigned', 'in_progress', 'on_scene', 'resolved', 'rejected', 'recovered', 'closed', 'deleted'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty', 'available', 'en_route', 'on_scene'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN CREATE TYPE public.announcement_type AS ENUM ('notice', 'alert', 'safety_tip'); END IF;
END$$;

-- 4. Re-create the get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role_text text;
BEGIN
  SELECT role::text INTO user_role_text FROM public.profiles WHERE id = p_user_id;
  RETURN COALESCE(user_role_text, 'user');
END;
$$;
```

### **Part 2: Setup Tables, Functions, and Policies**
*(After Part 1 completes, copy and run this entire code block in a NEW query window)*

```sql
-- RAPID iREPORT - Database Setup Script - PART 2
BEGIN;

-- NEW: Function to create a public panic report.
CREATE OR REPLACE FUNCTION public.create_public_panic_report(p_location text, p_coords jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    public_user_id uuid := '00000000-0000-0000-0000-000000000001';
    new_ob_number text;
    report_company_id uuid;
    company_initial char;
    now_ts timestamptz := now();
BEGIN
    SELECT company_id INTO report_company_id FROM public.profiles WHERE id = public_user_id;
    IF report_company_id IS NOT NULL THEN
        SELECT LEFT(name, 1) INTO company_initial FROM public.companies WHERE id = report_company_id;
    ELSE
        company_initial := 'P';
    END IF;

    new_ob_number := company_initial || 
                     lpad((SELECT public.get_next_ob_sequence(report_company_id, now_ts::date))::text, 4, '0') ||
                     '/' || to_char(now_ts, 'MM/YYYY');

    INSERT INTO public.crime_reports (
        id, ob_number, title, crime_type, description, location, location_coords, 
        severity, status, reported_by, reported_at
    ) VALUES (
        extensions.uuid_generate_v4(),
        new_ob_number,
        'PANIC ALERT',
        'PUBLIC_PANIC_ASSIST',
        'Public Panic Alert triggered via the community map at ' || to_char(now_ts, 'YYYY-MM-DD HH24:MI:SS') || '. User may be in distress.',
        p_location,
        p_coords,
        'critical'::public.severity,
        'active'::public.report_status,
        public_user_id,
        now_ts
    );
END;
$$;

-- IMPORTANT: Grant permission for anonymous users to trigger panic alerts
GRANT EXECUTE ON FUNCTION public.create_public_panic_report(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_panic_report(text, jsonb) TO authenticated;

-- Ensure the special Public Reporter user exists for the trigger system
INSERT INTO auth.users (id, aud, role, email, instance_id, raw_app_meta_data, raw_user_meta_data)
SELECT
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'public-reporter@rapid.ireport',
    (SELECT id FROM auth.instances LIMIT 1),
    '{"provider":"email","providers":["email"]}',
    '{}'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, surname, role, status)
SELECT
    '00000000-0000-0000-0000-000000000001',
    'public-reporter@rapid.ireport',
    'Public',
    'Reporter',
    'user',
    'active'
ON CONFLICT (id) DO NOTHING;

-- RLS RE-ENABLE (Simplified)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

COMMIT;
```

### **Part 3: Automatic Profile Creation Trigger**
*(After Part 2 completes, copy and run this entire code block in a NEW query window)*
```sql
-- RAPID iREPORT - Database Setup Script - PART 3
-- Description: This script creates a trigger to automatically create a user profile
-- upon new user signup, preventing missing profile errors.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert a new profile record, pulling metadata from the new auth.users record.
  INSERT INTO public.profiles (
      id, 
      email, 
      first_name, 
      surname, 
      role, 
      status, 
      company_id, 
      cell, 
      vehicle_reg, 
      home_address, 
      ice_no, 
      medical_aid, 
      psira_number
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'surname',
    'user', -- Default role for all new signups
    'pending', -- All new users must be approved by an admin
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

-- Create the trigger that executes the function after a new user is inserted.
-- We use CREATE OR REPLACE to ensure it can be run multiple times safely.
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- We also create a trigger to ensure email consistency on update
CREATE OR REPLACE FUNCTION public.update_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = new.email
  WHERE id = new.id;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (old.email IS DISTINCT FROM new.email)
  EXECUTE FUNCTION public.update_profile_email();

```


---

## Step 3: Deploy Supabase Edge Functions

(Instructions in original file...)
