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
    
    // State for live visual feedback
    const [detections, setDetections] = useState<{ text: string; bbox: Tesseract.Bbox }[]>([]);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

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

    // Effect to track video's rendered dimensions for scaling the overlay
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isScanning) return;
    
        const handleResize = () => {
            if (video) {
                setVideoDimensions({ width: video.clientWidth, height: video.clientHeight });
            }
        };
        
        handleResize(); // Initial size
    
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(video);
    
        return () => resizeObserver.disconnect();
    }, [isScanning]);

    const startScan = async () => {
        if (isScanning) return;
        
        setScannedPlates(new Map());
        setPlateHits(new Map());
        setDetections([]);
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
        setDetections([]);
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
                const foundPlates: { text: string; bbox: Tesseract.Bbox }[] = [];
                const plateTexts: string[] = [];
    
                if (result?.data.lines) {
                    for (const line of result.data.lines) {
                        const cleanedText = line.text.replace(/[^A-Z0-9]/g, '').toUpperCase();
                        if (/^[A-Z0-9]{5,8}$/.test(cleanedText) && line.confidence > 65) {
                            foundPlates.push({ text: cleanedText, bbox: line.bbox });
                            plateTexts.push(cleanedText);
                        }
                    }
                }
    
                setDetections(foundPlates);
                if (plateTexts.length > 0) {
                    processDetections(plateTexts);
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
    
    const sortedHits = useMemo(() => Array.from(plateHits.values()).sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime()), [plateHits]);
    const sortedScans = useMemo(() => Array.from(scannedPlates.entries()).sort((a: any, b: any) => b[1].timestamp.getTime() - a[1].timestamp.getTime()), [scannedPlates]);
    
    const scaleX = videoDimensions.width / (videoRef.current?.videoWidth || 1);
    const scaleY = videoDimensions.height / (videoRef.current?.videoHeight || 1);

    return (
        <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
            <h3 className="text-lg font-bold mb-2">Live ANPR Scanner</h3>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center mb-4">
                <style>{`
                    @keyframes scan {
                        0% { top: 0%; opacity: 0; }
                        15% { opacity: 1; }
                        85% { opacity: 1; }
                        100% { top: 100%; opacity: 0; }
                    }
                    .animate-scan {
                        position: absolute;
                        left: 0;
                        width: 100%;
                        height: 2px;
                        background: rgba(34, 197, 94, 0.8);
                        box-shadow: 0 0 10px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.4);
                        animation: scan 2.5s linear infinite;
                    }
                    .tech-grid {
                        background-image: 
                            linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px);
                        background-size: 40px 40px;
                    }
                `}</style>
                
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {isScanning && (
                    <>
                        {/* Tech Grid Overlay */}
                        <div className="absolute inset-0 pointer-events-none tech-grid opacity-30"></div>
                        
                        {/* Scanning Line */}
                        <div className="animate-scan pointer-events-none"></div>

                        {/* Viewfinder Corners */}
                        <div className="absolute inset-0 pointer-events-none p-6">
                            <div className="w-full h-full relative">
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-green-500/60 rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-green-500/60 rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-green-500/60 rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-green-500/60 rounded-br-lg"></div>
                                
                                {/* Center Crosshair */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-50">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-green-500/40"></div>
                                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-0.5 bg-green-500/40"></div>
                                </div>
                            </div>
                        </div>

                        {/* Status Text Overlay */}
                        <div className="absolute top-4 left-4 pointer-events-none">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-mono text-green-400 font-bold tracking-widest">REC • LIVE FEED</span>
                            </div>
                            <div className="text-[10px] font-mono text-green-500/70 mt-1">
                                ANPR SYSTEM ACTIVE
                            </div>
                        </div>
                    </>
                )}

                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${videoDimensions.width} ${videoDimensions.height}`}>
                    {detections.map((d, i) => {
                        const x = d.bbox.x0 * scaleX;
                        const y = d.bbox.y0 * scaleY;
                        const width = (d.bbox.x1 - d.bbox.x0) * scaleX;
                        const height = (d.bbox.y1 - d.bbox.y0) * scaleY;

                        return (
                            <g key={i}>
                                <rect
                                    x={x} y={y} width={width} height={height}
                                    style={{ fill: 'rgba(74, 222, 128, 0.2)', stroke: 'rgb(34, 197, 94)', strokeWidth: 2 }}
                                />
                                <rect x={x} y={y - 20} width={width} height={20} style={{ fill: 'rgb(34, 197, 94)' }} />
                                <text
                                    x={x + width / 2} y={y - 6}
                                    textAnchor="middle"
                                    style={{ fill: 'white', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}
                                >
                                    {d.text}
                                </text>
                            </g>
                        )
                    })}
                </svg>

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