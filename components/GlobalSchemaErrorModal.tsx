import React, { useState } from 'react';
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

interface GlobalSchemaErrorModalProps {
    checkError: string | null;
}

const GlobalSchemaErrorModal: React.FC<GlobalSchemaErrorModalProps> = ({ checkError }) => {
    const [isFixing, setIsFixing] = useState(false);
    const [fixSuccess, setFixSuccess] = useState<string | null>(null);
    const [fixError, setFixError] = useState<string | null>(null);
    
    const sqlPart1 = `-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script migrates old data types and ensures all ENUM types are correct.
-- It MUST be run separately from Part 2.

-- 0. Make sure the 'uuid-ossp' extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 1. Drop dependencies, policies, and disable RLS to allow type alterations.
-- Using CASCADE will also drop dependent RLS policies and trigger functions. They will be recreated in Part 2.
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid, text[]) CASCADE;

-- Defensively drop legacy 'responders' view/table which creates a dependency lock on responder_status_enum.
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'v') THEN
      DROP VIEW public.responders CASCADE;
   END IF;
END $$;
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'r') THEN
      DROP TABLE public.responders CASCADE;
   END IF;
END $$;

-- Drop specific problematic policies from older schema versions that can cause a dependency lock.
DROP POLICY IF EXISTS "Allow system to insert new user notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow system to insert new report notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow system to insert new registration notifications" ON public.notifications;

-- Explicitly drop policies that depend on columns whose types are being altered.
-- These will be recreated correctly in Part 2.
DROP POLICY IF EXISTS "Allow authorized profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can delete profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.vehicle_reports;


-- Temporarily disable RLS on tables that will be altered or have dependencies.
-- This releases any remaining dependency locks. RLS will be re-enabled in Part 2.
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports DISABLE ROW LEVEL SECURITY;

-- 2. Robustly migrate ENUM types from old "_enum" suffix to new names.
-- This block handles renaming if possible, or migrating columns and dropping the old type if a name conflict exists.

-- Migrate user_role
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            RAISE NOTICE 'Conflict found for user_role. Migrating column...';
            ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
            ALTER TABLE public.profiles ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
            ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user'::public.user_role;
            DROP TYPE public.user_role_enum;
        ELSE
            ALTER TYPE public.user_role_enum RENAME TO user_role;
        END IF;
    END IF;
END $$;

-- Migrate user_status
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
            RAISE NOTICE 'Conflict found for user_status. Migrating column...';
            ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;
            ALTER TABLE public.profiles ALTER COLUMN status TYPE public.user_status USING status::text::public.user_status;
            ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending'::public.user_status;
            DROP TYPE public.user_status_enum;
        ELSE
            ALTER TYPE public.user_status_enum RENAME TO user_status;
        END IF;
    END IF;
END $$;

-- Migrate report_status
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
            RAISE NOTICE 'Conflict found for report_status. Migrating columns...';
            ALTER TABLE public.vehicle_reports ALTER COLUMN status DROP DEFAULT;
            ALTER TABLE public.crime_reports ALTER COLUMN status DROP DEFAULT;
            ALTER TABLE public.vehicle_reports ALTER COLUMN status TYPE public.report_status USING status::text::public.report_status;
            ALTER TABLE public.crime_reports ALTER COLUMN status TYPE public.report_status USING status::text::public.report_status;
            DROP TYPE public.report_status_enum;
        ELSE
            ALTER TYPE public.report_status_enum RENAME TO report_status;
        END IF;
    END IF;
END $$;

-- Migrate severity
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN
            RAISE NOTICE 'Conflict found for severity. Migrating columns...';
            ALTER TABLE public.vehicle_reports ALTER COLUMN severity DROP DEFAULT;
            ALTER TABLE public.crime_reports ALTER COLUMN severity DROP DEFAULT;
            ALTER TABLE public.vehicle_reports ALTER COLUMN severity TYPE public.severity USING severity::text::public.severity;
            ALTER TABLE public.crime_reports ALTER COLUMN severity TYPE public.severity USING severity::text::public.severity;
            DROP TYPE public.severity_enum;
        ELSE
            ALTER TYPE public.severity_enum RENAME TO severity;
        END IF;
    END IF;
END $$;

-- Migrate responder_status
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN
            RAISE NOTICE 'Conflict found for responder_status. Migrating column...';
            ALTER TABLE public.profiles ALTER COLUMN responder_status TYPE public.responder_status USING responder_status::text::public.responder_status;
            DROP TYPE public.responder_status_enum;
        ELSE
            ALTER TYPE public.responder_status_enum RENAME TO responder_status;
        END IF;
    END IF;
END $$;

-- Drop deprecated type if it exists
DROP TYPE IF EXISTS public.request_status_enum;


-- 3. Create ENUM types if they don't exist after the migration attempt.
-- This ensures that for a new setup, the types are created correctly.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty'); END IF;
END$$;

-- 4. Add all possible values to ENUM types to ensure they are fully up-to-date.
-- This part is idempotent and safe to run multiple times. This will fix the "invalid input for enum" error.
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
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'deleted';

-- For backward compatibility, also ensure all values exist on the legacy enum type if it hasn't been migrated yet.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_enum') THEN
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'active';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'assigned';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'in_progress';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'on_scene';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'resolved';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'rejected';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'recovered';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'closed';
        ALTER TYPE public.report_status_enum ADD VALUE IF NOT EXISTS 'deleted';
    END IF;
END$$;

ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'critical';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE public.severity ADD VALUE IF NOT EXISTS 'medium';

ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'on_scene';

-- 5. Re-create the get_user_role function that was dropped.
-- The other dropped items (policies, triggers, etc.) will be recreated in Part 2.
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role_text text;
BEGIN
  SELECT role::text INTO user_role_text FROM public.profiles WHERE id = p_user_id;
  RETURN user_role_text;
END;
$$;`;

    const handleAttemptFix = async () => {
        setIsFixing(true);
        setFixSuccess(null);
        setFixError(null);

        try {
            // @ts-ignore - FIX: Property 'getSession' does not exist on type 'SupabaseAuthClient'. Using older version syntax.
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("Authentication failed. Please log in as an administrator first and then refresh this page to try again.");
            }

            const { data, error } = await supabase.functions.invoke('migrate-schema');

            if (error) {
                throw error;
            }
            
            // The function might return an error in its body if something went wrong internally
            if (data?.error) {
                throw new Error(data.error);
            }
            
            setFixSuccess(data.message || "The database schema has been successfully updated. Please refresh the application.");

        } catch (e: any) {
            if (e.message && (e.message.includes('401') || e.message.toLowerCase().includes('unauthorized'))) {
                setFixError("Authorization Failed: This action requires Administrator or Moderator permissions. Please log in with an authorized account and try again.");
            } else {
                setFixError(e.message || "An unknown error occurred during the automatic fix process.");
            }
        } finally {
            setIsFixing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true" aria-labelledby="error-modal-title">
            <div className="bg-white dark:bg-gray-900 border border-yellow-500/50 dark:border-yellow-400/50 rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-10 w-10 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="ml-4 flex-grow">
                        <h3 id="error-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Database API Out of Sync</h3>
                        <div className="mt-2 text-md text-gray-600 dark:text-gray-300">
                            <p className="mb-4">The application has detected that its view of the database is out of sync. This is typically due to a stale API cache on the server after a database update and must be resolved by an administrator.</p>
                             {checkError && <p className="mb-4 text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded-md font-mono text-sm">{checkError}</p>}
                        </div>

                        <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                            <h4 className="font-bold text-lg text-blue-800 dark:text-blue-200">Recommended: Automatic Fix</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 mb-4">If you are logged in as an <strong className="font-semibold">Administrator</strong> or <strong className="font-semibold">Moderator</strong>, click the button below to automatically update the schema and clear the API cache.</p>
                            <button
                                onClick={handleAttemptFix}
                                disabled={isFixing}
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-100 dark:focus:ring-offset-gray-900 focus:ring-blue-500 disabled:opacity-60"
                            >
                                {isFixing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> : null}
                                {isFixing ? 'Applying Fix...' : 'Attempt Automatic Fix'}
                            </button>
                            {fixSuccess && <div className="mt-3 text-sm font-semibold text-green-700 dark:text-green-300 bg-green-500/10 p-3 rounded-md">{fixSuccess}</div>}
                            {fixError && <div className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300 bg-red-500/10 p-3 rounded-md">{fixError}</div>}
                        </div>

                        <div className="mt-8">
                            <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">Manual Fallback</h4>
                             <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <li>If the automatic fix fails, go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Supabase Project Dashboard</a> and open the <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">SQL Editor</strong>.</li>
                                <li>Run the scripts from **Part 1** and **Part 2** found in the `DATABASE_SCHEMA.md` file to ensure the schema is correct.</li>
                                <li><strong className="text-yellow-600 dark:text-yellow-300">Most importantly:</strong> If the error persists, you must restart your project to clear the API cache. Go to <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">Project Settings &gt; General</strong> and click "Restart Project".</li>
                                <li>Once the project has restarted, click the "Refresh Application" button below.</li>
                            </ol>
                        </div>
                        
                        <div className="mt-4">
                            <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">Part 1: Migration Script (for manual copy)</h4>
                            <CodeBlock code={sqlPart1} />
                        </div>


                         <div className="mt-8">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900 focus:ring-blue-500"
                            >
                                Refresh Application
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalSchemaErrorModal;
