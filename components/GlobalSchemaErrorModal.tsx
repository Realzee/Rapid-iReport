
import React from 'react';

const GlobalSchemaErrorModal: React.FC = () => {
    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true" aria-labelledby="error-modal-title">
            <div className="bg-white dark:bg-gray-900 border border-yellow-500/50 dark:border-yellow-400/50 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all p-8">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-10 w-10 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-4">
                        <h3 id="error-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Administrator Action Required</h3>
                        <div className="mt-2 text-md text-gray-600 dark:text-gray-300">
                            <p className="mb-4">The application has detected that the database API is out of sync. This is a common Supabase issue that must be resolved by a project administrator before the application can function correctly.</p>
                        </div>
                        <div className="mt-4 bg-gray-100 dark:bg-gray-800/50 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                            <p className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Instructions for Supabase Administrators:</p>
                            <ol className="list-decimal list-inside space-y-2 text-sm">
                                <li>Navigate to your <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">Supabase Project Dashboard</strong>.</li>
                                <li>In the left sidebar, click the <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">API Docs</strong> icon (&lt;&gt;).</li>
                                <li>From the list on the left, select the <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">`public`</strong> schema.</li>
                                <li>At the top-right of the page, click the <strong className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">"Reload schema"</strong> button.</li>
                            </ol>
                        </div>
                         <div className="mt-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400">After reloading the schema in Supabase, click the button below to refresh the application.</p>
                            <button
                                onClick={handleRefresh}
                                className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900 focus:ring-blue-500"
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
