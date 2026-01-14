
import React from 'react';
import { Responder, ResponderStatus } from '../types';

interface ResponderStatusPanelProps {
    responders: Responder[];
}

const ResponderStatusPanel: React.FC<ResponderStatusPanelProps> = ({ responders }) => {
    const statusCounts = responders.reduce((acc, responder) => {
        if (responder.status === ResponderStatus.AVAILABLE) {
            acc.available++;
        } else if (responder.status !== ResponderStatus.OFF_DUTY) {
            acc.busy++;
        }
        return acc;
    }, { available: 0, busy: 0 });

    const totalAssignments = responders.filter(r => r.status === ResponderStatus.EN_ROUTE || r.status === ResponderStatus.ON_SCENE).length;
    const totalResponders = responders.filter(r => r.status !== ResponderStatus.OFF_DUTY).length;

    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex-shrink-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Responder Status</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full mr-2"></span>
                    <span className="font-semibold mr-2">{statusCounts.available}</span>
                    <span className="text-gray-500 dark:text-gray-400">Available</span>
                </div>
                 <div className="flex items-center">
                    <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full mr-2"></span>
                    <span className="font-semibold mr-2">{statusCounts.busy}</span>
                    <span className="text-gray-500 dark:text-gray-400">Busy</span>
                </div>
                <div className="flex items-center">
                    <span className="w-2.5 h-2.5 bg-gray-400 rounded-full mr-2"></span>
                    <span className="font-semibold mr-2">{totalResponders}</span>
                    <span className="text-gray-500 dark:text-gray-400">Total</span>
                </div>
                <div className="flex items-center">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-2"></span>
                    <span className="font-semibold mr-2">{totalAssignments}</span>
                    <span className="text-gray-500 dark:text-gray-400">Active</span>
                </div>
            </div>
        </div>
    );
};

export default ResponderStatusPanel;
