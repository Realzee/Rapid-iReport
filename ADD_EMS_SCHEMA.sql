CREATE TABLE IF NOT EXISTS public.ems_assessments (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
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
    transport_decision text, -- e.g., 'Transported to Hospital', 'Refused Care', 'Treated and Released'
    receiving_facility text,
    handover_notes text,
    assessed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessed_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ems_assessments ENABLE ROW LEVEL SECURITY;

-- Allow staff to read
CREATE POLICY "Allow staff to read ems assessments" ON public.ems_assessments 
    FOR SELECT 
    USING (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder', 'ras_driver'));

-- Allow staff to insert
CREATE POLICY "Allow staff to insert ems assessments" ON public.ems_assessments 
    FOR INSERT 
    WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller', 'responder', 'ras_driver'));

-- Allow author to update
CREATE POLICY "Allow author to update ems assessments" ON public.ems_assessments 
    FOR UPDATE 
    USING (assessed_by = auth.uid());
