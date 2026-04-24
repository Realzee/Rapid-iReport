-- ADD RECOVERY LOCATION FIELDS TO VEHICLE REPORTS
ALTER TABLE public.vehicle_reports 
ADD COLUMN IF NOT EXISTS recovered_location_coords jsonb,
ADD COLUMN IF NOT EXISTS recovered_at timestamp with time zone;

-- Update RLS if necessary (usually standard profiles already have read/write)
-- Re-confirming that the column is accessible via the standard select policies is enough for now.
