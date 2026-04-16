-- Function to allow global vehicles search across the entire database, bypassing RLS
CREATE OR REPLACE FUNCTION public.global_vehicle_search(search_term text)
RETURNS SETOF public.vehicle_reports
LANGUAGE plpgsql
SECURITY DEFINER -- This ensures the query bypasses RLS
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
