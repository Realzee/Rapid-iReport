
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

-- 1. Drop dependencies, policies, and disable RLS to allow type alterations.
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_notification(text, text, text, uuid, text[]) CASCADE;

DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'responders' AND n.nspname = 'public' AND c.relkind = 'v') THEN
      DROP VIEW public.responders CASCADE;
   END IF;
END $$;

DROP POLICY IF EXISTS "Allow authorized profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Allow public read access to recent, active reports" ON public.vehicle_reports;
DROP POLICY IF EXISTS "Allow authorized users to update reports" ON public.vehicle_reports;

ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_reports DISABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
            ALTER TABLE public.profiles ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
            ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user'::public.user_role;
            DROP TYPE public.user_role_enum;
        ELSE
            ALTER TYPE public.user_role_enum RENAME TO user_role;
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_enum') THEN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
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

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'moderator', 'controller', 'responder'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'suspended'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending', 'active', 'assigned', 'in_progress', 'on_scene', 'resolved', 'rejected', 'recovered', 'closed', 'deleted'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low', 'medium', 'high', 'critical'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty', 'available', 'en_route', 'on_scene'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN CREATE TYPE public.announcement_type AS ENUM ('notice', 'alert', 'safety_tip'); END IF;
END$$;

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_role_text text;
BEGIN
  SELECT role::text INTO user_role_text FROM public.profiles WHERE id = p_user_id;
  RETURN COALESCE(user_role_text, 'user');
END; $$;`;

    const handleAttemptFix = async () => {
        setIsFixing(true);
        setFixSuccess(null);
        setFixError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("Authentication failed. Please log in as an administrator first and then refresh this page to try again.");
            }

            const { data, error } = await supabase.functions.invoke('migrate-schema');

            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            
            setFixSuccess(data.message || "The database schema has been successfully updated. Please refresh the application.");

        } catch (e: any) {
            if (e.message && (e.message.includes('401') || e.message.toLowerCase().includes('unauthorized'))) {
                setFixError("Authorization Failed: This action requires Administrator or Moderator permissions.");
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
                        <svg className="h-10 w-10 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="ml-4 flex-grow">
                        <h3 id="error-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Database API Out of Sync</h3>
                        <div className="mt-2 text-md text-gray-600 dark:text-gray-300">
                            <p className="mb-4">The application has detected that its view of the database is out of sync. This typically happens after a database update and requires a schema cache reload.</p>
                             {checkError && <p className="mb-4 text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded-md font-mono text-sm">{checkError}</p>}
                        </div>

                        <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                            <h4 className="font-bold text-lg text-blue-800 dark:text-blue-200">Recommended: Automatic Fix</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 mb-4">If you are an <strong className="font-semibold">Administrator</strong>, click below to update the schema and clear the cache automatically.</p>
                            <button
                                onClick={handleAttemptFix}
                                disabled={isFixing}
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-60"
                            >
                                {isFixing ? 'Applying Fix...' : 'Attempt Automatic Fix'}
                            </button>
                            {fixSuccess && <div className="mt-3 text-sm font-semibold text-green-700 bg-green-500/10 p-3 rounded-md">{fixSuccess}</div>}
                            {fixError && <div className="mt-3 text-sm font-semibold text-red-700 bg-red-500/10 p-3 rounded-md">{fixError}</div>}
                        </div>

                        <div className="mt-8">
                            <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">Part 1: Migration Script (Manual)</h4>
                            <CodeBlock code={sqlPart1} />
                        </div>

                         <div className="mt-8">
                            <button onClick={() => window.location.reload()} className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
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
