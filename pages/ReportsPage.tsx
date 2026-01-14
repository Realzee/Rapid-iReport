import React from 'react';
import { CrimeIcon } from '../components/icons';

const ReportsPage: React.FC = () => {
    return (
        <div className="container mx-auto h-full flex flex-col items-center justify-center text-center">
            <CrimeIcon className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Reports View</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">A detailed table view of all reports will be available here soon.</p>
        </div>
    );
};

export default ReportsPage;
