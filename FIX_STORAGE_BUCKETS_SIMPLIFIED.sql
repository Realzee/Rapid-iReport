-- RAPID iREPORT - Fix Storage Buckets and Policies (Simplified)
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create the company-logos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies for company-logos to avoid conflicts
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Staff Upload Company Logos" ON storage.objects;
DROP POLICY IF EXISTS "Users Manage Own Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to delete company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete company logos" ON storage.objects;

-- 3. Create comprehensive policies for the company-logos bucket

-- Allow public read access to the bucket
CREATE POLICY "Public read access for company-logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Allow ANY authenticated user to upload (UI restricts access to this page)
CREATE POLICY "Allow authenticated users to upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

-- Allow ANY authenticated user to update
CREATE POLICY "Allow authenticated users to update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos');

-- Allow ANY authenticated user to delete
CREATE POLICY "Allow authenticated users to delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');

-- 4. Just in case, create other necessary buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Create comprehensive policies for the app-assets bucket
DROP POLICY IF EXISTS "Public read access for app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete app-assets" ON storage.objects;

CREATE POLICY "Public read access for app-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-assets');

CREATE POLICY "Allow authenticated users to upload app-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-assets');

CREATE POLICY "Allow authenticated users to update app-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'app-assets');

CREATE POLICY "Allow authenticated users to delete app-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'app-assets');
