
# RAPID iREPORT - Complete Supabase Backend Setup

This document provides all the necessary steps and SQL scripts to fully set up the Supabase backend for the RAPID iREPORT application. Follow these instructions carefully.

> [!IMPORTANT]
> **Common Error: "403 Forbidden" or "data not showing"**
> If you are seeing errors related to database permissions or data is not appearing, it means your database is out of sync. Following the steps below will fix this. The scripts are idempotent and safe to run on an existing project.

---

## Step 1: Create Storage Buckets

You need to create four public buckets for storing images and assets.

1.  Navigate to your Supabase Project dashboard and go to **Storage** in the left sidebar.
2.  Create the following buckets, ensuring the **"Public bucket"** switch is toggled ON for each:
    *   `evidence` (for incident-related images)
    *   `avatars` (for user profile pictures)
    *   `company-logos` (for company branding)
    *   `app-assets` (for global application assets like the main logo)

---

## Step 2: Run the Database Schema Script (Two Parts)

This script creates and updates all necessary types, tables, functions, and triggers.

> [!DANGER]
> **CRITICAL SETUP INSTRUCTION: RUN IN TWO SEPARATE STEPS**
>
> The SQL script is divided into **Part 1** and **Part 2**. You **MUST** run these in two separate steps:
>
> 1.  Copy and run **Part 1** in the Supabase SQL Editor.
> 2.  Wait for it to complete successfully.
> 3.  Open a **NEW, SEPARATE** query window, copy and run **Part 2**.

### **Part 1: Update Data Types, Policies & Migrate Old Schema**
*(Copy and run this entire code block first)*

```sql
-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script migrates old data types, ensures all ENUM types are correct, and sets up RLS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Helper function for Edge Function migrations
CREATE OR REPLACE FUNCTION public.eval(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

DROP FUNCTION IF EXISTS public.get_enum_values(text);

CREATE OR REPLACE FUNCTION public.get_enum_values(enum_type_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enum_vals jsonb;
BEGIN
  SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO enum_vals
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = enum_type_name;
  
  RETURN enum_vals;
END;
$$;

-- 1. Drop old functions and policies to allow type alterations.
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid, text[]) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_public_panic_report(text, jsonb) CASCADE;
-- Drop policies to be idempotent
DROP POLICY IF EXISTS "Allow individual user insert" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual user read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual user update" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin and moderator full access" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access" ON public.companies;
DROP POLICY IF EXISTS "Allow admin full access" ON public.companies;
DROP POLICY IF EXISTS "Allow public read of active reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authenticated users to create reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow owners to read their reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow owners to update pending reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow staff and responders to manage reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow users to read their own and company reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow admin and staff to read company reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow responders to read assigned or own reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow users to read own reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow staff to manage company reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow staff to update company reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow staff to delete company reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow public read of active reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow authenticated users to create reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow owners to read their reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow owners to update pending reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow staff and responders to manage reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to read their own and company reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow admin and staff to read company reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow responders to read assigned or own reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to read own reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow staff to manage company reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow staff to update company reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow staff to delete company reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow users to manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow public read access" ON public.announcements;
DROP POLICY IF EXISTS "Allow staff to manage announcements" ON public.announcements;


-- 2. Migrate and create ENUM types if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'moderator', 'controller', 'responder'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'assigned', 'in_progress', 'on_scene', 'resolved', 'rejected', 'recovered', 'closed', 'deleted'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty', 'available', 'en_route', 'on_scene'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN CREATE TYPE public.announcement_type AS ENUM ('notice', 'alert', 'safety_tip'); END IF;
END$$;

-- 3. Update tables with company_id and completion timestamp for multi-tenancy and archiving
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS evidence_images text[];
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS evidence_images text[];
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS cas_number text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS station_name text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS engine_number text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS cas_number text;
ALTER TABLE public.crime_reports ADD COLUMN IF NOT EXISTS station_name text;

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    reference_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Re-create helper functions
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role_text text;
BEGIN
  SELECT role::text INTO user_role_text FROM public.profiles WHERE id = p_user_id;
  RETURN COALESCE(user_role_text, 'user');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_staff_notification(
    p_type text,
    p_description text,
    p_severity text,
    p_report_id uuid,
    p_evidence_images text[]
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

    -- Notify all staff (admin, moderator, controller)
    FOR v_user_id IN 
        SELECT id FROM public.profiles 
        WHERE role IN ('admin', 'moderator', 'controller')
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
            p_description,
            p_report_id,
            false
        );
    END LOOP;
END;
$$;

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
    NEW.evidence_images
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vehicle_report_created ON public.vehicle_reports;
CREATE TRIGGER on_vehicle_report_created
  AFTER INSERT ON public.vehicle_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_report();

DROP TRIGGER IF EXISTS on_crime_report_created ON public.crime_reports;
CREATE TRIGGER on_crime_report_created
  AFTER INSERT ON public.crime_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_report();

-- 5. Trigger to auto-set company_id on new reports
CREATE OR REPLACE FUNCTION public.set_report_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.company_id := (SELECT company_id FROM public.profiles WHERE id = NEW.reported_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vehicle_report_insert ON public.vehicle_reports;
CREATE TRIGGER on_vehicle_report_insert
  BEFORE INSERT ON public.vehicle_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_report_company_id();
  
DROP TRIGGER IF EXISTS on_crime_report_insert ON public.crime_reports;
CREATE TRIGGER on_crime_report_insert
  BEFORE INSERT ON public.crime_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_report_company_id();

-- 6. Backfill company_id for existing reports
UPDATE public.vehicle_reports v SET company_id = p.company_id FROM public.profiles p WHERE v.reported_by = p.id AND v.company_id IS NULL;
UPDATE public.crime_reports c SET company_id = p.company_id FROM public.profiles p WHERE c.reported_by = p.id AND c.company_id IS NULL;

-- 7. Set up Row Level Security (RLS) policies
-- Enable RLS for all relevant tables first
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow individual user insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Allow individual user read access" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow individual user update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow admin and moderator full access" ON public.profiles FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- Companies Policies
CREATE POLICY "Allow public read access" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Allow admin full access" ON public.companies FOR ALL USING (get_user_role(auth.uid()) = 'admin') WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Vehicle Reports Policies
CREATE POLICY "Allow public read of active reports" ON public.vehicle_reports FOR SELECT TO anon USING (status = 'active'::public.report_status);
CREATE POLICY "Allow authenticated users to create reports" ON public.vehicle_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Allow owners to update pending reports" ON public.vehicle_reports FOR UPDATE TO authenticated USING (auth.uid() = reported_by AND status = 'pending'::public.report_status) WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Allow admin and staff to read company reports" ON public.vehicle_reports FOR SELECT USING ((get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())));
CREATE POLICY "Allow responders to read assigned or own reports" ON public.vehicle_reports FOR SELECT USING ((get_user_role(auth.uid()) = 'responder' AND (auth.uid() = reported_by OR auth.uid() = assigned_to)));
CREATE POLICY "Allow users to read own reports" ON public.vehicle_reports FOR SELECT USING ((get_user_role(auth.uid()) = 'user' AND auth.uid() = reported_by));
CREATE POLICY "Allow staff to update company reports" ON public.vehicle_reports FOR UPDATE USING ((get_user_role(auth.uid()) = 'admin') OR (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())) OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to));
CREATE POLICY "Allow staff to delete company reports" ON public.vehicle_reports FOR DELETE USING ((get_user_role(auth.uid()) = 'admin') OR (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())) OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to));

-- Crime Reports Policies
CREATE POLICY "Allow public read of active reports" ON public.crime_reports FOR SELECT TO anon USING (status = 'active'::public.report_status);
CREATE POLICY "Allow authenticated users to create reports" ON public.crime_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Allow owners to update pending reports" ON public.crime_reports FOR UPDATE TO authenticated USING (auth.uid() = reported_by AND status = 'pending'::public.report_status) WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Allow admin and staff to read company reports" ON public.crime_reports FOR SELECT USING ((get_user_role(auth.uid()) IN ('admin', 'moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())));
CREATE POLICY "Allow responders to read assigned or own reports" ON public.crime_reports FOR SELECT USING ((get_user_role(auth.uid()) = 'responder' AND (auth.uid() = reported_by OR auth.uid() = assigned_to)));
CREATE POLICY "Allow users to read own reports" ON public.crime_reports FOR SELECT USING ((get_user_role(auth.uid()) = 'user' AND auth.uid() = reported_by));
CREATE POLICY "Allow staff to update company reports" ON public.crime_reports FOR UPDATE USING ((get_user_role(auth.uid()) = 'admin') OR (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())) OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to));
CREATE POLICY "Allow staff to delete company reports" ON public.crime_reports FOR DELETE USING ((get_user_role(auth.uid()) = 'admin') OR (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())) OR (get_user_role(auth.uid()) = 'responder' AND auth.uid() = assigned_to));


-- Notifications Policies
CREATE POLICY "Allow users to manage their own notifications" ON public.notifications FOR ALL USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);

-- Announcements Policies
CREATE POLICY "Allow public read access" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Allow staff to manage announcements" ON public.announcements FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'moderator')) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'moderator'));

```

### **Part 2: Automatic Profile Creation Trigger**
*(After Part 1 completes, copy and run this entire code block in a NEW query window)*
```sql
-- RAPID iREPORT - Database Setup Script - PART 2
-- Description: This script creates a trigger to automatically create a user profile
-- upon new user signup, preventing missing profile errors.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert a new profile record, pulling metadata from the new auth.users record.
  -- Use COALESCE to provide default values for NOT NULL columns if metadata is missing.
  INSERT INTO public.profiles (
      id, 
      email, 
      first_name, 
      surname, 
      role, 
      status, 
      company_id, 
      cell, 
      vehicle_reg, 
      home_address, 
      ice_no, 
      medical_aid, 
      psira_number
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'first_name', 'New'),
    COALESCE(new.raw_user_meta_data ->> 'surname', 'User'),
    'user', -- Default role for all new signups
    'pending', -- All new users must be approved by an admin
    (new.raw_user_meta_data ->> 'company_id')::uuid,
    new.raw_user_meta_data ->> 'cell',
    new.raw_user_meta_data ->> 'vehicle_reg',
    new.raw_user_meta_data ->> 'home_address',
    new.raw_user_meta_data ->> 'ice_no',
    new.raw_user_meta_data ->> 'medical_aid',
    new.raw_user_meta_data ->> 'psira_number'
  );
  RETURN new;
END;
$$;

-- Company Sequences for OB Numbers
CREATE TABLE IF NOT EXISTS public.company_sequences (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_sequence INTEGER DEFAULT 0
);

-- Function to get next OB sequence
CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  INSERT INTO public.company_sequences (company_id, last_sequence)
  VALUES (p_company_id, 1)
  ON CONFLICT (company_id)
  DO UPDATE SET last_sequence = public.company_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_seq;
  
  RETURN next_seq;
END;
$$;

-- Create the trigger that executes the function after a new user is inserted.
-- We use CREATE OR REPLACE to ensure it can be run multiple times safely.
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- We also create a trigger to ensure email consistency on update
CREATE OR REPLACE FUNCTION public.update_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = new.email
  WHERE id = new.id;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (old.email IS DISTINCT FROM new.email)
  EXECUTE FUNCTION public.update_profile_email();

```


### **Part 3: Emergency Reports Setup**
*(Run this in a NEW query window to enable Emergency Reporting)*
```sql
-- RAPID iREPORT - Emergency Reports Database Schema
-- Run this in the Supabase SQL Editor to enable emergency reporting.

-- 1. Create the emergency_reports table
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ob_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    emergency_type text NOT NULL,
    severity public.severity NOT NULL,
    status public.report_status NOT NULL,
    reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    location_coords jsonb,
    evidence_images text[],
    vehicle_involved boolean DEFAULT false,
    vehicles_involved integer DEFAULT 0,
    injuries_reported boolean DEFAULT false,
    fatalities_reported boolean DEFAULT false,
    deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at timestamp with time zone
);

-- 2. Enable RLS
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Users read own emergency reports" ON public.emergency_reports;
CREATE POLICY "Users read own emergency reports" ON public.emergency_reports FOR SELECT USING (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Users create emergency reports" ON public.emergency_reports;
CREATE POLICY "Users create emergency reports" ON public.emergency_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Staff manage company emergency reports" ON public.emergency_reports;
CREATE POLICY "Staff manage company emergency reports" ON public.emergency_reports FOR ALL USING (
    get_user_role(auth.uid()) = 'admin' OR 
    (get_user_role(auth.uid()) IN ('moderator', 'controller') AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

-- 4. Update the OB Sequence Function to include emergency reports
CREATE OR REPLACE FUNCTION public.get_next_ob_sequence(p_company_id uuid, p_report_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    report_month integer := extract(month from p_report_date);
    report_year integer := extract(year from p_report_date);
    total_count integer;
BEGIN
    SELECT count(*) INTO total_count
    FROM (
        SELECT id FROM public.vehicle_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        UNION ALL
        SELECT id FROM public.crime_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
        UNION ALL
        SELECT id FROM public.emergency_reports WHERE extract(year from reported_at) = report_year AND extract(month from reported_at) = report_month
    ) AS combined;
    RETURN total_count + 1;
END;
$$;

-- 5. Add trigger for emergency reports OB number company_id auto-set
DROP TRIGGER IF EXISTS on_emergency_report_insert ON public.emergency_reports;
CREATE TRIGGER on_emergency_report_insert
  BEFORE INSERT ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_report_company_id();

-- 6. Add trigger for notifications on new emergency reports
DROP TRIGGER IF EXISTS on_emergency_report_created ON public.emergency_reports;
CREATE TRIGGER on_emergency_report_created
  AFTER INSERT ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff_on_new_report();
```

---

## Step 3: Deploy Supabase Edge Functions

(Instructions in original file...)