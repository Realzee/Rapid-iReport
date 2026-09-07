-- RAPID911 COMPLETE DATABASE SCHEMA

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'user', 'admin', 'moderator', 'controller', 'responder', 
            'ras_driver', 'roadside_driver', 'driver', 'fleet_management', 
            'supervisor', 'guard'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended');
    END IF;
END $$;

-- 2. COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    company_code text UNIQUE,
    logo_url text,
    contact_email text,
    contact_number text,
    address text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 3. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    first_name text,
    surname text,
    name text,
    cell text,
    ice_no text,
    home_address text,
    vehicle_reg text,
    medical_aid text,
    psira_number text,
    role public.user_role DEFAULT 'user'::public.user_role,
    status public.user_status DEFAULT 'pending'::public.user_status,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    responder_status text DEFAULT 'off_duty',
    location_coords jsonb,
    last_seen_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. VEHICLE REPORTS
CREATE TABLE IF NOT EXISTS public.vehicle_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate text NOT NULL,
    make text, model text, color text, vehicle_type text,
    stolen_at timestamptz,
    last_seen_location text NOT NULL,
    latitude double precision, longitude double precision,
    status text DEFAULT 'stolen',
    severity text DEFAULT 'medium',
    description text,
    evidence_images text[] DEFAULT '{}'::text[],
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}'::uuid[],
    ob_number text, case_number text,
    reported_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. CRIME REPORTS
CREATE TABLE IF NOT EXISTS public.crime_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL, crime_type text NOT NULL, location text NOT NULL,
    latitude double precision, longitude double precision,
    status text DEFAULT 'pending', severity text DEFAULT 'medium', description text,
    evidence_images text[] DEFAULT '{}'::text[],
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}'::uuid[],
    ob_number text, case_number text,
    reported_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- 6. EMERGENCY REPORTS
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL, emergency_type text NOT NULL, location text NOT NULL,
    latitude double precision, longitude double precision,
    status text DEFAULT 'pending', severity text DEFAULT 'critical', description text,
    evidence_images text[] DEFAULT '{}'::text[],
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}'::uuid[],
    ob_number text, case_number text,
    reported_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- 7. EMS ASSESSMENTS (PATIENT CARE REPORTS)
CREATE TABLE IF NOT EXISTS public.ems_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    patient_name text, patient_age text, patient_gender text, patient_contact text,
    chief_complaint text, medical_history text, allergies text,
    vital_bp text, vital_pulse text, vital_resp text, vital_spo2 text, vital_temp text, vital_gcs text,
    treatment_provided text, medications_administered text,
    transport_decision text, receiving_facility text, handover_notes text,
    assessed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessed_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- 8. REPORT UPDATES & NOTES
CREATE TABLE IF NOT EXISTS public.report_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL, report_type text NOT NULL,
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    update_type text DEFAULT 'note', content text NOT NULL,
    images text[] DEFAULT '{}'::text[], created_at timestamptz DEFAULT now()
);

-- 9. ASSIGNMENT AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL, report_type text NOT NULL,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes text, created_at timestamptz DEFAULT now()
);

-- 10. REPORT SHARES
CREATE TABLE IF NOT EXISTS public.report_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL, report_type text NOT NULL,
    from_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    to_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    status text DEFAULT 'pending',
    requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- 11. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL, content text NOT NULL, priority text DEFAULT 'normal',
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    is_global boolean DEFAULT false, created_at timestamptz DEFAULT now()
);

-- 12. PATROL LOGS
CREATE TABLE IF NOT EXISTS public.patrol_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guard_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    checkpoint_name text NOT NULL, latitude double precision, longitude double precision,
    notes text, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- 13. VEHICLES
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_sign text NOT NULL, license_plate text NOT NULL,
    make text, model text, status text DEFAULT 'active',
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    odometer numeric, created_at timestamptz DEFAULT now()
);

-- 14. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL, details text, ip_address text,
    created_at timestamptz DEFAULT now()
);

-- 15. FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role text;
BEGIN
    SELECT role::text INTO v_role FROM public.profiles WHERE id = p_user_id;
    RETURN COALESCE(v_role, 'user');
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, surname, name, role, status)
    VALUES (
        NEW.id, NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'surname', ''),
        COALESCE(NEW.raw_user_meta_data->>'name', CONCAT(COALESCE(NEW.raw_user_meta_data->>'first_name', ''), ' ', COALESCE(NEW.raw_user_meta_data->>'surname', ''))),
        'user'::public.user_role, 'pending'::public.user_status
    ) ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 16. ENABLE RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ems_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Allow read companies" ON public.companies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow read vehicle_reports" ON public.vehicle_reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert vehicle_reports" ON public.vehicle_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update vehicle_reports" ON public.vehicle_reports FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read crime_reports" ON public.crime_reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert crime_reports" ON public.crime_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update crime_reports" ON public.crime_reports FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read emergency_reports" ON public.emergency_reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert emergency_reports" ON public.emergency_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update emergency_reports" ON public.emergency_reports FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read ems_assessments" ON public.ems_assessments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert ems_assessments" ON public.ems_assessments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
