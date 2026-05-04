import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { Guard, Checkpoint } from '../../types';
import { getDistance } from '../../utils/geo';

interface PatrolScannerProps {
    guards: Guard[];
    checkpoints: Checkpoint[];
    onScanSuccess: () => void;
}

const PatrolScanner: React.FC<PatrolScannerProps> = ({ guards, checkpoints, onScanSuccess }) => {
    const [selectedGuard, setSelectedGuard] = useState<string>('');
    const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const getCurrentLocation = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
    };

    const handleScan = async () => {
        if (!selectedCheckpoint || !selectedGuard) return;
        setLoading(true);

        try {
            const cp = checkpoints.find(c => c.id === selectedCheckpoint);
            if (!cp) throw new Error('Checkpoint not found');
            
            const guard = guards.find(g => g.id === selectedGuard);
            if (!guard) throw new Error('Guard not found');

            let verification_status: 'valid' | 'invalid' = 'invalid';
            let location_coords = { lat: 0, lng: 0 };

            try {
                const position = await getCurrentLocation();
                location_coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                const distance = getDistance(location_coords.lat, location_coords.lng, cp.location.lat, cp.location.lng);
                verification_status = distance < 50 ? 'valid' : 'invalid'; // 50m threshold
            } catch (err) {
                console.warn('Geolocation failed, defaulting to checkpoint location', err);
                location_coords = cp.location; // Fallback
            }

            const { error } = await supabase
                .from('patrol_logs')
                .insert([
                    {
                        checkpoint_id: selectedCheckpoint,
                        guard_id: selectedGuard,
                        site_id: guard.site_id,
                        location_coords: location_coords,
                        verification_status: verification_status
                    }
                ]);

            if (error) throw error;
            onScanSuccess();
            setSelectedCheckpoint('');
            alert(`Scan recorded as ${verification_status}`);
        } catch (error) {
            console.error('Error scanning checkpoint:', error);
            alert('Failed to record patrol log.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mt-4">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Patrol Checkpoint Scanner</h4>
            <select
                value={selectedGuard}
                onChange={(e) => setSelectedGuard(e.target.value)}
                className="w-full mb-2 p-2 border rounded dark:bg-gray-700 dark:text-white"
            >
                <option value="">Select Guard</option>
                {guards.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>
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
                disabled={!selectedCheckpoint || !selectedGuard || loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded transition disabled:bg-gray-400"
            >
                {loading ? 'Recording...' : 'Scan Checkpoint'}
            </button>
        </div>
    );
};

export default PatrolScanner;
