ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'stolen';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'suspicious';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'bolo';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'sought';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'hijacked';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'used_in_commission_of_crime';
