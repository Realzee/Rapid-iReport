# RAPID iREPORT - Supabase Database Setup

If you encounter errors like "Could not find column 'evidence_images'" or "violates row-level security policy" when creating reports, your Supabase database schema is likely incomplete or misconfigured.

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

This script adds the missing `evidence_images` column to your report tables and configures the necessary Row Level Security (RLS) policies for both the database tables and the storage bucket.

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


-- === STEP B: SETUP SECURITY POLICIES ===
-- This fixes the "violates row-level security policy" errors.

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
```

---

After completing both steps, your application should be able to create reports and upload evidence photos without any permission or schema-related errors.
