import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check } from 'lucide-react';

interface ImagePickerProps {
    value?: string;
    onChange: (value: string) => void;
    label: string;
}

const ImagePicker: React.FC<ImagePickerProps> = ({ value, onChange, label }) => {
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraOpen(true);
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                onChange(dataUrl);
                stopCamera();
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onChange(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            
            <div className="flex flex-wrap gap-4 items-start">
                {/* Preview */}
                <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                    {value ? (
                        <>
                            <img src={value} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button 
                                type="button"
                                onClick={() => onChange('')}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-sm"
                            >
                                <X size={14} />
                            </button>
                        </>
                    ) : (
                        <div className="text-gray-400 dark:text-gray-500 text-center p-2">
                            <Upload size={24} className="mx-auto mb-1" />
                            <span className="text-[10px]">No Image</span>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"
                    >
                        <Upload size={16} />
                        Browse Photo
                    </button>
                    <button
                        type="button"
                        onClick={startCamera}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"
                    >
                        <Camera size={16} />
                        Take Selfie
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                    />
                </div>
            </div>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden max-w-lg w-full shadow-2xl">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold dark:text-white">Take a Photo</h3>
                            <button onClick={stopCamera} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="relative aspect-video bg-black">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                            />
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                        <div className="p-6 flex justify-center gap-4">
                            <button 
                                onClick={takePhoto}
                                className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition shadow-lg active:scale-95"
                            >
                                <Camera size={32} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImagePicker;
