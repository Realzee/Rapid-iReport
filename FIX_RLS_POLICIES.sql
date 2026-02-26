-- Fix RLS policies for companies table

-- Ensure get_user_role function exists
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role::text FROM public.profiles WHERE id = p_user_id);
END;
$$;

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 1. Allow read access to everyone (authenticated and anon if needed for public pages, but usually authenticated)
-- We'll allow authenticated users to read.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.companies;
CREATE POLICY "Enable read access for all users" ON public.companies
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Allow admins to insert companies
DROP POLICY IF EXISTS "Enable insert for admins" ON public.companies;
CREATE POLICY "Enable insert for admins" ON public.companies
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_user_role(auth.uid()) = 'admin'
    );

-- 3. Allow admins to update companies
DROP POLICY IF EXISTS "Enable update for admins" ON public.companies;
CREATE POLICY "Enable update for admins" ON public.companies
    FOR UPDATE
    TO authenticated
    USING (
        public.get_user_role(auth.uid()) = 'admin'
    );

-- 4. Allow admins to delete companies
DROP POLICY IF EXISTS "Enable delete for admins" ON public.companies;
CREATE POLICY "Enable delete for admins" ON public.companies
    FOR DELETE
    TO authenticated
    USING (
        public.get_user_role(auth.uid()) = 'admin'
    );
