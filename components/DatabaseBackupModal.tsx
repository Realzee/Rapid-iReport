import React, { useState } from 'react';
import { XIcon } from './icons';

interface DatabaseBackupModalProps {
    isOpen: boolean;
    onClose: () => void;
    dbHost: string;
}

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="relative bg-gray-100 dark:bg-gray-800/50 p-4 rounded-md border border-gray-200 dark:border-gray-700">
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


const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({ isOpen, onClose, dbHost }) => {
    if (!isOpen) return null;
    
    const backupCommand = `pg_dump "postgresql://postgres:[YOUR_PASSWORD]@${dbHost}:5432/postgres" -f backup.sql`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Create Database Backup</h3>
                <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                    <p>To create a full backup of your database, you will need to use the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">pg_dump</code> command-line tool, which is part of a standard PostgreSQL installation.</p>
                    <ol className="list-decimal list-inside space-y-2">
                        <li>
                            <strong>Install PostgreSQL:</strong> If you don't have it, install PostgreSQL on your local machine to get the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">pg_dump</code> tool.
                        </li>
                        <li>
                            <strong>Get your Database Password:</strong> Go to your Supabase project's <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Database Settings</a> page to find your password.
                        </li>
                        <li>
                            <strong>Run the Command:</strong> Open your terminal or command prompt, navigate to a folder where you want to save the backup, and run the command below. Replace <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">[YOUR_PASSWORD]</code> with your actual database password.
                        </li>
                    </ol>
                    
                    <div>
                        <p className="font-semibold mb-2">Backup Command:</p>
                        <CodeBlock code={backupCommand} />
                    </div>

                    <p>This will create a file named <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">backup.sql</code> in your current directory containing a full snapshot of your database.</p>

                    <p>For more detailed instructions, refer to the official <a href="https://supabase.com/docs/guides/database/backups" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Supabase Backup Documentation</a>.</p>
                </div>
                 <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabaseBackupModal;