# RAPID iREPORT - Supabase Database Setup

If you encounter errors like "Could not find column 'evidence_images'", "violates row-level security policy", or "Could not find the 'last_seen_at' column", your Supabase database schema is likely incomplete or misconfigured.

To fix all known database issues, please follow these steps carefully.

## Step 1: Create the 'evidence' Storage Bucket

This step is crucial for enabling image uploads.

1.  Navigate to your Supabase Project dashboard.
2.  In the left sidebar, go to **Storage**.
3.  Click the **+ New Bucket** button.
4.  Enter the bucket name exactly as `evidence`.
5.  Toggle the **Public bucket** switch to ON.
6.  Click **Create Bucket**.

## Step 2: Run the Complete Database Setup Script

This script adds missing columns, creates a helper function for roles, and configures the necessary Row Level Security (RLS) policies for both the database tables and the storage bucket.

1.  In your Supabase Project dashboard, go to the **SQL Editor**.
2.  Click **+ New query**.
3.  Copy the entire SQL script below, paste it into the editor, and click the **RUN** button.

---

### Full SQL Setup Script

```sql
-- === STEP A: ADD MISSING COLUMNS ===
-- This fixes "Could not find column" errors for 'evidence_images' and 'last_seen_at'.
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS evidence_images text[];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS evidence_images text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;


-- === STEP B: CREATE HELPER FUNCTION TO GET USER ROLE ===
-- This function is used in RLS policies to check a user's role securely.
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  RETURN user_role;
END;
$$;


-- === STEP C: SETUP PROFILES SECURITY POLICIES ===
-- This fixes the HTTP 400 error and "Error setting up presence" on login.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;

-- Allow any authenticated user to VIEW all profiles. Required for User Management page.
CREATE POLICY "Allow users to view all profiles"
ON public.profiles FOR SELECT
TO authenticated USING (true);

-- Allow a user to UPDATE their OWN profile. Crucial for the 'last_seen_at' presence feature.
CREATE POLICY "Allow users to update their own profile"
ON public.profiles FOR UPDATE
TO authenticated USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- === STEP D: SETUP REPORTS SECURITY POLICIES ===
-- These role-based policies fix "violates row-level security policy" errors.

-- Enable RLS on report tables.
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;

-- Drop old policies to prevent conflicts.
DROP POLICY IF EXISTS "Enable read access based on role" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Enable insert access based on role" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Enable update access based on role" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Enable read access based on role" ON public.crime_reports;
DROP POLICY IF EXISTS "Enable insert access based on role" ON public.crime_reports;
DROP POLICY IF EXISTS "Enable update access based on role" ON public.crime_reports;

-- Policies for VEHICLE reports
CREATE POLICY "Enable read access based on role" ON public.vehicle_reports FOR SELECT
TO authenticated USING (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
    OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to)
    OR auth.uid() = reported_by
);
CREATE POLICY "Enable insert access based on role" ON public.vehicle_reports FOR INSERT
TO authenticated WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
    OR auth.uid() = reported_by
);
CREATE POLICY "Enable update access based on role" ON public.vehicle_reports FOR UPDATE
TO authenticated USING (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
    OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to)
);

-- Policies for CRIME reports
CREATE POLICY "Enable read access based on role" ON public.crime_reports FOR SELECT
TO authenticated USING (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
    OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to)
    OR auth.uid() = reported_by
);
CREATE POLICY "Enable insert access based on role" ON public.crime_reports FOR INSERT
TO authenticated WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
    OR auth.uid() = reported_by
);
CREATE POLICY "Enable update access based on role" ON public.crime_reports FOR UPDATE
TO authenticated USING (
    get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
    OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to)
);


-- === STEP E: SETUP STORAGE PERMISSIONS ===
-- This fixes issues with viewing/uploading images.
DROP POLICY IF EXISTS "Allow authenticated read access to evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to evidence" ON storage.objects;

-- Allow authenticated users to view all files in the 'evidence' bucket.
CREATE POLICY "Allow authenticated read access to evidence"
ON storage.objects FOR SELECT
TO authenticated USING (bucket_id = 'evidence');

-- Allow authenticated users to upload files into the 'evidence' bucket.
CREATE POLICY "Allow authenticated uploads to evidence"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'evidence');
```

---

After running this complete script, your application should function correctly without any further schema or permission-related errors.
