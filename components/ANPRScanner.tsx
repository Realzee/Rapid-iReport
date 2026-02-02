import React, { useState, useEffect, useRef, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import { supabase } from '../utils/supabase';
import { VehicleReport, ReportStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { ScanIcon, AlertTriangleIcon, CheckCircleIcon } from './icons';
import { format } from 'date-fns';

interface ANPRScannerProps {
    onReportHit: (reportId: string) => void;
}

const ANPRScanner: React.FC<ANPRScannerProps> = ({ onReportHit }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);
    const recognitionInProgress = useRef(false);
    const tesseractWorkerRef = useRef<Tesseract.Worker | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<'Idle' | 'Initializing' | 'Scanning' | 'Error'>('Idle');
    const [scannedPlates, setScannedPlates] = useState<Map<string, { timestamp: Date }>>(new Map());
    const [plateHits, setPlateHits] = useState<Map<string, { report: VehicleReport, timestamp: Date }>>(new Map());
    const [blacklist, setBlacklist] = useState<Set<string>>(new Set());

    const { addToast } = useToast();

    // Sound alert effect
    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }, []);

    const playHitSound = () => {
        const context = audioContextRef.current;
        if (!context) return;
        if (context.state === 'suspended') context.resume();
        const oscillator = context.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1000, context.currentTime);
        oscillator.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.2);
    };

    // Blacklist management effect
    useEffect(() => {
        const activeStatuses = [ReportStatus.PENDING, ReportStatus.ACTIVE, ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE];

        const fetchBlacklist = async () => {
            const { data, error } = await supabase.from('vehicle_reports').select('license_plate').in('status', activeStatuses);
            if (error) {
                addToast('Could not load vehicle blacklist.', 'error');
            } else {
                setBlacklist(new Set(data.map(item => item.license_plate)));
            }
        };

        fetchBlacklist();

        const channel = supabase.channel('anpr-blacklist-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, (payload) => {
                const updatedReport = payload.new as VehicleReport;
                const oldReport = payload.old as VehicleReport;
                
                if (payload.eventType === 'INSERT' && activeStatuses.includes(updatedReport.status)) {
                    setBlacklist(prev => new Set(prev).add(updatedReport.license_plate));
                } else if (payload.eventType === 'UPDATE') {
                    const isActive = activeStatuses.includes(updatedReport.status);
                    setBlacklist(prev => {
                        const newSet = new Set(prev);
                        if(isActive) newSet.add(updatedReport.license_plate);
                        else newSet.delete(updatedReport.license_plate);
                        return newSet;
                    });
                } else if (payload.eventType === 'DELETE') {
                    setBlacklist(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(oldReport.license_plate);
                        return newSet;
                    });
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [addToast]);
    
    // Main cleanup effect
    useEffect(() => {
        return () => {
            stopScan(true); // Ensure cleanup on unmount
        };
    }, []);

    const startScan = async () => {
        if (isScanning) return;
        
        setScannedPlates(new Map());
        setPlateHits(new Map());
        setStatus('Initializing');
        
        // Init OCR
        if (!tesseractWorkerRef.current) {
            try {
                const worker = await Tesseract.createWorker('eng');
                await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });
                tesseractWorkerRef.current = worker;
            } catch (err) {
                setStatus('Error');
                addToast('ANPR engine failed to initialize.', 'error');
                return;
            }
        }
        
        // Init Camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setStatus('Scanning');
            setIsScanning(true);
            scanIntervalRef.current = window.setInterval(scanFrame, 1500);
        } catch (err: any) {
            setStatus('Error');
            addToast(`Camera access denied: ${err.message}`, 'error');
        }
    };
    
    const stopScan = (isUnmounting = false) => {
        setIsScanning(false);
        setStatus('Idle');
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if(videoRef.current) videoRef.current.srcObject = null;
        
        if (isUnmounting && tesseractWorkerRef.current) {
            tesseractWorkerRef.current.terminate();
            tesseractWorkerRef.current = null;
        }
        recognitionInProgress.current = false;
    };
    
    const scanFrame = async () => {
        if (recognitionInProgress.current || !videoRef.current || !canvasRef.current || !isScanning) return;
        
        recognitionInProgress.current = true;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            
            try {
                const result = await tesseractWorkerRef.current?.recognize(canvas);
                if (result?.data.text) {
                    const plates = result.data.text.split('\n')
                        .map(line => line.replace(/[^A-Z0-9]/g, '').toUpperCase())
                        .filter(plate => /^[A-Z0-9]{5,8}$/.test(plate));
                    
                    if (plates.length > 0) processDetections(plates);
                }
            } catch (err) {
                console.warn('OCR recognition error:', err);
            }
        }
        
        recognitionInProgress.current = false;
    };
    
    const processDetections = async (plates: string[]) => {
        const newHits: string[] = [];
        const timestamp = new Date();

        setScannedPlates(prev => {
            const newMap = new Map(prev);
            plates.forEach(plate => {
                if (!newMap.has(plate)) newMap.set(plate, { timestamp });
            });
            return newMap;
        });

        for (const plate of plates) {
            if (blacklist.has(plate) && !plateHits.has(plate)) {
                newHits.push(plate);
            }
        }

        if (newHits.length > 0) {
            playHitSound();
            const { data, error } = await supabase.from('vehicle_reports').select('*').in('license_plate', newHits);
            if (!error && data) {
                setPlateHits(prev => {
                    const newMap = new Map(prev);
                    data.forEach(report => {
                        if (!newMap.has(report.license_plate)) newMap.set(report.license_plate, { report: report as VehicleReport, timestamp });
                    });
                    return newMap;
                });
            }
        }
    };
    
    // FIX: Add explicit types to sort callback parameters to prevent type inference errors.
    const sortedHits = useMemo(() => Array.from(plateHits.values()).sort((a: { timestamp: Date }, b: { timestamp: Date }) => b.timestamp.getTime() - a.timestamp.getTime()), [plateHits]);
    // FIX: Add explicit types to the sort callback parameters to resolve TypeScript inference issue. Also corrected a typo in the dependency array.
    const sortedScans = useMemo(() => Array.from(scannedPlates.entries()).sort((a: [string, { timestamp: Date }], b: [string, { timestamp: Date }]) => b[1].timestamp.getTime() - a[1].timestamp.getTime()), [scannedPlates]);

    return (
        <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
            <h3 className="text-lg font-bold mb-2">Live ANPR Scanner</h3>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center mb-4">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                {isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-11/12 h-2/3 border-4 border-dashed border-white/50 rounded-lg animate-pulse flex flex-col items-center justify-center p-4">
                            <ScanIcon className="w-12 h-12 text-white/70" />
                        </div>
                    </div>
                )}
                {!isScanning && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                        <p className="font-semibold">{status}</p>
                    </div>
                )}
            </div>

            <button
                onClick={isScanning ? () => stopScan() : startScan}
                className={`w-full py-2.5 font-bold rounded-lg text-white transition-colors ${isScanning ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {isScanning ? 'Stop Scan' : 'Start Scan'}
            </button>

            <div className="mt-4 space-y-4">
                {/* Alerts / Hits */}
                <div>
                    <h4 className="font-bold text-red-500 dark:text-red-400">Alerts ({plateHits.size})</h4>
                    <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                        {sortedHits.map(({ report, timestamp }) => (
                            <div key={report.id} className="p-2 bg-red-500/10 border-l-4 border-red-500 rounded-r-lg">
                                <div className="flex justify-between items-center">
                                    <p className="font-mono font-bold text-lg text-red-800 dark:text-red-200">{report.license_plate}</p>
                                    <button onClick={() => onReportHit(report.id)} className="px-3 py-1 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700">View Report</button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{format(timestamp, 'HH:mm:ss')}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scan Log */}
                <div>
                    <h4 className="font-bold">Scan Log ({scannedPlates.size})</h4>
                     <div className="space-y-1 mt-2 max-h-48 overflow-y-auto text-sm">
                        {sortedScans.map(([plate, { timestamp }]) => (
                            <div key={plate} className="flex justify-between items-center p-1.5 bg-gray-100 dark:bg-gray-800/50 rounded-md">
                                <p className="font-mono">{plate}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{format(timestamp, 'HH:mm:ss')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ANPRScanner;