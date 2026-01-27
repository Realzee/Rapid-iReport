import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { XIcon, CameraIcon, CheckCircleIcon, SearchIcon, AlertTriangleIcon } from './icons';
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

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [extractedPlate, setExtractedPlate] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<VehicleReport | 'not_found' | null>(null);

    const { addToast } = useToast();

    const cleanup = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const setupCamera = async () => {
        cleanup();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera error:", err);
            setError("Could not access camera. Please check permissions.");
            addToast("Could not access camera. Please check permissions.", 'error');
        }
    };
    
    const resetState = () => {
        setError(null);
        setCapturedImage(null);
        setExtractedPlate(null);
        setIsSearching(false);
        setSearchResult(null);
        setupCamera();
    };


    useEffect(() => {
        if (isOpen) {
            resetState();
        } else {
            cleanup();
        }
        return cleanup;
    }, [isOpen]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageDataUrl);
        cleanup();
        recognizePlate(imageDataUrl);
    };

    const recognizePlate = async (imageDataUrl: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const base64Data = imageDataUrl.split(',')[1];
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: base64Data } };
            const textPart = { text: "Read the license plate from the vehicle in this image. Respond with only the license plate text, with no spaces or special characters. If no plate is visible or it is unreadable, respond with the exact string 'NO_PLATE'." };
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, textPart] },
            });

            const plateText = response.text?.trim().toUpperCase();
            if (plateText && plateText !== 'NO_PLATE') {
                setExtractedPlate(plateText);
            } else {
                setError('Could not detect a license plate. Please try again.');
            }
        } catch (err: any) {
            console.error("Gemini API error:", err);
            setError("Failed to analyze image. Please try again.");
        } finally {
            setIsLoading(false);
        }
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
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-2">Analyzing image...</p>
                        </div>
                    )}
                </div>

                {error && <div className="mt-4 text-center text-red-500 bg-red-500/10 p-3 rounded-lg">{error}</div>}

                {!capturedImage && (
                    <button onClick={handleCapture} className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                        <CameraIcon className="w-5 h-5" /> Capture Plate
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
                             <button onClick={resetState} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">
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
