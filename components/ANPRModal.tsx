import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { XIcon, CameraIcon, CheckCircleIcon, SearchIcon, AlertTriangleIcon, ScanIcon } from './icons';
import { supabase } from '../utils/supabase';
import { VehicleReport } from '../types';
import { useToast } from '../contexts/ToastContext';

declare global {
    interface Window {
        TextDetector: new () => {
            detect: (image: ImageBitmapSource) => Promise<{ rawValue: string; boundingBox: DOMRectReadOnly; }[]>;
        };
    }
}

interface ANPRModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReportFound: (report: VehicleReport) => void;
}

const ANPRModal: React.FC<ANPRModalProps> = ({ isOpen, onClose, onReportFound }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);
    const recognitionInProgress = useRef(false);
    const tesseractWorkerRef = useRef<Tesseract.Worker | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [extractedPlate, setExtractedPlate] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<VehicleReport | 'not_found' | null>(null);
    const [ocrEngine, setOcrEngine] = useState<'native' | 'tesseract' | 'none'>('none');
    const [ocrInitializationStatus, setOcrInitializationStatus] = useState<string | null>(null);

    const { addToast } = useToast();
    
    const cleanupCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };
    
    const cleanupOcr = async () => {
        if (tesseractWorkerRef.current) {
            await tesseractWorkerRef.current.terminate();
            tesseractWorkerRef.current = null;
        }
    };

    const stopAllActivity = () => {
        cleanupCamera();
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        setIsScanning(false);
        recognitionInProgress.current = false;
    };

    const initializeOcr = async (): Promise<boolean> => {
        if ('TextDetector' in window) {
            setOcrEngine('native');
            return true;
        }

        try {
            setOcrEngine('tesseract');
            setOcrInitializationStatus('Initializing fallback ANPR engine...');
            addToast('Using fallback ANPR engine, which may be slower.', 'info');
            
            if (!tesseractWorkerRef.current) {
                const worker = await Tesseract.createWorker('eng');
                await worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                });
                tesseractWorkerRef.current = worker;
            }
            setOcrInitializationStatus(null);
            return true;
        } catch (err) {
            console.error("Failed to initialize Tesseract.js", err);
            const errorMessage = "The ANPR fallback engine failed to start. This feature is unavailable.";
            setError(errorMessage);
            addToast(errorMessage, 'error');
            setOcrEngine('none');
            setOcrInitializationStatus(null);
            await cleanupOcr();
            return false;
        }
    };

    const setupCamera = async (): Promise<boolean> => {
        cleanupCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            return true;
        } catch (err) {
            console.error("Camera error:", err);
            const errorMessage = "Could not access camera. Please check permissions.";
            setError(errorMessage);
            addToast(errorMessage, 'error');
            return false;
        }
    };
    
    const resetStateAndStartScan = async () => {
        stopAllActivity();
        setError(null);
        setCapturedImage(null);
        setExtractedPlate(null);
        setIsSearching(false);
        setSearchResult(null);
        setIsProcessing(false);
        setOcrInitializationStatus(null);
        
        const ocrReady = await initializeOcr();
        if (!ocrReady) return;

        const cameraReady = await setupCamera();
        if (!cameraReady) return;

        setIsScanning(true);
        const scanInterval = ocrEngine === 'tesseract' ? 1500 : 1000;
        scanIntervalRef.current = window.setInterval(scanFrameForPlate, scanInterval);
    };
    
    useEffect(() => {
        if (isOpen) {
            resetStateAndStartScan();
        } else {
            stopAllActivity();
            cleanupOcr();
        }
        return () => {
            stopAllActivity();
            cleanupOcr();
        };
    }, [isOpen]);

    const recognizePlate = async (canvas: HTMLCanvasElement): Promise<string | null> => {
        if (ocrEngine === 'native') {
            const textDetector = new window.TextDetector();
            const detectedTexts = await textDetector.detect(canvas);
            for (const detectedText of detectedTexts) {
                const cleanedText = detectedText.rawValue.replace(/[\s-]/g, '').toUpperCase();
                if (/^[A-Z0-9]{4,8}$/.test(cleanedText)) return cleanedText;
            }
        } else if (ocrEngine === 'tesseract' && tesseractWorkerRef.current) {
            const imageBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!imageBlob) {
                console.error("Failed to convert canvas to blob for OCR.");
                return null;
            }

            const { data: { text } } = await tesseractWorkerRef.current.recognize(imageBlob);
            const lines = text.split('\n');
            for (const line of lines) {
                const cleanedText = line.replace(/[^A-Z0-9]/g, '').toUpperCase();
                if (/^[A-Z0-9]{5,8}$/.test(cleanedText)) return cleanedText;
            }
        }
        return null;
    };


    const scanFrameForPlate = async () => {
        if (recognitionInProgress.current || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
            return;
        }

        recognitionInProgress.current = true;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            recognitionInProgress.current = false;
            return;
        }
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        try {
            const foundPlate = await recognizePlate(canvas);
            if (foundPlate) {
                stopAllActivity();
                const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setCapturedImage(imageDataUrl);
                setExtractedPlate(foundPlate);
            }
        } catch (err: any) {
            console.error("Recognition error:", err);
            setError("Error during license plate detection.");
            stopAllActivity();
        } finally {
            recognitionInProgress.current = false;
        }
    };
    
    const processSingleFrame = async () => {
        if (!canvasRef.current) return;
        setIsProcessing(true);
        setError(null);
        try {
            const foundPlate = await recognizePlate(canvasRef.current);
            if (foundPlate) {
                setExtractedPlate(foundPlate);
            } else {
                setError('Could not detect a license plate. Please try again.');
            }
        } catch (err: any) {
            console.error("Recognition error on single frame:", err);
            setError("An error occurred during image analysis.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleManualCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;
        stopAllActivity();
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        
        setCapturedImage(imageDataUrl);
        cleanupCamera();
        processSingleFrame();
    };

    const handleSearch = async () => {
        if (!extractedPlate) return;
        setIsSearching(true);
        setSearchResult(null);
        const { data, error } = await supabase
            .from('vehicle_reports')
            .select('*')
            .eq('license_plate', extractedPlate)
            .limit(1)
            .single();

        if (error || !data) {
            setSearchResult('not_found');
        } else {
            setSearchResult(data as VehicleReport);
        }
        setIsSearching(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors z-10">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">ANPR Plate Scanner</h3>
                
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                    {!capturedImage && <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />}
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {capturedImage && <img src={capturedImage} alt="Captured plate" className="w-full h-full object-contain" />}
                    {ocrInitializationStatus && (
                         <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-2 text-center px-4">{ocrInitializationStatus}</p>
                        </div>
                    )}
                    {isProcessing && !ocrInitializationStatus && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-2">Analyzing image...</p>
                        </div>
                    )}
                     {isScanning && !ocrInitializationStatus && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-11/12 h-2/3 border-4 border-dashed border-white/50 rounded-lg animate-pulse flex flex-col items-center justify-center p-4">
                                <ScanIcon className="w-12 h-12 text-white/70" />
                                <p className="text-white font-bold mt-2 bg-black/30 px-2 py-1 rounded">SCANNING FOR PLATE</p>
                            </div>
                        </div>
                    )}
                </div>

                {error && <div className="mt-4 text-center text-red-500 bg-red-500/10 p-3 rounded-lg">{error}</div>}

                {!capturedImage && !ocrInitializationStatus && (
                    <button onClick={handleManualCapture} className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                        <CameraIcon className="w-5 h-5" /> Manual Capture
                    </button>
                )}

                {capturedImage && (
                    <div className="mt-4 space-y-4">
                        {extractedPlate && (
                             <div className="text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Detected Plate:</p>
                                <p className="font-mono text-3xl font-bold tracking-widest bg-yellow-300 text-black py-2 px-4 rounded-md inline-block">{extractedPlate}</p>
                            </div>
                        )}
                        
                        {searchResult && (
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                                {searchResult === 'not_found' ? (
                                    <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400">
                                        <AlertTriangleIcon className="w-6 h-6" />
                                        <p className="font-semibold">No active report found for this plate.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                                            <CheckCircleIcon className="w-6 h-6" />
                                            <p className="font-semibold">Matching report found!</p>
                                        </div>
                                        <p><strong>Status:</strong> <span className="capitalize">{searchResult.status.replace(/_/g, ' ')}</span></p>
                                        <p><strong>Vehicle:</strong> {searchResult.vehicle_make} {searchResult.vehicle_model}</p>
                                        <button onClick={() => onReportFound(searchResult)} className="w-full mt-2 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition">
                                            View Report
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                             <button onClick={resetStateAndStartScan} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                                Scan Again
                            </button>
                            {extractedPlate && !searchResult && (
                                <button onClick={handleSearch} disabled={isSearching} className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isSearching ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SearchIcon className="w-5 h-5"/>}
                                    {isSearching ? 'Searching...' : 'Search for Plate'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ANPRModal;
