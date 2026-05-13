import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import { Guard, Checkpoint } from '../../types';
import { getDistance } from '../../utils/geo';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, X, Check, AlertTriangle, Camera } from 'lucide-react';

interface PatrolScannerProps {
    guards: Guard[];
    checkpoints: Checkpoint[];
    onScanSuccess: () => void;
}

const PatrolScanner: React.FC<PatrolScannerProps> = ({ guards, checkpoints, onScanSuccess }) => {
    const [selectedGuard, setSelectedGuard] = useState<string>(guards.length === 1 ? guards[0].id : '');
    const [loading, setLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{
        checkpoint: Checkpoint;
        status: 'valid' | 'invalid';
        message: string;
    } | null>(null);

    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        if (guards.length === 1 && !selectedGuard) {
            setSelectedGuard(guards[0].id);
        }
    }, [guards, selectedGuard]);

    const onScanSuccess_QR = React.useCallback(async (decodedText: string) => {
        // Stop scanning
        if (scannerRef.current) {
            try {
                await scannerRef.current.clear();
            } catch (err) {
                console.warn('Failed to clear scanner:', err);
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
        
        // Find checkpoint by QR code or ID
        const cp = checkpoints.find(c => c.qr_code === decodedText || c.id === decodedText);
        if (!cp) {
            alert(`Unrecognized QR code or checkpoint ID: ${decodedText}`);
            return;
        }

        if (!selectedGuard) {
            alert('Please select a guard first.');
            setIsScanning(true); // Restart if no guard
            return;
        }

        await handleScan(cp.id, decodedText);
    }, [checkpoints, selectedGuard]);

    const onScanFailure_QR = React.useCallback((error: any) => {
        // Continuous scanning failures are expected when no QR is in view
    }, []);

    useEffect(() => {
        let isScannerReady = true;

        if (isScanning && !scannerRef.current) {
            // Delay initialization to ensure the DOM element #qr-reader is mounted
            const timer = setTimeout(() => {
                if (!isScannerReady) return;
                
                try {
                    const scanner = new Html5QrcodeScanner(
                        "qr-reader",
                        { 
                            fps: 10, 
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0,
                            showTorchButtonIfSupported: true
                        },
                        false
                    );
                    scannerRef.current = scanner;
                    scanner.render(onScanSuccess_QR, onScanFailure_QR);
                } catch (err) {
                    console.error("Scanner initialization failed:", err);
                    setIsScanning(false);
                }
            }, 150);

            return () => {
                isScannerReady = false;
                clearTimeout(timer);
                if (scannerRef.current) {
                    scannerRef.current.clear().catch(err => console.warn("Scanner clear failed:", err));
                    scannerRef.current = null;
                }
            };
        }
    }, [isScanning, onScanSuccess_QR, onScanFailure_QR]);

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

    const handleScan = async (checkpointId: string, qrCodeScanned?: string) => {
        if (!selectedGuard) return;
        setLoading(true);

        try {
            const cp = checkpoints.find(c => c.id === checkpointId);
            if (!cp) throw new Error('Checkpoint not found');
            
            const guard = guards.find(g => g.id === selectedGuard);
            if (!guard) throw new Error('Guard not found');

            let verification_status: 'valid' | 'invalid' = 'invalid';
            let location_coords = { lat: 0, lng: 0 };

            try {
                const position = await getCurrentLocation();
                location_coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                const distance = getDistance(location_coords.lat, location_coords.lng, cp.location.lat, cp.location.lng);
                verification_status = distance < 100 ? 'valid' : 'invalid'; // 100m threshold for QR
            } catch (err) {
                console.warn('Geolocation failed, defaulting to checkpoint location', err);
                location_coords = cp.location; // Fallback
                verification_status = 'valid'; // Trust QR if GPS fails?
            }

            const { error } = await supabase
                .from('patrol_logs')
                .insert([
                    {
                        checkpoint_id: checkpointId,
                        guard_id: selectedGuard,
                        site_id: guard.site_id || cp.site_id || null,
                        location_coords: location_coords,
                        verification_status: verification_status,
                        qr_code_scanned: qrCodeScanned || null,
                        company_id: guard.company_id || cp.company_id || (guard as any).company_id || null
                    }
                ]);

            if (error) {
                console.error('Supabase insert error details:', {
                    error,
                    payload: {
                        checkpoint_id: checkpointId,
                        guard_id: selectedGuard,
                        site_id: guard.site_id || cp.site_id,
                        company_id: guard.company_id || cp.company_id
                    }
                });
                throw error;
            }
            
            setScanResult({
                checkpoint: cp,
                status: verification_status,
                message: verification_status === 'valid' 
                    ? 'Scan verified successfully!' 
                    : 'Scan recorded, but distance check failed.'
            });

            onScanSuccess();
        } catch (error) {
            console.error('Error scanning checkpoint:', error);
            alert('Failed to record patrol log.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <QrCode size={24} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Patrol Scanner</h4>
            </div>

            <div className="space-y-4">
                {guards.length > 1 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Select Guard on Duty</label>
                        <select
                            value={selectedGuard}
                            onChange={(e) => setSelectedGuard(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                        >
                            <option value="">Choose a guard...</option>
                            {guards.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {guards.length === 1 && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Recording for: <strong>{guards[0].name}</strong></span>
                        </div>
                    </div>
                )}

                {isScanning ? (
                    <div className="space-y-4">
                        <div id="qr-reader" className="overflow-hidden rounded-xl border-2 border-emerald-500 shadow-lg bg-black">
                            <div className="p-8 text-center text-gray-400">
                                <Camera className="mx-auto mb-4 opacity-50" size={48} />
                                <p className="text-sm">Initializing camera...</p>
                                <p className="text-[10px] mt-2">Please ensure camera permissions are granted in your browser.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsScanning(false)}
                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                            <X size={18} />
                            Cancel Scanning
                        </button>
                    </div>
                ) : scanResult ? (
                    <div className={`p-6 rounded-xl border-2 flex flex-col items-center text-center ${
                        scanResult.status === 'valid' 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    }`}>
                        <div className={`p-3 rounded-full mb-4 ${
                            scanResult.status === 'valid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                            {scanResult.status === 'valid' ? <Check size={32} /> : <AlertTriangle size={32} />}
                        </div>
                        <h5 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{scanResult.checkpoint.name}</h5>
                        <p className={`text-sm mb-6 ${
                            scanResult.status === 'valid' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                        }`}>{scanResult.message}</p>
                        
                        <button 
                            onClick={() => setScanResult(null)}
                            className="px-8 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-lg hover:opacity-90 transition shadow-lg"
                        >
                            Scan Another
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button
                            onClick={() => {
                                if (!selectedGuard) {
                                    alert('Please select a guard first');
                                    return;
                                }
                                setIsScanning(true);
                            }}
                            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-emerald-500/30 group"
                        >
                            <Camera className="group-hover:scale-110 transition" size={24} />
                            Scan Point QR Code
                        </button>
                        
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                            <span className="flex-shrink mx-4 text-gray-400 text-xs font-medium uppercase tracking-widest">or manual backup</span>
                            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <select
                            onChange={(e) => e.target.value && handleScan(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                        >
                            <option value="">Select manual checkpoint...</option>
                            {checkpoints.map(cp => (
                                <option key={cp.id} value={cp.id}>{cp.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-gray-500 italic text-center">Use manual selection ONLY if QR scanning is not possible.</p>
                    </div>
                )}
            </div>
            
            {loading && (
                <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
    );
};

export default PatrolScanner;

