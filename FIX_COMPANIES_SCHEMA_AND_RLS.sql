-- RAPID iREPORT - Fix Companies Schema and RLS
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Update companies table schema with missing columns
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owners_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cell_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS psira_number text;

-- 2. Ensure get_user_role function is robust
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_role_text text;
BEGIN
  SELECT role::text INTO user_role_text FROM public.profiles WHERE id = p_user_id;
  RETURN COALESCE(user_role_text, 'user');
END; $$;

-- 3. Fix RLS policies for companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admins full access" ON public.companies;
DROP POLICY IF EXISTS "Staff update own company" ON public.companies;
DROP POLICY IF EXISTS "Public read companies" ON public.companies;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.companies;
DROP POLICY IF EXISTS "Admin manage companies" ON public.companies;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.companies;
DROP POLICY IF EXISTS "Enable update for admins" ON public.companies;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.companies;
DROP POLICY IF EXISTS "Admins and staff full access" ON public.companies;

-- Policy: Allow everyone (authenticated) to read company basic info
CREATE POLICY "Public read companies" ON public.companies 
    FOR SELECT 
    TO authenticated
    USING (true);

-- Policy: Allow Admins full control over all companies
CREATE POLICY "Admins full access" ON public.companies
    FOR ALL
    TO authenticated
    USING (public.get_user_role(auth.uid()) = 'admin')
    WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Policy: Allow Moderators and Controllers to update their OWN company
CREATE POLICY "Staff update own company" ON public.companies
    FOR UPDATE
    TO authenticated
    USING (
        public.get_user_role(auth.uid()) IN ('moderator', 'controller') AND 
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        public.get_user_role(auth.uid()) IN ('moderator', 'controller') AND 
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- 4. Ensure profiles table has correct RLS for company updates
-- This allows users to see their own company_id which is needed for the policies above
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- 5. Grant necessary permissions to authenticated users
GRANT ALL ON public.companies TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
