-- Migration: Add detailed recovery and arrest fields to vehicle and crime reports
-- To be run in Supabase SQL Editor

-- Update vehicle_reports
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS arrests integer DEFAULT 0;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS guns_recovered integer DEFAULT 0;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS other_recoveries text;

-- Update crime_reports
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS recovered_at timestamp with time zone;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS other_recoveries text;

-- Ensure RLS is updated (though if using the helper, it should be fine)
-- If we added new columns, we might need to refresh the schema cache in the client.
