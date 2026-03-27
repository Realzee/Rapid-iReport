-- Update create_staff_notification to accept company_id and only notify relevant staff
DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid, text[]) CASCADE;

CREATE OR REPLACE FUNCTION public.create_staff_notification(
    p_type text,
    p_description text,
    p_severity text,
    p_report_id uuid,
    p_evidence_images text[],
    p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_title text;
BEGIN
    -- Determine title based on table name/type
    IF p_type = 'vehicle_reports' THEN
        v_title := 'New Vehicle Report';
    ELSIF p_type = 'crime_reports' THEN
        v_title := 'New Crime Report';
    ELSE
        v_title := 'New Incident Report';
    END IF;

    -- Notify all staff (admin, moderator, controller) in the same company
    -- Or if p_company_id is NULL, notify global admins (company name like '%rapid911%')
    FOR v_user_id IN 
        SELECT p.id FROM public.profiles p
        LEFT JOIN public.companies c ON p.company_id = c.id
        WHERE p.role IN ('admin', 'moderator', 'controller')
        AND (
            p.company_id = p_company_id 
            OR (p_company_id IS NULL AND (p.company_id IS NULL OR c.name ILIKE '%rapid911%'))
        )
    LOOP
        INSERT INTO public.notifications (
            recipient_user_id,
            type,
            title,
            message,
            reference_id,
            is_read
        ) VALUES (
            v_user_id,
            'new_report',
            v_title || ' (' || p_severity || ')',
            substring(p_description from 1 for 100) || CASE WHEN length(p_description) > 100 THEN '...' ELSE '' END,
            p_report_id,
            false
        );
    END LOOP;
END;
$$;

-- Update the trigger function to pass company_id
CREATE OR REPLACE FUNCTION public.notify_staff_on_new_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_staff_notification(
    TG_TABLE_NAME::text,
    NEW.description,
    NEW.severity::text,
    NEW.id,
    NEW.evidence_images,
    NEW.company_id
  );
  RETURN NEW;
END;
$$;
