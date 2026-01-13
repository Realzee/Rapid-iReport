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

This script adds missing columns to your tables and configures the necessary Row Level Security (RLS) policies for both the database tables and the storage bucket.

1.  In your Supabase Project dashboard, go to the **SQL Editor**.
2.  Click **+ New query**.
3.  Copy the entire SQL script below, paste it into the editor, and click the **RUN** button.

---

### Full SQL Setup Script

```sql
-- === STEP A: ADD MISSING 'evidence_images' COLUMN ===
-- This fixes the "Could not find the 'evidence_images' column" error.
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS evidence_images text[];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS evidence_images text[];


-- === STEP B: SETUP REPORT SECURITY POLICIES ===
-- This fixes the "violates row-level security policy" errors for reports.

-- Enable Row Level Security on the tables if not already enabled.
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid conflicts when re-running the script.
DROP POLICY IF EXISTS "Allow users to create their own vehicle reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow users to view their own vehicle reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow users to create their own crime reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to view their own crime reports" ON public.crime_reports;

-- Allow users to INSERT reports for themselves
CREATE POLICY "Allow users to create their own vehicle reports"
ON public.vehicle_reports FOR INSERT
TO authenticated WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Allow users to create their own crime reports"
ON public.crime_reports FOR INSERT
TO authenticated WITH CHECK (auth.uid() = reported_by);

-- Allow users to SELECT (view) reports they created
CREATE POLICY "Allow users to view their own vehicle reports"
ON public.vehicle_reports FOR SELECT
TO authenticated USING (auth.uid() = reported_by);

CREATE POLICY "Allow users to view their own crime reports"
ON public.crime_reports FOR SELECT
TO authenticated USING (auth.uid() = reported_by);


-- === STEP C: SETUP STORAGE PERMISSIONS ===
-- This fixes issues with viewing/uploading images.

-- Drop policies if they exist to avoid conflicts when re-running the script.
DROP POLICY IF EXISTS "Allow authenticated read access to evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to evidence" ON storage.objects;

-- Allow authenticated users to view all files in the 'evidence' bucket.
CREATE POLICY "Allow authenticated read access to evidence"
ON storage.objects FOR SELECT
TO authenticated USING (bucket_id = 'evidence');

-- Allow users to upload files into the 'evidence' bucket.
CREATE POLICY "Allow authenticated uploads to evidence"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'evidence');


-- === STEP D: SETUP PROFILES SECURITY POLICIES ===
-- This fixes the HTTP 400 error and "Error setting up presence" on login
-- by allowing users to update their own 'last_seen_at' status.

-- Enable RLS on the profiles table if it's not already.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts when re-running the script.
DROP POLICY IF EXISTS "Allow users to view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;

-- Allow any authenticated user to VIEW all profiles.
-- In a high-security environment, you might restrict this to admins.
CREATE POLICY "Allow users to view all profiles"
ON public.profiles FOR SELECT
TO authenticated USING (true);

-- Allow a user to UPDATE their OWN profile. This is crucial for the 'last_seen_at' feature.
CREATE POLICY "Allow users to update their own profile"
ON public.profiles FOR UPDATE
TO authenticated USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- === STEP E: ADD MISSING 'last_seen_at' COLUMN ===
-- This fixes the "Could not find the 'last_seen_at' column" error.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

```

---

After running this complete script, your application should function correctly without any further schema or permission-related errors.
