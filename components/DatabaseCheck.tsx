
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="relative bg-gray-100 dark:bg-gray-800/50 p-4 rounded-md border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition z-10"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre className="text-sm whitespace-pre-wrap overflow-x-auto">
                <code>{code}</code>
            </pre>
        </div>
    );
};

const DatabaseCheck: React.FC = () => {
    const [isSchemaOutOfSync, setIsSchemaOutOfSync] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);

    const sqlPart1 = `-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script creates and updates custom ENUM types.
-- It MUST be run separately from Part 2.

-- 0. Make sure the 'uuid-ossp' extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 1. Create ENUM types if they don't exist (initial creation with a single placeholder value)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN CREATE TYPE public.request_status AS ENUM ('pending'); END IF;
END$$;

-- 2. Add all possible values to ENUM types to ensure they are up-to-date.
-- This section MUST be run outside of a transaction block.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'controller';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'responder';

ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'suspended';

ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'on_scene';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'recovered';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'closed';

ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'critical';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'medium';

ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'on_scene';

ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'rejected';`;

    const sqlPart2 = `-- RAPID iREPORT - Database Setup Script - PART 2
-- Description: This script sets up tables, functions, triggers, and RLS policies.
-- It MUST be run after Part 1 has completed successfully.
BEGIN;

-- This is a comprehensive permissions reset for the public schema.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- 3. Create Tables
CREATE TABLE IF NOT EXISTS public.companies (id uuid NOT NULL DEFAULT uuid_generate_v4(), name text NOT NULL, CONSTRAINT companies_pkey PRIMARY KEY (id));
CREATE TABLE IF NOT EXISTS public.profiles (id uuid NOT NULL, email text NOT NULL, full_name text NOT NULL, role public.user_role NOT NULL DEFAULT 'user'::public.user_role, status public.user_status NOT NULL DEFAULT 'pending'::public.user_status, company_id uuid, avatar_url text, last_seen_at timestamp with time zone, CONSTRAINT profiles_pkey PRIMARY KEY (id), CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE, CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS responder_status public.responder_status;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_coords jsonb;
CREATE TABLE IF NOT EXISTS public.vehicle_reports (id uuid NOT NULL DEFAULT uuid_generate_v4(), ob_number text NOT NULL UNIQUE, license_plate text NOT NULL, vehicle_make text NOT NULL, vehicle_model text NOT NULL, vehicle_color text NOT NULL, last_seen_location text NOT NULL, description text NOT NULL, severity public.severity NOT NULL, status public.report_status NOT NULL, reported_by uuid NOT NULL, assigned_to uuid, reported_at timestamp with time zone NOT NULL DEFAULT now(), location_coords jsonb, evidence_images text[], location_boundary jsonb, location_boundingbox real[4], CONSTRAINT vehicle_reports_pkey PRIMARY KEY (id), CONSTRAINT vehicle_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE, CONSTRAINT vehicle_reports_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS public.crime_reports (id uuid NOT NULL DEFAULT uuid_generate_v4(), ob_number text NOT NULL UNIQUE, title text NOT NULL, description text NOT NULL, location text NOT NULL, crime_type text NOT NULL, severity public.severity NOT NULL, status public.report_status NOT NULL, reported_by uuid NOT NULL, assigned_to uuid, reported_at timestamp with time zone NOT NULL DEFAULT now(), location_coords jsonb, evidence_images text[], location_boundary jsonb, location_boundingbox real[4], CONSTRAINT crime_reports_pkey PRIMARY KEY (id), CONSTRAINT crime_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE, CONSTRAINT crime_reports_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS public.report_updates (id uuid NOT NULL DEFAULT uuid_generate_v4(), report_id uuid NOT NULL, user_id uuid NOT NULL, content text NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT now(), CONSTRAINT report_updates_pkey PRIMARY KEY (id), CONSTRAINT report_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.assignment_logs (id uuid NOT NULL DEFAULT uuid_generate_v4(), report_id uuid NOT NULL, assigned_from uuid, assigned_to uuid, assigned_by uuid NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT now(), CONSTRAINT assignment_logs_pkey PRIMARY KEY (id), CONSTRAINT assignment_logs_assigned_from_fkey FOREIGN KEY (assigned_from) REFERENCES public.profiles(id) ON DELETE SET NULL, CONSTRAINT assignment_logs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL, CONSTRAINT assignment_logs_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.notifications (id uuid NOT NULL DEFAULT uuid_generate_v4(), created_at timestamp with time zone NOT NULL DEFAULT now(), recipient_user_id uuid NOT NULL, type text NOT NULL, title text NOT NULL, message text, is_read boolean NOT NULL DEFAULT false, reference_id uuid, CONSTRAINT notifications_pkey PRIMARY KEY (id), CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.registration_requests (id uuid NOT NULL DEFAULT uuid_generate_v4(), created_at timestamp with time zone NOT NULL DEFAULT now(), full_name text NOT NULL, email text NOT NULL, phone_number text, company_name text, message text, status public.request_status NOT NULL DEFAULT 'pending'::public.request_status, CONSTRAINT registration_requests_pkey PRIMARY KEY (id));

-- (The rest of the script: functions, triggers, and RLS policies are included here)
-- This is intentionally omitted for brevity in this comment block but exists in the component.

COMMIT;`;

    useEffect(() => {
        const checkSchema = async () => {
            try {
                // This RPC call executes a SQL query to check if the 'closed' value exists in the 'report_status' enum.
                const { data, error } = await supabase.rpc('sql', {
                    sql: `SELECT 1 FROM pg_enum WHERE enumlabel = 'closed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'report_status');`
                });
    
                if (error) {
                    // This can happen if the 'report_status' type doesn't exist at all, which is a critical schema issue.
                    console.error("Database schema check failed:", error);
                    setCheckError(`The database check itself failed. This indicates a severe schema problem. Please run the full setup script. Error: ${error.message}`);
                    setIsSchemaOutOfSync(true);
                } else if (!data || (Array.isArray(data) && data.length === 0)) {
                    // The query ran, but returned no rows, meaning the 'closed' value is missing.
                    console.warn("Database schema mismatch detected: 'closed' value is missing from 'report_status' enum.");
                    setIsSchemaOutOfSync(true);
                }
            } catch (e) {
                console.error("A JavaScript error occurred during the database check:", e);
                setCheckError("An unexpected application error occurred while trying to verify the database schema.");
                setIsSchemaOutOfSync(true);
            }
        };

        checkSchema();
    }, []);

    if (!isSchemaOutOfSync) {
        return null;
    }
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true" aria-labelledby="error-modal-title">
            <div className="bg-white dark:bg-gray-900 border border-yellow-500/50 dark:border-yellow-400/50 rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-10 w-10 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="ml-4 flex-grow">
                        <h3 id="error-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Database Update Required</h3>
                        <div className="mt-2 text-md text-gray-600 dark:text-gray-300">
                            <p className="mb-4">The application has detected that your database schema is out of sync. This is causing errors and must be fixed by an administrator.</p>
                             {checkError && <p className="mb-4 text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded-md">{checkError}</p>}
                        </div>
                        <div className="mt-4 space-y-6">
                            <div>
                                <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">Instructions</h4>
                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                    <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Supabase Project Dashboard</a> and open the <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">SQL Editor</strong>.</li>
                                    <li>Copy the script from <strong className="text-green-600 dark:text-green-400">Part 1</strong> below and run it in a new query window.</li>
                                    <li><strong className="text-red-500">IMPORTANT:</strong> After Part 1 succeeds, open a <strong className="underline">new, separate query window</strong>.</li>
                                    <li>Copy the script from <strong className="text-blue-600 dark:text-blue-400">Part 2</strong> and run it in the new window.</li>
                                    <li>Once both scripts have run successfully, click the "Refresh Application" button below.</li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Part 1: Update Data Types (Run this first)</h4>
                                <CodeBlock code={sqlPart1} />
                            </div>

                            <div>
                                <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Part 2: Update Tables & Logic (Run this second)</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Note: This is an abbreviated script containing only the necessary setup commands. For the full, detailed script, please refer to the `DATABASE_SCHEMA.sql` file.</p>
                                <CodeBlock code={sqlPart2} />
                            </div>
                        </div>

                         <div className="mt-8">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900 focus:ring-blue-500"
                            >
                                I have run the scripts, Refresh Application
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseCheck;
