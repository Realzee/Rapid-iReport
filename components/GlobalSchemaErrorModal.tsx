
import React, { useState } from 'react';

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
    const sqlPart1 = `-- RAPID iREPORT - Database Setup Script - PART 1
-- Description: This script migrates old data types and ensures all ENUM types are correct.
-- It MUST be run separately from Part 2.

-- 0. Make sure the 'uuid-ossp' extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 1. MIGRATION: Attempt to rename old '_enum' suffixed types to the correct names.
-- This handles databases created with an older script. It will do nothing if the old types don't exist.
DO $$ BEGIN ALTER TYPE public.user_role_enum RENAME TO user_role; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename user_role_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.user_status_enum RENAME TO user_status; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename user_status_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.report_status_enum RENAME TO report_status; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename report_status_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.severity_enum RENAME TO severity; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename severity_enum (likely OK).'; END $$;
DO $$ BEGIN ALTER TYPE public.responder_status_enum RENAME TO responder_status; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not rename responder_status_enum (likely OK).'; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS public.request_status_enum; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Did not drop request_status_enum (likely OK).'; END $$;


-- 2. Create ENUM types if they don't exist after the migration attempt.
-- This ensures that for a new setup, the types are created correctly.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE public.user_role AS ENUM ('user'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN CREATE TYPE public.user_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN CREATE TYPE public.report_status AS ENUM ('pending'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN CREATE TYPE public.severity AS ENUM ('low'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'responder_status') THEN CREATE TYPE public.responder_status AS ENUM ('off_duty'); END IF;
END$$;

-- 3. Add all possible values to ENUM types to ensure they are fully up-to-date.
-- This part is idempotent and safe to run multiple times.
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
ALTER TYPE public.responder_status ADD VALUE IF NOT EXISTS 'on_scene';`;

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
                             {checkError && <p className="mb-4 text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded-md font-mono text-sm">{checkError}</p>}
                        </div>
                        <div className="mt-4 space-y-6">
                            <div>
                                <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">Instructions</h4>
                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                    <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Supabase Project Dashboard</a> and open the <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">SQL Editor</strong>.</li>
                                    <li>Copy the script from <strong className="text-green-600 dark:text-green-400">Part 1</strong> below and run it in a new query window. This new version includes a migration step to fix old schemas.</li>
                                    <li><strong className="text-red-500">IMPORTANT:</strong> After Part 1 succeeds, open a <strong className="underline">new, separate query window</strong>.</li>
                                    <li>Copy the full script from the `DATABASE_SCHEMA.md` file's <strong className="text-blue-600 dark:text-blue-400">Part 2</strong> and run it in the new window.</li>
                                    <li>Once both scripts have run successfully, click the "Refresh Application" button below.</li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Part 1: Update & Migrate Data Types (Run this first)</h4>
                                <CodeBlock code={sqlPart1} />
                            </div>

                            <div>
                                <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Part 2: Update Tables & Logic (Run this second from `DATABASE_SCHEMA.md`)</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Please copy the full script from the `DATABASE_SCHEMA.md` file in the project. The code below is a summary for reference.</p>
                                <CodeBlock code={"-- Copy the full Part 2 script from DATABASE_SCHEMA.md"} />
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

export default GlobalSchemaErrorModal;
