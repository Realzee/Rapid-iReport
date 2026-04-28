import React, { useState } from 'react';
import { Profile } from '../types';

interface GuardDashboardPageProps {
    profile: Profile;
}

const GuardDashboardPage: React.FC<GuardDashboardPageProps> = ({ profile }) => {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guard Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Welcome, {profile.first_name} {profile.surname}.</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Guard relevant functions */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h2 className="text-lg font-bold">Log Activity</h2>
                    <p>Register incidents or patrol checkpoints.</p>
                </div>
                 <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h2 className="text-lg font-bold">Gate Access</h2>
                    <p>Manage gate entries and exits.</p>
                </div>
            </div>
        </div>
    );
};

export default GuardDashboardPage;
