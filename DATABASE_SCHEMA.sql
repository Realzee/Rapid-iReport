-- ==============================================================================
-- RAPID iREPORT / RAPID911 - COMPLETE UPDATED DATABASE SQL SCHEMA
-- Version: 2026.09 (Fully Idempotent: Works on Both Fresh & Existing Databases)
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
-- 2. MASTER ENTITY TABLES
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

-- Auto-Incrementing OB Sequence Tracker
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
    triage_level text DEFAULT 'Pending Assessment',
    patient_count integer DEFAULT 1,
    assigned_unit text,
    receiving_facility text,
    special_hazards text,
    dispatch_notes text,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamptz,
    verification_status text DEFAULT 'unverified',
    verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at timestamptz,
    verification_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. ENSURE ALL COLUMNS EXIST ON EXISTING TABLES (IDEMPOTENT MIGRATIONS)
-- ------------------------------------------------------------------------------
-- Companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS allowed_modules text[] DEFAULT '{}'::text[];
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bolo_background_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owners_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cell_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS psira_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS responder_status public.responder_status DEFAULT 'off_duty'::public.responder_status;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_coords jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cell text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_reg text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ice_no text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_aid text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_aid_policy_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_company text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_policy_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_contact text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicles jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS psira_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_unit text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ems_shift_role text;

-- Vehicle Reports (Verification & Specialized Fields)
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified';
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS is_wanted boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS wanted_report_id text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS crime_outcome text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS other_recoveries text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS saps_13 text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS pound_name text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS has_arrests boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS has_firearms boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS vehicle_involved boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_license_plate text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_vehicle_make text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_vehicle_model text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS suspect_vehicle_color text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS recovered_at timestamptz;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids text[] DEFAULT '{}'::text[];
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS location_coords jsonb;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS location_boundary jsonb;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS location_boundingbox real[4];
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS evidence_images text[] DEFAULT '{}'::text[];
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS date_of_incident date;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS engine_number text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cas_number text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS station_name text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS io_name text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS io_contact text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cos_name text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cos_contact_number text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS has_tracker boolean DEFAULT false;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS tracker_company text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS circulation_number text;

-- Crime Reports (Verification & Specialized Fields)
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified';
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS cas_number text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS station_name text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS io_name text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS io_contact text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS crime_outcome text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS guns_stolen integer DEFAULT 0;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS license_plate text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS vehicle_make text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS vehicle_color text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS engine_number text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS recovered_at timestamptz;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS other_recoveries text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS saps_13 text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS pound_name text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS has_arrests boolean DEFAULT false;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS has_firearms boolean DEFAULT false;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids text[] DEFAULT '{}'::text[];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS location_coords jsonb;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS location_boundary jsonb;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS location_boundingbox real[4];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS evidence_images text[] DEFAULT '{}'::text[];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS date_of_incident date;

-- Emergency Reports (Verification & Specialized Fields)
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified';
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS assistance_type text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS card_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS car_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS drop_off_location text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS drop_off_location_coords jsonb;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS rollback boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS recovery boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS dreamtec boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS family_run boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS incident_time text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_involved boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicles_involved integer DEFAULT 1;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS injuries_reported boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS fatalities_reported boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS license_plate text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_make text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_color text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS engine_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS cas_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS station_name text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS date_of_incident date;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS crime_outcome text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS other_recoveries text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS recovered_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS saps_13 text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS pound_name text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS has_arrests boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS has_firearms boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS triage_level text DEFAULT 'Pending Assessment';
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS patient_count integer DEFAULT 1;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS assigned_unit text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS receiving_facility text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS special_hazards text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS dispatch_notes text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS shared_with_company_ids text[] DEFAULT '{}'::text[];
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS location_coords jsonb;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS location_boundary jsonb;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS location_boundingbox real[4];
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS evidence_images text[] DEFAULT '{}'::text[];

-- ------------------------------------------------------------------------------
-- 5. DISPATCH COLLABORATION, CHAT & AUDIT TRAILS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    assigned_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    action text NOT NULL,
    details text,
    created_at timestamptz DEFAULT now()
);

-- ANPR / Gate Access
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

-- GPS Fleet Tracking Units
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
-- 6. GUARDING & PATROL MODULES
-- ------------------------------------------------------------------------------

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
-- 7. TECH OPS & JOB DISPATCH
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
-- 8. PERFORMANCE INDEXES (Created safely AFTER column verification)
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
-- 9. HELPER RPC FUNCTIONS (OB SEQUENCE GENERATOR & GLOBAL SEARCH)
-- ------------------------------------------------------------------------------

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

-- Ensure created_at exists on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 9.2 Auth User Creation Trigger (Supports Community Members with NULL company_id)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id uuid := NULL;
    v_role public.user_role := 'user'::public.user_role;
    v_status public.user_status := 'pending'::public.user_status;
BEGIN
    -- Parse company_id safely (community members register with NULL company_id)
    IF new.raw_user_meta_data->>'company_id' IS NOT NULL AND TRIM(new.raw_user_meta_data->>'company_id') <> '' THEN
        BEGIN
            v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_company_id := NULL;
        END;
    END IF;

    -- Parse user role safely
    IF new.raw_user_meta_data->>'role' IS NOT NULL AND TRIM(new.raw_user_meta_data->>'role') <> '' THEN
        BEGIN
            v_role := (new.raw_user_meta_data->>'role')::public.user_role;
        EXCEPTION WHEN OTHERS THEN
            v_role := 'user'::public.user_role;
        END;
    END IF;

    -- User status defaults to 'pending' awaiting administrator review
    IF new.raw_user_meta_data->>'status' IS NOT NULL AND TRIM(new.raw_user_meta_data->>'status') <> '' THEN
        BEGIN
            v_status := (new.raw_user_meta_data->>'status')::public.user_status;
        EXCEPTION WHEN OTHERS THEN
            v_status := 'pending'::public.user_status;
        END;
    END IF;

    INSERT INTO public.profiles (
        id, 
        email, 
        first_name, 
        surname, 
        role, 
        status, 
        company_id, 
        cell, 
        vehicle_reg, 
        home_address, 
        ice_no, 
        medical_aid, 
        psira_number,
        created_at,
        updated_at
    ) VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'first_name', ''),
        COALESCE(new.raw_user_meta_data->>'surname', ''),
        v_role,
        v_status,
        v_company_id,
        new.raw_user_meta_data->>'cell',
        new.raw_user_meta_data->>'vehicle_reg',
        new.raw_user_meta_data->>'home_address',
        new.raw_user_meta_data->>'ice_no',
        new.raw_user_meta_data->>'medical_aid',
        new.raw_user_meta_data->>'psira_number',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = CASE WHEN profiles.first_name = '' THEN EXCLUDED.first_name ELSE profiles.first_name END,
        surname = CASE WHEN profiles.surname = '' THEN EXCLUDED.surname ELSE profiles.surname END,
        company_id = COALESCE(profiles.company_id, EXCLUDED.company_id),
        role = CASE WHEN profiles.role = 'user' THEN EXCLUDED.role ELSE profiles.role END,
        updated_at = now();

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
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
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_patrol_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_job_updates ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

DO $$ BEGIN
    -- Companies
    DROP POLICY IF EXISTS "Allow select for authenticated" ON public.companies;
    CREATE POLICY "Allow select for authenticated" ON public.companies FOR SELECT TO authenticated USING (true);

    -- Profiles
    DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
    CREATE POLICY "Allow select profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow manage own profile" ON public.profiles;
    CREATE POLICY "Allow manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);

    -- Vehicle Reports
    DROP POLICY IF EXISTS "Allow select vehicle reports" ON public.vehicle_reports;
    CREATE POLICY "Allow select vehicle reports" ON public.vehicle_reports FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert vehicle reports" ON public.vehicle_reports;
    CREATE POLICY "Allow insert vehicle reports" ON public.vehicle_reports FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow update vehicle reports" ON public.vehicle_reports;
    CREATE POLICY "Allow update vehicle reports" ON public.vehicle_reports FOR UPDATE TO authenticated USING (true);

    -- Crime Reports
    DROP POLICY IF EXISTS "Allow select crime reports" ON public.crime_reports;
    CREATE POLICY "Allow select crime reports" ON public.crime_reports FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert crime reports" ON public.crime_reports;
    CREATE POLICY "Allow insert crime reports" ON public.crime_reports FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow update crime reports" ON public.crime_reports;
    CREATE POLICY "Allow update crime reports" ON public.crime_reports FOR UPDATE TO authenticated USING (true);

    -- Emergency Reports
    DROP POLICY IF EXISTS "Allow select emergency reports" ON public.emergency_reports;
    CREATE POLICY "Allow select emergency reports" ON public.emergency_reports FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert emergency reports" ON public.emergency_reports;
    CREATE POLICY "Allow insert emergency reports" ON public.emergency_reports FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow update emergency reports" ON public.emergency_reports;
    CREATE POLICY "Allow update emergency reports" ON public.emergency_reports FOR UPDATE TO authenticated USING (true);

    -- Report Updates
    DROP POLICY IF EXISTS "Allow report updates select" ON public.report_updates;
    CREATE POLICY "Allow report updates select" ON public.report_updates FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow report updates insert" ON public.report_updates;
    CREATE POLICY "Allow report updates insert" ON public.report_updates FOR INSERT TO authenticated WITH CHECK (true);

    -- Chat Messages
    DROP POLICY IF EXISTS "Allow chat select" ON public.chat_messages;
    CREATE POLICY "Allow chat select" ON public.chat_messages FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow chat insert" ON public.chat_messages;
    CREATE POLICY "Allow chat insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);

    -- User Activity Logs
    DROP POLICY IF EXISTS "Allow select user activity logs" ON public.user_activity_logs;
    CREATE POLICY "Allow select user activity logs" ON public.user_activity_logs FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert user activity logs" ON public.user_activity_logs;
    CREATE POLICY "Allow insert user activity logs" ON public.user_activity_logs FOR INSERT TO authenticated WITH CHECK (true);

    -- Assignment Logs
    DROP POLICY IF EXISTS "Allow select assignment logs" ON public.assignment_logs;
    CREATE POLICY "Allow select assignment logs" ON public.assignment_logs FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert assignment logs" ON public.assignment_logs;
    CREATE POLICY "Allow insert assignment logs" ON public.assignment_logs FOR INSERT TO authenticated WITH CHECK (true);

    -- Report Shares
    DROP POLICY IF EXISTS "Allow select report shares" ON public.report_shares;
    CREATE POLICY "Allow select report shares" ON public.report_shares FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert report shares" ON public.report_shares;
    CREATE POLICY "Allow insert report shares" ON public.report_shares FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow update report shares" ON public.report_shares;
    CREATE POLICY "Allow update report shares" ON public.report_shares FOR UPDATE TO authenticated USING (true);

    -- Gate Access Logs
    DROP POLICY IF EXISTS "Allow select gate access logs" ON public.gate_access_logs;
    CREATE POLICY "Allow select gate access logs" ON public.gate_access_logs FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert gate access logs" ON public.gate_access_logs;
    CREATE POLICY "Allow insert gate access logs" ON public.gate_access_logs FOR INSERT TO authenticated WITH CHECK (true);

    -- Tracking Units
    DROP POLICY IF EXISTS "Allow select tracking units" ON public.tracking_units;
    CREATE POLICY "Allow select tracking units" ON public.tracking_units FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow manage tracking units" ON public.tracking_units;
    CREATE POLICY "Allow manage tracking units" ON public.tracking_units FOR ALL TO authenticated USING (true);

    -- Sites & Checkpoints
    DROP POLICY IF EXISTS "Allow select sites" ON public.sites;
    CREATE POLICY "Allow select sites" ON public.sites FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow manage sites" ON public.sites;
    CREATE POLICY "Allow manage sites" ON public.sites FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow select checkpoints" ON public.guard_checkpoints;
    CREATE POLICY "Allow select checkpoints" ON public.guard_checkpoints FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow manage checkpoints" ON public.guard_checkpoints;
    CREATE POLICY "Allow manage checkpoints" ON public.guard_checkpoints FOR ALL TO authenticated USING (true);

    -- Patrol Logs & Attendances
    DROP POLICY IF EXISTS "Allow select patrol logs" ON public.guard_patrol_logs;
    CREATE POLICY "Allow select patrol logs" ON public.guard_patrol_logs FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert patrol logs" ON public.guard_patrol_logs;
    CREATE POLICY "Allow insert patrol logs" ON public.guard_patrol_logs FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow select attendances" ON public.guard_attendances;
    CREATE POLICY "Allow select attendances" ON public.guard_attendances FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow manage attendances" ON public.guard_attendances;
    CREATE POLICY "Allow manage attendances" ON public.guard_attendances FOR ALL TO authenticated USING (true);

    -- Tech Jobs
    DROP POLICY IF EXISTS "Allow select tech jobs" ON public.tech_jobs;
    CREATE POLICY "Allow select tech jobs" ON public.tech_jobs FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow manage tech jobs" ON public.tech_jobs;
    CREATE POLICY "Allow manage tech jobs" ON public.tech_jobs FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow select tech job updates" ON public.tech_job_updates;
    CREATE POLICY "Allow select tech job updates" ON public.tech_job_updates FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow insert tech job updates" ON public.tech_job_updates;
    CREATE POLICY "Allow insert tech job updates" ON public.tech_job_updates FOR INSERT TO authenticated WITH CHECK (true);
END $$;
