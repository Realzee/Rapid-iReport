
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

            if (error) {
                // The edge function itself might throw a structured error
                if (error.message.includes("Authorization failed")) {
                    throw new Error("Authorization failed. You must be logged in as an administrator to use this feature.");
                } else {
                    throw new Error(error.message);
                }
            }
            
            // The function might return an error in its body if something went wrong internally
            if (data?.error) {
                throw new Error(data.error);
            }
            
            setFixSuccess(data.message || "The database schema has been successfully updated. Please refresh the application.");

        } catch (e: any) {
            setFixError(e.message || "An unknown error occurred during the automatic fix process.");
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
                        <h3 id="error-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Database Update Required</h3>
                        <div className="mt-2 text-md text-gray-600 dark:text-gray-300">
                            <p className="mb-4">The application has detected that your database schema is out of sync. This is causing errors and must be fixed by an administrator.</p>
                             {checkError && <p className="mb-4 text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded-md font-mono text-sm">{checkError}</p>}
                        </div>

                        <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                            <h4 className="font-bold text-lg text-blue-800 dark:text-blue-200">Recommended: Automatic Fix</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 mb-4">If you are logged in as an administrator, click the button below to automatically update the database schema and clear the API cache.</p>
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
                                <li>Run the scripts from **Part 1** and **Part 2** found in the `DATABASE_SCHEMA.md` file.</li>
                                <li>Once both scripts have run successfully, click the "Refresh Application" button below.</li>
                            </ol>
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
