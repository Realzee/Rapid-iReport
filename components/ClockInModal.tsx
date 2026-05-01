import React, { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';
import LocationMap from './LocationMap';
import { useToast } from '../contexts/ToastContext';

interface ClockInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (location: string) => void;
    action: 'clockIn' | 'clockOut';
}

const ClockInModal: React.FC<ClockInModalProps> = ({ isOpen, onClose, onConfirm, action }) => {
    const [loading, setLoading] = useState(true);
    const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [showMap, setShowMap] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setLoading(false);
                },
                (err) => {
                    console.error(err);
                    addToast('Could not get your location.', 'error');
                    onClose();
                }
            );
        }
    }, [isOpen, addToast, onClose]);

    if (!isOpen) return null;

    return (
        <ConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={() => position && onConfirm(`${position.lat},${position.lng}`)}
            title={action === 'clockIn' ? 'Clock In' : 'Clock Out'}
            message={
                loading 
                ? 'Getting your current location...' 
                : (
                    <div className="space-y-4">
                        <p>Confirm your current location to {action === 'clockIn' ? 'clock in' : 'clock out'}:</p>
                        {position && (
                            <div className="space-y-2">
                                <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={showMap}
                                        onChange={() => setShowMap(!showMap)}
                                    />
                                    <span>Show Map</span>
                                </label>
                                {showMap && <LocationMap lat={position.lat} lng={position.lng} />}
                            </div>
                        )}
                    </div>
                )
            }
            confirmText={action === 'clockIn' ? 'Confirm Clock In' : 'Confirm Clock Out'}
        />
    );
};

export default ClockInModal;
