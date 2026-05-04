import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { PatrolLog, Guard, Checkpoint } from '../../types';

interface PatrolScannerProps {
    guard: Guard;
    checkpoints: Checkpoint[];
    onScanSuccess: () => void;
}

const PatrolScanner: React.FC<PatrolScannerProps> = ({ guard, checkpoints, onScanSuccess }) => {
    const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleScan = async () => {
        if (!selectedCheckpoint) return;
        setLoading(true);

        try {
            // Need to get coordinates for the checkpoint
            const cp = checkpoints.find(c => c.id === selectedCheckpoint);
            if (!cp) throw new Error('Checkpoint not found');

            const { data, error } = await supabase
                .from('patrol_logs')
                .insert([
                    {
                        checkpoint_id: selectedCheckpoint,
                        guard_id: guard.id,
                        site_id: guard.site_id, // Assuming guard belongs to a site
                        location_coords: cp.location,
                        verification_status: 'valid'
                    }
                ]);

            if (error) throw error;
            onScanSuccess();
            setSelectedCheckpoint('');
        } catch (error) {
            console.error('Error scanning checkpoint:', error);
            alert('Failed to record patrol log.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Patrol Checkpoint Scanner</h4>
            <select
                value={selectedCheckpoint}
                onChange={(e) => setSelectedCheckpoint(e.target.value)}
                className="w-full mb-4 p-2 border rounded dark:bg-gray-700 dark:text-white"
            >
                <option value="">Select Checkpoint</option>
                {checkpoints.map(cp => (
                    <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
            </select>
            <button
                onClick={handleScan}
                disabled={!selectedCheckpoint || loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded transition disabled:bg-gray-400"
            >
                {loading ? 'Recording...' : 'Scan Checkpoint'}
            </button>
        </div>
    );
};

export default PatrolScanner;