import React, { useState, useEffect, useRef } from 'react';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { XIcon, CameraIcon, CheckCircleIcon, SearchIcon, AlertTriangleIcon, ScanIcon, EditIcon } from './icons';
import { supabase } from '../utils/supabase';
import { VehicleReport } from '../types';
import { useToast } from '../contexts/ToastContext';

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
    const tesseractWorkerRef = useRef<TesseractWorker | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [extractedPlates, setExtractedPlates] = useState<string[] | null>(null);
    const [searchingPlates, setSearchingPlates] = useState<Record<string, boolean>>({});
    const [searchResults, setSearchResults] = useState<Record<string, VehicleReport | 'not_found' | null>>({});
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
        try {
            setOcrInitializationStatus('Initializing ANPR engine...');
            
            if (!tesseractWorkerRef.current) {
                const { createWorker } = await import('tesseract.js');
                const worker = await createWorker('eng');
                await worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                });
                tesseractWorkerRef.current = worker;
            }
            setOcrInitializationStatus(null);
            return true;
        } catch (err) {
            console.error("Failed to initialize Tesseract.js", err);
            const errorMessage = "The ANPR engine failed to start. This feature is unavailable.";
            setError(errorMessage);
            addToast(errorMessage, 'error');
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
        setExtractedPlates(null);
        setSearchingPlates({});
        setSearchResults({});
        setIsProcessing(false);
        setOcrInitializationStatus(null);
        
        const ocrReady = await initializeOcr();
        if (!ocrReady) return;

        const cameraReady = await setupCamera();
        if (!cameraReady) return;

        setIsScanning(true);
        const scanInterval = 1500;
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

    const preprocessCanvas = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
    
        // Grayscale and contrast adjustment for better OCR
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            
            const contrast = 2.0; // Increased contrast factor
            const contrastedValue = 128 + contrast * (gray - 128);
            const finalValue = Math.max(0, Math.min(255, contrastedValue));
    
            data[i] = finalValue;     // red
            data[i + 1] = finalValue; // green
            data[i + 2] = finalValue; // blue
        }
        ctx.putImageData(imageData, 0, 0);
    };

    const recognizePlate = async (canvas: HTMLCanvasElement): Promise<string[] | null> => {
        const plateSet = new Set<string>();
        if (tesseractWorkerRef.current) {
            const imageBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!imageBlob) {
                console.error("Failed to convert canvas to blob for OCR.");
                return null;
            }

            const { data: { text } } = await tesseractWorkerRef.current.recognize(imageBlob);
            const lines = text.split('\n');
            for (const line of lines) {
                const cleanedText = line.replace(/[^A-Z0-9]/g, '').toUpperCase();
                if (/^[A-Z0-9]{5,8}$/.test(cleanedText)) plateSet.add(cleanedText);
            }
        }
        return plateSet.size > 0 ? Array.from(plateSet) : null;
    };


    const scanFrameForPlate = async () => {
        if (recognitionInProgress.current || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
            return;
        }

        recognitionInProgress.current = true;
        const video = videoRef.current;

        if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.warn("Video dimensions not available yet, skipping frame.");
            recognitionInProgress.current = false;
            return;
        }

        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            recognitionInProgress.current = false;
            return;
        }
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        const originalImageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

        preprocessCanvas(canvas);

        try {
            const foundPlates = await recognizePlate(canvas);
            if (foundPlates && foundPlates.length > 0) {
                stopAllActivity();
                setCapturedImage(originalImageDataUrl);
                setExtractedPlates(foundPlates);
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

        preprocessCanvas(canvasRef.current);

        try {
            const foundPlates = await recognizePlate(canvasRef.current);
            if (foundPlates && foundPlates.length > 0) {
                setExtractedPlates(foundPlates);
            } else {
                setError('Could not detect any license plates. Please try again.');
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
        
        const video = videoRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            addToast("Camera feed is not ready. Please try again in a moment.", 'warning');
            return;
        }

        stopAllActivity();
        
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

    const handleSearch = async (plate: string) => {
        if (!plate) return;
        setSearchingPlates(prev => ({ ...prev, [plate]: true }));
        setSearchResults(prev => ({ ...prev, [plate]: null }));
        
        const { data, error } = await supabase
            .from('vehicle_reports')
            .select('*')
            .eq('license_plate', plate)
            .limit(1)
            .single();

        if (error || !data) {
            setSearchResults(prev => ({ ...prev, [plate]: 'not_found' }));
        } else {
            setSearchResults(prev => ({ ...prev, [plate]: data as VehicleReport }));
        }
        setSearchingPlates(prev => ({ ...prev, [plate]: false }));
    };
    
    const handlePlateEdit = (index: number, newValue: string) => {
        setExtractedPlates(currentPlates => {
            if (!currentPlates) return null;
            const newPlates = [...currentPlates];
            const oldPlate = newPlates[index];
            const updatedPlate = newValue.toUpperCase().replace(/[^A-Z0-9]/g, '');
            newPlates[index] = updatedPlate;

            if (oldPlate !== updatedPlate) {
                setSearchResults(prevResults => {
                    const newResults = { ...prevResults };
                    if (newResults[oldPlate]) delete newResults[oldPlate];
                    return newResults;
                });
                setSearchingPlates(prevSearching => {
                    const newSearching = { ...prevSearching };
                    if (newSearching[oldPlate]) delete newSearching[oldPlate];
                    return newSearching;
                });
            }
            return newPlates;
        });
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
                        {extractedPlates && extractedPlates.length > 0 ? (
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                                    Detected {extractedPlates.length} potential plate{extractedPlates.length > 1 ? 's' : ''}. Edit if necessary and search.
                                </p>
                                {extractedPlates.map((plate, index) => {
                                    const result = searchResults[plate];
                                    const isSearching = searchingPlates[plate];
                                    return (
                                    <div key={index} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-grow">
                                                <input
                                                    type="text"
                                                    value={plate}
                                                    onChange={(e) => handlePlateEdit(index, e.target.value)}
                                                    className="w-full font-mono text-xl font-bold tracking-widest bg-yellow-300 text-black py-1 px-2 rounded-md border-2 border-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-yellow-200 transition"
                                                    aria-label={`Detected license plate ${index + 1}, editable`}
                                                />
                                                <EditIcon className="w-4 h-4 text-gray-500 absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none"/>
                                            </div>
                                            <button onClick={() => handleSearch(plate)} disabled={isSearching} className="py-2 px-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 w-28">
                                                {isSearching ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><SearchIcon className="w-5 h-5"/><span>Search</span></>}
                                            </button>
                                        </div>
                                        {result && (
                                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                                 {result === 'not_found' ? (
                                                    <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                                                        <AlertTriangleIcon className="w-5 h-5" />
                                                        <p className="font-semibold">No active report found.</p>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
                                                            <CheckCircleIcon className="w-5 h-5" />
                                                            <p className="font-semibold">Matching report found!</p>
                                                        </div>
                                                        <button onClick={() => onReportFound(result)} className="w-full text-sm text-left px-2 py-1 bg-green-500/10 rounded-md hover:bg-green-500/20 transition">
                                                            <strong>Status:</strong> <span className="capitalize">{result.status.replace(/_/g, ' ')}</span>
                                                            <br/>
                                                            <strong>Vehicle:</strong> {result.vehicle_make} {result.vehicle_model}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        ) : (
                             extractedPlates !== null && <p className="text-center text-gray-500 dark:text-gray-400">No plates were detected in the image.</p>
                        )}

                        <button onClick={resetStateAndStartScan} className="w-full py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition">
                            Scan Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ANPRModal;