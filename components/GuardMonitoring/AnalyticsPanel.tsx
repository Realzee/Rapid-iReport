import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Site A', patrols: 40, responseTime: 24 },
    { name: 'Site B', patrols: 30, responseTime: 13 },
    { name: 'Site C', patrols: 20, responseTime: 98 },
    { name: 'Site D', patrols: 27, responseTime: 39 },
];

const AnalyticsPanel: React.FC = () => (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analytics</h2>
        
        <div className="h-64">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Patrol Completion Rates</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="patrols" fill="#8884d8" />
                </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="h-64">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Response Times</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="responseTime" fill="#82ca9d" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
);

export default AnalyticsPanel;
