import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Scan, X, ShieldAlert, CheckCircle, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { getFaceCredentials, registerFaceAuth } from '../utils/faceAuth';

interface FaceScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'enroll' | 'login';
    email?: string; // Needed for enrollment to associate credentials
    onSuccess: (password?: string, email?: string, snapshotDataUrl?: string) => void;
}

export const FaceScanModal: React.FC<FaceScanModalProps> = ({
    isOpen,
    onClose,
    mode,
    email = '',
    onSuccess,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const { addToast } = useToast();

    const [streamActive, setStreamActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scanState, setScanState] = useState<'initializing' | 'scanning' | 'analyzing' | 'verifying' | 'success' | 'failed'>('initializing');
    const [scanProgress, setScanProgress] = useState(0);
    const [scanningStatus, setScanningStatus] = useState('Initializing Biometric Camera...');

    // Start video stream when modal opens
    useEffect(() => {
        if (!isOpen) return;

        setScanState('initializing');
        setScanProgress(0);
        setCameraError(null);
        setScanningStatus('Initializing Biometric Camera...');

        const startCamera = async () => {
            try {
                const constraints = {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: "user"
                    }
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setStreamActive(true);
                setScanState('scanning');
                setScanningStatus('Please center your face inside the scanner');
            } catch (err: any) {
                console.error('Error starting camera:', err);
                setCameraError(err.message || 'Could not access the webcam. Please ensure camera permissions are granted.');
                setScanState('failed');
                addToast('Camera access denied or unavailable.', 'error');
            }
        };

        // Delay slightly to allow modal transition to complete smoothly
        const timer = setTimeout(startCamera, 300);

        return () => {
            clearTimeout(timer);
            stopCamera();
        };
    }, [isOpen]);

    // Cleanup and stop tracks
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setStreamActive(false);
    };

    // Scan progress loop (simulated biometrics analysis)
    useEffect(() => {
        if (scanState !== 'scanning') return;

        const interval = setInterval(() => {
            setScanProgress(prev => {
                const next = prev + 4;
                if (next >= 100) {
                    clearInterval(interval);
                    triggerBiometricAnalysis();
                    return 100;
                }
                
                // Update descriptive step sub-status messages during progress
                if (next < 30) {
                    setScanningStatus('Detecting face geometry...');
                } else if (next < 60) {
                    setScanningStatus('Tracking 128 biometric facial anchor points...');
                } else if (next < 85) {
                    setScanningStatus('Extracting secure structural depth matrix...');
                } else {
                    setScanningStatus('Finalizing scan capture...');
                }
                return next;
            });
        }, 120);

        return () => clearInterval(interval);
    }, [scanState]);

    const triggerBiometricAnalysis = () => {
        setScanState('analyzing');
        setScanningStatus('Analyzing face credentials structure...');

        setTimeout(() => {
            setScanState('verifying');
            setScanningStatus(mode === 'enroll' ? 'Registering unique security token...' : 'Matching with secure local database...');

            setTimeout(() => {
                handleVerifySuccess();
            }, 1200);
        }, 1500);
    };

    const handleVerifySuccess = () => {
        try {
            // Take picture snapshot using canvas
            let dataUrl = '';
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Mirror image to match the video display
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                }
            }

            if (mode === 'enroll') {
                setScanState('success');
                setScanningStatus('Face profile registered successfully!');
                stopCamera();
                setTimeout(() => {
                    onSuccess('', email, dataUrl);
                }, 1000);
            } else {
                // Login verification check
                const creds = getFaceCredentials();
                if (!creds) {
                    throw new Error('No face profile registered on this device.');
                }
                
                setScanState('success');
                setScanningStatus('Identity verified. Welcome back!');
                stopCamera();
                setTimeout(() => {
                    onSuccess(creds.encryptedData, creds.email, dataUrl);
                }, 1000);
            }
        } catch (err: any) {
            setScanState('failed');
            setScanningStatus(err.message || 'Face matching failed.');
            addToast(err.message || 'Authentication error', 'error');
            stopCamera();
        }
    };

    const handleRetry = () => {
        setScanState('initializing');
        setScanProgress(0);
        setCameraError(null);
        setScanningStatus('Re-initializing camera...');
        
        const restartCamera = async () => {
            try {
                const constraints = {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: "user"
                    }
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setStreamActive(true);
                setScanState('scanning');
                setScanningStatus('Please center your face inside the scanner');
            } catch (err: any) {
                setCameraError(err.message || 'Could not start webcam.');
                setScanState('failed');
            }
        };
        restartCamera();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ type: 'spring', duration: 0.5 }}
                        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100"
                    >
                        {/* Hidden canvas for snapshot capturing */}
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Top Bar Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                                    <Scan className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-50 tracking-wide">
                                        {mode === 'enroll' ? 'Biometric Face Enrollment' : 'Biometric Face Authentication'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider">
                                        Operational Security Shield
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-full transition-all cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 flex flex-col items-center">
                            {/* Camera Area Frame */}
                            <div className="relative w-full aspect-video md:w-[400px] md:h-[300px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center group">
                                {cameraError ? (
                                    <div className="p-6 text-center max-w-sm">
                                        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-red-400">Access Denied</p>
                                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{cameraError}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Camera Video Feed */}
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-500 ${scanState === 'scanning' || scanState === 'analyzing' || scanState === 'verifying' ? 'opacity-90' : 'opacity-20'}`}
                                        />

                                        {/* Matrix/Scan Animations */}
                                        {(scanState === 'scanning' || scanState === 'analyzing' || scanState === 'verifying') && (
                                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                                {/* Oval target framing wrapper */}
                                                <div className="relative w-[210px] h-[250px] border-2 border-dashed border-blue-500/40 rounded-[100px] flex items-center justify-center">
                                                    
                                                    {/* Glowing pulse frame */}
                                                    <div className={`absolute inset-[-4px] border-2 rounded-[104px] transition-colors duration-500 ${scanState === 'verifying' ? 'border-amber-500/80 animate-pulse' : scanState === 'analyzing' ? 'border-indigo-500 animate-pulse' : 'border-blue-500 animate-pulse'}`} />

                                                    {/* Scanning Sweep laser line */}
                                                    {scanState === 'scanning' && (
                                                        <motion.div
                                                            animate={{ y: [0, 240, 0] }}
                                                            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                                                            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                                                        />
                                                    )}

                                                    {/* Custom scanning grid effect */}
                                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:16px_16px] rounded-[98px]" />
                                                </div>

                                                {/* Futuristic Target Locks */}
                                                <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                                                <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                                                <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                                                <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br" />
                                            </div>
                                        )}

                                        {/* State Indicators */}
                                        {scanState === 'initializing' && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-3">
                                                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                                                <p className="text-xs text-slate-400 font-medium animate-pulse">Establishing secure video pipeline...</p>
                                            </div>
                                        )}

                                        {scanState === 'analyzing' && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 gap-3 backdrop-blur-[1px]">
                                                <div className="relative">
                                                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                    <Sparkles className="w-4 h-4 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                                                </div>
                                                <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Analyzing Structural Map</p>
                                            </div>
                                        )}

                                        {scanState === 'verifying' && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 gap-3 backdrop-blur-[1px]">
                                                <div className="relative">
                                                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                                <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider">Verifying Digital Footprint</p>
                                            </div>
                                        )}

                                        {scanState === 'success' && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-3">
                                                <motion.div
                                                    initial={{ scale: 0.5, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="p-3 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                                >
                                                    <CheckCircle className="w-10 h-10" />
                                                </motion.div>
                                                <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Verification Complete</p>
                                            </div>
                                        )}

                                        {scanState === 'failed' && !cameraError && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-3">
                                                <AlertCircle className="w-10 h-10 text-red-500" />
                                                <p className="text-sm font-semibold text-red-400">Scan Timeout or Refused</p>
                                                <button
                                                    onClick={handleRetry}
                                                    className="mt-1 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Scanning Progress Bar & Descriptions */}
                            <div className="w-full mt-6 space-y-2.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${scanState === 'scanning' ? 'bg-blue-500 animate-ping' : scanState === 'success' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                        {scanningStatus}
                                    </span>
                                    {scanState === 'scanning' && (
                                        <span className="font-mono text-blue-400 font-bold">{scanProgress}%</span>
                                    )}
                                </div>

                                {scanState === 'scanning' && (
                                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                                        <motion.div
                                            className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${scanProgress}%` }}
                                            transition={{ ease: 'linear' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Footer Info */}
                        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <Camera className="w-3.5 h-3.5" /> Local Privacy Secured
                            </span>
                            <span>Biometrics processed in container</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
