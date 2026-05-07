
-- Add vin_number, engine_number and crime_outcome to crime_reports
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS engine_number text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS crime_outcome text;

-- Add vin_number and engine_number to emergency_reports
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS engine_number text;
