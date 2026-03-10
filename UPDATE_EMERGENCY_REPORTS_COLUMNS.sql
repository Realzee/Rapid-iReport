-- Add vehicle detail columns to emergency_reports table
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS license_plate text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_make text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vehicle_color text;
