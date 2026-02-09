import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { LegacyObEntry } from '../types';
import { DatabaseIcon } from './icons';

interface LegacyObLogProps {
    onRowClick: (entry: LegacyObEntry) => void;
}


const LegacyObLog: React.FC<LegacyObLogProps> = ({ onRowClick }) => {
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

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="bg-red-500/10 p-3 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    <p className="font-bold">Error Loading Legacy Data</p>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (legacyData.length === 0) {
        return (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No legacy data found.</p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm z-10">
                    <tr>
                        <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OB#</th>
                        <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
                        <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
                    {legacyData.map((entry) => (
                        <tr key={entry.obNumber} className="hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => onRowClick(entry)}>
                            <td className="px-2 py-3 font-mono whitespace-nowrap">{entry.obNumber}</td>
                            <td className="px-2 py-3">{entry.details}</td>
                            <td className="px-2 py-3 whitespace-nowrap">{entry.timestamp}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default LegacyObLog;