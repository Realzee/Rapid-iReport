-- ==============================================================================
-- RAPID iREPORT / RAPID911 - COMPLETE UPDATED DATABASE SQL SCHEMA
-- Version: 2026.09 (Fully Updated with Report Verification & False Alarm Protocol)
-- PostgreSQL / Supabase Compatible
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. ENUMS & DOMAIN TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'user', 'admin', 'moderator', 'controller', 'ems_controller', 
            'ems_responder', 'responder', 'guard', 'supervisor', 
            'technician', 'ras_driver'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM (
            'pending', 'active', 'assigned', 'in_progress', 'on_scene', 
            'resolved', 'rejected', 'recovered', 'closed', 'deleted', 
            'stolen', 'suspicious', 'bolo', 'sought', 'hijacked', 
            'used_in_commission_of_crime', 'verified', 'false_alarm'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN
        CREATE TYPE public.severity AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN
        CREATE TYPE public.responder_status AS ENUM ('off_duty', 'available', 'en_route', 'on_scene');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN
        CREATE TYPE public.announcement_type AS ENUM ('notice', 'alert', 'safety_tip');
    END IF;
END $$;

-- Guarantee newer ENUM values are present for existing databases
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'stolen';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'suspicious';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'bolo';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'sought';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'hijacked';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'used_in_commission_of_crime';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'false_alarm';

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ems_controller';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ems_responder';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'guard';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'technician';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ras_driver';

-- ------------------------------------------------------------------------------
-- 2. CORE MASTER TABLES
-- ------------------------------------------------------------------------------

-- Companies / Organizations
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    alias text,
    logo_url text,
    bolo_background_url text,
    owners_name text,
    address text,
    contact_person text,
    cell_number text,
    psira_number text,
    allowed_modules text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- User Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    first_name text DEFAULT '',
    surname text DEFAULT '',
    role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
    status public.user_status NOT NULL DEFAULT 'pending'::public.user_status,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    avatar_url text,
    last_seen_at timestamptz DEFAULT now(),
    responder_status public.responder_status DEFAULT 'off_duty'::public.responder_status,
    location_coords jsonb,
    cell text,
    vehicle_reg text,
    home_address text,
    work_address text,
    ice_no text,
    medical_aid text,
    medical_aid_policy_number text,
    allergies text,
    insurance_company text,
    insurance_policy_number text,
    insurance_type text,
    insurance_contact text,
    vehicles jsonb DEFAULT '[]'::jsonb,
    psira_number text,
    username text,
    assigned_unit text,
    ems_shift_role text,
    updated_at timestamptz DEFAULT now()
);

-- Application Settings / Key-Value Config
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Broadcast Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    type public.announcement_type NOT NULL DEFAULT 'notice'::public.announcement_type,
    image_url text,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Company Auto-Incrementing OB Sequence Tracker
CREATE TABLE IF NOT EXISTS public.company_sequences (
    company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    last_sequence integer NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. INCIDENT REPORTING TABLES
-- ------------------------------------------------------------------------------

-- 3.1 Vehicle Reports
CREATE TABLE IF NOT EXISTS public.vehicle_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ob_number text NOT NULL UNIQUE,
    license_plate text NOT NULL,
    vehicle_make text NOT NULL DEFAULT '',
    vehicle_model text NOT NULL DEFAULT '',
    vehicle_color text NOT NULL DEFAULT '',
    last_seen_location text NOT NULL,
    description text NOT NULL DEFAULT '',
    severity public.severity NOT NULL DEFAULT 'medium'::public.severity,
    status public.report_status NOT NULL DEFAULT 'pending'::public.report_status,
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name text,
    is_global boolean DEFAULT false,
    shared_with_company_ids text[] DEFAULT '{}'::text[],
    reported_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    completed_at timestamptz,
    resolved_at timestamptz,
    location_coords jsonb,
    location_boundary jsonb,
    location_boundingbox real[4],
    evidence_images text[] DEFAULT '{}'::text[],
    date_of_incident date,
    vin_number text,
    engine_number text,
    year text,
    cas_number text,
    station_name text,
    io_name text,
    io_contact text,
    cos_name text,
    cos_contact_number text,
    has_tracker boolean DEFAULT false,
    tracker_company text,
    circulation_number text,
    is_wanted boolean DEFAULT false,
    wanted_report_id text,
    crime_outcome text,
    cit_success boolean DEFAULT false,
    arrests integer DEFAULT 0,
    guns_recovered integer DEFAULT 0,
    other_recoveries text,
    saps_13 text,
    pound_name text,
    has_arrests boolean DEFAULT false,
    has_firearms boolean DEFAULT false,
    vehicle_involved boolean DEFAULT false,
    suspect_license_plate text,
    suspect_vehicle_make text,
    suspect_vehicle_model text,
    suspect_vehicle_color text,
    recovered_location_coords jsonb,
    recovered_at timestamptz,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamptz,
    -- Verification & False Alarm Tracking Fields
    verification_status text DEFAULT 'unverified',
    verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at timestamptz,
    verification_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.2 Crime Reports
CREATE TABLE IF NOT EXISTS public.crime_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    location text NOT NULL,
    crime_type text NOT NULL,
    severity public.severity NOT NULL DEFAULT 'medium'::public.severity,
    status public.report_status NOT NULL DEFAULT 'pending'::public.report_status,
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name text,
    is_global boolean DEFAULT false,
    shared_with_company_ids text[] DEFAULT '{}'::text[],
    reported_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    completed_at timestamptz,
    resolved_at timestamptz,
    location_coords jsonb,
    location_boundary jsonb,
    location_boundingbox real[4],
    evidence_images text[] DEFAULT '{}'::text[],
    date_of_incident date,
    cas_number text,
    station_name text,
    io_name text,
    io_contact text,
    crime_outcome text,
    cit_success boolean DEFAULT false,
    arrests integer DEFAULT 0,
    guns_recovered integer DEFAULT 0,
    guns_stolen integer DEFAULT 0,
    license_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    vin_number text,
    engine_number text,
    recovered_location_coords jsonb,
    recovered_at timestamptz,
    other_recoveries text,
    saps_13 text,
    pound_name text,
    has_arrests boolean DEFAULT false,
    has_firearms boolean DEFAULT false,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamptz,
    -- Verification & False Alarm Tracking Fields
    verification_status text DEFAULT 'unverified',
    verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at timestamptz,
    verification_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.3 Emergency & Roadside Reports
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    location text NOT NULL,
    emergency_type text NOT NULL,
    assistance_type text,
    card_number text,
    car_number text,
    driver_name text,
    drop_off_location text,
    drop_off_location_coords jsonb,
    rollback boolean DEFAULT false,
    recovery boolean DEFAULT false,
    dreamtec boolean DEFAULT false,
    family_run boolean DEFAULT false,
    incident_time text,
    severity public.severity NOT NULL DEFAULT 'high'::public.severity,
    status public.report_status NOT NULL DEFAULT 'pending'::public.report_status,
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name text,
    is_global boolean DEFAULT false,
    shared_with_company_ids text[] DEFAULT '{}'::text[],
    reported_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    completed_at timestamptz,
    resolved_at timestamptz,
    location_coords jsonb,
    location_boundary jsonb,
    location_boundingbox real[4],
    evidence_images text[] DEFAULT '{}'::text[],
    vehicle_involved boolean DEFAULT false,
    vehicles_involved integer DEFAULT 1,
    injuries_reported boolean DEFAULT false,
    fatalities_reported boolean DEFAULT false,
    license_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    vin_number text,
    engine_number text,
    cas_number text,
    station_name text,
    date_of_incident date,
    crime_outcome text,
    cit_success boolean DEFAULT false,
    arrests integer DEFAULT 0,
    guns_recovered integer DEFAULT 0,
    other_recoveries text,
    recovered_location_coords jsonb,
    recovered_at timestamptz,
    saps_13 text,
    pound_name text,
    has_arrests boolean DEFAULT false,
    has_firearms boolean DEFAULT false,
    -- EMS Specialized Fields
    triage_level text DEFAULT 'Pending Assessment',
    patient_count integer DEFAULT 1,
    assigned_unit text,
    receiving_facility text,
    special_hazards text,
    dispatch_notes text,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamptz,
    -- Verification & False Alarm Tracking Fields
    verification_status text DEFAULT 'unverified',
    verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at timestamptz,
    verification_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. COLLABORATION, AUDIT LOGS & DISPATCH TRACKING
-- ------------------------------------------------------------------------------

-- Incident Updates & Timeline Audit Trail
CREATE TABLE IF NOT EXISTS public.report_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Responder Assignment History
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- Cross-Company Corporate Report Sharing
CREATE TABLE IF NOT EXISTS public.report_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    source_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    target_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    shared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Incident Chat & Controller Dispatch Messaging
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id text NOT NULL,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    message text NOT NULL,
    is_channel boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- User Activity & Audit Logs
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    action text NOT NULL,
    details text,
    created_at timestamptz DEFAULT now()
);

-- Gate Access Logs (ANPR / Guarding)
CREATE TABLE IF NOT EXISTS public.gate_access_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate text NOT NULL,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    gate_name text,
    direction text NOT NULL CHECK (direction IN ('entry', 'exit')),
    logged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    is_wanted boolean DEFAULT false,
    wanted_report_id text,
    created_at timestamptz DEFAULT now()
);

-- Tracking Units / GPS Fleet
CREATE TABLE IF NOT EXISTS public.tracking_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL DEFAULT 'vehicle',
    callsign text,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    assigned_responder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active',
    last_location jsonb,
    last_seen_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. GUARDING & SITE MANAGEMENT TABLES
-- ------------------------------------------------------------------------------

-- Guarding Sites
CREATE TABLE IF NOT EXISTS public.sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    address text,
    contact_person text,
    contact_number text,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Guard Checkpoints (QR / NFC / GPS)
CREATE TABLE IF NOT EXISTS public.guard_checkpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
    name text NOT NULL,
    qr_code text NOT NULL,
    nfc_tag_id text,
    location_coords jsonb,
    description text,
    sequence_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Guard Patrol Logs
CREATE TABLE IF NOT EXISTS public.guard_patrol_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
    checkpoint_id uuid REFERENCES public.guard_checkpoints(id) ON DELETE SET NULL,
    guard_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'normal',
    notes text,
    evidence_image text,
    location_coords jsonb,
    created_at timestamptz DEFAULT now()
);

-- Guard Attendance & Duty Register
CREATE TABLE IF NOT EXISTS public.guard_attendances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
    guard_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    clock_in timestamptz NOT NULL DEFAULT now(),
    clock_out timestamptz,
    status text NOT NULL DEFAULT 'on_duty',
    clock_in_location jsonb,
    clock_out_location jsonb,
    created_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. TECHNICAL OPERATIONS & DISPATCH JOBS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tech_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    job_type text NOT NULL DEFAULT 'Installation',
    priority text NOT NULL DEFAULT 'medium',
    status text NOT NULL DEFAULT 'pending',
    client_name text,
    client_contact text,
    site_address text,
    location_coords jsonb,
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_tech_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    scheduled_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tech_job_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES public.tech_jobs(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 7. ESSENTIAL INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_status ON public.vehicle_reports(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_company_id ON public.vehicle_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_reported_at ON public.vehicle_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_license_plate ON public.vehicle_reports(license_plate);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_verification ON public.vehicle_reports(verification_status);

CREATE INDEX IF NOT EXISTS idx_crime_reports_status ON public.crime_reports(status);
CREATE INDEX IF NOT EXISTS idx_crime_reports_company_id ON public.crime_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_crime_reports_reported_at ON public.crime_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_crime_reports_verification ON public.crime_reports(verification_status);

CREATE INDEX IF NOT EXISTS idx_emergency_reports_status ON public.emergency_reports(status);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_company_id ON public.emergency_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_reported_at ON public.emergency_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_verification ON public.emergency_reports(verification_status);

CREATE INDEX IF NOT EXISTS idx_report_updates_report_id ON public.report_updates(report_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_report_id ON public.chat_messages(report_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- ------------------------------------------------------------------------------
-- 8. HELPER RPC FUNCTIONS (OB SEQUENCE & HELPERS)
-- ------------------------------------------------------------------------------

-- Safely generate next OB sequence number per company/month
CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(
    p_company_id uuid DEFAULT NULL,
    p_report_date timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seq integer;
BEGIN
    IF p_company_id IS NULL THEN
        SELECT COALESCE(MAX(last_sequence), 0) + 1 INTO v_seq FROM public.company_sequences;
        RETURN v_seq;
    END IF;

    INSERT INTO public.company_sequences (company_id, last_sequence, updated_at)
    VALUES (p_company_id, 1, now())
    ON CONFLICT (company_id)
    DO UPDATE SET 
        last_sequence = company_sequences.last_sequence + 1,
        updated_at = now()
    RETURNING last_sequence INTO v_seq;

    RETURN v_seq;
END;
$$;

-- Global Unified Incident Search RPC
CREATE OR REPLACE FUNCTION public.search_incidents(search_term text, p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_results jsonb;
BEGIN
    WITH combined AS (
        SELECT id, ob_number, license_plate as title, 'vehicle' as type, status, severity, reported_at, last_seen_location as location, company_id
        FROM public.vehicle_reports
        WHERE (ob_number ILIKE '%' || search_term || '%' OR license_plate ILIKE '%' || search_term || '%' OR vehicle_make ILIKE '%' || search_term || '%' OR description ILIKE '%' || search_term || '%')
          AND (p_company_id IS NULL OR is_global = true OR company_id = p_company_id)
        UNION ALL
        SELECT id, ob_number, title, 'crime' as type, status, severity, reported_at, location, company_id
        FROM public.crime_reports
        WHERE (ob_number ILIKE '%' || search_term || '%' OR title ILIKE '%' || search_term || '%' OR description ILIKE '%' || search_term || '%' OR crime_type ILIKE '%' || search_term || '%')
          AND (p_company_id IS NULL OR is_global = true OR company_id = p_company_id)
        UNION ALL
        SELECT id, ob_number, title, 'emergency' as type, status, severity, reported_at, location, company_id
        FROM public.emergency_reports
        WHERE (ob_number ILIKE '%' || search_term || '%' OR title ILIKE '%' || search_term || '%' OR description ILIKE '%' || search_term || '%' OR emergency_type ILIKE '%' || search_term || '%')
          AND (p_company_id IS NULL OR is_global = true OR company_id = p_company_id)
    )
    SELECT jsonb_agg(row_to_json(combined)) INTO v_results FROM combined;
    RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_patrol_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_job_updates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view active records
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow select for authenticated" ON public.companies;
    CREATE POLICY "Allow select for authenticated" ON public.companies FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
    CREATE POLICY "Allow select profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow manage own profile" ON public.profiles;
    CREATE POLICY "Allow manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Allow select vehicle reports" ON public.vehicle_reports;
    CREATE POLICY "Allow select vehicle reports" ON public.vehicle_reports FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert vehicle reports" ON public.vehicle_reports;
    CREATE POLICY "Allow insert vehicle reports" ON public.vehicle_reports FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow update vehicle reports" ON public.vehicle_reports;
    CREATE POLICY "Allow update vehicle reports" ON public.vehicle_reports FOR UPDATE TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow select crime reports" ON public.crime_reports;
    CREATE POLICY "Allow select crime reports" ON public.crime_reports FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert crime reports" ON public.crime_reports;
    CREATE POLICY "Allow insert crime reports" ON public.crime_reports FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow update crime reports" ON public.crime_reports;
    CREATE POLICY "Allow update crime reports" ON public.crime_reports FOR UPDATE TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow select emergency reports" ON public.emergency_reports;
    CREATE POLICY "Allow select emergency reports" ON public.emergency_reports FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert emergency reports" ON public.emergency_reports;
    CREATE POLICY "Allow insert emergency reports" ON public.emergency_reports FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow update emergency reports" ON public.emergency_reports;
    CREATE POLICY "Allow update emergency reports" ON public.emergency_reports FOR UPDATE TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow report updates select" ON public.report_updates;
    CREATE POLICY "Allow report updates select" ON public.report_updates FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow report updates insert" ON public.report_updates;
    CREATE POLICY "Allow report updates insert" ON public.report_updates FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow chat select" ON public.chat_messages;
    CREATE POLICY "Allow chat select" ON public.chat_messages FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow chat insert" ON public.chat_messages;
    CREATE POLICY "Allow chat insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);
END $$;
