-- Fix RLS policies for companies table to allow moderators and controllers to update their own company
-- Run this in the Supabase SQL Editor

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Enable update for admins" ON public.companies;
DROP POLICY IF EXISTS "Admin manage companies" ON public.companies;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.companies;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.companies;

-- 2. Create more inclusive policies
-- Allow admins full access
CREATE POLICY "Admins full access" ON public.companies
    FOR ALL
    TO authenticated
    USING (public.get_user_role(auth.uid()) = 'admin')
    WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Allow moderators and controllers to update their own company
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

-- Allow everyone to read companies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.companies;
DROP POLICY IF EXISTS "Public read companies" ON public.companies;
CREATE POLICY "Public read companies" ON public.companies
    FOR SELECT
    USING (true);
