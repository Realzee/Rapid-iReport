# RAPID iREPORT - Supabase Database Setup

If you encounter errors like "Could not find column 'location_boundary'", "violates row-level security policy", or "Error setting up presence", your Supabase database schema is out of sync with the application code.

To fix all known database issues, please follow these steps carefully. This script is safe to run multiple times.

## Step 1A: Create the 'evidence' Storage Bucket

This is for incident-related images. If you've already done this, you can skip to Step 1B.

1.  Navigate to your Supabase Project dashboard.
2.  In the left sidebar, go to **Storage**.
3.  Click the **+ New Bucket** button.
4.  Enter the bucket name exactly as `evidence`.
5.  Toggle the **Public bucket** switch to ON.
6.  Click **Create Bucket**.

## Step 1B: Create the 'avatars' Storage Bucket

This is for user profile pictures.

1.  While in the **Storage** section, click **+ New Bucket** again.
2.  Enter the bucket name exactly as `avatars`.
3.  Toggle the **Public bucket** switch to ON.
4.  Click **Create Bucket**.


## Step 2: Run the Complete Database Setup Script

This comprehensive script creates all necessary types, tables, functions, and security policies. It is designed to be **idempotent**, meaning you can run it on a new project or an existing one without causing errors. It will only add the pieces that are missing.

1.  In your Supabase Project dashboard, go to the **SQL Editor**.
2.  Click **+ New query**.
3.  Copy the entire SQL script below, paste it into the editor, and click the **RUN** button.

---

### Full SQL Setup Script

```sql
-- This script is idempotent and can be safely run multiple times.

-- === PART 1: TYPE DEFINITIONS ===
-- Create ENUM types for controlled vocabularies to ensure data integrity.
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('admin', 'moderator', 'controller', 'responder', 'user'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.user_status AS ENUM ('active', 'pending', 'suspended'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'in_progress', 'resolved', 'rejected', 'recovered'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.severity AS ENUM ('critical', 'high', 'medium', 'low'); EXCEPTION WHEN duplicate_object THEN null; END $$;


-- === PART 2: TABLE CREATION ===
-- Create tables if they don't exist.
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE,
    full_name text,
    -- NOTE: If you have an old schema with text-based roles/statuses, you may need to migrate them manually.
    -- For new setups, these will be created as ENUM types.
    role public.user_role NOT NULL DEFAULT 'user',
    status public.user_status NOT NULL DEFAULT 'pending',
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    avatar_url text,
    last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vehicle_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ob_number text UNIQUE,
    license_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    last_seen_location text,
    description text,
    severity public.severity,
    status public.report_status,
    reported_by uuid NOT NULL REFERENCES public.profiles(id),
    assigned_to uuid REFERENCES public.profiles(id),
    reported_at timestamptz NOT NULL DEFAULT now(),
    location_coords jsonb,
    evidence_images text[],
    location_boundary jsonb,
    location_boundingbox real[]
);

CREATE TABLE IF NOT EXISTS public.crime_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ob_number text UNIQUE,
    title text,
    description text,
    location text,
    crime_type text,
    severity public.severity,
    status public.report_status,
    reported_by uuid NOT NULL REFERENCES public.profiles(id),
    assigned_to uuid REFERENCES public.profiles(id),
    reported_at timestamptz NOT NULL DEFAULT now(),
    location_coords jsonb,
    evidence_images text[],
    location_boundary jsonb,
    location_boundingbox real[]
);


-- === PART 3: AUTOMATIC PROFILE CREATION ===
-- This function and trigger are CRITICAL. It creates a profile when a new user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    (new.raw_user_meta_data->>'role')::public.user_role
  );
  RETURN new;
END;
$$;

-- Drop and recreate the trigger to ensure it's up-to-date.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- === PART 4: SCHEMA MIGRATION (for existing projects) ===
-- These commands add missing columns to tables without deleting data.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text; -- Ensure avatar column exists
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id);
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS evidence_images text[];
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS location_boundary jsonb;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS location_boundingbox real[];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id);
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS evidence_images text[];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS location_boundary jsonb;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS location_boundingbox real[];


-- === PART 5: SECURITY (ROW LEVEL SECURITY) ===
-- Helper function to get user role securely within RLS policies.
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  RETURN user_role;
END;
$$;

-- PROFILES Table Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- VEHICLE REPORTS Table Policies
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access based on role" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Enable update access based on role" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Enable delete access for admins/mods" ON public.vehicle_reports;

CREATE POLICY "Enable read access based on role" ON public.vehicle_reports FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller') OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to) OR auth.uid() = reported_by);
CREATE POLICY "Enable insert access for users" ON public.vehicle_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Enable update access based on role" ON public.vehicle_reports FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller') OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to));
CREATE POLICY "Enable delete access for admins/mods" ON public.vehicle_reports FOR DELETE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- CRIME REPORTS Table Policies
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access based on role" ON public.crime_reports;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.crime_reports;
DROP POLICY IF EXISTS "Enable update access based on role" ON public.crime_reports;
DROP POLICY IF EXISTS "Enable delete access for admins/mods" ON public.crime_reports;

CREATE POLICY "Enable read access based on role" ON public.crime_reports FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller') OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to) OR auth.uid() = reported_by);
CREATE POLICY "Enable insert access for users" ON public.crime_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Enable update access based on role" ON public.crime_reports FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller') OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to));
CREATE POLICY "Enable delete access for admins/mods" ON public.crime_reports FOR DELETE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));


-- === PART 6: STORAGE PERMISSIONS ===
-- EVIDENCE BUCKET POLICIES
DROP POLICY IF EXISTS "Allow authenticated read access to evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to evidence" ON storage.objects;
CREATE POLICY "Allow authenticated read access to evidence" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'evidence');
CREATE POLICY "Allow authenticated uploads to evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidence');

-- AVATARS BUCKET POLICIES
DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow user to manage their own avatar" ON storage.objects;
CREATE POLICY "Allow public read access to avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- This policy allows a user to upload/update an avatar only inside a folder that matches their own user ID.
-- Example: A user with ID 'abc-123' can only write to 'avatars/abc-123/filename.jpg'
CREATE POLICY "Allow user to manage their own avatar" ON storage.objects FOR INSERT, UPDATE TO authenticated WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() = (storage.foldername(name))[1]::uuid
);

```

---

After running this complete script, your application should function correctly without any further schema or permission-related errors.