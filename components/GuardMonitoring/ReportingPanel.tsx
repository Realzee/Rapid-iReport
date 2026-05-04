import React, { useState } from 'react';

interface ReportingPanelProps {
    data: any;
}

const ReportingPanel: React.FC<ReportingPanelProps> = ({ data }) => {
    const [email, setEmail] = useState('');
    const [frequency, setFrequency] = useState('daily');

    const patrolLogs = data.patrol_logs || [];
    const guards = data.guards || [];
    const checkpoints = data.checkpoints || [];

    const getGuardName = (id: string) => guards.find((g: any) => g.id === id)?.name || 'Unknown';
    const getCheckpointName = (id: string) => checkpoints.find((c: any) => c.id === id)?.name || 'Unknown';

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Reporting & Patrol Logs</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 italic">Patrol Logs</h3>
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-2">Guard</th>
                                    <th className="px-4 py-2">Checkpoint</th>
                                    <th className="px-4 py-2">Time</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patrolLogs.map((log: any) => (
                                    <tr key={log.id} className="border-b dark:border-gray-600">
                                        <td className="px-4 py-2">{getGuardName(log.guard_id)}</td>
                                        <td className="px-4 py-2">{getCheckpointName(log.checkpoint_id)}</td>
                                        <td className="px-4 py-2">{new Date(log.scanned_at).toLocaleString()}</td>
                                        <td className="px-4 py-2 capitalize">{log.verification_status}</td>
                                    </tr>
                                ))}
                                {patrolLogs.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">No logs found</td></tr>}
                            </tbody>
                        </table>
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
