import React, { useState, useEffect, useRef, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import { supabase } from '../utils/supabase';
import { VehicleReport, ReportStatus, Severity, UserRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import { ScanIcon, AlertTriangleIcon, CarIcon, CameraIcon, EyeIcon } from './icons';
import { format } from 'date-fns';

interface LookoutScannerProps {
    profile: any;
    onReportHit: (reportId: string) => void;
}

const LookoutScanner: React.FC<LookoutScannerProps> = ({ profile, onReportHit }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);
    const recognitionInProgress = useRef(false);
    const tesseractWorkerRef = useRef<Tesseract.Worker | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<'Idle' | 'Initializing' | 'Scanning' | 'Error'>('Idle');
    const [plateHits, setPlateHits] = useState<Map<string, { report: VehicleReport, timestamp: Date }>>(new Map());
    const [circulationList, setCirculationList] = useState<VehicleReport[]>([]);
    const [activeTab, setActiveTab] = useState<'circulation' | 'alerts'>('circulation');
    
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

    // Circulation list management effect
    useEffect(() => {
        const activeStatuses = [ReportStatus.PENDING, ReportStatus.ACTIVE, ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE];
        const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);

        const fetchCirculationList = async () => {
            let allowedReporterIds: string[] | null = null;

            if (!isGlobalAdmin && profile.company_id) {
                const { data: companyUsers } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('company_id', profile.company_id);
                
                if (companyUsers) {
                    allowedReporterIds = companyUsers.map(u => u.id);
                }
            }

            let query = supabase
                .from('vehicle_reports')
                .select('*')
                .in('status', activeStatuses);

            if (allowedReporterIds) {
                query = query.in('reported_by', allowedReporterIds);
            }

            const { data, error } = await query.order('reported_at', { ascending: false });
                
            if (error) {
                addToast('Could not load circulation list.', 'error');
            } else {
                setCirculationList(data as VehicleReport[]);
            }
        };

        fetchCirculationList();

        const channel = supabase.channel('lookout-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, (payload) => {
                // For realtime updates, just re-fetch
                fetchCirculationList();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [addToast, profile]);
    
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
                addToast('Lookout engine failed to initialize.', 'error');
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
        const newHits: VehicleReport[] = [];
        const timestamp = new Date();

        for (const plate of plates) {
            const matchedReport = circulationList.find(r => r.license_plate === plate);
            if (matchedReport && !plateHits.has(plate)) {
                newHits.push(matchedReport);
            }
        }

        if (newHits.length > 0) {
            playHitSound();
            setPlateHits(prev => {
                const newMap = new Map(prev);
                newHits.forEach(report => {
                    if (!newMap.has(report.license_plate)) newMap.set(report.license_plate, { report, timestamp });
                });
                return newMap;
            });
            setActiveTab('alerts');
        }
    };
    
    const sortedHits = useMemo(() => Array.from(plateHits.values()).sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime()), [plateHits]);
    
    const scaleX = (videoRef.current?.videoWidth || 0) > 0 ? videoDimensions.width / videoRef.current!.videoWidth : 0;
    const scaleY = (videoRef.current?.videoHeight || 0) > 0 ? videoDimensions.height / videoRef.current!.videoHeight : 0;

    return (
        <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <EyeIcon className="w-5 h-5 text-blue-500" />
                    Circulation List Lookout
                </h3>
                <div className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                    {circulationList.length} Vehicles in Circulation List
                </div>
            </div>

            {/* Camera View */}
            <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center mb-4 border border-gray-800 relative group transition-all duration-300 ${isScanning ? 'h-auto' : 'h-32'}`}>
                <style>{`
                    @keyframes scan {
                        0% { top: 0%; opacity: 0; }
                        15% { opacity: 1; }
                        85% { opacity: 1; }
                        100% { top: 100%; opacity: 0; }
                    }
                    @keyframes radar-spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
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
                    .animate-radar {
                        animation: radar-spin 2s linear infinite;
                    }
                    .tech-grid {
                        background-image: 
                            linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px);
                        background-size: 40px 40px;
                    }
                `}</style>
                
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isScanning && 'hidden'}`} />
                <canvas ref={canvasRef} className="hidden" />

                {isScanning && (
                    <>
                        {/* Tech Grid Overlay */}
                        <div className="absolute inset-0 pointer-events-none tech-grid opacity-20"></div>
                        
                        {/* Scanning Line */}
                        <div className="animate-scan pointer-events-none"></div>

                        {/* Viewfinder Corners */}
                        <div className="absolute inset-0 pointer-events-none p-4 sm:p-6">
                            <div className="w-full h-full relative border border-green-500/10">
                                <div className="absolute top-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-l-2 border-green-500/60 rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-r-2 border-green-500/60 rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-l-2 border-green-500/60 rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-r-2 border-green-500/60 rounded-br-lg"></div>
                                
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
                                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] sm:text-xs font-mono text-green-400 font-bold tracking-widest">REC • LIVE FEED</span>
                            </div>
                            <div className="text-[10px] font-mono text-green-500/70 mt-1">
                                LOOKOUT ACTIVE
                            </div>
                            {detections.length > 0 && (
                                <div className="mt-2 text-xs font-mono text-red-500 font-bold animate-pulse bg-black/50 px-2 py-1 rounded border border-red-500/50">
                                    TARGET DETECTED
                                </div>
                            )}
                        </div>

                        {/* Radar Animation */}
                        <div className="absolute top-4 right-4 pointer-events-none hidden sm:block">
                            <div className="relative w-16 h-16 border border-green-500/30 rounded-full flex items-center justify-center overflow-hidden bg-green-900/10 backdrop-blur-sm">
                                <div className="absolute w-full h-full bg-gradient-to-t from-green-500/20 to-transparent animate-radar origin-bottom-right"></div>
                                <div className="absolute inset-0 border border-green-500/10 rounded-full scale-50"></div>
                                <div className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_5px_#22c55e]"></div>
                            </div>
                            <p className="text-[8px] text-green-500/70 text-center mt-1 font-mono tracking-wider">RADAR</p>
                        </div>
                    </>
                )}

                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${videoDimensions.width} ${videoDimensions.height}`}>
                    {detections.map((d, i) => {
                        const x = d.bbox.x0 * scaleX;
                        const y = d.bbox.y0 * scaleY;
                        const width = (d.bbox.x1 - d.bbox.x0) * scaleX;
                        const height = (d.bbox.y1 - d.bbox.y0) * scaleY;
                        const isHit = plateHits.has(d.text) || circulationList.some(r => r.license_plate === d.text);
                        const color = isHit ? '#ef4444' : '#22c55e'; // Red for hit, Green for normal

                        return (
                            <g key={i}>
                                {/* Target Lock Corners */}
                                <path d={`M${x},${y} L${x + 10},${y} M${x},${y} L${x},${y + 10}`} stroke={color} strokeWidth="2" fill="none" />
                                <path d={`M${x + width},${y} L${x + width - 10},${y} M${x + width},${y} L${x + width},${y + 10}`} stroke={color} strokeWidth="2" fill="none" />
                                <path d={`M${x},${y + height} L${x + 10},${y + height} M${x},${y + height} L${x},${y + height - 10}`} stroke={color} strokeWidth="2" fill="none" />
                                <path d={`M${x + width},${y + height} L${x + width - 10},${y + height} M${x + width},${y + height} L${x + width},${y + height - 10}`} stroke={color} strokeWidth="2" fill="none" />
                                
                                {/* Pulsing Background */}
                                <rect x={x} y={y} width={width} height={height} fill={isHit ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.1)'} className="animate-pulse" />
                                
                                {/* Label */}
                                <rect x={x} y={y - 20} width={width} height={20} fill={isHit ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)'} />
                                <text
                                    x={x + width / 2} y={y - 6}
                                    textAnchor="middle"
                                    style={{ fill: 'white', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}
                                >
                                    {d.text}
                                </text>
                            </g>
                        )
                    })}
                </svg>

                {!isScanning && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white">
                        <CameraIcon className="w-10 h-10 text-gray-500 mb-2" />
                        <p className="font-semibold text-gray-400">{status === 'Initializing' ? 'Initializing Camera...' : 'Camera Offline'}</p>
                        {status === 'Error' && <p className="text-red-500 text-sm mt-2">Camera/Engine Error</p>}
                    </div>
                )}
            </div>

            <button
                onClick={isScanning ? () => stopScan() : startScan}
                className={`w-full py-3 font-bold rounded-xl text-white transition-colors flex items-center justify-center gap-2 shadow-md ${isScanning ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {isScanning ? (
                    <>Stop Lookout</>
                ) : (
                    <><CameraIcon className="w-5 h-5" /> Open Camera & Start Lookout</>
                )}
            </button>

            {/* Tabs */}
            <div className="mt-6">
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    <button
                        onClick={() => setActiveTab('circulation')}
                        className={`flex-1 py-2 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'circulation' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Circulation List
                    </button>
                    <button
                        onClick={() => setActiveTab('alerts')}
                        className={`flex-1 py-2 font-semibold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'alerts' ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Alerts
                        {plateHits.size > 0 && (
                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{plateHits.size}</span>
                        )}
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'circulation' && (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {circulationList.length === 0 ? (
                            <p className="text-center text-gray-500 text-sm py-4">No vehicles currently in circulation list.</p>
                        ) : (
                            circulationList.map(report => (
                                <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-10 rounded-full ${report.severity === Severity.CRITICAL ? 'bg-red-500' : report.severity === Severity.HIGH ? 'bg-orange-500' : report.severity === Severity.MEDIUM ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <p className="font-mono font-bold text-gray-900 dark:text-white">{report.license_plate}</p>
                                            <p className="text-xs text-gray-500">{report.vehicle_make} {report.vehicle_model} • {report.vehicle_color}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => onReportHit(report.id)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                                        <EyeIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'alerts' && (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {sortedHits.length === 0 ? (
                            <p className="text-center text-gray-500 text-sm py-4">No hits detected yet.</p>
                        ) : (
                            sortedHits.map(({ report, timestamp }) => (
                                <div key={report.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-mono font-bold text-lg text-red-700 dark:text-red-400">{report.license_plate}</p>
                                            <p className="text-xs text-red-600/70 dark:text-red-400/70">Detected at {format(timestamp, 'HH:mm:ss')}</p>
                                        </div>
                                        <button onClick={() => onReportHit(report.id)} className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition-colors">
                                            View Report
                                        </button>
                                    </div>
                                    <div className="text-sm text-red-800 dark:text-red-300">
                                        {report.vehicle_make} {report.vehicle_model} ({report.vehicle_color})
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LookoutScanner;
