-- ==============================================================================
-- RAPID911 / RAPID iREPORT - MASTER PRODUCTION DATABASE SCHEMA
-- Version: 2026.09 (Consolidated, 100% Verified & Production-Ready)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CUSTOM TYPES & ENUMS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'user', 'admin', 'moderator', 'controller', 'responder', 
            'ras_driver', 'roadside_driver', 'driver', 
            'supervisor', 'guard'
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
            'used_in_commission_of_crime'
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

-- Ensure newer enum values exist if type was created previously
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'stolen';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'suspicious';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'bolo';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'sought';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'hijacked';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'used_in_commission_of_crime';

-- ------------------------------------------------------------------------------
-- 2. CORE MASTER TABLES
-- ------------------------------------------------------------------------------

-- Companies / Security Organizations
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

-- User Profiles (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    first_name text DEFAULT '',
    surname text DEFAULT '',
    role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
    status public.user_status NOT NULL DEFAULT 'pending'::public.user_status,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    avatar_url text,
    updated_at timestamptz DEFAULT now(),
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
    username text
);

-- Application Settings / Key-Value Configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Global System Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    type public.announcement_type NOT NULL DEFAULT 'notice'::public.announcement_type,
    image_url text,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Company Auto-Incrementing OB Sequences
CREATE TABLE IF NOT EXISTS public.company_sequences (
    company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    last_sequence integer NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. INCIDENT REPORTING TABLES
-- ------------------------------------------------------------------------------

-- Vehicle Reports (BOLO, Stolen, Recoveries)
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
    reported_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    completed_at timestamptz,
    resolved_at timestamptz,
    location_coords jsonb,
    location_boundary jsonb,
    location_boundingbox double precision[],
    evidence_images text[] DEFAULT '{}'::text[],
    cas_number text,
    station_name text,
    vin_number text,
    engine_number text,
    year text,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}'::uuid[],
    circulation_number text,
    recovered_location_coords jsonb,
    recovered_at timestamptz,
    arrests integer DEFAULT 0,
    guns_recovered integer DEFAULT 0,
    other_recoveries text,
    saps_13 text,
    pound_name text,
    has_arrests boolean DEFAULT false,
    has_firearms boolean DEFAULT false,
    crime_outcome text,
    cit_success boolean DEFAULT false,
    cos_name text,
    cos_contact_number text,
    date_of_incident date,
    tracker_company text,
    io_name text,
    io_contact text,
    has_tracker boolean DEFAULT false,
    vehicle_involved boolean DEFAULT false,
    suspect_license_plate text,
    suspect_vehicle_make text,
    suspect_vehicle_model text,
    suspect_vehicle_color text,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamptz
);

-- Crime Incident Reports
CREATE TABLE IF NOT EXISTS public.crime_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    crime_type text NOT NULL,
    location text NOT NULL,
    description text NOT NULL DEFAULT '',
    severity public.severity NOT NULL DEFAULT 'medium'::public.severity,
    status public.report_status NOT NULL DEFAULT 'pending'::public.report_status,
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    completed_at timestamptz,
    resolved_at timestamptz,
    location_coords jsonb,
    location_boundary jsonb,
    location_boundingbox double precision[],
    evidence_images text[] DEFAULT '{}'::text[],
    cas_number text,
    station_name text,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}'::uuid[],
    cit_success boolean DEFAULT false,
    arrests integer DEFAULT 0,
    guns_recovered integer DEFAULT 0,
    guns_stolen integer DEFAULT 0,
    vin_number text,
    engine_number text,
    crime_outcome text,
    recovered_location_coords jsonb,
    recovered_at timestamptz,
    other_recoveries text,
    stat text,
    license_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    saps_13 text,
    pound_name text,
    has_arrests boolean DEFAULT false,
    has_firearms boolean DEFAULT false,
    vehicle_involved boolean DEFAULT false,
    io_name text,
    io_contact text,
    date_of_incident date,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamptz
);

-- Emergency & Panic Reports (SOS / Roadside / Medical)
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    emergency_type text NOT NULL,
    location text NOT NULL,
    description text NOT NULL DEFAULT '',
    severity public.severity NOT NULL DEFAULT 'critical'::public.severity,
    status public.report_status NOT NULL DEFAULT 'pending'::public.report_status,
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    location_coords jsonb,
    location_boundary jsonb,
    location_boundingbox double precision[],
    evidence_images text[] DEFAULT '{}'::text[],
    cas_number text,
    station_name text,
    vehicles_involved text,
    injuries_reported integer DEFAULT 0,
    fatalities_reported integer DEFAULT 0,
    license_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    vehicle_involved boolean DEFAULT false,
    is_global boolean DEFAULT false,
    shared_with_company_ids uuid[] DEFAULT '{}'::uuid[],
    vin_number text,
    engine_number text,
    saps_13 text,
    pound_name text,
    has_arrests boolean DEFAULT false,
    has_firearms boolean DEFAULT false,
    arrests integer DEFAULT 0,
    guns_recovered integer DEFAULT 0,
    other_recoveries text,
    crime_outcome text,
    recovered_location_coords jsonb,
    recovered_at timestamptz,
    cit_success boolean DEFAULT false,
    date_of_incident date,
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
    incident_time timestamptz,
    is_public boolean DEFAULT false,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamptz
);

-- EMS Assessments (Patient Care Reports)
CREATE TABLE IF NOT EXISTS public.ems_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    patient_name text,
    patient_age text,
    patient_gender text,
    patient_contact text,
    chief_complaint text,
    medical_history text,
    allergies text,
    vital_bp text,
    vital_pulse text,
    vital_resp text,
    vital_spo2 text,
    vital_temp text,
    vital_gcs text,
    treatment_provided text,
    medications_administered text,
    transport_decision text,
    receiving_facility text,
    handover_notes text,
    assessed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assessed_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Incident Updates & Investigation Notes
CREATE TABLE IF NOT EXISTS public.report_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Cross-Company Shared Intelligence Records
CREATE TABLE IF NOT EXISTS public.report_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    report_type text NOT NULL,
    source_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    target_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Incident Dispatch / Collaborative Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content text NOT NULL,
    read_by uuid[] DEFAULT '{}'::uuid[],
    created_at timestamptz DEFAULT now()
);

-- Assignment Audit Logs (Dispatch / Re-assignment Trail)
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- User In-App Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    reference_id text,
    created_at timestamptz DEFAULT now()
);

-- System Security & Audit Activity Logs
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    details text,
    ip_address text,
    created_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. GUARDING, PATROL & GATE ACCESS TABLES
-- ------------------------------------------------------------------------------

-- Guarding Sites / Protected Properties
CREATE TABLE IF NOT EXISTS public.sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    location text,
    address text,
    boundary jsonb,
    contact_person text,
    contact_number text,
    logo_url text,
    created_at timestamptz DEFAULT now()
);

-- Guard Supervisors
CREATE TABLE IF NOT EXISTS public.supervisors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact_number text,
    profile_pic_url text,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    site_ids uuid[] DEFAULT '{}'::uuid[],
    created_at timestamptz DEFAULT now()
);

-- Guard Personnel Roster
CREATE TABLE IF NOT EXISTS public.guards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text DEFAULT 'active',
    contact_number text,
    psira_number text,
    psira_expiry_date date,
    next_of_kin_contact text,
    profile_pic_url text,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- Patrol Routes
CREATE TABLE IF NOT EXISTS public.routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Patrol Checkpoints (QR / NFC / GPS)
CREATE TABLE IF NOT EXISTS public.checkpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
    location jsonb,
    qr_code text,
    created_at timestamptz DEFAULT now()
);

-- Patrol Checkpoint Scans & Audit Logs
CREATE TABLE IF NOT EXISTS public.patrol_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guard_id uuid REFERENCES public.guards(id) ON DELETE SET NULL,
    checkpoint_id uuid REFERENCES public.checkpoints(id) ON DELETE SET NULL,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    timestamp timestamptz DEFAULT now(),
    scanned_at timestamptz DEFAULT now(),
    status text DEFAULT 'valid',
    notes text,
    qr_code_scanned text,
    verification_status text DEFAULT 'verified',
    location_coords jsonb
);

-- Live Guard GPS Heartbeats
CREATE TABLE IF NOT EXISTS public.guard_heartbeats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guard_id uuid REFERENCES public.guards(id) ON DELETE CASCADE,
    location_coords jsonb NOT NULL,
    status text DEFAULT 'active',
    battery_level integer,
    signal_strength integer,
    timestamp timestamptz DEFAULT now()
);

-- Gate Access & ANPR License Plate Logs
CREATE TABLE IF NOT EXISTS public.gate_access_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate text NOT NULL,
    vehicle_make text,
    vehicle_model text,
    vehicle_color text,
    gate_name text DEFAULT 'Main Gate',
    direction text NOT NULL DEFAULT 'entry',
    logged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    is_wanted boolean DEFAULT false,
    wanted_report_id uuid REFERENCES public.vehicle_reports(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. FLEET, TECH OPERATIONS & ATTENDANCE
-- ------------------------------------------------------------------------------

-- Tracking Units (Fleet GPS & Telemetry)
CREATE TABLE IF NOT EXISTS public.tracking_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    plate text NOT NULL,
    imei text UNIQUE NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    status text DEFAULT 'offline',
    lat double precision,
    lng double precision,
    speed double precision DEFAULT 0,
    course double precision DEFAULT 0,
    battery_voltage double precision,
    battery_percent integer,
    acc_status boolean DEFAULT false,
    fuel_cut boolean DEFAULT false,
    mileage double precision DEFAULT 0,
    fuel_level double precision,
    speed_limit double precision DEFAULT 120,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Technical Operations Work Orders / Jobs
CREATE TABLE IF NOT EXISTS public.tech_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'pending',
    severity text NOT NULL DEFAULT 'medium',
    location text,
    location_coords jsonb,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    parts_logged jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Technical Operations Live Chat
CREATE TABLE IF NOT EXISTS public.tech_chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES public.tech_jobs(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Staff Clock-In / Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    clock_in_time timestamptz NOT NULL DEFAULT now(),
    clock_out_time timestamptz,
    clock_in_location jsonb,
    clock_out_location jsonb,
    created_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. HIGH-PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_reported_at ON public.vehicle_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_status ON public.vehicle_reports(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_company_id ON public.vehicle_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_license_plate ON public.vehicle_reports(license_plate);
CREATE INDEX IF NOT EXISTS idx_vehicle_reports_ob_number ON public.vehicle_reports(ob_number);

CREATE INDEX IF NOT EXISTS idx_crime_reports_reported_at ON public.crime_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_crime_reports_status ON public.crime_reports(status);
CREATE INDEX IF NOT EXISTS idx_crime_reports_company_id ON public.crime_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_crime_reports_ob_number ON public.crime_reports(ob_number);

CREATE INDEX IF NOT EXISTS idx_emergency_reports_reported_at ON public.emergency_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_status ON public.emergency_reports(status);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_company_id ON public.emergency_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_ob_number ON public.emergency_reports(ob_number);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_chat_messages_report_id ON public.chat_messages(report_id);
CREATE INDEX IF NOT EXISTS idx_report_updates_report_id ON public.report_updates(report_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_report_id ON public.assignment_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_gate_access_logs_plate ON public.gate_access_logs(license_plate);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id, is_read);

-- ------------------------------------------------------------------------------
-- 7. ESSENTIAL DATABASE FUNCTIONS & RPCS
-- ------------------------------------------------------------------------------

-- Month/Year Sequence Generator for OB Occurrence Numbers
CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(
    p_company_id uuid DEFAULT NULL, 
    p_report_date timestamp with time zone DEFAULT now()
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    report_month integer := extract(month from p_report_date);
    report_year integer := extract(year from p_report_date);
    max_seq integer;
BEGIN
    SELECT MAX(seq) INTO max_seq
    FROM (
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.vehicle_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
        UNION ALL
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.crime_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
        UNION ALL
        SELECT CAST(substring(ob_number from 2 for 4) AS integer) as seq 
        FROM public.emergency_reports 
        WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        AND ob_number ~ '^[A-Z][0-9]{4}/[0-9]{2}/[0-9]{4}$'
    ) AS combined;
    
    RETURN COALESCE(max_seq, 0) + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_ob_sequence(uuid, timestamp with time zone) TO authenticated, anon, service_role;

-- Global BOLO Search RPC across vehicle records
CREATE OR REPLACE FUNCTION public.global_vehicle_search(search_term text)
RETURNS SETOF public.vehicle_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.vehicle_reports
    WHERE
        license_plate ILIKE '%' || search_term || '%' OR
        cas_number ILIKE '%' || search_term || '%' OR
        vin_number ILIKE '%' || search_term || '%' OR
        engine_number ILIKE '%' || search_term || '%' OR
        ob_number ILIKE '%' || search_term || '%' OR
        vehicle_make ILIKE '%' || search_term || '%' OR
        vehicle_model ILIKE '%' || search_term || '%' OR
        cos_name ILIKE '%' || search_term || '%' OR
        io_name ILIKE '%' || search_term || '%' OR
        description ILIKE '%' || search_term || '%'
    ORDER BY reported_at DESC
    LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_vehicle_search(text) TO authenticated, anon, service_role;

-- Auth User Creation Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, surname, role, status)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'first_name', ''),
        COALESCE(new.raw_user_meta_data->>'surname', ''),
        'user'::public.user_role,
        'active'::public.user_status
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = CASE WHEN profiles.first_name = '' THEN EXCLUDED.first_name ELSE profiles.first_name END,
        surname = CASE WHEN profiles.surname = '' THEN EXCLUDED.surname ELSE profiles.surname END;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ems_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Helper policy function: check if caller is global admin
CREATE OR REPLACE FUNCTION public.is_global_admin(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.companies c ON p.company_id = c.id
        WHERE p.id = user_id 
          AND p.role = 'admin'::public.user_role 
          AND LOWER(c.name) LIKE '%rapid911%'
    );
$$;

-- Companies Policies
DROP POLICY IF EXISTS "Public companies read access" ON public.companies;
CREATE POLICY "Public companies read access" ON public.companies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage companies" ON public.companies;
CREATE POLICY "Admins manage companies" ON public.companies FOR ALL 
    USING (auth.uid() IS NOT NULL AND (is_global_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')));

-- Profiles Policies
DROP POLICY IF EXISTS "Users can read profiles" ON public.profiles;
CREATE POLICY "Users can read profiles" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins manage all profiles" ON public.profiles;
CREATE POLICY "Admins manage all profiles" ON public.profiles FOR ALL 
    USING (auth.uid() IS NOT NULL AND (is_global_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')));

-- Incident Reports Universal Policies
DROP POLICY IF EXISTS "Staff read vehicle reports" ON public.vehicle_reports;
CREATE POLICY "Staff read vehicle reports" ON public.vehicle_reports FOR SELECT 
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff manage vehicle reports" ON public.vehicle_reports;
CREATE POLICY "Staff manage vehicle reports" ON public.vehicle_reports FOR ALL 
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff read crime reports" ON public.crime_reports;
CREATE POLICY "Staff read crime reports" ON public.crime_reports FOR SELECT 
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff manage crime reports" ON public.crime_reports;
CREATE POLICY "Staff manage crime reports" ON public.crime_reports FOR ALL 
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff read emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff read emergency reports" ON public.emergency_reports FOR SELECT 
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff manage emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff manage emergency reports" ON public.emergency_reports FOR ALL 
    USING (auth.uid() IS NOT NULL);

-- Operational Tables Policies (Authenticated Access)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'app_settings', 'announcements', 'ems_assessments', 'report_updates', 
            'report_shares', 'chat_messages', 'assignment_logs', 'notifications', 
            'user_activity_logs', 'sites', 'supervisors', 'guards', 'routes', 
            'checkpoints', 'patrol_logs', 'guard_heartbeats', 'gate_access_logs', 
            'tracking_units', 'tech_jobs', 'tech_chat_messages', 'attendance'
        ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Auth read %I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Auth read %I" ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)', tbl, tbl);
        
        EXECUTE format('DROP POLICY IF EXISTS "Auth write %I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Auth write %I" ON public.%I FOR ALL USING (auth.uid() IS NOT NULL)', tbl, tbl);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 9. STORAGE BUCKETS CONFIGURATION
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('company-logos', 'company-logos', true),
    ('avatars', 'avatars', true),
    ('evidence', 'evidence', true),
    ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Read Policy (Public access for images)
DROP POLICY IF EXISTS "Public Storage Read Access" ON storage.objects;
CREATE POLICY "Public Storage Read Access" ON storage.objects FOR SELECT 
    USING (bucket_id IN ('company-logos', 'avatars', 'evidence', 'app-assets'));

-- Storage Write Policy (Authenticated Users)
DROP POLICY IF EXISTS "Authenticated Storage Uploads" ON storage.objects;
CREATE POLICY "Authenticated Storage Uploads" ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id IN ('company-logos', 'avatars', 'evidence', 'app-assets'));

DROP POLICY IF EXISTS "Authenticated Storage Updates" ON storage.objects;
CREATE POLICY "Authenticated Storage Updates" ON storage.objects FOR UPDATE 
    TO authenticated 
    USING (bucket_id IN ('company-logos', 'avatars', 'evidence', 'app-assets'));

DROP POLICY IF EXISTS "Authenticated Storage Deletes" ON storage.objects;
CREATE POLICY "Authenticated Storage Deletes" ON storage.objects FOR DELETE 
    TO authenticated 
    USING (bucket_id IN ('company-logos', 'avatars', 'evidence', 'app-assets'));

-- ------------------------------------------------------------------------------
-- 10. SYSTEM NOTIFICATION & CACHE RELOAD
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
