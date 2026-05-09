-- COMPREHENSIVE RECOVERY AND SHARED FIELDS MIGRATION
-- Adds all new fields required for Vehicle, Crime, and Emergency reports

-- 1. Updates for vehicle_reports
ALTER TABLE public.vehicle_reports 
ADD COLUMN IF NOT EXISTS cas_number text,
ADD COLUMN IF NOT EXISTS station_name text,
ADD COLUMN IF NOT EXISTS vin_number text,
ADD COLUMN IF NOT EXISTS engine_number text,
ADD COLUMN IF NOT EXISTS year text,
ADD COLUMN IF NOT EXISTS saps_13 text,
ADD COLUMN IF NOT EXISTS pound_name text,
ADD COLUMN IF NOT EXISTS has_arrests boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_firearms boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_recoveries text,
ADD COLUMN IF NOT EXISTS crime_outcome text,
ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb,
ADD COLUMN IF NOT EXISTS recovered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false;

-- 2. Updates for crime_reports
ALTER TABLE public.crime_reports 
ADD COLUMN IF NOT EXISTS cas_number text,
ADD COLUMN IF NOT EXISTS station_name text,
ADD COLUMN IF NOT EXISTS stat text,
ADD COLUMN IF NOT EXISTS license_plate text,
ADD COLUMN IF NOT EXISTS vehicle_make text,
ADD COLUMN IF NOT EXISTS vehicle_model text,
ADD COLUMN IF NOT EXISTS vehicle_color text,
ADD COLUMN IF NOT EXISTS vin_number text,
ADD COLUMN IF NOT EXISTS engine_number text,
ADD COLUMN IF NOT EXISTS saps_13 text,
ADD COLUMN IF NOT EXISTS pound_name text,
ADD COLUMN IF NOT EXISTS has_arrests boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_firearms boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_recoveries text,
ADD COLUMN IF NOT EXISTS crime_outcome text,
ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb,
ADD COLUMN IF NOT EXISTS recovered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vehicle_involved boolean DEFAULT false;

-- 3. Updates for emergency_reports
-- First ensure table exists if not created in another schema file
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    emergency_type text NOT NULL,
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    location_coords jsonb,
    evidence_images text[]
);

ALTER TABLE public.emergency_reports 
ADD COLUMN IF NOT EXISTS cas_number text,
ADD COLUMN IF NOT EXISTS station_name text,
ADD COLUMN IF NOT EXISTS license_plate text,
ADD COLUMN IF NOT EXISTS vehicle_make text,
ADD COLUMN IF NOT EXISTS vehicle_model text,
ADD COLUMN IF NOT EXISTS vehicle_color text,
ADD COLUMN IF NOT EXISTS vin_number text,
ADD COLUMN IF NOT EXISTS engine_number text,
ADD COLUMN IF NOT EXISTS vehicle_involved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vehicles_involved integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS injuries_reported boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fatalities_reported boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS saps_13 text,
ADD COLUMN IF NOT EXISTS pound_name text,
ADD COLUMN IF NOT EXISTS has_arrests boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_firearms boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_recoveries text,
ADD COLUMN IF NOT EXISTS crime_outcome text,
ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb,
ADD COLUMN IF NOT EXISTS recovered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cit_success boolean DEFAULT false;
