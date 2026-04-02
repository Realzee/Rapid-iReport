import React, { useState } from 'react';

const ReportingPanel: React.FC = () => {
    const [email, setEmail] = useState('');
    const [frequency, setFrequency] = useState('daily');

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Reporting</h2>
            
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Generate Report</h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">Generate 24/7 Report</button>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Automated Email Reports</h3>
                <div className="flex space-x-2">
                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="p-2 border border-gray-300 dark:border-gray-600 rounded-md flex-grow"
                    />
                    <select 
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                    >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md">Save</button>
                </div>
            </div>
        </div>
    );
};

export default ReportingPanel;
