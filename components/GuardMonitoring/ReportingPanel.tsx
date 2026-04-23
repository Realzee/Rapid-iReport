import React, { useState } from 'react';

const ReportingPanel: React.FC = () => {
    const [email, setEmail] = useState('');
    const [frequency, setFrequency] = useState('daily');

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Reporting</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 italic">Live Patrol Feed (Verified Scans)</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        <div className="text-xs text-gray-400">No recent scans detected...</div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Generate Report</h3>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-md w-full">Generate 24h Site Overview</button>
                    </div>

                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Automated Email Reports</h3>
                        <div className="flex flex-col space-y-2">
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter email address"
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-inner"
                            />
                            <div className="flex space-x-2">
                                <select 
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value)}
                                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md flex-1"
                                >
                                    <option value="daily">Daily Digest</option>
                                    <option value="weekly">Weekly Summary</option>
                                    <option value="shift">End of Shift</option>
                                </select>
                                <button className="px-4 py-1 bg-emerald-600 text-white rounded-md">Enable</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportingPanel;
