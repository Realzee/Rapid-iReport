-- Add location column to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_in_location TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_out_location TEXT;
