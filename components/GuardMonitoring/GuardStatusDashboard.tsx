import React from 'react';
import { Responder, ResponderStatus } from '../../types';
import StatusBadge from '../StatusBadge';
import PatrolScanner from './PatrolScanner';

interface GuardStatusDashboardProps {
    responders: Responder[];
    data: { sites: any[], guards: any[], routes: any[], supervisors: any[], checkpoints: any[] };
}

const GuardStatusDashboard: React.FC<GuardStatusDashboardProps> = ({ responders, data }) => {
    const counts = {
        available: responders.filter(r => r.status === ResponderStatus.AVAILABLE).length,
        enRoute: responders.filter(r => r.status === ResponderStatus.EN_ROUTE).length,
        onScene: responders.filter(r => r.status === ResponderStatus.ON_SCENE).length,
        offDuty: responders.filter(r => r.status === ResponderStatus.OFF_DUTY).length,
    };

    const [isPanicActive, setIsPanicActive] = React.useState(false);

    const handlePanic = () => {
        setIsPanicActive(true);
        // Simulate a system-wide broadcast
        alert('CRITICAL: SOS SIGNAL RECEIVED FROM GUARD! prioritising profile on map.');
        setTimeout(() => setIsPanicActive(false), 5000);
    };

    const handleShiftStart = () => {
        console.log('Shift Started!');
    };

    const handleShiftEnd = () => {
        console.log('Shift Ended!');
    };

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 shadow space-y-4 transition-all duration-500 ${isPanicActive ? 'ring-4 ring-red-600 animate-pulse bg-red-50 dark:bg-red-950/20' : ''}`}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center justify-between">
                <span>Guard Status</span>
                {isPanicActive && <span className="text-xs bg-red-600 text-white px-2 py-1 rounded animate-bounce">SOS ACTIVE</span>}
            </h3>
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

            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Sites: {data.sites?.length || 0}</div>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Guards: {data.guards?.length || 0}</div>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Routes: {data.routes?.length || 0}</div>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Supervisors: {data.supervisors?.length || 0}</div>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">Checkpoints: {data.checkpoints?.length || 0}</div>
            </div>
            
            <div className="mt-4">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">All Guards</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {responders.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="text-sm text-gray-900 dark:text-white">{r.first_name} {r.surname}</span>
                            <StatusBadge status={r.status} />
                        </div>
                    ))}
                </div>
            </div>

            <PatrolScanner guards={data.guards} checkpoints={data.checkpoints} onScanSuccess={() => alert('Scan recorded!')} />

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
