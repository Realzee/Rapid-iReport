-- Migration: Create report_shares table to handle controlled report sharing between companies

CREATE TABLE IF NOT EXISTS public.report_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    report_type text NOT NULL, -- 'crime' | 'vehicle' | 'emergency'
    source_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    target_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_report_target UNIQUE (report_id, target_company_id)
);

-- Enable RLS
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- Row Level Security (RLS) Policies
DROP POLICY IF EXISTS "Allow select for authenticated report_shares" ON public.report_shares;
CREATE POLICY "Allow select for authenticated report_shares" ON public.report_shares 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated report_shares" ON public.report_shares;
CREATE POLICY "Allow insert for authenticated report_shares" ON public.report_shares 
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for authenticated report_shares" ON public.report_shares;
CREATE POLICY "Allow update for authenticated report_shares" ON public.report_shares 
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete for authenticated report_shares" ON public.report_shares;
CREATE POLICY "Allow delete for authenticated report_shares" ON public.report_shares 
    FOR DELETE TO authenticated USING (true);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
