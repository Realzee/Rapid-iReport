import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { LegacyObEntry } from '../types';
import { DatabaseIcon } from './icons';

const LegacyObLog: React.FC = () => {
    const [legacyData, setLegacyData] = useState<LegacyObEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLegacyData = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error: functionError } = await supabase.functions.invoke('fetch-legacy-ob');

                if (functionError) {
                    if (functionError.message.includes('Function not found')) {
                         throw new Error("The 'fetch-legacy-ob' Supabase function is not deployed. Please follow the deployment instructions provided by the developer.");
                    }
                    throw functionError;
                }

                if (data.error) {
                    throw new Error(data.error);
                }
                
                setLegacyData(data);
            } catch (e: any) {
                console.error("Failed to fetch legacy OB data:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLegacyData();
    }, []);

    return (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700/50">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <DatabaseIcon className="w-5 h-5" />
                Legacy OB Log
            </h2>
            <div>
                {loading && (
                    <div className="flex justify-center items-center py-8">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                {error && (
                    <div className="bg-red-500/10 p-3 rounded-lg text-red-700 dark:text-red-300 text-sm">
                        <p className="font-bold">Error Loading Legacy Data</p>
                        <p>{error}</p>
                    </div>
                )}
                {!loading && !error && legacyData.length === 0 && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No legacy data found.</p>
                )}
                {!loading && !error && legacyData.length > 0 && (
                     <table className="min-w-full text-sm">
                        <thead className="sticky top-0 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm">
                            <tr>
                                <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OB#</th>
                                <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
                                <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
                            {legacyData.map((entry) => (
                                <tr key={entry.obNumber} className="hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                    <td className="px-2 py-2 font-mono whitespace-nowrap">{entry.obNumber}</td>
                                    <td className="px-2 py-2">{entry.details}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{entry.timestamp}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default LegacyObLog;