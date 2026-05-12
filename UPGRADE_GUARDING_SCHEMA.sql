-- Upgrade script to add missing columns if they don't exist
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.supervisors ADD COLUMN IF NOT EXISTS profile_pic_url text;

ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS psira_number text;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS psira_expiry_date date;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS next_of_kin_contact text;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS profile_pic_url text;

ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE;
ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS qr_code text;
ALTER TABLE public.checkpoints ALTER COLUMN route_id DROP NOT NULL;

