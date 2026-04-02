import React from 'react';
import { Responder, ResponderStatus } from '../../types';
import StatusBadge from '../StatusBadge';

interface GuardStatusDashboardProps {
    responders: Responder[];
}

const GuardStatusDashboard: React.FC<GuardStatusDashboardProps> = ({ responders }) => {
    const counts = {
        available: responders.filter(r => r.status === ResponderStatus.AVAILABLE).length,
        enRoute: responders.filter(r => r.status === ResponderStatus.EN_ROUTE).length,
        onScene: responders.filter(r => r.status === ResponderStatus.ON_SCENE).length,
        offDuty: responders.filter(r => r.status === ResponderStatus.OFF_DUTY).length,
    };

    const handlePanic = () => {
        // TODO: Implement panic alert logic
        console.log('Panic Alert Triggered!');
    };

    const handleShiftStart = () => {
        // TODO: Implement shift start logic
        console.log('Shift Started!');
    };

    const handleShiftEnd = () => {
        // TODO: Implement shift end logic
        console.log('Shift Ended!');
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Guard Status</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Available</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{counts.available}</p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">En Route</p>
                    <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{counts.enRoute}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                    <p className="text-sm text-amber-600 dark:text-amber-400">On Scene</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{counts.onScene}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Off Duty</p>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{counts.offDuty}</p>
                </div>
            </div>
            <div className="flex gap-2 pt-2">
                <button 
                    onClick={handlePanic}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition"
                >
                    PANIC
                </button>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handleShiftStart}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
                >
                    Start Shift
                </button>
                <button 
                    onClick={handleShiftEnd}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition"
                >
                    End Shift
                </button>
            </div>
        </div>
    );
};

export default GuardStatusDashboard;
