-- ====================================================================
-- SQL Migration: Update Storage and Company Logos Configuration
-- Description:
-- 1. Updates public.companies and public.profiles table schema.
-- 2. Initializes required storage buckets ('company-logos', 'app-assets').
-- 3. Enables and configures Row Level Security (RLS) on storage objects.
-- 4. Establishes robust RLS policies for secure logo upload and retrieval.
-- ====================================================================

-- 1. Update companies table schema with logo and background columns
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bolo_background_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owners_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cell_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS psira_number text;

-- 2. Update profiles table schema (reference columns)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 3. Ensure get_user_role helper function is robust
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_role_text text;
BEGIN
  SELECT role::text INTO user_role_text FROM public.profiles WHERE id = p_user_id;
  RETURN COALESCE(user_role_text, 'user');
END; $$;

-- 4. Set up storage buckets
-- Note: 'storage.buckets' belongs to Supabase storage extension schema
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Note: Row Level Security (RLS) is already enabled on storage.objects by default.
-- (We do not run ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY here to avoid 42501 "must be owner of table objects" error).

-- 6. Drop existing storage policies to start fresh and avoid conflicts
DROP POLICY IF EXISTS "Public read access for company-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to delete company logos" ON storage.objects;

DROP POLICY IF EXISTS "Public read access for app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to upload app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to update app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to delete app-assets" ON storage.objects;

-- 7. Define Policies for 'company-logos' Bucket

-- SELECT: Allow any user (including public guest users) to view company logos
CREATE POLICY "Public read access for company-logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- INSERT: Allow staff (admin, moderator, controller) to upload company logos
CREATE POLICY "Allow staff to upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'company-logos' AND 
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

-- UPDATE: Allow staff (admin, moderator, controller) to update uploaded logos
CREATE POLICY "Allow staff to update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'company-logos' AND 
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

-- DELETE: Allow staff (admin, moderator, controller) to delete uploaded logos
CREATE POLICY "Allow staff to delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'company-logos' AND 
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

-- 8. Define Policies for 'app-assets' Bucket

-- SELECT: Allow public read access to application assets
CREATE POLICY "Public read access for app-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-assets');

-- INSERT/UPDATE/DELETE: Only allow admins/staff to write assets
CREATE POLICY "Allow staff to upload app-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'app-assets' AND 
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

CREATE POLICY "Allow staff to update app-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'app-assets' AND 
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

CREATE POLICY "Allow staff to delete app-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'app-assets' AND 
    public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller')
);

-- ====================================================================
-- End of SQL Migration
-- ====================================================================
